# jevlish

Typed [Jev](https://docs.typesafe.ai) judgments for TypeScript business logic.

Documentation: [jacobgoldfarb.github.io/Jevlish](https://jacobgoldfarb.github.io/Jevlish/)

Use `given` to judge one value and `from` to filter or rank a collection. Exact checks remain TypeScript functions; semantic checks compile to Jev Noul, Score, and Choice questions.

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

```sh
npm install jevlish
export TYPESAFE_API_KEY=...
```

Expressions are lazy. Use `.plan()` to inspect the state and questions without sending them; use `await` or `.run()` to execute. Results keep uncertainty separate and carry the evidence behind each decision.

Node 20+. ESM only.

Start with the [Introduction](https://jacobgoldfarb.github.io/Jevlish/) or [Quickstart](https://jacobgoldfarb.github.io/Jevlish/start/quickstart/). The documentation covers filtering and ranking, scales, choices, batching, policy, evidence, runtime configuration, and testing.
