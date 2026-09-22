import { given } from "jevlish";
import { ticket } from "./support.js";
import { disruption } from "./vocabulary.js";

const measurement = await given(ticket)
  .seenAs((t) => ({ subject: t.subject, body: t.body }))
  .measure(disruption);

if (measurement.status === "decided") {
  const { score, normalized, level, levelDescription, confidence } = measurement.value;
  score; // expected position, 0 .. disruption.top
  normalized; // score / top
  level; // the most likely level's index
  levelDescription; // that level's text
  confidence; // what the policy compared against score.minConfidence
}
