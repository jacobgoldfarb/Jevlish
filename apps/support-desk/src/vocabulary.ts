/**
 * The domain vocabulary. These are the meanings the rest of the app speaks in.
 * They are named, composable, and measured like functions; see fixtures.ts.
 *
 * A meaning is a proposition plus the boundary drawn around it:
 * `.including()` is what falls inside, `.excluding()` what falls outside.
 */
import { means, scale } from "jevlish";
import type { Ticket } from "./data.js";

export const blocked = means<Ticket>("the customer is currently unable to complete their task")
  .including("a product failure prevents them from completing the task")
  .excluding("they can complete the task despite inconvenience, or they are only asking a question")
  .named("blocked");

export const saysResolved = means<Ticket>("the customer says the problem has been resolved").named("saysResolved");

export const threatensToLeave = means<Ticket>("the customer threatens to cancel or move to a competitor")
  .named("threatensToLeave");

/**
 * The escalation policy, as a sentence:
 * blocked (unless they say it's resolved), or threatening to leave — and the ticket is open.
 *
 * Note the shape: resolution only qualifies `blocked`. A churn threat needs
 * attention whether or not some earlier problem was fixed.
 */
export const needsAttention = blocked
  .unless(saysResolved)
  .or(threatensToLeave)
  .and((ticket) => ticket.status === "open");

export const reportsProblem = means<Ticket>("the message reports a problem with the product")
  .including("something in the product is broken, failing, or behaving wrongly")
  .excluding("a how-to question, a feature request, or praise")
  .named("reportsProblem");

export const disruption = scale<Ticket>("how much the reported problem disrupts the customer's work")
  .from("Work continues normally; the problem affects appearance only")
  .through("The task remains possible through a workaround")
  .to("The task cannot be completed")
  .named("disruption");

