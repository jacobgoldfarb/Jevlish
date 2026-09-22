// Verbs
export { configure, createSense, from, given, measure, type Sense } from "./sense.js";

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
export { defaultPolicy, resolvePolicy, truthOf, type AcceptancePolicy, type PartialPolicy } from "./policy.js";
export * as logic from "./logic.js";

// Builders (types for annotations)
export {
  Branch,
  Choose,
  ChooseCandidates,
  Given,
  Measure,
  Predicate,
  ReadyBranch,
  type BranchTaken,
  type Decision,
  type Handler,
  type Measurement,
} from "./builders/given.js";
export { From, Query, type QueryResult, type RankOrder } from "./builders/from.js";

// Runtime
export { Runtime, type PlannedRequest, type SenseConfig } from "./runtime/runtime.js";
export { memoryCache, type Cache, type Evaluator } from "./runtime/evaluator.js";
export type { Plan } from "./runtime/plan.js";
export { toState } from "./state.js";
export { SenseError } from "./errors.js";

// Testing
export type { Fixture, MeasureOptions, Report } from "./testing.js";

export type { EntryType } from "@typesafe-ai/sdk";
