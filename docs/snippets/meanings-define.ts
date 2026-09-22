import { means } from "jevlish";
import type { Ticket } from "./support.js";

export const blocked = means<Ticket>("the customer is currently unable to complete their task")
  // Inside the boundary: what the proposition covers. Becomes Noul criteria.true.
  .including("a product failure prevents them from completing the task")
  // Outside the boundary: what it does not cover, even when it looks close. Becomes criteria.false.
  .excluding("they can complete the task despite inconvenience, or they are only asking a question")
  // A name for traces, fixtures, and error messages.
  .named("blocked");
