import { all, any, means, not } from "jevlish";
import type { Ticket } from "./support.js";
import { blocked, saysResolved, threatensToLeave } from "./vocabulary.js";

const isOpen = (t: Ticket) => t.status === "open";

// Composition keeps nodes; it never rewrites the propositions.
export const needsAttention = blocked.unless(saysResolved).or(threatensToLeave).and(isOpen);

needsAttention.describe();
// (((blocked: "..." and not saysResolved: "...") or threatensToLeave: "...") and isOpen())

// The same shapes as functions, for when you start from strings or predicates.
export const escalatable = all("the customer reports a failure", isOpen, not(saysResolved));
export const noteworthy = any(blocked, threatensToLeave, means<Ticket>("the customer mentions a competitor"));
