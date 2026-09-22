import { describe, expect, it } from "vitest";
import { chooseFrom, createSense, means, scale } from "../src/index.js";
import { fake, pick as choose, rate, textOf, yes } from "./fake.js";

interface Feedback {
  text: string;
  plan: "free" | "pro";
}

const area = [
  { name: "Export", description: "getting data out" },
  { name: "Billing", description: "plans, invoices, payment" },
];

const problem = means<Feedback>("the message describes a problem the user experienced").named("problem");
const churn = means<Feedback>("the user says they will stop using the product").named("churn");
const severity = scale<Feedback>("how much the issue blocks the user")
  .from("cosmetic")
  .through("workaround exists")
  .to("blocked");

const feedback: Feedback = { text: "Exports have been failing all week. We're moving to a competitor.", plan: "pro" };

describe("given().ask()", () => {
  it("asks several independent things in one request and types each answer", async () => {
    const client = fake((question) => {
      if (question.type === "choice") return choose("option_1", 0.95, { option_1: 0.97, option_2: 0.03 });
      if (question.type === "score") return rate(2, 0.9, 3);
      return yes(textOf(question).includes("stop using") ? 0.93 : 0.97);
    });

    const answers = await createSense({ client })
      .given(feedback)
      .seenAs((f) => ({ text: f.text }))
      .ask({
        problem,
        churn,
        paying: (f) => f.plan !== "free",
        severity,
        area: chooseFrom(area)
          .seenAs((a) => a.description)
          .by("which part of the product the message is about")
          .orNone("not about any of these"),
      })
      .run();

    expect(client.calls).toHaveLength(1);
    expect(Object.values(client.calls[0]!.questions).map((q) => q.type)).toEqual(["noul", "noul", "score", "choice"]);

    expect(answers.problem).toMatchObject({ status: "decided", value: true });
    expect(answers.churn).toMatchObject({ status: "decided", value: true });
    expect(answers.paying).toMatchObject({ status: "decided", value: true });
    expect(answers.severity).toMatchObject({ status: "decided", value: { score: 2, level: 2 } });
    expect(answers.area).toMatchObject({ status: "decided", value: area[0] });

    // Type-level: the selection answer is Judgment<Area | null>, the scale answer Judgment<Measurement>.
    if (answers.area.status === "decided") {
      const name: string | undefined = answers.area.value?.name;
      void name;
    }
    if (answers.severity.status === "decided") {
      const normalized: number = answers.severity.value.normalized;
      void normalized;
    }
  });

  it("shares one evidence trail across all answers and records code judgments too", async () => {
    const client = fake(() => yes(0.99));
    const answers = await createSense({ client }).given(feedback).ask({ problem, paying: (f) => f.plan !== "free" }).run();
    expect(answers.problem.evidence).toBe(answers.paying.evidence);
    expect(answers.problem.evidence.judgments.map((j) => j.kind)).toEqual(["code", "noul"]);
  });

  it("sends nothing when every question is settled by code", async () => {
    const client = fake(() => yes(0.99));
    const answers = await createSense({ client }).given(feedback).ask({ paying: (f) => f.plan !== "free" }).run();
    expect(client.calls).toHaveLength(0);
    expect(answers.paying).toMatchObject({ status: "decided", value: true });
  });

  it("keeps uncertainty per answer", async () => {
    const client = fake((question) => (question.type === "score" ? rate(1, 0.1, 3) : yes(0.5)));
    const answers = await createSense({ client }).given(feedback).ask({ problem, severity }).run();
    expect(answers.problem.status).toBe("uncertain");
    expect(answers.severity.status).toBe("uncertain");
  });

  it("refuses an empty question set", () => {
    expect(() => createSense({ client: fake(() => yes(1)) }).given(feedback).ask({})).toThrow(/at least one/);
  });
});
