import { describe, expect, it } from "vitest";
import { logic } from "../src/index.js";
import { truthOfProbability } from "../src/runtime.js";

describe("three-valued logic", () => {
  it("follows Kleene semantics", () => {
    expect(logic.and(false, "uncertain")).toBe(false);
    expect(logic.and(true, "uncertain")).toBe("uncertain");
    expect(logic.and(true, true)).toBe(true);
    expect(logic.or(true, "uncertain")).toBe(true);
    expect(logic.or(false, "uncertain")).toBe("uncertain");
    expect(logic.or(false, false)).toBe(false);
    expect(logic.not("uncertain")).toBe("uncertain");
    expect(logic.not(true)).toBe(false);
  });

  it("maps probabilities to truth under a policy", () => {
    const policy = { yesAbove: 0.9, noBelow: 0.1 };
    expect(truthOfProbability(0.95, policy)).toBe(true);
    expect(truthOfProbability(0.05, policy)).toBe(false);
    expect(truthOfProbability(0.5, policy)).toBe("uncertain");
    expect(truthOfProbability(0.9, policy)).toBe(true);
    expect(truthOfProbability(0.1, policy)).toBe(false);
  });
});
