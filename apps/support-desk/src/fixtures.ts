/**
 * Labelled examples for the vocabulary. Run with `npm start -- --measure`.
 * A meaning is tested the way a function is: expected answers, and a report of
 * false positives, false negatives, and abstentions.
 */
import type { Fixture } from "jevlish";
import type { Ticket } from "./data.js";

const ticket = (body: string): Ticket => ({
  id: "fixture",
  status: "open",
  customer: "fixture",
  plan: "team",
  subject: "",
  body,
});

export const blockedFixtures: Fixture<Ticket>[] = [
  { subject: ticket("Every export fails; we cannot bill our clients."), expected: true, note: "hard failure" },
  { subject: ticket("Nobody can log in. 500 on every attempt."), expected: true, note: "outage" },
  { subject: ticket("The icon is a bit misaligned."), expected: false, note: "cosmetic" },
  { subject: ticket("How do I invite a teammate?"), expected: false, note: "question" },
  { subject: ticket("Uploads work but take a while; I go make coffee."), expected: false, note: "slow but works" },
  { subject: ticket("Great product, thanks!"), expected: false, note: "praise" },
];
