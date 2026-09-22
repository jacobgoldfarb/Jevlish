import { createSense } from "jevlish";

/**
 * One configured instance for the app and its tests, so `grade` evaluates
 * the vocabulary under the same policy the report uses.
 *
 * Thresholds scale with risk. Here a false positive is one wrong quote in a
 * report and a false negative is a missed insight, so the bar for "yes" is
 * lower than it would be for an action. Scores between two levels get low
 * confidence by construction; for averaging, the expectation is what we want.
 */
export const sense = createSense({
  policy: { noul: { yesAbove: 0.7, noBelow: 0.3 }, score: { minConfidence: 0.25 } },
});
