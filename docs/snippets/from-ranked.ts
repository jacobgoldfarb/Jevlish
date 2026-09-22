import { from } from "jevlish";
import { tickets } from "./support.js";
import { disruption, reportsProblem } from "./vocabulary.js";

const queue = await from(tickets)
  .seenAs((t) => ({ subject: t.subject, body: t.body }))
  .where((t) => t.status === "open")
  .and(reportsProblem)
  .rankedBy(disruption, "highest first")
  .take(5);

for (const { item, score, normalized } of queue.scored) {
  item.id; // an accepted ticket, highest disruption first
  score; // 0 .. disruption.top
  normalized; // 0 .. 1
}

// Ranking alone, with no filter, scores every item.
const byDisruption = await from(tickets).rankedBy(disruption, "lowest first");
byDisruption.accepted;
