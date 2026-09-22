import { SenseError } from "../errors.js";
import { type Condition, type ConditionLike, describeCondition, toCondition } from "../expressions/condition.js";
import type { Scale } from "../expressions/scale.js";
import { type Evidence, EvidenceLog, type Truth } from "../judgment.js";
import { type AcceptancePolicy, type PartialPolicy, resolvePolicy } from "../policy.js";
import { type Plan, planFor } from "../runtime/plan.js";
import { type Bound, Probe } from "../runtime/probe.js";
import type { Runtime } from "../runtime/runtime.js";
import { toState } from "../state.js";
import type { Projection } from "./subject.js";

export type RankOrder = "highest first" | "lowest first";

export interface QueryResult<T> {
  /** Accepted items, in ranked order when a scale was given, otherwise in input order. */
  readonly items: readonly T[];
  /** Items whose filtering or ranking judgment did not meet the policy. Not rejected; unresolved. */
  readonly uncertain: readonly T[];
  /** Items the condition resolved to false. */
  readonly rejected: readonly T[];
  /** Accepted items with their scale position, when ranked. */
  readonly scored?: ReadonlyArray<{ readonly item: T; readonly score: number; readonly normalized: number }>;
  readonly evidence: Evidence;
}

/** Entry point: `from(items)`. */
export class From<T> {
  constructor(
    private readonly runtime: Runtime,
    private readonly items: readonly T[],
    private readonly projection: Projection<T> | undefined = undefined,
    private readonly policy: PartialPolicy | undefined = undefined,
  ) {}

  /** Send only these fields of each item. Code predicates still see whole items. */
  describedBy(projection: Projection<T>): From<T> {
    return new From(this.runtime, this.items, projection, this.policy);
  }

  withPolicy(policy: PartialPolicy): From<T> {
    return new From(this.runtime, this.items, this.projection, policy);
  }

  where(condition: ConditionLike<T>): Query<T> {
    return new Query(this.runtime, this.items, this.projection, this.resolvedPolicy(), toCondition(condition));
  }

  rankedBy(scale: Scale<T>, order: RankOrder = "highest first"): Query<T> {
    return new Query(this.runtime, this.items, this.projection, this.resolvedPolicy(), undefined, {
      scale: scale as Scale<unknown>,
      order,
    });
  }

  private resolvedPolicy(): AcceptancePolicy {
    return resolvePolicy(this.runtime.policy, this.policy);
  }
}

interface Ranking {
  readonly scale: Scale<unknown>;
  readonly order: RankOrder;
}

interface ItemProbe<T> {
  readonly item: T;
  readonly probe: Probe<T>;
  readonly bound: Bound | undefined;
  readonly scoreId: string | undefined;
}

/** `from(items).where(...)` — filter, rank, and limit. The model judges; the runtime sorts. */
export class Query<T> {
  constructor(
    private readonly runtime: Runtime,
    private readonly items: readonly T[],
    private readonly projection: Projection<T> | undefined,
    private readonly policy: AcceptancePolicy,
    private readonly condition: Condition<T> | undefined,
    private readonly ranking: Ranking | undefined = undefined,
    private readonly limit: number | undefined = undefined,
  ) {}

  and(condition: ConditionLike<T>): Query<T> {
    return this.withCondition(
      this.condition
        ? { type: "and", left: this.condition, right: toCondition(condition) }
        : toCondition(condition),
    );
  }

  or(condition: ConditionLike<T>): Query<T> {
    if (!this.condition) throw new SenseError(".or() needs a preceding .where().");
    return this.withCondition({ type: "or", left: this.condition, right: toCondition(condition) });
  }

  unless(condition: ConditionLike<T>): Query<T> {
    const negated: Condition<T> = { type: "not", inner: toCondition(condition) };
    return this.withCondition(this.condition ? { type: "and", left: this.condition, right: negated } : negated);
  }

  /** Each accepted item is scored once; ordering is then an ordinary sort. */
  rankedBy(scale: Scale<T>, order: RankOrder = "highest first"): Query<T> {
    return new Query(this.runtime, this.items, this.projection, this.policy, this.condition, {
      scale: scale as Scale<unknown>,
      order,
    }, this.limit);
  }

  take(count: number): Query<T> {
    if (!Number.isInteger(count) || count < 0) throw new SenseError("take() needs a non-negative integer.");
    return new Query(this.runtime, this.items, this.projection, this.policy, this.condition, this.ranking, count);
  }

  plan(): Plan {
    const log = new EvidenceLog(this.policy);
    const probes = this.items.map((item) => this.prepare(item, log).probe);
    return planFor(this.runtime, probes as Probe<unknown>[], this.notes());
  }

  async run(): Promise<QueryResult<T>> {
    const log = new EvidenceLog(this.policy);
    const prepared = this.items.map((item) => this.prepare(item, log));

    const outcomes = await Promise.all(
      prepared.map(async ({ item, probe, bound, scoreId }) => {
        const answers = probe.needsInference ? await this.runtime.ask(probe.state, probe.questions, log) : {};
        const truth: Truth = bound ? probe.resolve(bound, answers, this.policy) : true;
        if (truth !== true) return { item, truth, score: undefined };
        if (!scoreId || !this.ranking) return { item, truth, score: undefined };
        const reading = probe.readScore(scoreId, this.ranking.scale, answers, this.policy);
        return reading.accepted
          ? { item, truth, score: reading }
          : { item, truth: "uncertain" as Truth, score: undefined };
      }),
    );

    const accepted = outcomes.filter((outcome) => outcome.truth === true);
    const uncertain = outcomes.filter((outcome) => outcome.truth === "uncertain").map((outcome) => outcome.item);
    const rejected = outcomes.filter((outcome) => outcome.truth === false).map((outcome) => outcome.item);

    if (this.ranking) {
      const direction = this.ranking.order === "highest first" ? -1 : 1;
      accepted.sort((a, b) => direction * ((a.score?.score ?? 0) - (b.score?.score ?? 0)));
    }
    const limited = this.limit === undefined ? accepted : accepted.slice(0, this.limit);

    return {
      items: limited.map((outcome) => outcome.item),
      uncertain,
      rejected,
      ...(this.ranking
        ? {
            scored: limited.map((outcome) => ({
              item: outcome.item,
              score: outcome.score?.score ?? 0,
              normalized: outcome.score?.normalized ?? 0,
            })),
          }
        : {}),
      evidence: log.toEvidence(),
    };
  }

  private prepare(item: T, log: EvidenceLog): ItemProbe<T> {
    const probe = new Probe(item, toState(this.projection ? this.projection(item) : item), log);
    const bound = this.condition ? probe.bind(this.condition) : undefined;
    const filteredOutByCode = bound?.reduced.type === "const" && bound.reduced.value === false;
    const scoreId = this.ranking && !filteredOutByCode ? probe.addScore(this.ranking.scale) : undefined;
    return { item, probe, bound, scoreId };
  }

  private withCondition(condition: Condition<T>): Query<T> {
    return new Query(this.runtime, this.items, this.projection, this.policy, condition, this.ranking, this.limit);
  }

  private notes(): string[] {
    const notes: string[] = [];
    if (this.condition) notes.push(`filter: ${describeCondition(this.condition)}`);
    if (this.ranking) notes.push(`ranked by "${this.ranking.scale.question}", ${this.ranking.order}`);
    if (this.limit !== undefined) notes.push(`take ${this.limit}`);
    return notes;
  }
}
