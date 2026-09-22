import { means, scale } from "jevlish";
import type { Ticket } from "./support.js";

// A domain vocabulary. These are meanings, not prompts: named, composable,
// inspectable, and graded against fixtures like any other function.

export const blocked = means<Ticket>("the customer is currently unable to complete their task")
  .including("a product failure prevents them from completing the task")
  .excluding("they can complete the task despite inconvenience, or they are only asking a question")
  .named("blocked");

export const saysResolved = means<Ticket>("the customer says the problem has been resolved").named("saysResolved");

export const threatensToLeave = means<Ticket>("the customer says they will cancel or switch providers").named(
  "threatensToLeave",
);

export const isOpen = (t: Ticket) => t.status === "open";

export const needsAttention = blocked.unless(saysResolved).or(threatensToLeave).and(isOpen);

export const reportsProblem = means<Ticket>("the message reports a problem with the product")
  .including("something in the product is broken, failing, or behaving wrongly")
  .excluding("a how-to question, a feature request, or praise")
  .named("reportsProblem");

export const disruption = scale<Ticket>("how much the reported problem disrupts the customer's work")
  .from("Work continues normally; the problem affects appearance only")
  .through("The task remains possible through a workaround")
  .to("The task cannot be completed")
  .named("disruption");
