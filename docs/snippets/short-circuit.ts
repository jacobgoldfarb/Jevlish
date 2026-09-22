import { given } from "jevlish";
import type { Ticket } from "./support.js";
import { blocked } from "./vocabulary.js";

const closed: Ticket = { id: "T-9", status: "closed", subject: "Login down", body: "Nobody can log in." };

// `false AND uncertain` is false, so a false code predicate settles the whole
// expression before anything is sent.
const plan = given(closed)
  .when(blocked)
  .and((t) => t.status === "open")
  .plan();

plan.decidedByCode; // 1
plan.requestCount; // 0
