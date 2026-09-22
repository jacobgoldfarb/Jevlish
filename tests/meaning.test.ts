import { describe, expect, it } from "vitest";
import { means, not, scale } from "../src/index.js";

interface Ticket {
  status: "open" | "closed";
  body: string;
}

describe("means()", () => {
  it("keeps composition as expression nodes, never concatenated prose", () => {
    const blocked = means<Ticket>("the customer cannot continue their work")
      .including("a product failure prevents them from completing the task")
      .excluding("they can complete the task despite inconvenience")
      .named("blocked");

    const needsAttention = blocked
      .and((ticket) => ticket.status === "open")
      .unless("the customer says the problem has been resolved");

    expect(needsAttention.node.type).toBe("and");
    expect(needsAttention.describe()).toBe(
      '((blocked: "the customer cannot continue their work" and code predicate) and not "the customer says the problem has been resolved")',
    );
    expect(blocked.node).toMatchObject({
      type: "semantic",
      proposition: "the customer cannot continue their work",
      including: "a product failure prevents them from completing the task",
      excluding: "they can complete the task despite inconvenience",
      name: "blocked",
    });
  });

  it("refuses boundary descriptions on composites", () => {
    const composite = means("a").and("b");
    expect(() => composite.including("x")).toThrow(/single proposition/);
    expect(() => composite.excluding("x")).toThrow(/single proposition/);
  });

  it("negates and serializes", () => {
    const resolved = not<Ticket>("the problem has been resolved");
    expect(resolved.node.type).toBe("not");
    expect(JSON.parse(JSON.stringify(means("x").named("x").and("y")))).toEqual({
      expression: {
        and: [{ proposition: "x", name: "x" }, { proposition: "y" }],
      },
    });
  });

  it("rejects empty propositions", () => {
    expect(() => means("   ")).toThrow(/non-empty/);
  });
});

describe("scale()", () => {
  it("builds ordered levels", () => {
    const disruption = scale<Ticket>("how much the problem disrupts work")
      .from("work continues normally")
      .through("a workaround exists")
      .to("the task cannot be completed");
    expect(disruption.levels).toHaveLength(3);
    expect(disruption.top).toBe(2);
    expect(disruption.toQuestion()).toEqual({
      type: "score",
      instructions: "how much the problem disrupts work",
      criteria: ["work continues normally", "a workaround exists", "the task cannot be completed"],
    });
  });

  it("caps levels at ten", () => {
    let builder = scale("x").from("0");
    for (let i = 1; i < 10; i += 1) builder = builder.through(String(i));
    expect(() => builder.to("10")).toThrow(/at most 10/);
  });
});
