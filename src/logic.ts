import type { Truth } from "./judgment.js";

/**
 * Kleene three-valued logic. Uncertainty is a first-class value here, so
 * composite conditions combine decisions rather than multiplying probabilities
 * and pretending the product is calibrated.
 *
 *   false AND uncertain -> false
 *   true  AND uncertain -> uncertain
 *   true  OR  uncertain -> true
 *   NOT uncertain       -> uncertain
 */
export function and(a: Truth, b: Truth): Truth {
  if (a === false || b === false) return false;
  if (a === true && b === true) return true;
  return "uncertain";
}

export function or(a: Truth, b: Truth): Truth {
  if (a === true || b === true) return true;
  if (a === false && b === false) return false;
  return "uncertain";
}

export function not(a: Truth): Truth {
  return a === "uncertain" ? "uncertain" : !a;
}
