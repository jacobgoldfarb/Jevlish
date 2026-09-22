# support-desk

A sample app: a support inbox triaged with `jevlish`. Every judgment in the
pipeline is a sentence; everything else is ordinary TypeScript.

```sh
cd apps/support-desk && npm install

npm start                     # run the pipeline, print the desk report
npm run plan                  # what would be sent, without spending anything
npm run trace                 # run, then dump every judgment behind each decision
npm run measure               # test the vocabulary against labelled fixtures
```

The API key is read from the repo-root `.env` (`TYPESAFE_API_KEY`).

## What it does

| Stage | Expression |
| --- | --- |
| Escalation policy | `given(ticket).when(needsAttention).do(escalate).otherwise(leaveUnchanged).whenUncertain(flagForReview)` |
| Priority queue | `from(tickets).where(isOpen).and(reportsProblem).rankedBy(disruption).take(5)` |
| Incident linking | `given({ ticket }).chooseFrom(incidents).by("the incident that explains…").orNone(…)` |
| Owner suggestion | `given({ ticket }).chooseFrom(onCall).by("whose experience best matches…").orNone(…)` |

`src/vocabulary.ts` is the domain language: `blocked`, `saysResolved`,
`threatensToLeave`, `needsAttention`, `reportsProblem`, `disruption`.
`src/fixtures.ts` holds labelled examples for `blocked`; `npm run measure`
reports accuracy, coverage, and abstentions.

## Things to notice

- Closed tickets never reach the model: the code predicate under `.and()` folds
  the whole expression to `false` before anything is sent. `npm run plan` shows
  `settled by code`.
- `needsAttention` is `blocked.unless(saysResolved).or(threatensToLeave).and(isOpen)`.
  The shape matters: resolution qualifies only the `blocked` branch, so a churn
  threat escalates regardless.
- "Search is slow but works" tends to land between the thresholds. It goes to
  `review`, never silently to `otherwise`.
- Every `chooseFrom` returns one of your own objects, or `null` for `orNone`,
  or `uncertain` — three different things, kept apart.
