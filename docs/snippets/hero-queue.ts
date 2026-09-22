import { from, scale } from "jevlish";
import { tickets, type Ticket } from "./support.js";

const disruption = scale<Ticket>("how much this disrupts the customer's work")
  .from("Work continues; the problem is cosmetic")
  .to("The task cannot be completed");

const queue = await from(tickets)
  .where((t) => t.status === "open")
  .and("the message reports a failure in the product")
  .rankedBy(disruption, "highest first")
  .take(10);

queue.accepted; // passed both checks, highest score first
queue.uncertain; // missed the threshold on the Noul or the score
queue.rejected; // resolved false
