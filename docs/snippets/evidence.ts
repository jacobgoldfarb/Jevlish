import { given } from "jevlish";
import { ticket } from "./support.js";
import { needsAttention } from "./vocabulary.js";

const judgment = await given(ticket)
  .seenAs((t) => ({ subject: t.subject, body: t.body }))
  .when(needsAttention);

const { requests, judgments, policy } = judgment.evidence;

for (const record of judgments) {
  switch (record.kind) {
    case "code":
      record.truth; // boolean; the predicate's name is record.label
      break;
    case "noul":
      record.probability; // P(yes)
      record.truth; // true | false | "uncertain", after the policy
      break;
    case "choice":
      record.choice; // the option id; record.probabilities has the distribution
      break;
    case "score":
      record.score; // the expected position on the scale
      break;
  }
}

for (const request of requests) {
  request.state; // what the model saw
  request.questions; // what it was asked
  request.usage.input_tokens; // what it cost
  request.cached; // whether a cache answered instead
}

policy.noul.yesAbove; // the thresholds that turned probabilities into truth
