import { createSense } from "jevlish";
import { fake, yes } from "jevlish/testing";
import { ticket } from "./support.js";
import { blocked } from "./vocabulary.js";

// This transport answers every question locally and records each request.
const alwaysYes = fake(() => yes(0.95));

const sense = createSense({ client: alwaysYes });

const judgment = await sense.given(ticket).when(blocked);
judgment.status; // "decided"
alwaysYes.calls.length; // 1
alwaysYes.calls[0]?.state; // what the library would have sent
