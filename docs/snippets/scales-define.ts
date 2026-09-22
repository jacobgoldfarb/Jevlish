import { scale } from "jevlish";
import type { Ticket } from "./support.js";

// A degree, not a probability. Levels are ordered situations; the model
// returns a position along them. Two to ten levels.
export const disruption = scale<Ticket>("how much the reported problem disrupts the customer's work")
  .from("Work continues normally; the problem affects appearance only")
  .through("The task remains possible through a workaround")
  .to("The task cannot be completed")
  .named("disruption");

disruption.levels.length; // 3
disruption.top; // 2: scores run from 0 to top
