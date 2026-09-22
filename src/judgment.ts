import type {
  ChoiceResponse,
  EntryType,
  NoulResponse,
  Questions,
  ScoreResponse,
  Usage,
} from "@typesafe-ai/sdk";
import type { AcceptancePolicy } from "./policy.js";

/** Three-valued truth. A predicate resolves to true, false, or stays unresolved. */
export type Truth = boolean | "uncertain";

/** A raw model answer to one question, before the policy is applied. */
export type Answer = NoulResponse | ChoiceResponse | ScoreResponse;

/** One request that actually left the process, with what came back. */
export interface RequestRecord {
  readonly model: string;
  readonly state: EntryType;
  readonly questions: Questions;
  readonly answers: Readonly<Record<string, Answer>>;
  readonly usage: Usage;
  readonly cached: boolean;
}

/**
 * One judgment that contributed to a result. Code predicates are recorded
 * alongside model answers so the trace shows the whole decision, not only the
 * part that involved inference.
 */
export type JudgmentRecord =
  | { readonly kind: "code"; readonly label: string; readonly truth: boolean }
  | {
      readonly kind: "noul";
      readonly id: string;
      readonly label: string;
      readonly instructions: EntryType;
      readonly probability: number;
      readonly truth: Truth;
    }
  | {
      readonly kind: "choice";
      readonly id: string;
      readonly label: string;
      readonly instructions: EntryType;
      readonly choice: string;
      readonly confidence: number;
      readonly probabilities: Readonly<Record<string, number>>;
      readonly accepted: boolean;
    }
  | {
      readonly kind: "score";
      readonly id: string;
      readonly label: string;
      readonly instructions: EntryType;
      readonly score: number;
      readonly confidence: number;
      readonly probabilities: Readonly<Record<string, number>>;
      readonly accepted: boolean;
    };

/** Everything needed to audit a result: the requests, the judgments, the policy applied. */
export interface Evidence {
  readonly requests: readonly RequestRecord[];
  readonly judgments: readonly JudgmentRecord[];
  readonly policy: AcceptancePolicy;
}

/**
 * The fundamental return type. "decided" means the result passed the
 * acceptance policy, not that it is a proven fact.
 */
export type Judgment<T> =
  | { readonly status: "decided"; readonly value: T; readonly evidence: Evidence }
  | { readonly status: "uncertain"; readonly evidence: Evidence };

/** A judgment that passed the policy. `decided(null, evidence)` is how `orNone` reports "none of these". */
export function decided<T>(value: T, evidence: Evidence): Judgment<T> {
  return { status: "decided", value, evidence };
}

/** A judgment the policy would not accept. */
export function uncertain<T = never>(evidence: Evidence): Judgment<T> {
  return { status: "uncertain", evidence };
}

/** Type guard for the decided case. */
export function isDecided<T>(
  judgment: Judgment<T>,
): judgment is Extract<Judgment<T>, { status: "decided" }> {
  return judgment.status === "decided";
}

/** Collapse a boolean judgment back to three-valued truth. */
export function truthOfJudgment(judgment: Judgment<boolean>): Truth {
  return judgment.status === "decided" ? judgment.value : "uncertain";
}

/** Mutable accumulator used while a run is in progress. */
export class EvidenceLog {
  readonly requests: RequestRecord[] = [];
  readonly judgments: JudgmentRecord[] = [];

  constructor(readonly policy: AcceptancePolicy) {}

  toEvidence(): Evidence {
    return {
      requests: [...this.requests],
      judgments: [...this.judgments],
      policy: this.policy,
    };
  }
}
