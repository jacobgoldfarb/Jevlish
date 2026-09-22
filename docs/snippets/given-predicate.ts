import { given } from "jevlish";
import { ticket } from "./support.js";
import { blocked, saysResolved } from "./vocabulary.js";

// A predicate without a branch resolves to a Judgment<boolean>.
const judgment = await given(ticket)
  .when(blocked)
  .unless(saysResolved)
  .and((t) => t.status === "open");

if (judgment.status === "decided") {
  judgment.value; // true or false
} else {
  judgment.evidence; // the requests and answers that failed to settle it
}
