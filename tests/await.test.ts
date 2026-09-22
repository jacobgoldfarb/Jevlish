import { describe, expect, it } from "vitest";
import { chooseFrom, createSense, means, scale } from "../src/index.js";
import { fake, pick, rate, yes } from "./fake.js";

interface Ticket {
  id: string;
  status: "open" | "closed";
  body: string;
}

const blocked = means<Ticket>("the customer cannot continue their work");
const disruption = scale<Ticket>("how much this disrupts the customer's work").from("cosmetic").through("slowed").to("blocked");
const open: Ticket = { id: "t1", status: "open", body: "Export crashes every time." };
const engineers = [{ name: "Ada" }, { name: "Grace" }];

describe("awaiting an expression runs it", () => {
  it("nothing is sent until the expression is awaited", async () => {
    const client = fake(() => yes(0.99));
    const predicate = createSense({ client }).given(open).when(blocked);
    predicate.plan();
    expect(client.calls).toHaveLength(0);

    const judgment = await predicate;
    expect(judgment).toMatchObject({ status: "decided", value: true });
    expect(client.calls).toHaveLength(1);
  });

  it("awaits a predicate, a branch, a measurement, a choice, a batch of questions, and a query", async () => {
    const client = fake((question) => {
      if (question.type === "score") return rate(2, 0.9, 3);
      if (question.type === "choice") return pick("option_2", 0.9, { option_1: 0.1, option_2: 0.9 });
      return yes(0.99);
    });
    const sense = createSense({ client });

    expect(await sense.given(open).when(blocked)).toMatchObject({ status: "decided", value: true });

    const decision = await sense
      .given(open)
      .when(blocked)
      .do(() => "escalate" as const)
      .otherwise(() => "leave" as const)
      .whenUncertain(() => "review" as const);
    expect(decision.branch).toBe("do");
    expect(decision.result).toBe("escalate");

    const measurement = await sense.given(open).measure(disruption);
    expect(measurement).toMatchObject({ status: "decided", value: { level: 2 } });

    const owner = await sense.given({ ticket: open }).chooseFrom(engineers).by("whose experience matches");
    expect(owner).toMatchObject({ status: "decided", value: engineers[1] });

    const answers = await sense.given(open).ask({
      problem: blocked,
      severity: disruption,
      owner: chooseFrom(engineers).by("whose experience matches"),
    });
    expect(answers.problem).toMatchObject({ status: "decided", value: true });
    expect(answers.severity).toMatchObject({ status: "decided", value: { level: 2 } });
    expect(answers.owner).toMatchObject({ status: "decided", value: engineers[1] });

    const queue = await sense.from([open]).where(blocked).rankedBy(disruption).take(1);
    expect(queue.accepted).toEqual([open]);
    expect(queue.scored.map((entry) => entry.score)).toEqual([2]);
  });

  it("runs once per await, like run()", async () => {
    const client = fake(() => yes(0.99));
    const predicate = createSense({ client }).given(open).when(blocked);
    await predicate;
    await predicate;
    expect(client.calls).toHaveLength(2);
  });

  it("works with Promise.all", async () => {
    const client = fake((question) => (question.type === "score" ? rate(2, 0.9, 3) : yes(0.99)));
    const sense = createSense({ client });
    const [a, b] = await Promise.all([sense.given(open).when(blocked), sense.given(open).measure(disruption)]);
    expect(a.status).toBe("decided");
    expect(b.status).toBe("decided");
  });

  it("rejects a branch that has no whenUncertain handler instead of falling through", async () => {
    const client = fake(() => yes(0.99));
    const branch = createSense({ client }).given(open).when(blocked).do(() => "escalate");

    await expect(branch).rejects.toThrow(/whenUncertain/);
    expect(client.calls).toHaveLength(0);
  });
});
