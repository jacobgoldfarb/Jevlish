# jevlish

TypeScript expressions that compile to [Jev](https://docs.typesafe.ai) requests.

A string in a condition is a Noul. A function is a predicate and runs locally, before anything is sent. `and`, `or`, and `unless` stay separate nodes and combine with three-valued logic. `scale` is a Score. `chooseFrom` is a Choice over objects you pass in. `ask` sends several questions about one subject in one request.

```ts
import { given, means } from "jevlish";

const blocked = means<Ticket>("the customer cannot complete their task")
  .excluding("they can finish the task despite the inconvenience");

const decision = await given(ticket)
  .seenAs((t) => ({ subject: t.subject, body: t.body }))
  .when(blocked)
  .and((t) => t.status === "open")
  .do(escalate)
  .otherwise(leave)
  .whenUncertain(review)
  .run();
```

`decision.branch` is `"do"`, `"otherwise"`, or `"uncertain"`. Abstention runs the `whenUncertain` handler; `.whenUncertain()` is required before `.run()`. A false predicate under `and` drops the other side, so a closed ticket sends no request.

```ts
import { from, scale } from "jevlish";

const disruption = scale<Ticket>("how much this disrupts the customer's work")
  .from("Work continues; the problem is cosmetic")
  .to("The task cannot be completed");

const queue = await from(tickets)
  .where((t) => t.status === "open")
  .and("the message reports a failure in the product")
  .rankedBy(disruption, "highest first")
  .take(10)
  .run();
```

`accepted` passed both checks, highest score first. `rejected` resolved false. `uncertain` missed your threshold on the Noul or the score. The sort and `take` run locally.

## What it solves

A Jev call answers a question. The program around it still has to project state, mix the answer with exact checks, apply thresholds, and treat abstention as its own result. Written out by hand, each call site builds that request itself, and the checks end up in the question text.

Predicates reduce the tree first. The Nouls, scores, and choices that remain for one subject go out together. `do`, `otherwise`, and `whenUncertain` call functions you wrote.

## Use

```sh
npm install jevlish
export TYPESAFE_API_KEY=...
```

Node 20+. ESM.

`given(subject)` judges one value. `from(items)` filters a list. `.seenAs(fn)` is the state the model sees; predicates, actions, and the chosen candidate are still the whole object. `.plan()` returns the requests that would be sent, including how many subjects code already settled.

```ts
import { configure } from "jevlish";

configure({
  model: "jev-1.13", // default: jev-latest
  policy: { noul: { yesAbove: 0.9, noBelow: 0.1 } },
});
```

That configures the shared runtime behind `given`, `from`, and `grade`. `createSense({ ... })` builds another one. Pass `client` for your own transport or a fake, and `cache: memoryCache()` to cache responses by model, state, and questions. Thresholds apply after a cache hit.

`means(proposition).including(inside).excluding(outside)` sets Noul criteria, and only on a single proposition — compose after the boundary is drawn. `grade(meaning, fixtures)` reports accuracy on decided fixtures, coverage, and abstentions separately from wrong answers.

`given(x).ask({ ... })` batches independent questions. A predicate in that object adds nothing to the request. `given(x).chooseFrom(candidates).by("...").orNone("...")` resolves the Choice back to your object; `decided(null)` is the none option.

Defaults are Noul yes at P(yes) ≥ 0.9 and no at ≤ 0.1, Choice and Score at confidence ≥ 0.5. A thrown error is a failed request.

`npm test` uses a fake evaluator. `npm run example` runs `examples/triage.ts` (copy `.env.example` to `.env` first).
