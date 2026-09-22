/**
 * insights: mine user feedback for product insights.
 *
 *   npm start          the report
 *   npm run plan       what would be sent, without spending anything
 *   npm run trace      every probability behind every judgment
 *
 * One request per message asks ten independent things. Everything after that
 * is counting and grouping in ordinary code. Every number in the report is a
 * count of judgments; every quote is a user's own words.
 */
import { parseArgs } from "node:util";
import { isDecided, type Judgment } from "jevlish";
import { type Feedback, type Plan, feedback } from "./feedback.js";
import { AREAS, type Area, type Feature } from "./product.js";
import { sense } from "./sense.js";
import {
  area,
  churnRisk,
  confused,
  describesProblem,
  describesWorkaround,
  existingFeature,
  praise,
  reproducible,
  requestsChange,
  severity,
} from "./vocabulary.js";

const { values: flags } = parseArgs({
  options: { plan: { type: "boolean", default: false }, trace: { type: "boolean", default: false } },
});

const askAbout = (item: Feedback) =>
  sense
    .given(item)
    .describedBy((f) => ({ message: f.text }))
    .ask({
      problem: describesProblem,
      request: requestsChange,
      workaround: describesWorkaround,
      confused,
      churnRisk,
      praise,
      reproducible,
      severity,
      area,
      existingFeature,
      paying: (f) => f.plan !== "free",
    });

type Profile = Awaited<ReturnType<ReturnType<typeof askAbout>["run"]>>;
interface Row {
  item: Feedback;
  answers: Profile;
}

async function main(): Promise<void> {
  if (flags.plan) {
    showPlan();
    return;
  }

  const rows = await loadRows();
  printHeader(rows);
  printPain(rows);
  printWorkarounds(rows);
  printAlreadyShipped(rows);
  printChurn(rows);
  printConfusion(rows);
  printEngineeringReady(rows);
  printPraise(rows);
  printUnplaced(rows);
  printCost(rows);
  if (flags.trace) trace(rows);
}

function showPlan(): void {
  const plan = askAbout(feedback[0]!).plan();
  console.log(`${feedback.length} messages → ${feedback.length} requests, ${plan.questionCount} questions each`);
  console.log(dim("first request as it would be sent:"));
  console.log(dim(JSON.stringify(plan.requests[0], null, 2)));
}

async function loadRows(): Promise<Row[]> {
  return Promise.all(feedback.map(async (item) => ({ item, answers: await askAbout(item).run() })));
}

function printHeader(rows: Row[]): void {
  const sources = count(rows.map((row) => row.item.source));
  const mix = Object.entries(sources)
    .map(([source, tally]) => `${source} ${tally}`)
    .join(", ");
  console.log(bold(`Ledgerly · ${rows.length} pieces of feedback`) + dim(`  (${mix})`));
}

function printPain(rows: Row[]): void {
  heading("Where the pain is");
  const perArea = areaCounts(rows);
  const maxPain = perArea[0]?.pain ?? 1;
  console.log(dim(`  ${"".padEnd(20)} ${"".padEnd(12)}  msgs  problems  severity  churn  workarounds  confused  praise`));
  for (const counts of perArea) {
    console.log(
      `  ${counts.area.name.padEnd(20)} ${bar(counts.pain, maxPain)}  ${String(counts.all).padStart(4)}  ${String(counts.problems).padStart(8)}  ` +
        `${(counts.scored ? counts.meanSeverity.toFixed(1) : "-").padStart(8)}  ${String(counts.churn).padStart(5)}  ${String(counts.workarounds).padStart(11)}  ${String(counts.confused).padStart(8)}  ${String(counts.praise).padStart(6)}`,
    );
  }
  console.log(dim(`  bar = problems × (1 + mean severity on a 0–${severity.top} scale)`));
  printUncounted(rows);
}

function printUncounted(rows: Row[]): void {
  const unsure = (judgment: (row: Row) => Judgment<unknown>) =>
    rows.filter((row) => judgment(row).status === "uncertain").length;
  console.log(
    dim(
      `  uncertain, not counted: problems ${unsure((row) => row.answers.problem)}, severity ${unsure((row) => row.answers.severity)}, ` +
        `churn ${unsure((row) => row.answers.churnRisk)}, workarounds ${unsure((row) => row.answers.workaround)}, ` +
        `confused ${unsure((row) => row.answers.confused)}, praise ${unsure((row) => row.answers.praise)}, area ${unsure((row) => row.answers.area)}`,
    ),
  );
}

function printWorkarounds(rows: Row[]): void {
  heading("What people build to get around us");
  console.log(dim("  A workaround is a feature request with proof of demand."));
  printGroups(
    rows.filter((row) => yes(row.answers.workaround)),
    (row) => areaOf(row)?.name ?? "Unplaced",
  );
}

function printAlreadyShipped(rows: Row[]): void {
  heading("Asked for something that already exists");
  console.log(dim("  Discoverability, not roadmap."));
  const rediscovered = rows.filter((row) => yes(row.answers.request) && value(row.answers.existingFeature));
  for (const [name, group] of groupBy(rediscovered, (row) => (value(row.answers.existingFeature) as Feature).name)) {
    console.log(`  ${bold(name)} ${dim(`← ${group.length}`)}`);
    for (const row of group) console.log(quote(row));
  }
}

function printChurn(rows: Row[]): void {
  heading("Who is about to leave");
  const churners = rows.filter((row) => yes(row.answers.churnRisk));
  for (const [plan, group] of groupBy(churners, (row) => row.item.plan)) {
    const areas = count(group.map((row) => areaOf(row)?.name ?? "unplaced"));
    const top = Object.entries(areas).sort((a, b) => b[1] - a[1])[0];
    const total = rows.filter((row) => row.item.plan === plan).length;
    console.log(
      `  ${bold(plan as Plan)} ${dim(`${group.length} of ${total} messages`)}` +
        (top && top[1] > 1 ? ` — ${top[1]} of ${group.length} about ${bold(top[0])}` : ""),
    );
    for (const row of group.sort(bySeverity)) console.log(quote(row, areaOf(row) ? `, ${areaOf(row)!.name}` : ""));
  }
}

function printConfusion(rows: Row[]): void {
  heading("Confusion → docs or UX, not engineering");
  printGroups(
    rows.filter((row) => yes(row.answers.confused)),
    (row) => areaOf(row)?.name ?? "Unplaced",
  );
}

function printEngineeringReady(rows: Row[]): void {
  heading("Engineering-ready");
  console.log(dim("  Problem + enough detail to reproduce, most severe first."));
  const ready = rows.filter((row) => yes(row.answers.problem) && yes(row.answers.reproducible)).sort(bySeverity);
  for (const row of ready) {
    console.log(quote(row, `, ${areaOf(row)?.name ?? "unplaced"}, severity ${severityOf(row)?.toFixed(1) ?? "?"}`));
  }
}

function printPraise(rows: Row[]): void {
  heading("What people love");
  const loved = areaCounts(rows)
    .filter((counts) => counts.praise > 0)
    .sort((a, b) => b.praise - a.praise);
  console.log(`  ${loved.map((counts) => `${counts.area.name} ${dim(String(counts.praise))}`).join("   ")}`);
  for (const row of rows.filter((row) => yes(row.answers.praise) && !yes(row.answers.problem)).slice(0, 3)) {
    console.log(quote(row));
  }
}

function printUnplaced(rows: Row[]): void {
  heading("Couldn't place");
  console.log(dim("  Area unresolved, or nothing about the message was decided. A person should look, or nobody should."));
  const unplaced = rows.filter(
    (row) => !areaOf(row) && !yes(row.answers.praise) && !yes(row.answers.problem) && !yes(row.answers.request),
  );
  for (const row of unplaced) {
    console.log(quote(row, `, area ${row.answers.area.status === "uncertain" ? "uncertain" : "none"}`));
  }
}

function printCost(rows: Row[]): void {
  const requests = rows.flatMap((row) => row.answers.problem.evidence.requests);
  const tokens = requests.reduce((sum, request) => sum + request.usage.input_tokens + request.usage.output_tokens, 0);
  console.log(
    dim(
      `\n${requests.length} requests, ${tokens.toLocaleString()} tokens, ${requests[0]?.model ?? "?"}. Every number above is a count of judgments; every quote is a user's own words.`,
    ),
  );
}

interface AreaCounts {
  area: Area;
  all: number;
  problems: number;
  scored: number;
  meanSeverity: number;
  pain: number;
  churn: number;
  workarounds: number;
  confused: number;
  praise: number;
}

function areaCounts(rows: Row[]): AreaCounts[] {
  return AREAS.map((productArea) => {
    const here = rows.filter((row) => areaOf(row)?.name === productArea.name);
    const problems = here.filter((row) => yes(row.answers.problem));
    const scores = problems.map(severityOf).filter((score): score is number => score !== undefined);
    const meanSeverity = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    return {
      area: productArea,
      all: here.length,
      problems: problems.length,
      scored: scores.length,
      meanSeverity,
      pain: painScore(problems.length, meanSeverity),
      churn: here.filter((row) => yes(row.answers.churnRisk)).length,
      workarounds: here.filter((row) => yes(row.answers.workaround)).length,
      confused: here.filter((row) => yes(row.answers.confused)).length,
      praise: here.filter((row) => yes(row.answers.praise)).length,
    };
  }).sort((a, b) => b.pain - a.pain);
}

function painScore(problemCount: number, meanSeverity: number): number {
  return problemCount * (1 + meanSeverity);
}

const yes = (judgment: Judgment<boolean>) => isDecided(judgment) && judgment.value;
const value = <T>(judgment: Judgment<T>): T | undefined => (isDecided(judgment) ? judgment.value : undefined);
const areaOf = (row: Row): Area | undefined => value(row.answers.area) ?? undefined;
const severityOf = (row: Row): number | undefined => value(row.answers.severity)?.score;
const bySeverity = (a: Row, b: Row) => (severityOf(b) ?? -1) - (severityOf(a) ?? -1);

function printGroups(rows: Row[], key: (row: Row) => string): void {
  for (const [name, group] of groupBy(rows, key)) {
    console.log(`  ${bold(name)} ${dim(`(${group.length})`)}`);
    for (const row of group) console.log(quote(row));
  }
}

const bold = (text: string) => `\x1b[1m${text}\x1b[0m`;
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const heading = (text: string) => console.log(`\n${bold(text.toUpperCase())}`);
const quote = (row: Row, extra = "") =>
  `  ${dim("“")}${clip(row.item.text, 110)}${dim("”")} ${dim(`— ${row.item.plan}, ${row.item.tenureMonths} mo, ${row.item.source}${extra}`)}`;
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const bar = (n: number, max: number, width = 12) => "█".repeat(Math.round((n / Math.max(max, 1)) * width)).padEnd(width);

function trace(rows: Row[]): void {
  console.log(`\n${bold("TRACE")}`);
  for (const row of rows) {
    console.log(`\n#${row.item.id} ${dim(clip(row.item.text, 90))}`);
    for (const judgment of row.answers.problem.evidence.judgments) {
      if (judgment.kind === "noul") console.log(`   ${judgment.probability.toFixed(2)} ${String(judgment.truth).padEnd(9)} ${judgment.label}`);
      else if (judgment.kind === "score")
        console.log(
          `   ${judgment.score.toFixed(2)} conf ${judgment.confidence.toFixed(2)} ${judgment.accepted ? "" : "(uncertain)"} ${judgment.label}`,
        );
      else if (judgment.kind === "choice")
        console.log(
          `   ${judgment.choice.padEnd(14)} conf ${judgment.confidence.toFixed(2)} ${judgment.accepted ? "" : "(uncertain)"} ${clip(judgment.label, 60)}`,
        );
      else console.log(`   code ${judgment.label} → ${judgment.truth}`);
    }
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

function count(keys: string[]): Record<string, number> {
  return keys.reduce<Record<string, number>>((acc, key) => ({ ...acc, [key]: (acc[key] ?? 0) + 1 }), {});
}

await main();
