/**
 * support-desk: a support inbox triaged with jevlish.
 *
 *   npm start            run the pipeline and print the desk report
 *   npm run plan         show what would be sent, without spending anything
 *   npm run trace        run, then dump the evidence behind each decision
 *   npm run measure      test the vocabulary against fixtures
 *
 * The mechanics (status checks, on-call rosters, sorting, the actions
 * themselves) are code. The judgments are prose.
 */
import { parseArgs } from "node:util";
import { createSense, memoryCache, type Decision, type Evidence, type Judgment, type Plan, type RankedQueryResult } from "jevlish";
import { type Engineer, type Incident, type Ticket, engineers, incidents, tickets } from "./data.js";
import { blockedFixtures } from "./fixtures.js";
import { blocked, disruption, needsAttention, reportsProblem } from "./vocabulary.js";

const { values: flags } = parseArgs({
  options: {
    plan: { type: "boolean", default: false },
    trace: { type: "boolean", default: false },
    measure: { type: "boolean", default: false },
  },
});

const sense = createSense({
  cache: memoryCache(),
  // Escalation pages a human; be stricter about "yes" than about "no".
  policy: { noul: { yesAbove: 0.85, noBelow: 0.15 } },
});

const heading = (title: string) => console.log(`\n\x1b[1m${title}\x1b[0m`);
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const show = (ticket: Ticket) => `${ticket.id} ${dim(`(${ticket.customer}, ${ticket.plan})`)} ${ticket.subject}`;

// ---------------------------------------------------------------------------
// Actions. Ordinary functions; the model only picks which one runs.
// ---------------------------------------------------------------------------

const desk = {
  escalated: [] as Ticket[],
  review: [] as Ticket[],
  unchanged: [] as Ticket[],
};

function escalate(ticket: Ticket): "escalated" {
  desk.escalated.push(ticket);
  return "escalated";
}
function flagForReview(ticket: Ticket): "review" {
  desk.review.push(ticket);
  return "review";
}
function leaveUnchanged(ticket: Ticket): "unchanged" {
  desk.unchanged.push(ticket);
  return "unchanged";
}

// ---------------------------------------------------------------------------
// The pipeline. Each stage is one expression; each reads as a sentence.
// ---------------------------------------------------------------------------

const describeTicket = (ticket: Ticket) => ({ subject: ticket.subject, body: ticket.body });

/** Given this ticket, when it needs attention, escalate; otherwise leave it; when uncertain, review. */
const escalationPolicy = (ticket: Ticket) =>
  sense
    .given(ticket)
    .describedBy(describeTicket)
    .when(needsAttention)
    .do(escalate)
    .otherwise(leaveUnchanged)
    .whenUncertain(flagForReview);

/** From the open tickets that report a product problem, ranked by disruption, take five. */
const priorityQueue = sense
  .from(tickets)
  .describedBy(describeTicket)
  .where((ticket) => ticket.status === "open")
  .and(reportsProblem)
  .rankedBy(disruption, "highest first")
  .take(5);

/** Given this ticket, choose the known incident that explains it — or none. */
const linkIncident = (ticket: Ticket) =>
  sense
    .given({ ticket: describeTicket(ticket) })
    .chooseFrom(incidents)
    .describedBy((incident) => ({ title: incident.title, summary: incident.summary }))
    .by("the incident that explains the problem described in ticket")
    .orNone("no listed incident explains this ticket");

/** Given this ticket, choose an on-call engineer whose experience matches — or none. */
const chooseOwner = (ticket: Ticket) =>
  sense
    .given({ ticket: describeTicket(ticket) })
    .chooseFrom(engineers.filter((engineer) => engineer.onCall))
    .describedBy((engineer) => ({ expertise: engineer.expertise, recentWork: engineer.recentWork }))
    .by("whose experience best matches the problem described in ticket")
    .orNone("none of these engineers has relevant experience for this ticket");

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

interface DeskTrace {
  readonly label: string;
  readonly evidence: Evidence;
}

interface DeskReport {
  readonly escalations: ReadonlyArray<{
    ticket: Ticket;
    decision: Decision<"escalated" | "unchanged" | "review">;
  }>;
  readonly queue: RankedQueryResult<Ticket>;
  readonly incidents: ReadonlyArray<{ ticket: Ticket; link: Judgment<Incident | null> }>;
  readonly owners: ReadonlyArray<{ ticket: Ticket; owner: Judgment<Engineer | null> }>;
  readonly traces: readonly DeskTrace[];
}

async function triage(): Promise<DeskReport> {
  const traces: DeskTrace[] = [];
  const escalations: DeskReport["escalations"][number][] = [];
  for (const ticket of tickets) {
    const decision = await escalationPolicy(ticket).run();
    traces.push({ label: `escalation ${ticket.id}`, evidence: decision.judgment.evidence });
    escalations.push({ ticket, decision });
  }

  const queue = await priorityQueue.run();
  traces.push({ label: "priority queue", evidence: queue.evidence });

  const incidents: DeskReport["incidents"][number][] = [];
  for (const ticket of queue.items) {
    const link = await linkIncident(ticket).run();
    traces.push({ label: `incident ${ticket.id}`, evidence: link.evidence });
    incidents.push({ ticket, link });
  }

  const owners: DeskReport["owners"][number][] = [];
  for (const ticket of desk.escalated) {
    const owner = await chooseOwner(ticket).run();
    traces.push({ label: `owner ${ticket.id}`, evidence: owner.evidence });
    owners.push({ ticket, owner });
  }

  return { escalations, queue, incidents, owners, traces };
}

function printDesk(report: DeskReport): void {
  heading("Escalation policy");
  for (const { ticket, decision } of report.escalations) {
    console.log(`  ${decision.result.padEnd(9)} ${show(ticket)} ${dim(probabilities(decision.judgment.evidence))}`);
  }

  heading("Priority queue (open, reports a problem, most disruptive first)");
  report.queue.scored?.forEach((entry, index) =>
    console.log(`  ${index + 1}. ${show(entry.item)} ${dim(`disruption ${entry.score.toFixed(2)} / ${disruption.top}`)}`),
  );
  if (report.queue.uncertain.length) {
    console.log(`  ${dim("unresolved:")} ${report.queue.uncertain.map((ticket) => ticket.id).join(", ")}`);
  }

  heading("Known incidents (open tickets in the queue)");
  for (const { ticket, link } of report.incidents) {
    console.log(`  ${ticket.id} ← ${incidentLabel(link)} ${dim(confidence(link.evidence))}`);
  }

  heading("Suggested owners for escalations");
  for (const { ticket, owner } of report.owners) {
    console.log(`  ${ticket.id} → ${ownerName(owner)} ${dim(confidence(owner.evidence))}`);
  }

  heading("Summary");
  console.log(`  escalated: ${desk.escalated.map((ticket) => ticket.id).join(", ") || "-"}`);
  console.log(`  review:    ${desk.review.map((ticket) => ticket.id).join(", ") || "-"}`);
  console.log(`  unchanged: ${desk.unchanged.map((ticket) => ticket.id).join(", ") || "-"}`);
  const requests = report.traces.flatMap((trace) => trace.evidence.requests);
  const tokens = requests.reduce((sum, request) => sum + request.usage.input_tokens + request.usage.output_tokens, 0);
  console.log(dim(`  ${requests.length} requests, ${tokens} tokens, model ${requests[0]?.model ?? "?"}`));

  if (flags.trace) {
    heading("Trace");
    for (const { label, evidence } of report.traces) {
      console.log(`\n  ${label}`);
      for (const judgment of evidence.judgments) console.log(`    ${formatJudgment(judgment)}`);
    }
  }
}

function incidentLabel(link: Judgment<Incident | null>): string {
  if (link.status === "uncertain") return "uncertain";
  if (link.value) return `${link.value.id} ${dim(link.value.title)}`;
  return dim("no known incident");
}

function ownerName(owner: Judgment<Engineer | null>): string {
  if (owner.status === "uncertain") return "uncertain — assign by hand";
  return owner.value?.name ?? "none on call fits";
}

async function runDesk(): Promise<void> {
  const report = await triage();
  printDesk(report);
}

function showPlan(): void {
  const print = (title: string, plan: Plan) => {
    heading(title);
    console.log(`  subjects ${plan.subjects}, settled by code ${plan.decidedByCode}, ` +
      `questions ${plan.questionCount}, requests ${plan.requestCount}`);
    for (const note of plan.notes) console.log(`  ${dim(note)}`);
    const sample = plan.requests[0];
    if (sample) {
      console.log(dim("  first request:"));
      console.log(dim(indent(JSON.stringify(sample, null, 2), 4)));
    }
  };
  const first = tickets[0]!;
  print(`Escalation policy for ${first.id}`, escalationPolicy(first).plan());
  print("Priority queue", priorityQueue.plan());
  print(`Incident for ${first.id}`, linkIncident(first).plan());
  print(`Owner for ${first.id}`, chooseOwner(first).plan());
}

async function measureVocabulary(): Promise<void> {
  heading(`grade(blocked) over ${blockedFixtures.length} fixtures`);
  const report = await sense.grade(blocked, blockedFixtures, { describedBy: describeTicket });
  console.log(`  accuracy ${fmt(report.accuracy)}  coverage ${fmt(report.coverage)}`);
  console.log(`  false positives ${report.falsePositives}, false negatives ${report.falseNegatives}, abstentions ${report.abstentions}`);
  for (const { fixture } of report.misjudged) console.log(`  misjudged: ${fixture.note}`);
  for (const { fixture } of report.abstained) console.log(`  abstained: ${fixture.note}`);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function probabilities(evidence: Evidence): string {
  return evidence.judgments
    .map((j) => (j.kind === "noul" ? `${j.label}=${j.probability.toFixed(2)}` : j.kind === "code" ? `code=${j.truth}` : ""))
    .filter(Boolean)
    .join(" ");
}

function confidence(evidence: Evidence): string {
  const record = evidence.judgments.find((j) => j.kind === "choice");
  return record?.kind === "choice" ? `confidence ${record.confidence.toFixed(2)}` : "";
}

function formatJudgment(judgment: Evidence["judgments"][number]): string {
  switch (judgment.kind) {
    case "code":
      return `code       ${judgment.label} → ${judgment.truth}`;
    case "noul":
      return `noul  ${judgment.probability.toFixed(2)} ${String(judgment.truth).padEnd(9)} ${judgment.label}`;
    case "score":
      return `score ${judgment.score.toFixed(2)} conf ${judgment.confidence.toFixed(2)} ${judgment.accepted ? "accepted" : "uncertain"} ${judgment.label}`;
    case "choice":
      return `choice ${judgment.choice} conf ${judgment.confidence.toFixed(2)} ${judgment.accepted ? "accepted" : "uncertain"}`;
  }
}

const fmt = (value: number | null) => (value === null ? "n/a" : `${(value * 100).toFixed(0)}%`);
const indent = (text: string, spaces: number) => text.split("\n").map((line) => " ".repeat(spaces) + line).join("\n");

// ---------------------------------------------------------------------------

if (flags.plan) showPlan();
else if (flags.measure) await measureVocabulary();
else await runDesk();
