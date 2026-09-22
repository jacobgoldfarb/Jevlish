import type { Scale } from "../expressions/scale.js";
import type { Judgment } from "../judgment.js";
import { type PartialPolicy, resolvePolicy } from "../policy.js";
import type { Plan } from "../runtime/plan.js";
import { type Measurement, askOne, planOne } from "./ask.js";
import type { SubjectContext } from "./subject.js";

/** `given(x).measure(scale)` — where does the subject sit on the scale? */
export class Measure<T> implements PromiseLike<Judgment<Measurement>> {
  constructor(
    private readonly ctx: SubjectContext<T>,
    private readonly scale: Scale<T>,
  ) {}

  /** Override acceptance thresholds for this measurement. */
  withPolicy(policy: PartialPolicy): Measure<T> {
    return new Measure({ ...this.ctx, policy: resolvePolicy(this.ctx.policy, policy) }, this.scale);
  }

  /** What would be sent, without sending it. */
  plan(): Plan {
    return planOne(this.ctx, this.scale);
  }

  /** Ask for the measurement. Equivalent to awaiting it. */
  async run(): Promise<Judgment<Measurement>> {
    return askOne(this.ctx, this.scale);
  }

  /** Awaiting the measurement runs it. */
  then<R1 = Judgment<Measurement>, R2 = never>(
    onfulfilled?: ((value: Judgment<Measurement>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}