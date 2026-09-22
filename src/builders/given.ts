import type { ChoiceCriteria, EntryType } from "@typesafe-ai/sdk";
import { SenseError } from "../errors.js";
import { type Condition, type ConditionLike, toCondition } from "../expressions/condition.js";
import type { Scale } from "../expressions/scale.js";
import { type Judgment, EvidenceLog, decided, uncertain } from "../judgment.js";
import { type PartialPolicy, resolvePolicy } from "../policy.js";
import { type Plan, planFor } from "../runtime/plan.js";
import { Probe, type ScoreReading } from "../runtime/probe.js";
import type { Runtime } from "../runtime/runtime.js";
import { toState } from "../state.js";
import { type Projection, type SubjectContext, contextFor, judge, prepare } from "./subject.js";

const MAX_CHOICE_OPTIONS = 255;

/** A callback chosen by a judgment. It receives the subject and the judgment that selected it. */
export type Handler<T, R> = (subject: T, judgment: Judgment<boolean>) => R | Promise<R>;

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

  /** Send only these fields to the model. Code predicates still see the whole subject. */
  describedBy(projection: Projection<T>): Given<T> {
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
    return new ChooseCandidates(this.context(), candidates, undefined);
  }

  /** Place the subject on a scale. */
  measure(scale: Scale<T>): Measure<T> {
    return new Measure(this.context(), scale as Scale<unknown>);
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
    return new Predicate(this.ctx, { type: "and", left: this.condition, right: toCondition(condition) });
  }

  or(condition: ConditionLike<T>): Predicate<T> {
    return new Predicate(this.ctx, { type: "or", left: this.condition, right: toCondition(condition) });
  }

  unless(condition: ConditionLike<T>): Predicate<T> {
    return new Predicate(this.ctx, {
      type: "and",
      left: this.condition,
      right: { type: "not", inner: toCondition(condition) },
    });
  }

  /** Runs when the condition resolves to true. Uncertainty must be handled before `.run()`. */
  do<R>(action: Handler<T, R>): Branch<T, R, false> {
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
    private readonly onTrue: Handler<T, unknown>,
    private readonly onFalse: Handler<T, unknown> | undefined,
  ) {}

  /** Runs when the condition resolves to false. Never runs on uncertainty. */
  otherwise<R2>(action: Handler<T, R2>): Branch<T, R | R2, true> {
    return new Branch(this.predicate, this.onTrue, action);
  }

  /** Runs when the condition is unresolved. Required: uncertainty never falls through. */
  whenUncertain<R3>(
    action: Handler<T, R3>,
  ): ReadyBranch<T, HasOtherwise extends true ? R | R3 : R | R3 | undefined> {
    return new ReadyBranch(this.predicate, this.onTrue, this.onFalse, action);
  }
}

export class ReadyBranch<T, R> {
  constructor(
    private readonly predicate: Predicate<T>,
    private readonly onTrue: Handler<T, unknown>,
    private readonly onFalse: Handler<T, unknown> | undefined,
    private readonly onUncertain: Handler<T, unknown>,
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
    private readonly candidates: readonly C[],
    private readonly describe: Projection<C> | undefined,
  ) {}

  /** Send only these fields of each candidate. */
  describedBy(projection: Projection<C>): ChooseCandidates<T, C> {
    return new ChooseCandidates(this.ctx, this.candidates, projection);
  }

  /** The selection criterion, in prose. */
  by(criterion: string): Choose<T, C, never> {
    const trimmed = criterion.trim();
    if (!trimmed) throw new SenseError("chooseFrom(...).by() needs a non-empty criterion.");
    return new Choose(this.ctx, this.candidates, this.describe, trimmed, undefined);
  }
}

export class Choose<T, C, None> {
  constructor(
    private readonly ctx: SubjectContext<T>,
    private readonly candidates: readonly C[],
    private readonly describe: Projection<C> | undefined,
    private readonly criterion: string,
    private readonly noneDescription: EntryType | undefined,
  ) {}

  describedBy(projection: Projection<C>): Choose<T, C, None> {
    return new Choose(this.ctx, this.candidates, projection, this.criterion, this.noneDescription);
  }

  /** Make "none of them" a legitimate, distinct outcome. Separate from uncertainty. */
  orNone(description: EntryType): Choose<T, C, null> {
    return new Choose(this.ctx, this.candidates, this.describe, this.criterion, description);
  }

  plan(): Plan {
    const { probe } = this.prepare();
    return planFor(this.ctx.runtime, [probe]);
  }

  async run(): Promise<Judgment<C | None>> {
    const { log, probe, id, byOption } = this.prepare();
    const answers = await this.ctx.runtime.ask(probe.state, probe.questions, log);
    const reading = probe.readChoice(id, this.criterion, answers, this.ctx.policy);
    if (!reading.accepted) return uncertain(log.toEvidence());
    if (reading.choice === NONE_OPTION) return decided(null as None, log.toEvidence());
    const selected = byOption.get(reading.choice);
    if (selected === undefined) throw new SenseError(`Model selected unknown option "${reading.choice}".`);
    return decided<C | None>(selected, log.toEvidence());
  }

  private prepare() {
    if (this.candidates.length === 0) throw new SenseError("chooseFrom() needs at least one candidate.");
    const limit = this.noneDescription === undefined ? MAX_CHOICE_OPTIONS : MAX_CHOICE_OPTIONS - 1;
    if (this.candidates.length > limit) {
      throw new SenseError(
        `chooseFrom() supports at most ${limit} candidates here (got ${this.candidates.length}). ` +
          "Narrow the candidates in code first.",
      );
    }
    const log = new EvidenceLog(this.ctx.policy);
    const probe = new Probe(this.ctx.subject, this.ctx.state, log);
    const byOption = new Map<string, C>();
    const criteria: ChoiceCriteria = {};
    this.candidates.forEach((candidate, index) => {
      const option = `option_${index + 1}`;
      byOption.set(option, candidate);
      criteria[option] = toState(this.describe ? this.describe(candidate) : candidate);
    });
    if (this.noneDescription !== undefined) criteria[NONE_OPTION] = this.noneDescription;
    const id = probe.addChoice(this.criterion, criteria);
    return { log, probe, id, byOption };
  }
}

const NONE_OPTION = "none_of_these";

export type Measurement = ScoreReading;

/** `given(x).measure(scale)` — where does the subject sit on the scale? */
export class Measure<T> {
  constructor(
    private readonly ctx: SubjectContext<T>,
    private readonly scale: Scale<unknown>,
  ) {}

  plan(): Plan {
    const { probe } = this.prepare();
    return planFor(this.ctx.runtime, [probe]);
  }

  async run(): Promise<Judgment<Measurement>> {
    const { log, probe, id } = this.prepare();
    const answers = await this.ctx.runtime.ask(probe.state, probe.questions, log);
    const reading = probe.readScore(id, this.scale, answers, this.ctx.policy);
    return reading.accepted ? decided(reading, log.toEvidence()) : uncertain(log.toEvidence());
  }

  private prepare() {
    const log = new EvidenceLog(this.ctx.policy);
    const probe = new Probe(this.ctx.subject, this.ctx.state, log);
    const id = probe.addScore(this.scale);
    return { log, probe, id };
  }
}
