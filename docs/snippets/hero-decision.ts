import { given, means } from "jevlish";
import { escalate, leave, review, ticket, type Ticket } from "./support.js";

const blocked = means<Ticket>("the customer cannot complete their task")
  .excluding("they can finish the task despite the inconvenience");

const decision = await given(ticket)
  .seenAs((t) => ({ subject: t.subject, body: t.body }))
  .when(blocked)
  .and((t) => t.status === "open")
  .do(escalate)
  .otherwise(leave)
  .whenUncertain(review);

decision.branch; // "do" | "otherwise" | "uncertain"
