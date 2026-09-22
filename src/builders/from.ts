import { SenseError } from "../errors.js";
import { type Condition, type ConditionLike, conjoin, describeCondition, disjoin, toCondition, without } from "../expressions/condition.js";
import type { Scale } from "../expressions/scale.js";
import { type Evidence, EvidenceLog, type Truth } from "../judgment.js";
import { type AcceptancePolicy, type PartialPolicy, resolvePolicy } from "../policy.js";
import { type Plan, planFor } from "../runtime/plan.js";
import { type Bound, Probe, type ScoreReading } from "../runtime/probe.js";
import type { Runtime } from "../runtime/runtime.js";
import { type Projection, contextFor } from "./subject.js";

/** Sort direction for `rankedBy`. */
export type RankOrder = "highest first" | "lowest first";

/** `from(items).where(...)` — every item lands in exactly one bucket. */
export interface QueryResult<T> {
  /** Items the condition resolved to true, in ranked order when a scale was given, otherwise in input order. */
  readonly accepted: readonly T[];
  /** Items whose filtering or ranking judgment did not meet the policy. Not rejected; unresolved. */
  readonly uncertain: readonly T[];
  /** Items the condition resolved to false. */
  readonly rejected: readonly T[];
  readonly evidence: Evidence;
}

/** `from(items).rankedBy(...)` — the same buckets, plus each accepted item's place on the scale. */
export interface RankedQueryResult<T> extends QueryResult<T> {
  readonly scored: ReadonlyArray<{ readonly item: T; readonly score: number; readonly normalized: number }>;
}

type RunResult<T, Ranked extends boolean> = Ranked extends true ? RankedQueryResult<T> : QueryResult<T>;

/** Entry point: `from(items)`. */
export class From<T> {
  constructor(
    private readonly runtime: Runtime,
    private readonly items: readonly T[],
    private readonly projection: Projection<T> | undefined = undefined,
    private readonly policy: PartialPolicy | undefined = undefined,
  ) {}

  /** What the model sees of each item. Code predicates still receive whole items. */
  seenAs(projection: Projection<T>): From<T> {
    return new From(this.runtime, this.items, projection, this.policy);
  }

  /** Override acceptance thresholds for this query. */
  withPolicy(policy: PartialPolicy): From<T> {
    const current = resolvePolicy(this.runtime.policy, this.policy);
    return new From(this.runtime, this.items, this.projection, resolvePolicy(current, policy));
  }

  /** Keep the items for which the condition holds. Refine with `.and()`, `.or()`, `.unless()`. */
  where(condition: ConditionLike<T>): Query<T> {
    return new Query(this.runtime, this.items, this.projection, this.resolvedPolicy(), {
      condition: toCondition(condition),
    });
  }

  /** Score every item on the scale and order by it, with no filter. */
  rankedBy(scale: Scale<T>, order: RankOrder = "highest first"): Query<T, true> {
    return new Query<T, true>(this.runtime, this.items, this.projection, this.resolvedPolicy(), {
      ranking: { scale: scale as Scale<unknown>, order },
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

interface QueryState<T> {
  readonly condition?: Condition<T>;
  readonly ranking?: Ranking;
  readonly limit?: number;
}

interface ItemProbe<T> {
  readonly item: T;
  readonly probe: Probe<T>;
  readonly bound: Bound | undefined;
  readonly scoreId: string | undefined;
}

interface ItemVerdict<T> {
  readonly item: T;
  readonly truth: Truth;
  readonly score?: ScoreReading;
}

interface Partitioned<T> {
  readonly accepted: ItemVerdict<T>[];
  readonly uncertain: readonly T[];
  readonly rejected: readonly T[];
}

/** `from(items).where(...)` — filter, rank, and limit. The model judges; the runtime sorts. */
export class Query<T, Ranked extends boolean = false> implements PromiseLike<RunResult<T, Ranked>> {
  constructor(
    private readonly runtime: Runtime,
    private readonly items: readonly T[],
    private readonly projection: Projection<T> | undefined,
    private readonly policy: AcceptancePolicy,
    private readonly state: QueryState<T> = {},
  ) {}

  /** Override acceptance thresholds for this query. */
  withPolicy(policy: PartialPolicy): Query<T, Ranked> {
    return new Query(this.runtime, this.items, this.projection, resolvePolicy(this.policy, policy), this.state);
  }

  /** Both must hold. A false code predicate drops the item without a request. */
  and(condition: ConditionLike<T>): Query<T, Ranked> {
    if (!this.state.condition) throw new SenseError(".and() needs a preceding .where().");
    return this.copy({ condition: conjoin(this.state.condition, condition) });
  }

  /** Either may hold. */
  or(condition: ConditionLike<T>): Query<T, Ranked> {
    if (!this.state.condition) throw new SenseError(".or() needs a preceding .where().");
    return this.copy({ condition: disjoin(this.state.condition, condition) });
  }

  /** Holds only if the exception does not: `where(a).unless(b)` keeps items where `a and not b`. */
  unless(condition: ConditionLike<T>): Query<T, Ranked> {
    if (!this.state.condition) throw new SenseError(".unless() needs a preceding .where().");
    return this.copy({ condition: without(this.state.condition, condition) });
  }

  /** Each accepted item is scored once; ordering is then an ordinary sort. */
  rankedBy(scale: Scale<T>, order: RankOrder = "highest first"): Query<T, true> {
    return new Query<T, true>(this.runtime, this.items, this.projection, this.policy, {
      ...this.state,
      ranking: { scale: scale as Scale<unknown>, order },
    });
  }

  /** Keep at most `count` accepted items, after ranking. Runs locally; every item is still judged. */
  take(count: number): Query<T, Ranked> {
    if (!Number.isInteger(count) || count < 0) throw new SenseError("take() needs a non-negative integer.");
    return this.copy({ limit: count });
  }

  /** What would be sent, without sending it. Includes how many items code alone settled. */
  plan(): Plan {
    const log = new EvidenceLog(this.policy);
    const probes = this.items.map((item) => this.prepare(item, log).probe);
    return planFor(this.runtime, probes as Probe<unknown>[], this.notes());
  }

  /** Judge every item, then partition, sort, and limit. Equivalent to awaiting the query. */
  async run(): Promise<RunResult<T, Ranked>> {
    const log = new EvidenceLog(this.policy);
    const prepared = this.items.map((item) => this.prepare(item, log));
    const verdicts = await Promise.all(prepared.map((entry) => this.judgeItem(entry, log)));
    return this.toResult(orderByScale(partition(verdicts), this.state.ranking), log);
  }

  /** Awaiting the query runs it. */
  then<R1 = RunResult<T, Ranked>, R2 = never>(
    onfulfilled?: ((value: RunResult<T, Ranked>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }

  private async judgeItem(entry: ItemProbe<T>, log: EvidenceLog): Promise<ItemVerdict<T>> {
    const answers = entry.probe.needsInference ? await this.runtime.ask(entry.probe.state, entry.probe.questions, log) : {};
    const truth: Truth = entry.bound ? entry.probe.resolve(entry.bound, answers, this.policy) : true;
    if (truth !== true) return { item: entry.item, truth };
    if (!this.state.ranking || !entry.scoreId) return { item: entry.item, truth };
    const reading = entry.probe.readScore(entry.scoreId, this.state.ranking.scale, answers, this.policy);
    if (!reading.accepted) return { item: entry.item, truth: "uncertain" };
    return { item: entry.item, truth, score: reading };
  }

  private prepare(item: T, log: EvidenceLog): ItemProbe<T> {
    const ctx = contextFor(this.runtime, item, this.projection, this.policy);
    const probe = new Probe(ctx.subject, ctx.state, log);
    const bound = this.state.condition ? probe.bind(this.state.condition) : undefined;
    const filteredOutByCode = bound?.reduced.type === "const" && bound.reduced.value === false;
    const scoreId = this.state.ranking && !filteredOutByCode ? probe.addScore(this.state.ranking.scale) : undefined;
    return { item, probe, bound, scoreId };
  }

  private copy(patch: Partial<QueryState<T>>): Query<T, Ranked> {
    return new Query<T, Ranked>(this.runtime, this.items, this.projection, this.policy, { ...this.state, ...patch });
  }

  private toResult(groups: Partitioned<T>, log: EvidenceLog): RunResult<T, Ranked> {
    const limited = this.state.limit === undefined ? groups.accepted : groups.accepted.slice(0, this.state.limit);
    const result: QueryResult<T> = {
      accepted: limited.map((verdict) => verdict.item),
      uncertain: groups.uncertain,
      rejected: groups.rejected,
      evidence: log.toEvidence(),
    };
    if (!this.state.ranking) return result as RunResult<T, Ranked>;
    const ranked: RankedQueryResult<T> = { ...result, scored: limited.map((verdict) => placed(verdict)) };
    return ranked as RunResult<T, Ranked>;
  }

  private notes(): string[] {
    const notes: string[] = [];
    if (this.state.condition) notes.push(`filter: ${describeCondition(this.state.condition)}`);
    if (this.state.ranking) notes.push(`ranked by "${this.state.ranking.scale.question}", ${this.state.ranking.order}`);
    if (this.state.limit !== undefined) notes.push(`take ${this.state.limit}`);
    return notes;
  }
}

function partition<T>(verdicts: readonly ItemVerdict<T>[]): Partitioned<T> {
  const accepted: ItemVerdict<T>[] = [];
  const uncertain: T[] = [];
  const rejected: T[] = [];
  for (const verdict of verdicts) {
    if (verdict.truth === true) accepted.push(verdict);
    else if (verdict.truth === "uncertain") uncertain.push(verdict.item);
    else rejected.push(verdict.item);
  }
  return { accepted, uncertain, rejected };
}

function orderByScale<T>(groups: Partitioned<T>, ranking: Ranking | undefined): Partitioned<T> {
  if (!ranking) return groups;
  const direction = ranking.order === "highest first" ? -1 : 1;
  const accepted = [...groups.accepted].sort((a, b) => direction * (scoreOf(a) - scoreOf(b)));
  return { ...groups, accepted };
}

function scoreOf<T>(verdict: ItemVerdict<T>): number {
  if (!verdict.score) throw new SenseError("A ranked item is missing its score.");
  return verdict.score.score;
}

function placed<T>(verdict: ItemVerdict<T>): { item: T; score: number; normalized: number } {
  if (!verdict.score) throw new SenseError("A ranked item is missing its score.");
  return { item: verdict.item, score: verdict.score.score, normalized: verdict.score.normalized };
}
