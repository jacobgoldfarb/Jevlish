import { blocked, saysResolved } from "./vocabulary.js";

// including() and excluding() apply to a single proposition.
// Draw the boundary on each means() first, then compose.
const composite = blocked.unless(saysResolved);

try {
  composite.excluding("the outage was announced in advance");
} catch (error) {
  error; // SenseError: .excluding() applies to a single proposition; (...) is a composite.
}
