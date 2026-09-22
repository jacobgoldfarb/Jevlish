import type { EntryType } from "@typesafe-ai/sdk";
import { type Condition, type ConditionLike, conjoin, disjoin, toCondition, without } from "../expressions/condition.js";
import type { Scale } from "../expressions/scale.js";
import { type Candidates, type Selection, chooseFrom as chooseAmong } from "../expressions/selection.js";
import type { Judgment } from "../judgment.js";
import { type PartialPolicy, resolvePolicy } from "../policy.js";
import { type Plan, planFor } from "../runtime/plan.js";
import type { Runtime } from "../runtime/runtime.js";
import { Ask, type Askable, askOne, planOne } from "./ask.js";
import { Measure } from "./measure.js";
import { type Projection, type SubjectContext, contextFor, judge, prepare } from "./subject.js";

/** A callback chosen by a judgment. It receives the subject and the judgment that selected it. */
export type Action<T, R> = (subject: T, judgment: Judgment<boolean>) => R | Promise<R>;

export type BranchTaken = "do" | "otherwise" | "uncertain";

export interface Decision<R> {
  readonly branch: BranchTaken;
  readonly result: R;
  readonly judgment: Judgment<boolean>;
}

/** Entry point: `given(subject)`. */
export class Given<T> {
  constructor(
    private readonly runtime: Runtime,
    private readonly subject: T,
    private readonly projection: Projection<T> | undefined = undefined,
    private readonly policy: PartialPolicy | undefined = undefined,
  ) {}

  /** What the model sees. Code predicates and actions still receive the whole subject. */
  seenAs(projection: Projection<T>): Given<T> {
    return new Given(this.runtime, this.subject, projection, this.policy);
  }

  /** Override acceptance thresholds for this expression. */
  withPolicy(policy: PartialPolicy): Given<T> {
    return new Given(this.runtime, this.subject, this.projection, policy);
  }

  when(condition: ConditionLike<T>): Predicate<T> {
    return new Predicate(this.context(), toCondition(condition));
  }

  /** Select one of your own objects, by prose. */
  chooseFrom<C>(candidates: readonly C[]): ChooseCandidates<T, C> {
    return new ChooseCandidates(this.context(), chooseAmong(candidates));
  }

  /** Place the subject on a scale. */
  measure(scale: Scale<T>): Measure<T> {
    return new Measure(this.context(), scale);
  }

  /** Several independent judgments about this subject, in one request. */
  ask<const Q extends Record<string, Askable<T>>>(questions: Q): Ask<T, Q> {
    return new Ask(this.context(), questions);
  }

  private context(): SubjectContext<T> {
    return contextFor(
      this.runtime,
      this.subject,
      this.projection,
      resolvePolicy(this.runtime.policy, this.policy),
    );
  }
}

/** `given(x).when(...)` — a predicate that can be refined, run, or branched on. */
export class Predicate<T> {
  constructor(
    private readonly ctx: SubjectContext<T>,
    readonly condition: Condition<T>,
  ) {}

  get subject(): T {
    return this.ctx.subject;
  }

  and(condition: ConditionLike<T>): Predicate<T> {
    return new Predicate(this.ctx, conjoin(this.condition, condition));
  }

  or(condition: ConditionLike<T>): Predicate<T> {
    return new Predicate(this.ctx, disjoin(this.condition, condition));
  }

  unless(condition: ConditionLike<T>): Predicate<T> {
    return new Predicate(this.ctx, without(this.condition, condition));
  }

  /** Runs when the condition resolves to true. Uncertainty must be handled before `.run()`. */
  do<R>(action: Action<T, R>): Branch<T, R, false> {
    return new Branch(this, action, undefined);
  }

  plan(): Plan {
    const { probe } = prepare(this.ctx, this.condition);
    return planFor(this.ctx.runtime, [probe]);
  }

  run(): Promise<Judgment<boolean>> {
    return judge(this.ctx, this.condition);
  }
}

/**
 * The type parameter `HasOtherwise` tracks whether the false branch was
 * supplied, so `run()` is typed honestly: without `.otherwise()` the result may
 * be `undefined`.
 */
export class Branch<T, R, HasOtherwise extends boolean> {
  constructor(
    private readonly predicate: Predicate<T>,
    private readonly onTrue: Action<T, unknown>,
    private readonly onFalse: Action<T, unknown> | undefined,
  ) {}

  /** Runs when the condition resolves to false. Never runs on uncertainty. */
  otherwise<R2>(action: Action<T, R2>): Branch<T, R | R2, true> {
    return new Branch(this.predicate, this.onTrue, action);
  }

  /** Runs when the condition is unresolved. Required: uncertainty never falls through. */
  whenUncertain<R3>(
    action: Action<T, R3>,
  ): ReadyBranch<T, HasOtherwise extends true ? R | R3 : R | R3 | undefined> {
    return new ReadyBranch(this.predicate, this.onTrue, this.onFalse, action);
  }
}

export class ReadyBranch<T, R> {
  constructor(
    private readonly predicate: Predicate<T>,
    private readonly onTrue: Action<T, unknown>,
    private readonly onFalse: Action<T, unknown> | undefined,
    private readonly onUncertain: Action<T, unknown>,
  ) {}

  plan(): Plan {
    return this.predicate.plan();
  }

  async run(): Promise<Decision<Awaited<R>>> {
    const judgment = await this.predicate.run();
    const subject = this.predicate.subject;
    if (judgment.status === "uncertain") {
      return { branch: "uncertain", result: (await this.onUncertain(subject, judgment)) as Awaited<R>, judgment };
    }
    if (judgment.value) {
      return { branch: "do", result: (await this.onTrue(subject, judgment)) as Awaited<R>, judgment };
    }
    const result = this.onFalse ? await this.onFalse(subject, judgment) : undefined;
    return { branch: "otherwise", result: result as Awaited<R>, judgment };
  }
}

/** `given(x).chooseFrom(candidates)` before the selection criterion is stated. */
export class ChooseCandidates<T, C> {
  constructor(
    private readonly ctx: SubjectContext<T>,
    private readonly candidates: Candidates<C>,
  ) {}

  /** What the model sees of each candidate. The chosen candidate comes back whole. */
  seenAs(projection: Projection<C>): ChooseCandidates<T, C> {
    return new ChooseCandidates(this.ctx, this.candidates.seenAs(projection));
  }

  /** The selection criterion, in prose. */
  by(criterion: string): Choose<T, C, never> {
    return new Choose(this.ctx, this.candidates.by(criterion));
  }
}

export class Choose<T, C, None> {
  constructor(
    private readonly ctx: SubjectContext<T>,
    private readonly selection: Selection<C, None>,
  ) {}

  /** Make "none of them" a legitimate, distinct outcome. Separate from uncertainty. */
  orNone(description: EntryType): Choose<T, C, null> {
    return new Choose(this.ctx, this.selection.orNone(description));
  }

  plan(): Plan {
    return planOne(this.ctx, this.selection);
  }

  async run(): Promise<Judgment<C | None>> {
    return askOne(this.ctx, this.selection);
  }
}
