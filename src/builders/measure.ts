import type { Scale } from "../expressions/scale.js";
import type { Judgment } from "../judgment.js";
import type { Plan } from "../runtime/plan.js";
import { type Measurement, askOne, planOne } from "./ask.js";
import type { SubjectContext } from "./subject.js";

/** `given(x).measure(scale)` — where does the subject sit on the scale? */
export class Measure<T> {
  constructor(
    private readonly ctx: SubjectContext<T>,
    private readonly scale: Scale<T>,
  ) {}

  plan(): Plan {
    return planOne(this.ctx, this.scale);
  }

  async run(): Promise<Judgment<Measurement>> {
    return askOne(this.ctx, this.scale);
  }
}