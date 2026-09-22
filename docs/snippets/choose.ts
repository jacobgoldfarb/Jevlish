import { given } from "jevlish";
import { engineers, ticket } from "./support.js";

const owner = await given({ ticket: { subject: ticket.subject, body: ticket.body } })
  .chooseFrom(engineers)
  .seenAs((e) => ({ expertise: e.expertise, recentWork: e.recentWork }))
  .by("whose experience best matches the problem described in ticket")
  .orNone("none of the engineers has relevant experience for this ticket");

// Three different things, kept apart:
if (owner.status === "uncertain") {
  // the model's confidence missed the policy
} else if (owner.value === null) {
  // the model chose "none of these" — a legitimate answer, not an abstention
} else {
  owner.value.name; // one of your own Engineer objects, returned whole
}
