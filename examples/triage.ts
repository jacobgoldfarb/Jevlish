/**
 * Live example. Run with: npm run example
 *
 * Write the mechanics in code. Write the judgments in prose.
 */
import { createSense, type Judgment } from "../src/index.js";
import { blocked, disruption, engineers, needsAttention, reportsProblem, tickets, type Ticket } from "./domain.js";

const sense = createSense();

const show = (label: string, value: unknown) => console.log(`\n${label}\n${JSON.stringify(value, null, 2)}`);

// 1. Given -> when -> do. Three outcomes; uncertainty never falls through.
console.log("== given().when().do() ==");
for (const ticket of tickets) {
  const decision = await sense
    .given(ticket)
    .describedBy((t) => ({ subject: t.subject, body: t.body }))
    .when(needsAttention)
    .do(() => "escalate")
    .otherwise(() => "leave")
    .whenUncertain(() => "review")
    .run();
  const probs = decision.judgment.evidence.judgments
    .filter((j) => j.kind === "noul")
    .map((j) => `${j.label}=${j.probability.toFixed(2)}`)
    .join(" ");
  const code = decision.judgment.evidence.judgments.filter((j) => j.kind === "code").map((j) => `code=${j.truth}`);
  console.log(`${ticket.id} ${ticket.status.padEnd(6)} -> ${decision.branch.padEnd(9)} ${decision.result.padEnd(8)} [${[...code, probs].join(" ")}]`);
}

// 2. Inspect before running: what leaves the process, what is asked.
show("plan for T-1", sense.given(tickets[0]!).describedBy((t) => ({ body: t.body })).when(needsAttention).plan());

// 3. Collections: filter, rank by a scale, take.
console.log("\n== from().where().rankedBy().take() ==");
const ranked = await sense
  .from(tickets)
  .describedBy((t) => ({ subject: t.subject, body: t.body }))
  .where((t) => t.status === "open")
  .and(reportsProblem)
  .rankedBy(disruption, "highest first")
  .take(10)
  .run();
console.log("items:    ", ranked.scored?.map((s) => `${s.item.id}(${s.score.toFixed(2)})`).join(", "));
console.log("uncertain:", ranked.uncertain.map((t) => t.id).join(", ") || "-");
console.log("rejected: ", ranked.rejected.map((t) => t.id).join(", ") || "-");
console.log(`requests: ${ranked.evidence.requests.length}, tokens in: ${ranked.evidence.requests.reduce((n, r) => n + r.usage.input_tokens, 0)}`);

// 4. Choose an actual value from your own objects.
console.log("\n== given().chooseFrom().by() ==");
for (const ticket of [tickets[0]!, tickets[4]!, tickets[3]!]) {
  const owner: Judgment<(typeof engineers)[number] | null> = await sense
    .given({ ticket: { subject: ticket.subject, body: ticket.body } })
    .chooseFrom(engineers)
    .describedBy((e) => ({ expertise: e.expertise, recentWork: e.recentWork }))
    .by("whose experience best matches the problem described in ticket")
    .orNone("none of the engineers has relevant experience for this ticket")
    .run();
  const record = owner.evidence.judgments.find((j) => j.kind === "choice");
  console.log(
    `${ticket.id} -> ${owner.status === "decided" ? (owner.value?.name ?? "none") : "uncertain"} ` +
      `(confidence ${record?.kind === "choice" ? record.confidence.toFixed(2) : "?"})`,
  );
}

// 5. Measure a meaning against fixtures, like a unit test.
console.log("\n== measure(blocked, fixtures) ==");
const report = await sense.measure(
  blocked,
  tickets.map((t): { subject: Ticket; expected: boolean; note: string } => ({
    subject: t,
    expected: ["T-1", "T-5"].includes(t.id),
    note: t.id,
  })),
  { describedBy: (t) => ({ subject: t.subject, body: t.body }) },
);
console.log({
  accuracy: report.accuracy,
  coverage: report.coverage,
  falsePositives: report.falsePositives,
  falseNegatives: report.falseNegatives,
  abstentions: report.abstained.map((a) => a.fixture.note),
  misjudged: report.misjudged.map((m) => m.fixture.note),
});
