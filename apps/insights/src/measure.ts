/**
 * Test the vocabulary the way you test a function. When the report is wrong,
 * the fix is a sentence in vocabulary.ts, and this tells you whether it helped.
 *
 *   npm run measure
 */
import type { Fixture } from "jevlish";
import type { Feedback } from "./feedback.js";
import { sense } from "./sense.js";
import { churnRisk, describesWorkaround } from "./vocabulary.js";

const msg = (text: string, expected: boolean, note?: string): Fixture<Feedback> => ({
  subject: { id: 0, source: "nps", plan: "pro", tenureMonths: 6, text },
  expected,
  ...(note ? { note } : {}),
});

const suites = {
  workaround: [
    msg("I export every Friday and paste into Sheets for my partner.", true, "manual routine"),
    msg("Wrote a cron job against the API to dump reports to S3.", true, "script"),
    msg("Zapier zap emails the CSV to my accountant every Monday.", true, "third-party automation"),
    msg("Please add scheduled exports.", false, "plain request"),
    msg("I use the mobile app to send invoices from client sites.", false, "intended use"),
    msg("Export is broken in Safari.", false, "bug"),
  ],
  churnRisk: [
    msg("We're evaluating Xero because there are no roles.", true),
    msg("Moving to FreshBooks next quarter unless permissions improve.", true, "conditional"),
    msg("Downgrading; business is slow, nothing wrong with the product.", true, "downgrade"),
    msg("Cheaper than FreshBooks and easier than QuickBooks.", false, "comparison, staying"),
    msg("Stripe payout took 9 days this time.", false, "complaint only"),
    msg("Five stars, never going back to spreadsheets.", false),
  ],
};

const meanings = { workaround: describesWorkaround, churnRisk };

for (const name of Object.keys(suites) as Array<keyof typeof suites>) {
  const fixtures = suites[name];
  const report = await sense.grade(meanings[name], fixtures, { describedBy: (f) => ({ message: f.text }) });
  const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);
  console.log(`\n\x1b[1m${name}\x1b[0m  ${fixtures.length} fixtures  accuracy ${pct(report.accuracy)}  coverage ${pct(report.coverage)}  FP ${report.falsePositives}  FN ${report.falseNegatives}  abstained ${report.abstentions}`);
  for (const { fixture, judgment } of report.misjudged) {
    const p = judgment.evidence.judgments.find((j) => j.kind === "noul");
    console.log(`  \x1b[31mwrong\x1b[0m     ${fixture.subject.text.slice(0, 60).padEnd(60)} expected ${fixture.expected} p=${p?.kind === "noul" ? p.probability.toFixed(2) : "?"} ${fixture.note ?? ""}`);
  }
  for (const { fixture, judgment } of report.abstained) {
    const p = judgment.evidence.judgments.find((j) => j.kind === "noul");
    console.log(`  \x1b[33mabstained\x1b[0m ${fixture.subject.text.slice(0, 60).padEnd(60)} expected ${fixture.expected} p=${p?.kind === "noul" ? p.probability.toFixed(2) : "?"} ${fixture.note ?? ""}`);
  }
}
