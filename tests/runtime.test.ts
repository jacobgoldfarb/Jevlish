import { describe, expect, it } from "vitest";
import { createSense, means, memoryCache } from "../src/index.js";
import { fake, textOf, yes } from "./fake.js";

describe("runtime", () => {
  it.each([0, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid questionsPerRequest values (%s)",
    (questionsPerRequest) => {
      expect(() => createSense({ questionsPerRequest })).toThrow(/positive integer/);
    },
  );

  it("chunks questions into requests and merges answers", async () => {
    const client = fake((question) => yes(textOf(question).endsWith("3") ? 0.99 : 0.01));
    const sense = createSense({ client, questionsPerRequest: 2 });
    const judgment = await sense
      .given("state")
      .when("p1")
      .or("p2")
      .or("p3")
      .or("p4")
      .or("p5")
      .run();
    expect(judgment).toMatchObject({ status: "decided", value: true });
    expect(client.calls).toHaveLength(3);
    expect(judgment.evidence.requests).toHaveLength(3);
  });

  it("caches by model, state, and questions", async () => {
    const client = fake(() => yes(0.99));
    const cache = memoryCache();
    const sense = createSense({ client, cache, model: "jev-test" });
    await sense.given("same").when("p").run();
    const second = await sense.given("same").when("p").run();
    await sense.given("different").when("p").run();
    expect(client.calls).toHaveLength(2);
    expect(cache.size).toBe(2);
    expect(second.evidence.requests[0]!.cached).toBe(true);
  });

  it("bounds concurrency", async () => {
    let inFlight = 0;
    let peak = 0;
    const client = {
      async systemOne(request: { questions: Record<string, unknown> }) {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return {
          model: "fake",
          answers: Object.fromEntries(Object.keys(request.questions).map((id) => [id, yes(0.99)])),
          usage: { input_tokens: 0, output_tokens: 0 },
        };
      },
    };
    const sense = createSense({ client: client as never, concurrency: 2 });
    await sense.from(Array.from({ length: 10 }, (_, i) => ({ i }))).where("p").run();
    expect(peak).toBe(2);
  });

  it("lets transport errors propagate as ordinary errors, not judgments", async () => {
    const client = {
      async systemOne() {
        throw new Error("boom");
      },
    };
    const sense = createSense({ client: client as never });
    await expect(sense.given("x").when("p").run()).rejects.toThrow("boom");
  });

  it("grades a meaning against fixtures", async () => {
    const client = fake((_question, state) => yes((state as { p: number }).p));
    const sense = createSense({ client });
    const report = await sense.grade(means<{ p: number }>("p"), [
      { subject: { p: 0.99 }, expected: true },
      { subject: { p: 0.01 }, expected: false },
      { subject: { p: 0.99 }, expected: false, note: "false positive" },
      { subject: { p: 0.5 }, expected: true, note: "abstains" },
    ]);
    expect(report).toMatchObject({
      total: 4,
      decided: 3,
      truePositives: 1,
      trueNegatives: 1,
      falsePositives: 1,
      falseNegatives: 0,
      abstentions: 1,
      coverage: 0.75,
    });
    expect(report.accuracy).toBeCloseTo(2 / 3);
    expect(report.misjudged[0]!.fixture.note).toBe("false positive");
  });
});
