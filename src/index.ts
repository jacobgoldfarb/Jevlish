// Verbs and configuration
export { configure, createSense, from, given, grade, type Sense } from "./sense.js";
export type { SenseConfig } from "./runtime/runtime.js";

// Question builders
export {
  Meaning,
  all,
  any,
  means,
  not,
  type ConditionLike,
} from "./expressions/condition.js";
export { Scale, scale } from "./expressions/scale.js";
export { Choice, chooseFrom } from "./expressions/selection.js";

// Results
export {
  isDecided,
  truthOfJudgment,
  type Evidence,
  type Judgment,
  type Truth,
} from "./judgment.js";
export {
  defaultPolicy,
  type AcceptancePolicy,
  type PartialPolicy,
} from "./policy.js";
export * as logic from "./logic.js";
export type { Asked, Measurement } from "./builders/ask.js";
export type { Action, BranchTaken, Decision } from "./builders/given.js";
export type { QueryResult, RankedQueryResult, RankOrder } from "./builders/from.js";

// Common runtime utilities
export { memoryCache, type Cache, type Transport } from "./runtime/transport.js";
export type { Plan } from "./runtime/plan.js";
export { SenseError } from "./errors.js";

// Testing
export type { Fixture, GradeOptions, GradeReport } from "./testing.js";

export type { EntryType } from "@typesafe-ai/sdk";
