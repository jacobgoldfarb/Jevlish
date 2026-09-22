import type { ConditionLike } from "./expressions/condition.js";
import { toCondition } from "./expressions/condition.js";
import type { Judgment } from "./judgment.js";
import { type PartialPolicy, resolvePolicy } from "./policy.js";
import type { Runtime } from "./runtime/runtime.js";
import { type Projection, contextFor, judge } from "./builders/subject.js";

/** A labelled example. `expected` is what a careful person would answer. */
export interface Fixture<T> {
  readonly subject: T;
  readonly expected: boolean;
  readonly note?: string;
}

export interface Report<T> {
  readonly total: number;
  readonly decided: number;
  readonly truePositives: number;
  readonly trueNegatives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly abstentions: number;
  /** Correct decisions over decided fixtures; null when nothing was decided. */
  readonly accuracy: number | null;
  /** Decided fixtures over all fixtures. */
  readonly coverage: number;
  readonly misjudged: ReadonlyArray<{ readonly fixture: Fixture<T>; readonly judgment: Judgment<boolean> }>;
  readonly abstained: ReadonlyArray<{ readonly fixture: Fixture<T>; readonly judgment: Judgment<boolean> }>;
}

export interface MeasureOptions<T> {
  readonly describedBy?: Projection<T>;
  readonly policy?: PartialPolicy;
}

/**
 * Evaluate a meaning against labelled fixtures the way you would test a
 * function. Reports false positives, false negatives, and abstentions
 * separately: an abstention is a policy outcome, not a wrong answer.
 */
export async function measure<T>(
  runtime: Runtime,
  meaning: ConditionLike<T>,
  fixtures: readonly Fixture<T>[],
  options: MeasureOptions<T> = {},
): Promise<Report<T>> {
  const condition = toCondition(meaning);
  const policy = resolvePolicy(runtime.policy, options.policy);
  const judgments = await Promise.all(
    fixtures.map((fixture) => judge(contextFor(runtime, fixture.subject, options.describedBy, policy), condition)),
  );

  let truePositives = 0;
  let trueNegatives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  const misjudged: Array<{ fixture: Fixture<T>; judgment: Judgment<boolean> }> = [];
  const abstained: Array<{ fixture: Fixture<T>; judgment: Judgment<boolean> }> = [];

  fixtures.forEach((fixture, index) => {
    const judgment = judgments[index];
    if (!judgment) return;
    if (judgment.status === "uncertain") {
      abstained.push({ fixture, judgment });
      return;
    }
    if (judgment.value === fixture.expected) {
      if (fixture.expected) truePositives += 1;
      else trueNegatives += 1;
    } else {
      if (judgment.value) falsePositives += 1;
      else falseNegatives += 1;
      misjudged.push({ fixture, judgment });
    }
  });

  const decided = fixtures.length - abstained.length;
  return {
    total: fixtures.length,
    decided,
    truePositives,
    trueNegatives,
    falsePositives,
    falseNegatives,
    abstentions: abstained.length,
    accuracy: decided === 0 ? null : (truePositives + trueNegatives) / decided,
    coverage: fixtures.length === 0 ? 0 : decided / fixtures.length,
    misjudged,
    abstained,
  };
}
