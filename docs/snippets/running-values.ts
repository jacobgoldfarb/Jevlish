import { given } from "jevlish";
import type { Ticket } from "./support.js";
import { blocked } from "./vocabulary.js";

// Build expressions in plain functions so callers can still .plan() them.
export const isBlocked = (t: Ticket) => given(t).seenAs((x) => ({ body: x.body })).when(blocked);

isBlocked({ id: "T-1", status: "open", subject: "s", body: "b" }).plan(); // fine

// An async function awaits the expression for you: the caller gets a
// Promise<Judgment<boolean>> and can no longer plan it.
export const isBlockedNow = async (t: Ticket) => given(t).when(blocked);

// .run() and await do the same thing; each call runs the expression again.
const expression = isBlocked({ id: "T-1", status: "open", subject: "s", body: "b" });
const first = await expression.run();
const second = await expression; // a second request (or a cache hit)
first.status === second.status;
