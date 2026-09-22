import type { Truth } from "./judgment.js";

/**
 * When does a model answer count as decided?
 *
 * These are application thresholds, not universal defaults. Noul reports a
 * yes-probability; Choice and Score report a distribution-derived confidence.
 * The two are not interchangeable, so they get separate knobs.
 */
export interface AcceptancePolicy {
  readonly noul: {
    /** Accept "yes" when P(yes) is at least this. */
    readonly yesAbove: number;
    /** Accept "no" when P(yes) is at most this. */
    readonly noBelow: number;
  };
  readonly choice: {
    /** Accept the selected option when confidence is at least this. */
    readonly minConfidence: number;
  };
  readonly score: {
    /** Accept a score when confidence is at least this. */
    readonly minConfidence: number;
  };
}

/** Any subset of the thresholds; the rest come from the runtime's policy. */
export interface PartialPolicy {
  readonly noul?: Partial<AcceptancePolicy["noul"]>;
  readonly choice?: Partial<AcceptancePolicy["choice"]>;
  readonly score?: Partial<AcceptancePolicy["score"]>;
}

/** Conservative starting point. Tune against your own fixtures. */
export const defaultPolicy: AcceptancePolicy = {
  noul: { yesAbove: 0.8, noBelow: 0.2 },
  choice: { minConfidence: 0.5 },
  score: { minConfidence: 0.5 },
};

/** Layer an override on a base policy. Throws a RangeError unless `noBelow < yesAbove`. */
export function resolvePolicy(base: AcceptancePolicy, override?: PartialPolicy): AcceptancePolicy {
  const policy: AcceptancePolicy = {
    noul: { ...base.noul, ...override?.noul },
    choice: { ...base.choice, ...override?.choice },
    score: { ...base.score, ...override?.score },
  };
  probability("noul.yesAbove", policy.noul.yesAbove);
  probability("noul.noBelow", policy.noul.noBelow);
  probability("choice.minConfidence", policy.choice.minConfidence);
  probability("score.minConfidence", policy.score.minConfidence);
  if (policy.noul.noBelow >= policy.noul.yesAbove) {
    throw new RangeError(
      `noul policy needs noBelow < yesAbove (got noBelow=${policy.noul.noBelow}, yesAbove=${policy.noul.yesAbove})`,
    );
  }
  return policy;
}

function probability(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1 (got ${value})`);
  }
}

/** Map a Noul yes-probability onto three-valued truth under a policy. */
export function truthOfProbability(probability: number, policy: AcceptancePolicy["noul"]): Truth {
  if (probability >= policy.yesAbove) return true;
  if (probability <= policy.noBelow) return false;
  return "uncertain";
}
