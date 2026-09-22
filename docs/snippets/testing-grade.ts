import { grade, type Fixture } from "jevlish";
import { tickets, type Ticket } from "./support.js";
import { blocked } from "./vocabulary.js";

// `expected` is what a careful person would answer.
const fixtures: Fixture<Ticket>[] = tickets.map((t) => ({
  subject: t,
  expected: ["T-1", "T-3"].includes(t.id),
  note: t.id,
}));

const report = await grade(blocked, fixtures, { seenAs: (t) => ({ subject: t.subject, body: t.body }) });

report.accuracy; // correct over decided; null when nothing was decided
report.coverage; // decided over total
report.falsePositives; // decided true, expected false
report.falseNegatives; // decided false, expected true
report.abstentions; // uncertain: a policy outcome, not a wrong answer
report.misjudged.map((m) => m.fixture.note);
report.abstained.map((a) => a.fixture.note);
