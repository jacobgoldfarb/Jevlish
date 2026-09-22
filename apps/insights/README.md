# insights

Mine user feedback for product insights. Every number in the report is a
count of judgments; every quote is a user's own words. Nothing is generated.

```sh
cd apps/insights && npm install

npm start          # the report
npm run plan       # what would be sent, without spending anything
npm run trace      # every probability behind every judgment
npm run measure    # test the vocabulary against labeled messages
```

Reads `TYPESAFE_API_KEY` from the repo-root `.env`.

## The problem

Fifty pieces of feedback a week from five channels. A PM reads them and,
per message, answers the same ten questions: is this a problem, a request,
praise? Which part of the product? How bad? Are they about to leave? Did they
build a workaround? Are they asking for something we already have? Then
they count. The counting is easy. The reading doesn't scale.

## The program

One expression per message, one request each:

```ts
const profile = (item: Feedback) =>
  given(item)
    .seenAs((f) => ({ message: f.text }))
    .ask({
      problem: describesProblem,          // Noul
      request: requestsChange,            // Noul
      workaround: describesWorkaround,    // Noul
      confused,                           // Noul
      churnRisk,                          // Noul
      praise,                             // Noul
      reproducible,                       // Noul
      severity,                           // Score over three described levels
      area: chooseFrom(AREAS).by("which part of the product the message is mainly about").orNone("…"),
      existingFeature: chooseFrom(FEATURES).by("the feature that already provides what the user is asking for…").orNone("…"),
      paying: (f) => f.plan !== "free",   // code; costs nothing
    });
```

Everything after `run()` is `filter`, `groupBy`, and arithmetic in
`src/main.ts`. The insights are intersections the model never sees as such:

| Insight | Computed as |
| --- | --- |
| Where the pain is | per area: problems × (1 + mean severity) |
| Unmet needs | `workaround` grouped by `area` |
| Discoverability gaps | `request` ∧ `existingFeature` decided, grouped by feature |
| Churn concentration | `churnRisk` grouped by plan, then by area |
| Docs/UX debt | `confused` grouped by area |
| Engineering-ready | `problem` ∧ `reproducible`, sorted by severity |
| Couldn't place | area unresolved and nothing else decided |

## What to look for

- **Four people built their own scheduled export.** Zapier, cron, a macOS
  Shortcut, a Friday ritual. None of them said "add scheduled exports"; they
  described what they do instead. That is a feature request with proof of
  demand, and a keyword search would never find it.
- **Four requests for things that ship today.** Recurring invoices, reminders,
  multi-currency, the client portal. The fix is discoverability, and the
  report says so instead of adding them to a roadmap.
- **Team-plan churn is one problem, not four.** Every team customer thinking
  of leaving is talking about roles and permissions.
- **"The app lost my invoice" is confusion, not a bug.** Sync latency read as
  data loss. Engineering can't fix that; a saving indicator can.
- **"meh", "ok", "👎" go under *Couldn't place*.** The model didn't file them
  somewhere plausible. Uncertainty is kept, not hidden.

## Why not just ask an LLM to summarize

You could, once. This runs on every message, in the request path if you like,
for a few hundred tokens each, and returns typed values code can count. The
same ten questions, asked the same way of every message, with calibrated
probabilities and an explicit "uncertain", is what makes the counts mean
something week over week. A summary is prose about the feedback. This is data.
