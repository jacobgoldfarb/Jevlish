import { createSense, memoryCache } from "jevlish";
import { ticket } from "./support.js";
import { blocked } from "./vocabulary.js";

const cache = memoryCache();

// A second runtime, independent of the shared one behind given/from/grade.
const sense = createSense({
  model: "jev-1.13", // default: the SDK's default, jev-latest
  concurrency: 4, // in-flight requests; default 8
  questionsPerRequest: 16, // questions per request before splitting; default 32
  cache, // keyed by model + state + questions
});

await sense.given(ticket).when(blocked);
await sense.given(ticket).when(blocked); // same model, state, and questions: served from the cache

cache.size; // 1
