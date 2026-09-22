import { type Condition, type ConditionLike, toCondition } from "./expressions/condition.js";
import type { Judgment } from "./judgment.js";
import { type AcceptancePolicy, type PartialPolicy, resolvePolicy } from "./policy.js";
import type { Runtime } from "./runtime/runtime.js";
import { type Projection, contextFor, judge } from "./builders/subject.js";

/** A labelled example. `expected` is what a careful person would answer. */
export interface Fixture<T> {
  readonly subject: T;
  readonly expected: boolean;
  readonly note?: string;
}

/** How a meaning did against fixtures. Abstentions are counted apart from wrong answers. */
export interface GradeReport<T> {
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

/** Options for `grade`. */
export interface GradeOptions<T> {
  /** What the model sees of each fixture's subject. */
  readonly seenAs?: Projection<T>;
  /** Thresholds for this grading run, layered on the runtime's policy. */
  readonly policy?: PartialPolicy;
}

type Classification = "truePositive" | "trueNegative" | "falsePositive" | "falseNegative" | "abstention";

interface JudgedFixture<T> {
  readonly fixture: Fixture<T>;
  readonly judgment: Judgment<boolean>;
}

/**
 * Grade a meaning against labelled fixtures the way you would test a
 * function. Reports false positives, false negatives, and abstentions
 * separately: an abstention is a policy outcome, not a wrong answer.
 */
export async function grade<T>(
  runtime: Runtime,
  meaning: ConditionLike<T>,
  fixtures: readonly Fixture<T>[],
  options: GradeOptions<T> = {},
): Promise<GradeReport<T>> {
  const condition = toCondition(meaning);
  const policy = resolvePolicy(runtime.policy, options.policy);
  const rows = await Promise.all(
    fixtures.map((fixture) => judgeFixture(runtime, condition, fixture, policy, options.seenAs)),
  );
  return reportFrom(rows);
}

async function judgeFixture<T>(
  runtime: Runtime,
  condition: Condition<T>,
  fixture: Fixture<T>,
  policy: AcceptancePolicy,
  projection: Projection<T> | undefined,
): Promise<JudgedFixture<T>> {
  const judgment = await judge(contextFor(runtime, fixture.subject, projection, policy), condition);
  return { fixture, judgment };
}

function classify<T>(row: JudgedFixture<T>): Classification {
  const { fixture, judgment } = row;
  if (judgment.status === "uncertain") return "abstention";
  if (judgment.value === fixture.expected) return fixture.expected ? "truePositive" : "trueNegative";
  return judgment.value ? "falsePositive" : "falseNegative";
}

function reportFrom<T>(rows: readonly JudgedFixture<T>[]): GradeReport<T> {
  const counts: Record<Classification, number> = {
    truePositive: 0,
    trueNegative: 0,
    falsePositive: 0,
    falseNegative: 0,
    abstention: 0,
  };
  const misjudged: Array<{ fixture: Fixture<T>; judgment: Judgment<boolean> }> = [];
  const abstained: Array<{ fixture: Fixture<T>; judgment: Judgment<boolean> }> = [];

  for (const row of rows) {
    const kind = classify(row);
    counts[kind] += 1;
    if (kind === "falsePositive" || kind === "falseNegative") misjudged.push(row);
    if (kind === "abstention") abstained.push(row);
  }

  const decided = rows.length - counts.abstention;
  return {
    total: rows.length,
    decided,
    truePositives: counts.truePositive,
    trueNegatives: counts.trueNegative,
    falsePositives: counts.falsePositive,
    falseNegatives: counts.falseNegative,
    abstentions: counts.abstention,
    accuracy: decided === 0 ? null : (counts.truePositive + counts.trueNegative) / decided,
    coverage: rows.length === 0 ? 0 : decided / rows.length,
    misjudged,
    abstained,
  };
}
