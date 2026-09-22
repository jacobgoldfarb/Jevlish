import type { EntryType } from "@typesafe-ai/sdk";
import { SenseError } from "../errors.js";
import { type Condition, type ConditionLike, Meaning, toCondition } from "../expressions/condition.js";
import { Scale } from "../expressions/scale.js";
import { Selection, compileSelection, resolveSelection } from "../expressions/selection.js";
import { type Answer, type Evidence, type Judgment, EvidenceLog, decided, uncertain } from "../judgment.js";
import type { AcceptancePolicy } from "../policy.js";
import { type Plan, planFor } from "../runtime/plan.js";
import { Probe, type ScoreReading } from "../runtime/probe.js";
import type { SubjectContext } from "./subject.js";

/** Where a subject sits on a scale, once the judgment is decided. */
export interface Measurement {
  readonly score: number;
  readonly normalized: number;
  readonly level: number;
  readonly levelDescription: EntryType;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
}

/** Anything you can ask about a subject: a condition, a scale, or a selection. */
// biome-ignore lint/suspicious/noExplicitAny: Selection is contravariant in its candidate type; `any` accepts every instantiation.
export type Askable<T> = ConditionLike<T> | Scale<T> | Selection<any, any>;

/** The typed answers of `ask()`: each key gets the Judgment its question produces. */
export type Asked<T, Q extends Record<string, Askable<T>>> = {
  readonly [K in keyof Q]: Q[K] extends Scale<infer _S>
    ? Judgment<Measurement>
    : Q[K] extends Selection<infer C, infer None>
      ? Judgment<C | None>
      : Judgment<boolean>;
};

type Pending = { status: "decided"; value: unknown } | { status: "uncertain" };
type Reader = (answers: Readonly<Record<string, Answer>>) => Pending;

const decidedPending = (value: unknown): Pending => ({ status: "decided", value });
const uncertainPending: Pending = { status: "uncertain" };

function toJudgment(pending: Pending, evidence: Evidence): Judgment<unknown> {
  return pending.status === "decided" ? decided(pending.value, evidence) : uncertain(evidence);
}

function recordEveryLeaf(
  readers: ReadonlyArray<readonly [string, Reader]>,
  answers: Readonly<Record<string, Answer>>,
): Array<readonly [string, Pending]> {
  return readers.map(([key, read]) => [key, read(answers)] as const);
}

function judgmentsSharing(
  outcomes: ReadonlyArray<readonly [string, Pending]>,
  evidence: Evidence,
): Record<string, Judgment<unknown>> {
  const judgments: Record<string, Judgment<unknown>> = {};
  for (const [key, pending] of outcomes) judgments[key] = toJudgment(pending, evidence);
  return judgments;
}

function isConditionLike<T>(question: unknown): question is ConditionLike<T> {
  return typeof question === "string" || typeof question === "function" || question instanceof Meaning;
}

function compileAskable<T>(probe: Probe<T>, question: Askable<T>, policy: AcceptancePolicy): Reader {
  if (question instanceof Scale) return compileScale(probe, question, policy);
  if (question instanceof Selection) return compileChoice(probe, question, policy);
  if (isConditionLike<T>(question)) return compileCondition(probe, toCondition(question), policy);
  throw new SenseError("ask() takes a condition, a scale, or chooseFrom(...).by(...).");
}

function measurementOf(reading: ScoreReading): Measurement {
  return {
    score: reading.score,
    normalized: reading.normalized,
    level: reading.level,
    levelDescription: reading.levelDescription,
    confidence: reading.confidence,
    probabilities: reading.probabilities,
  };
}

function compileScale<T>(probe: Probe<T>, scale: Scale<T>, policy: AcceptancePolicy): Reader {
  const id = probe.addScore(scale as Scale<unknown>);
  return (answers) => {
    const reading = probe.readScore(id, scale as Scale<unknown>, answers, policy);
    return reading.accepted ? decidedPending(measurementOf(reading)) : uncertainPending;
  };
}

function compileChoice<T>(probe: Probe<T>, selection: Selection<unknown, unknown>, policy: AcceptancePolicy): Reader {
  const { criteria, byOption } = compileSelection(selection);
  const id = probe.addChoice(selection.criterion, criteria);
  return (answers) => {
    const reading = probe.readChoice(id, selection.criterion, answers, policy);
    return reading.accepted ? decidedPending(resolveSelection(selection, reading.choice, byOption)) : uncertainPending;
  };
}

function compileCondition<T>(probe: Probe<T>, condition: Condition<T>, policy: AcceptancePolicy): Reader {
  const bound = probe.bind(condition);
  return (answers) => {
    const truth = probe.resolve(bound, answers, policy);
    return truth === "uncertain" ? uncertainPending : decidedPending(truth);
  };
}

function soleQuestion<T>(ctx: SubjectContext<T>, question: Askable<T>): Ask<T, { value: Askable<T> }> {
  return new Ask(ctx, { value: question });
}

export async function askOne<T, V>(ctx: SubjectContext<T>, question: Askable<T>): Promise<Judgment<V>> {
  const { value } = await soleQuestion(ctx, question).run();
  return value as Judgment<V>;
}

export function planOne<T>(ctx: SubjectContext<T>, question: Askable<T>): Plan {
  return soleQuestion(ctx, question).plan();
}

/**
 * `given(x).ask({ ... })` — several independent judgments about one subject,
 * in one request. Conditions still fold code first; scales become Scores;
 * selections become Choices. Every answer shares the same evidence.
 */
export class Ask<T, Q extends Record<string, Askable<T>>> {
  constructor(
    private readonly ctx: SubjectContext<T>,
    private readonly questions: Q,
  ) {
    if (Object.keys(questions).length === 0) throw new SenseError("ask() needs at least one question.");
  }

  plan(): Plan {
    const { probe } = this.prepare();
    return planFor(this.ctx.runtime, [probe]);
  }

  async run(): Promise<Asked<T, Q>> {
    const { log, probe, readers } = this.prepare();
    const answers = probe.needsInference ? await this.ctx.runtime.ask(probe.state, probe.questions, log) : {};
    const outcomes = recordEveryLeaf(readers, answers);
    return judgmentsSharing(outcomes, log.toEvidence()) as Asked<T, Q>;
  }

  private prepare(): { log: EvidenceLog; probe: Probe<T>; readers: Array<[string, Reader]> } {
    const log = new EvidenceLog(this.ctx.policy);
    const probe = new Probe(this.ctx.subject, this.ctx.state, log);
    const readers = Object.entries(this.questions).map(
      ([key, question]) => [key, compileAskable(probe, question, this.ctx.policy)] as [string, Reader],
    );
    return { log, probe, readers };
  }
}
