import { describe, expect, it } from "vitest";
import {
  configure,
  from,
  given,
  grade,
  isDecided,
  means,
  truthOfJudgment,
} from "../src/index.js";
import { fake, yes } from "./fake.js";

describe("module-level sense", () => {
  it("uses the runtime installed by configure for every shared verb", async () => {
    const client = fake(() => yes(0.95));
    configure({ client });

    const judgment = await given("one").when("applies");
    const query = await from(["two"]).where("applies");
    const report = await grade(means<string>("applies"), [{ subject: "three", expected: true }]);

    expect(isDecided(judgment)).toBe(true);
    expect(truthOfJudgment(judgment)).toBe(true);
    expect(query.accepted).toEqual(["two"]);
    expect(report).toMatchObject({ total: 1, truePositives: 1, accuracy: 1 });
    expect(client.calls).toHaveLength(3);
  });
});
