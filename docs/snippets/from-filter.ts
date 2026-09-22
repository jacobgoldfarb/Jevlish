import { from } from "jevlish";
import { tickets } from "./support.js";
import { reportsProblem, saysResolved } from "./vocabulary.js";

const result = await from(tickets)
  .seenAs((t) => ({ subject: t.subject, body: t.body }))
  .where((t) => t.status === "open")
  .and(reportsProblem)
  .unless(saysResolved);

result.accepted; // Ticket[]: the condition resolved to true, in input order
result.rejected; // Ticket[]: resolved to false
result.uncertain; // Ticket[]: did not meet the policy; unresolved, not rejected
result.evidence.requests.length; // one request per item that needed the model
