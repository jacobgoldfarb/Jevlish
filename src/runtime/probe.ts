import type { ChoiceCriteria, EntryType, Questions } from "@typesafe-ai/sdk";
import { choice, noul } from "@typesafe-ai/sdk";
import { SenseError } from "../errors.js";
import type { Condition, SemanticCondition } from "../expressions/condition.js";
import type { Scale } from "../expressions/scale.js";
import type { Answer, EvidenceLog, Truth } from "../judgment.js";
import * as logic from "../logic.js";
import type { AcceptancePolicy } from "../policy.js";
import { truthOf } from "../policy.js";
import { stableStringify } from "../state.js";

/** An expression tree after code predicates have been folded away. */
export type Reduced =
  | SemanticCondition
  | { readonly type: "const"; readonly value: boolean }
  | { readonly type: "and"; readonly left: Reduced; readonly right: Reduced }
  | { readonly type: "or"; readonly left: Reduced; readonly right: Reduced }
  | { readonly type: "not"; readonly inner: Reduced };

/** A condition bound to a probe: its reduced tree and the question id of each leaf. */
export interface Bound {
  readonly reduced: Reduced;
  readonly ids: ReadonlyMap<SemanticCondition, string>;
}

export interface ScoreReading {
  readonly score: number;
  readonly normalized: number;
  readonly level: number;
  readonly levelDescription: EntryType;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
  readonly accepted: boolean;
}

export interface ChoiceReading {
  readonly choice: string;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
  readonly accepted: boolean;
}

/**
 * Compiles everything to be asked about one state into a single question set.
 *
 * 1. Code predicates run first and fold the tree (a false code leaf under AND
 *    means nothing is sent for that branch).
 * 2. Remaining semantic leaves become Noul questions, deduplicated by content.
 * 3. After answers arrive, the tree is folded with three-valued logic and each
 *    contributing judgment is recorded.
 */
export class Probe<T> {
  readonly questions: Questions = {};
  private readonly idsByKey = new Map<string, string>();
  private readonly recorded = new Set<string>();
  private counter = 0;

  constructor(
    readonly subject: T,
    readonly state: EntryType,
    readonly log: EvidenceLog,
  ) {}

  get needsInference(): boolean {
    return this.counter > 0;
  }

  get questionCount(): number {
    return this.counter;
  }

  bind(node: Condition<T>): Bound {
    const reduced = this.reduce(node);
    const ids = new Map<SemanticCondition, string>();
    this.collect(reduced, ids);
    return { reduced, ids };
  }

  addScore(scale: Scale<unknown>): string {
    const id = this.nextId();
    this.questions[id] = scale.toQuestion();
    return id;
  }

  addChoice(instructions: EntryType, criteria: ChoiceCriteria): string {
    const id = this.nextId();
    this.questions[id] = choice(instructions, criteria);
    return id;
  }

  /** Fold a bound condition over the answers, recording each leaf judgment once. */
  resolve(bound: Bound, answers: Readonly<Record<string, Answer>>, policy: AcceptancePolicy): Truth {
    const visit = (node: Reduced): Truth => {
      switch (node.type) {
        case "const":
          return node.value;
        case "semantic": {
          const id = bound.ids.get(node);
          if (!id) throw new SenseError(`Unbound semantic leaf: "${node.proposition}"`);
          const answer = answers[id];
          if (!answer || answer.type !== "noul") {
            throw new SenseError(`Expected a noul answer for question ${id}.`);
          }
          const truth = truthOf(answer.noul, policy.noul);
          if (!this.recorded.has(id)) {
            this.recorded.add(id);
            const question = this.questions[id];
            this.log.judgments.push({
              kind: "noul",
              id,
              label: node.name ?? node.proposition,
              instructions: question?.instructions ?? node.proposition,
              probability: answer.noul,
              truth,
            });
          }
          return truth;
        }
        case "not":
          return logic.not(visit(node.inner));
        case "and":
          return logic.and(visit(node.left), visit(node.right));
        case "or":
          return logic.or(visit(node.left), visit(node.right));
      }
    };
    return visit(bound.reduced);
  }

  readScore(
    id: string,
    scale: Scale<unknown>,
    answers: Readonly<Record<string, Answer>>,
    policy: AcceptancePolicy,
  ): ScoreReading {
    const answer = answers[id];
    if (!answer || answer.type !== "score") throw new SenseError(`Expected a score answer for question ${id}.`);
    const accepted = answer.confidence >= policy.score.minConfidence;
    const level = Math.min(scale.top, Math.max(0, Math.round(answer.score)));
    this.log.judgments.push({
      kind: "score",
      id,
      label: scale.name ?? scale.question,
      instructions: scale.question,
      score: answer.score,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
      accepted,
    });
    return {
      score: answer.score,
      normalized: scale.top === 0 ? 0 : answer.score / scale.top,
      level,
      levelDescription: scale.levels[level] ?? null,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
      accepted,
    };
  }

  readChoice(
    id: string,
    label: string,
    answers: Readonly<Record<string, Answer>>,
    policy: AcceptancePolicy,
  ): ChoiceReading {
    const answer = answers[id];
    if (!answer || answer.type !== "choice") throw new SenseError(`Expected a choice answer for question ${id}.`);
    const accepted = answer.confidence >= policy.choice.minConfidence;
    this.log.judgments.push({
      kind: "choice",
      id,
      label,
      instructions: this.questions[id]?.instructions ?? label,
      choice: answer.choice,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
      accepted,
    });
    return { choice: answer.choice, confidence: answer.confidence, probabilities: answer.probabilities, accepted };
  }

  private reduce(node: Condition<T>): Reduced {
    switch (node.type) {
      case "semantic":
        return node;
      case "code": {
        const value = Boolean(node.predicate(this.subject));
        this.log.judgments.push({
          kind: "code",
          label: node.name ?? (node.predicate.name || "code predicate"),
          truth: value,
        });
        return { type: "const", value };
      }
      case "not": {
        const inner = this.reduce(node.inner);
        return inner.type === "const" ? { type: "const", value: !inner.value } : { type: "not", inner };
      }
      case "and": {
        const left = this.reduce(node.left);
        if (left.type === "const" && !left.value) return left;
        const right = this.reduce(node.right);
        if (right.type === "const" && !right.value) return right;
        if (left.type === "const") return right;
        if (right.type === "const") return left;
        return { type: "and", left, right };
      }
      case "or": {
        const left = this.reduce(node.left);
        if (left.type === "const" && left.value) return left;
        const right = this.reduce(node.right);
        if (right.type === "const" && right.value) return right;
        if (left.type === "const") return right;
        if (right.type === "const") return left;
        return { type: "or", left, right };
      }
    }
  }

  private collect(node: Reduced, ids: Map<SemanticCondition, string>): void {
    switch (node.type) {
      case "const":
        return;
      case "semantic": {
        const instructions = node.proposition;
        const criteria =
          node.yes !== undefined || node.no !== undefined
            ? {
                ...(node.yes !== undefined ? { true: node.yes } : {}),
                ...(node.no !== undefined ? { false: node.no } : {}),
              }
            : undefined;
        const key = stableStringify({ instructions, criteria });
        let id = this.idsByKey.get(key);
        if (!id) {
          id = this.nextId();
          this.idsByKey.set(key, id);
          this.questions[id] = noul(instructions, criteria);
        }
        ids.set(node, id);
        return;
      }
      case "not":
        this.collect(node.inner, ids);
        return;
      case "and":
      case "or":
        this.collect(node.left, ids);
        this.collect(node.right, ids);
        return;
    }
  }

  private nextId(): string {
    this.counter += 1;
    return `q${this.counter}`;
  }
}

/** Does the reduced tree still need the model? */
export function isConstant(reduced: Reduced): reduced is Extract<Reduced, { type: "const" }> {
  return reduced.type === "const";
}
