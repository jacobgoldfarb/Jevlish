import { From } from "./builders/from.js";
import { Given } from "./builders/given.js";
import type { ConditionLike } from "./expressions/condition.js";
import { Runtime, type SenseConfig } from "./runtime/runtime.js";
import { type Fixture, type MeasureOptions, type Report, measure as measureWith } from "./testing.js";

/** A configured instance of the language: the verbs, bound to one runtime. */
export interface Sense {
  readonly runtime: Runtime;
  given<T>(subject: T): Given<T>;
  from<T>(items: readonly T[]): From<T>;
  measure<T>(meaning: ConditionLike<T>, fixtures: readonly Fixture<T>[], options?: MeasureOptions<T>): Promise<Report<T>>;
}

export function createSense(config: SenseConfig = {}): Sense {
  const runtime = new Runtime(config);
  return {
    runtime,
    given: (subject) => new Given(runtime, subject),
    from: (items) => new From(runtime, items),
    measure: (meaning, fixtures, options) => measureWith(runtime, meaning, fixtures, options),
  };
}

let shared: Sense | undefined;

/** Configure the module-level verbs. Without this they read TYPESAFE_API_KEY on first use. */
export function configure(config: SenseConfig): Sense {
  shared = createSense(config);
  return shared;
}

function current(): Sense {
  shared ??= createSense();
  return shared;
}

export function given<T>(subject: T): Given<T> {
  return current().given(subject);
}

export function from<T>(items: readonly T[]): From<T> {
  return current().from(items);
}

export function measure<T>(
  meaning: ConditionLike<T>,
  fixtures: readonly Fixture<T>[],
  options?: MeasureOptions<T>,
): Promise<Report<T>> {
  return current().measure(meaning, fixtures, options);
}
