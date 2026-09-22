// Verbs
export { configure, createSense, from, given, grade, type Sense } from "./sense.js";

// Nouns: reusable meanings and scales
export {
  Meaning,
  all,
  any,
  means,
  not,
  describeCondition,
  type Condition,
  type ConditionLike,
} from "./expressions/condition.js";
export { Scale, scale } from "./expressions/scale.js";
export { Candidates, Selection, chooseFrom } from "./expressions/selection.js";

// Results
export {
  decided,
  isDecided,
  truthOfJudgment,
  uncertain,
  type Answer,
  type Evidence,
  type Judgment,
  type JudgmentRecord,
  type RequestRecord,
  type Truth,
} from "./judgment.js";
export {
  defaultPolicy,
  resolvePolicy,
  truthOfProbability,
  type AcceptancePolicy,
  type PartialPolicy,
} from "./policy.js";
export * as logic from "./logic.js";

// Builders (types for annotations)
export { Ask, type Askable, type Asked, type Measurement } from "./builders/ask.js";
export {
  Branch,
  Choose,
  ChooseCandidates,
  Given,
  Predicate,
  ReadyBranch,
  type BranchTaken,
  type Decision,
  type Action,
} from "./builders/given.js";
export { Measure } from "./builders/measure.js";
export { From, Query, type QueryResult, type RankedQueryResult, type RankOrder } from "./builders/from.js";

// Runtime
export { Runtime, type PlannedRequest, type SenseConfig } from "./runtime/runtime.js";
export { memoryCache, type Cache, type Transport } from "./runtime/transport.js";
export type { Plan } from "./runtime/plan.js";
export { toState } from "./state.js";
export { SenseError } from "./errors.js";

// Testing
export type { Fixture, GradeOptions, GradeReport } from "./testing.js";

export type { EntryType } from "@typesafe-ai/sdk";
