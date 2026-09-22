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
 *
 * Three-valued AND: false if either side is false; uncertain unless both are true.
 */
export function and(a: Truth, b: Truth): Truth {
  if (a === false || b === false) return false;
  if (a === true && b === true) return true;
  return "uncertain";
}

/** Three-valued OR: true if either side is true; uncertain unless both are false. */
export function or(a: Truth, b: Truth): Truth {
  if (a === true || b === true) return true;
  if (a === false && b === false) return false;
  return "uncertain";
}

/** Three-valued NOT: uncertain stays uncertain. */
export function not(a: Truth): Truth {
  return a === "uncertain" ? "uncertain" : !a;
}
