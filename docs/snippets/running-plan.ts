import { from } from "jevlish";
import { tickets } from "./support.js";
import { disruption, reportsProblem } from "./vocabulary.js";

const query = from(tickets)
  .seenAs((t) => ({ subject: t.subject, body: t.body }))
  .where((t) => t.status === "open")
  .and(reportsProblem)
  .rankedBy(disruption)
  .take(5);

// Nothing has been sent yet. The query is a value.
const plan = query.plan();

plan.subjectCount; // 3
plan.decidedByCode; // 1: the closed ticket never reaches the model
plan.questionCount; // one Noul and one Score for each of the other two
plan.requestCount; // 2
plan.requests[0]?.state; // exactly what leaves the process for the first subject
plan.notes; // ["filter: ...", 'ranked by "...", highest first', "take 5"]

// Now spend.
const result = await query;
result.scored;
