# jevlish

TypeScript expressions that compile to [Jev](https://docs.typesafe.ai) requests.

Documentation: [jacobgoldfarb.github.io/Jevlish](https://jacobgoldfarb.github.io/Jevlish/)

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
  .whenUncertain(review);
```

`decision.branch` is `"do"`, `"otherwise"`, or `"uncertain"`. Abstention runs the `whenUncertain` handler; a branch without `.whenUncertain()` rejects when awaited. A false predicate under `and` drops the other side, so a closed ticket sends no request.

```ts
import { from, scale } from "jevlish";

const disruption = scale<Ticket>("how much this disrupts the customer's work")
  .from("Work continues; the problem is cosmetic")
  .to("The task cannot be completed");

const queue = await from(tickets)
  .where((t) => t.status === "open")
  .and("the message reports a failure in the product")
  .rankedBy(disruption, "highest first")
  .take(10);
```

`accepted` passed both checks, highest score first. `rejected` resolved false. `uncertain` missed your threshold on the Noul or the score. The sort and `take` run locally.

## What it solves

The Jev SDK is shaped like an LLM SDK. You build a request, send it, and get a response back. That fits when the output goes to a user. Most Jev calls don't. They sit in business logic and decide what the code does with an object it already has: whether a ticket escalates, which rows a query keeps, who gets assigned. jevlish gives those decisions the shape of a condition or a filter, since that is what they are.

## Use

```sh
npm install jevlish
export TYPESAFE_API_KEY=...
```

Node 20+. ESM.

`given(subject)` judges one value. `from(items)` filters a list. `.seenAs(fn)` is the state the model sees; predicates, actions, and the chosen candidate are still the whole object.

An expression is a value until you `await` it; awaiting runs it, and each `await` runs it again. `.run()` does the same thing explicitly. `.plan()` returns the requests that would be sent, including how many subjects code already settled, without sending anything. Build expressions in plain functions, not `async` ones, if callers need to `.plan()` them: an `async` return awaits the expression for you.

```ts
import { configure } from "jevlish";

configure({
  model: "jev-1.13", // default: jev-latest
  policy: { noul: { yesAbove: 0.9, noBelow: 0.1 } }, // default: 0.8 / 0.2
});
```

That configures the shared runtime behind `given`, `from`, and `grade`. `createSense({ ... })` builds another one. Pass `client` for your own transport or a fake, and `cache: memoryCache()` to cache responses by model, state, and questions. Thresholds apply after a cache hit.

`means(proposition).including(inside).excluding(outside)` sets Noul criteria, and only on a single proposition — compose after the boundary is drawn. `grade(meaning, fixtures)` reports accuracy on decided fixtures, coverage, and abstentions separately from wrong answers.

`given(x).ask({ ... })` batches independent questions. A predicate in that object adds nothing to the request. `await given(x).chooseFrom(candidates).by("...").orNone("...")` resolves the Choice back to your object; `decided(null)` is the none option.

Defaults are Noul yes at P(yes) ≥ 0.8 and no at ≤ 0.2, Choice and Score at confidence ≥ 0.5. A thrown error is a failed request.

`npm test` uses a fake evaluator. `npm run example` runs `examples/triage.ts` (copy `.env.example` to `.env` first).
