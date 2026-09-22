import { given } from "jevlish";
import { ticket } from "./support.js";
import { blocked } from "./vocabulary.js";

const branch = given(ticket).when(blocked).do(() => "escalate").otherwise(() => "leave");

// Awaiting a branch without .whenUncertain() rejects with a SenseError.
// The fulfilled value is typed `never`, so the mistake also shows at compile time.
try {
  await branch;
} catch (error) {
  error; // SenseError: .whenUncertain() is required before a branch can run.
}
