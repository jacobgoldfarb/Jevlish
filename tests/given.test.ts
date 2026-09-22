import { describe, expect, it } from "vitest";
import { createSense, means, scale } from "../src/index.js";
import { fake, pick, rate, textOf, yes } from "./fake.js";

interface Ticket {
  id: string;
  status: "open" | "closed";
  body: string;
}

const blocked = means<Ticket>("the customer cannot continue their work")
  .including("a product failure prevents them from completing the task")
  .excluding("they can complete the task despite inconvenience")
  .named("blocked");

const open: Ticket = { id: "t1", status: "open", body: "Export crashes every time; we cannot ship invoices." };
const closed: Ticket = { ...open, id: "t2", status: "closed" };

describe("given().when()", () => {
  it("branches three ways and never lets uncertainty fall through", async () => {
    const script = (probability: number) =>
      fake((question) => (textOf(question).includes("resolved") ? yes(0.02) : yes(probability)));

    const run = (client: ReturnType<typeof fake>) =>
      createSense({ client })
        .given(open)
        .when(blocked)
        .and((ticket) => ticket.status === "open")
        .unless("the customer says the problem has been resolved")
        .do(() => "escalated" as const)
        .otherwise(() => "unchanged" as const)
        .whenUncertain(() => "review" as const)
        .run();

    expect((await run(script(0.97))).branch).toBe("do");
    expect((await run(script(0.03))).branch).toBe("otherwise");
    const uncertain = await run(script(0.55));
    expect(uncertain.branch).toBe("uncertain");
    expect(uncertain.result).toBe("review");
    expect(uncertain.judgment.status).toBe("uncertain");
  });

  it("prunes with code first: a false code predicate under AND sends nothing", async () => {
    const client = fake(() => yes(0.99));
    const decision = await createSense({ client })
      .given(closed)
      .when(blocked)
      .and((ticket) => ticket.status === "open")
      .do(() => "escalated")
      .whenUncertain(() => "review")
      .run();

    expect(decision.branch).toBe("otherwise");
    expect(decision.result).toBeUndefined();
    expect(client.calls).toHaveLength(0);
    expect(decision.judgment.evidence.judgments).toEqual([{ kind: "code", label: "code predicate", truth: false }]);
  });

  it("batches every semantic leaf for one subject into one request and dedupes equal leaves", async () => {
    const client = fake((question) => (textOf(question).includes("resolved") ? yes(0.01) : yes(0.95)));
    const judgment = await createSense({ client })
      .given(open)
      .when(blocked)
      .and(blocked)
      .unless("the customer says the problem has been resolved")
      .run();

    expect(judgment).toMatchObject({ status: "decided", value: true });
    expect(client.calls).toHaveLength(1);
    expect(Object.keys(client.calls[0]!.questions)).toEqual(["q1", "q2"]);
    expect(client.calls[0]!.questions.q1).toEqual({
      type: "noul",
      instructions: "the customer cannot continue their work",
      criteria: {
        true: "a product failure prevents them from completing the task",
        false: "they can complete the task despite inconvenience",
      },
    });
  });

  it("only sends projected fields while code predicates see the whole subject", async () => {
    const client = fake(() => yes(0.99));
    const plan = createSense({ client })
      .given(open)
      .seenAs((ticket) => ({ body: ticket.body }))
      .when(blocked)
      .and((ticket) => ticket.id === "t1")
      .plan();

    expect(plan.requests).toHaveLength(1);
    expect(plan.requests[0]!.state).toEqual({ body: open.body });
    expect(plan.questionCount).toBe(1);
    expect(plan.decidedByCode).toBe(0);
  });

  it("applies per-expression policy overrides", async () => {
    const client = fake(() => yes(0.7));
    const sense = createSense({ client });
    expect((await sense.given(open).when(blocked).run()).status).toBe("uncertain");
    expect(
      await sense.given(open).withPolicy({ noul: { yesAbove: 0.6 } }).when(blocked).run(),
    ).toMatchObject({ status: "decided", value: true });
  });

  it("records evidence for every judgment, code and model alike", async () => {
    const client = fake(() => yes(0.96));
    const judgment = await createSense({ client })
      .given(open)
      .when(blocked)
      .and((ticket) => ticket.status === "open")
      .run();

    expect(judgment.evidence.requests).toHaveLength(1);
    expect(judgment.evidence.judgments).toEqual([
      { kind: "code", label: "code predicate", truth: true },
      expect.objectContaining({ kind: "noul", id: "q1", label: "blocked", probability: 0.96, truth: true }),
    ]);
    expect(judgment.evidence.policy.noul.yesAbove).toBe(0.9);
  });
});

describe("given().chooseFrom()", () => {
  interface Engineer {
    name: string;
    expertise: string[];
  }
  const engineers: Engineer[] = [
    { name: "Ada", expertise: ["billing"] },
    { name: "Grace", expertise: ["exports", "pdf"] },
  ];

  it("returns the original object, not a label", async () => {
    const client = fake(() => pick("option_2", 0.9, { option_1: 0.05, option_2: 0.95 }));
    const owner = await createSense({ client })
      .given({ ticket: open })
      .chooseFrom(engineers)
      .seenAs((engineer) => ({ expertise: engineer.expertise }))
      .by("whose experience best matches the problem described in ticket")
      .orNone("none of the engineers has relevant experience")
      .run();

    expect(owner).toMatchObject({ status: "decided", value: engineers[1] });
    const question = client.calls[0]!.questions.q1!;
    expect(question).toEqual({
      type: "choice",
      instructions: "whose experience best matches the problem described in ticket",
      criteria: {
        option_1: { expertise: ["billing"] },
        option_2: { expertise: ["exports", "pdf"] },
        none_of_these: "none of the engineers has relevant experience",
      },
    });
  });

  it("distinguishes 'none' from 'uncertain'", async () => {
    const sense = createSense({ client: fake(() => pick("none_of_these", 0.8)) });
    const none = await sense
      .given({ ticket: open })
      .chooseFrom(engineers)
      .by("whose experience matches")
      .orNone("nobody fits")
      .run();
    expect(none).toMatchObject({ status: "decided", value: null });

    const unsure = createSense({ client: fake(() => pick("option_1", 0.2, { option_1: 0.55, option_2: 0.45 })) });
    expect((await unsure.given({ ticket: open }).chooseFrom(engineers).by("whose experience matches").run()).status).toBe(
      "uncertain",
    );
  });

  it("refuses empty candidate lists", () => {
    expect(() => createSense({ client: fake(() => yes(1)) }).given(open).chooseFrom([]).by("x").plan()).toThrow(
      /at least one candidate/,
    );
  });
});

describe("given().measure()", () => {
  const disruption = scale<Ticket>("how much the reported problem disrupts the customer's work")
    .from("Work continues normally")
    .through("A workaround exists")
    .to("The task cannot be completed");

  it("returns a position on the scale with its level", async () => {
    const client = fake(() => rate(1.8, 0.7, 3));
    const judgment = await createSense({ client }).given(open).measure(disruption).run();
    expect(judgment).toMatchObject({
      status: "decided",
      value: { score: 1.8, normalized: 0.9, level: 2, levelDescription: "The task cannot be completed" },
    });
  });

  it("is uncertain under the score confidence floor", async () => {
    const client = fake(() => rate(1.0, 0.2, 3));
    expect((await createSense({ client }).given(open).measure(disruption).run()).status).toBe("uncertain");
  });
});
