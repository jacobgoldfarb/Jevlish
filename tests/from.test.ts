import { describe, expect, it } from "vitest";
import { createSense, means, scale } from "../src/index.js";
import { fake, rate, textOf, yes } from "./fake.js";

interface Ticket {
  id: string;
  status: "open" | "closed";
  body: string;
  disruption: number;
}

const tickets: Ticket[] = [
  { id: "a", status: "open", body: "Export crashes; cannot invoice.", disruption: 2 },
  { id: "b", status: "closed", body: "Logo is blurry.", disruption: 0 },
  { id: "c", status: "open", body: "Search is slow but works.", disruption: 1 },
  { id: "d", status: "open", body: "Hi, how do I change my password?", disruption: 0 },
  { id: "e", status: "open", body: "Maybe a bug? Not sure. Sometimes exports look odd.", disruption: 1 },
];

const reportsProblem = means<Ticket>("the message reports a problem with the product");

const disruption = scale<Ticket>("how much the reported problem disrupts the customer's work")
  .from("Work continues normally")
  .through("A workaround exists")
  .to("The task cannot be completed");

/** Answers by looking up the ticket in the state; "e" is deliberately ambiguous. */
const oracle = fake((question, state) => {
  const ticket = state as unknown as Ticket;
  if (question.type === "score") return rate(ticket.disruption, 0.9, 3);
  if (textOf(question).includes("reports a problem")) {
    if (ticket.id === "e") return yes(0.5);
    return yes(ticket.id === "d" ? 0.02 : 0.98);
  }
  throw new Error(`unexpected question ${textOf(question)}`);
});

describe("from().where()", () => {
  it("filters with code first, then judges, then ranks and limits deterministically", async () => {
    const result = await createSense({ client: oracle })
      .from(tickets)
      .where((ticket) => ticket.status === "open")
      .and(reportsProblem)
      .rankedBy(disruption, "highest first")
      .take(10)
      .run();

    expect(result.accepted.map((ticket) => ticket.id)).toEqual(["a", "c"]);
    expect(result.uncertain.map((ticket) => ticket.id)).toEqual(["e"]);
    expect(result.rejected.map((ticket) => ticket.id).sort()).toEqual(["b", "d"]);
    expect(result.scored?.map((entry) => entry.score)).toEqual([2, 1]);
  });

  it("sends one request per item that needs inference, with filter and scale together", () => {
    const plan = createSense({ client: oracle })
      .from(tickets)
      .where((ticket) => ticket.status === "open")
      .and(reportsProblem)
      .rankedBy(disruption)
      .plan();

    expect(plan.subjectCount).toBe(5);
    expect(plan.decidedByCode).toBe(1);
    expect(plan.requestCount).toBe(4);
    expect(plan.questionCount).toBe(8);
    expect(Object.values(plan.requests[0]!.questions).map((question) => question.type)).toEqual(["noul", "score"]);
    expect(plan.notes.some((note) => note.startsWith("ranked by"))).toBe(true);
  });

  it("retains items whose ranking judgment failed the policy as uncertain", async () => {
    const shaky = fake((question) => (question.type === "score" ? rate(1, 0.1, 3) : yes(0.99)));
    const result = await createSense({ client: shaky }).from(tickets).where(reportsProblem).rankedBy(disruption).run();
    expect(result.accepted).toEqual([]);
    expect(result.uncertain).toHaveLength(5);
  });

  it("ranks lowest first when asked", async () => {
    const result = await createSense({ client: oracle })
      .from(tickets.filter((ticket) => ticket.id !== "e"))
      .rankedBy(disruption, "lowest first")
      .run();
    expect(result.accepted.map((ticket) => ticket.disruption)).toEqual([0, 0, 1, 2]);
  });

  it("expresses relationships as a query over pairs built in code", async () => {
    const feedback = [
      { id: 1, text: "Please let me export to PDF." },
      { id: 2, text: "Dark mode would save my eyes." },
    ];
    const roadmap = [
      { key: "PDF", title: "PDF export" },
      { key: "THEME", title: "Dark theme" },
    ];
    const pairs = feedback.flatMap((request) => roadmap.map((feature) => ({ request, feature })));
    const client = fake((_question, state) => {
      const pair = state as unknown as (typeof pairs)[number];
      const match = (pair.request.id === 1 && pair.feature.key === "PDF") || (pair.request.id === 2 && pair.feature.key === "THEME");
      return yes(match ? 0.97 : 0.03);
    });

    const { accepted } = await createSense({ client })
      .from(pairs)
      .where("feature would address the need described in request")
      .run();

    expect(accepted).toEqual([
      { request: feedback[0], feature: roadmap[0] },
      { request: feedback[1], feature: roadmap[1] },
    ]);
    expect(client.calls).toHaveLength(4);
    expect(client.calls[0]!.state).toEqual(pairs[0]);
  });
});
