import type { Questions, SystemOneRequest, SystemOneResult } from "@typesafe-ai/sdk";
import { createSense, type Transport } from "jevlish";
import { ticket } from "./support.js";
import { blocked } from "./vocabulary.js";

// A transport answers `systemOne`. This one says "yes, 0.95" to every Noul,
// records what it was asked, and never touches the network.
const calls: SystemOneRequest<Questions>[] = [];

const alwaysYes: Transport = {
  async systemOne(request) {
    calls.push(request);
    const answers = Object.fromEntries(Object.keys(request.questions).map((id) => [id, { type: "noul", noul: 0.95 }]));
    return { model: "fake", answers, usage: { input_tokens: 0, output_tokens: 0 } } as SystemOneResult<Questions>;
  },
};

const sense = createSense({ client: alwaysYes });

const judgment = await sense.given(ticket).when(blocked);
judgment.status; // "decided"
calls.length; // 1
calls[0]?.state; // what the library would have sent
