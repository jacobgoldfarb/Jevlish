# jevlish

**Write the mechanics in code. Write the judgments in prose.**

A small semantic expression language embedded in TypeScript, compiled to
[Jev](https://docs.typesafe.ai) through `@typesafe-ai/sdk`. Where you would
normally write a predicate, a selection criterion, or a relationship, you can
write what you mean — and it composes with ordinary code.

```ts
import { from, means } from "jevlish";

const needsAttention = means<Ticket>("the customer cannot continue their work")
  .and((ticket) => ticket.status === "open")
  .unless("the customer says the problem has been resolved");

const { items, uncertain } = await from(tickets).where(needsAttention).run();
```

Not an agent framework. Not a prompt builder. The model supplies judgments;
your code owns computation, permissions, side effects, and control flow.

## Install

```sh
npm install jevlish @typesafe-ai/sdk
export TYPESAFE_API_KEY=...
```

Node 20+. ESM.

## The grammar

Every condition position accepts the same three things:

```ts
.when("a natural-language condition")          // a judgment: becomes a Noul question
.when((ticket) => ticket.status === "open")     // exact computation: runs locally, first
.when(needsAttention)                           // a reusable Meaning
```

### given → when → do

```ts
import { given } from "jevlish";

const decision = await given(ticket)
  .when("the customer cannot continue their work")
  .and((ticket) => ticket.status === "open")
  .unless("the customer says the problem has been resolved")
  .do(escalateToSupport)
  .otherwise(leaveUnchanged)
  .whenUncertain(flagForReview)
  .run();

decision.branch;   // "do" | "otherwise" | "uncertain"
decision.result;   // whatever the chosen handler returned
decision.judgment; // Judgment<boolean> with full evidence
```

Three outcomes, three handlers. `.whenUncertain()` is required before
`.run()` exists — uncertainty never silently falls through to `otherwise`.
Without `.otherwise()` the result type honestly includes `undefined`.

Handlers receive `(subject, judgment)`. Jev selects a path through code you
already own; it does not invent what escalation means.

### Meanings: reusable, named, inspectable

```ts
import { means } from "jevlish";

const blocked = means<Ticket>("the customer is currently unable to complete their task")
  .including("a product failure prevents them from completing the task")
  .excluding("they can complete the task despite inconvenience")
  .named("blocked");

const needsAttention = blocked
  .and((ticket) => ticket.status === "open")
  .unless("the customer says the failure has been resolved");

needsAttention.describe();
// ((blocked: "the customer is currently unable..." and code predicate) and not "...resolved")
```

A meaning is a proposition plus the boundary you draw around it:
`.including()` says what falls inside even if it isn't obvious,
`.excluding()` says what falls outside even if it looks close. They map onto
Noul `criteria.true` / `criteria.false` and are only allowed on a single
proposition — boundaries belong on leaves, not on composites.

`blocked.and(x)` keeps two expression nodes. It never concatenates prose into
a longer sentence and hopes the model parses the logic.

Also: `not(c)`, `all(a, b, c)`, `any(a, b, c)`.

### Collections: filter, rank, take

```ts
import { from, scale } from "jevlish";

const disruption = scale<Ticket>("how much the reported problem disrupts the customer's work")
  .from("Work continues normally; the problem affects appearance")
  .through("The task remains possible through a workaround")
  .to("The task cannot be completed");

const { items, uncertain, rejected, scored } = await from(tickets)
  .where((ticket) => ticket.status === "open")
  .and("the message reports a problem with the product")
  .rankedBy(disruption, "highest first")
  .take(10)
  .run();
```

A `scale` is a degree, not a probability: it compiles to a Score question
with your descriptive levels. Each candidate is scored once; sorting and
limiting are ordinary local operations. `uncertain` retains candidates whose
filtering *or* ranking judgment didn't meet the policy — they are unresolved,
not rejected.

Relationships need no special syntax. Build the pairs in code — the keys
name the nouns the prose refers to — and query them:

```ts
const pairs = feedback.flatMap((request) => roadmap.map((feature) => ({ request, feature })));

const { items } = await from(pairs)
  .where("feature would address the need described in request")
  .run();

items[0]; // { request: Feedback; feature: RoadmapItem }
```

The pair count is visible in your own code, and `.plan()` shows the request
count before anything is sent. When each subject should match at most one
candidate, `chooseFrom` below is the sharper tool.

### Selection: choose a real value

```ts
const owner = await given({ ticket })
  .chooseFrom(availableEngineers)
  .describedBy((e) => ({ expertise: e.expertise, recentWork: e.recentWork }))
  .by("whose experience best matches the problem described in ticket")
  .orNone("none of the engineers has relevant experience")
  .run();

// Judgment<Engineer | null>
```

Compiles to a Choice over neutral option ids and resolves the answer back to
your original object. The candidates can come from a query, a registry, or the
user's workspace — bounded at evaluation time, not hardcoded at development
time. `orNone` is a legitimate outcome (`decided(null)`); it is distinct from
`uncertain`.

`given(x).measure(scale)` places one subject on a scale.

## Uncertainty is in the language

```ts
type Judgment<T> =
  | { status: "decided"; value: T; evidence: Evidence }
  | { status: "uncertain"; evidence: Evidence };
```

"Decided" means the result passed your acceptance policy — not that it is a
proven fact. `Evidence` holds every request that left the process, every
contributing judgment (code predicates included), and the policy applied.

Composite conditions combine with Kleene three-valued logic:

```
false AND uncertain → false
true  AND uncertain → uncertain
true  OR  uncertain → true
NOT uncertain       → uncertain
```

The runtime never multiplies probabilities and pretends the product is
calibrated. Transport failures are ordinary thrown errors, never judgments.

### Policy

```ts
const sense = createSense({
  policy: {
    noul: { yesAbove: 0.9, noBelow: 0.1 },  // on P(yes)
    choice: { minConfidence: 0.5 },          // on distribution-derived confidence
    score: { minConfidence: 0.5 },
  },
});

given(x).withPolicy({ noul: { yesAbove: 0.95 } }).when(...)  // per expression
```

Noul probability and Choice/Score confidence are different quantities and
get different knobs. Defaults are a conservative starting point; tune them
against fixtures.

## Inspect, test, cache

**Inspect before running.** Every builder has `.plan()`:

```ts
const plan = from(tickets).where(needsAttention).rankedBy(disruption).plan();
plan.subjects;        // 6
plan.decidedByCode;   // 1  — settled without inference
plan.requestCount;    // 5
plan.requests[0];     // { state, questions } exactly as they would be sent
```

**Send only what the question needs.** `.describedBy(fn)` projects the state
the model sees; code predicates still receive the whole object.

**Test meanings like functions.**

```ts
const report = await sense.measure(blocked, fixtures, { describedBy: (t) => ({ body: t.body }) });
report.accuracy;        // over decided fixtures
report.coverage;        // decided / total
report.falsePositives; report.falseNegatives; report.abstentions;
report.misjudged;       // [{ fixture, judgment }]
```

Abstentions are reported separately from errors. An abstention is a policy
outcome, not a wrong answer.

**Cache.** `createSense({ cache: memoryCache() })`, keyed on
model + state + questions. Policy is applied after retrieval, so changing
thresholds never serves stale decisions.

## How it compiles

The methods define the program. Nothing asks a second model what the chain
means.

| Expression | Strategy |
| --- | --- |
| `means`, `when`, `where` (prose) | Noul question |
| `(x) => boolean` | Evaluated locally, **first**; folds the tree before anything is sent |
| `and`, `or`, `unless`, `not` | Expression nodes, combined with three-valued logic after answers arrive |
| `scale(...).from().through().to()` | Score question with descriptive levels |
| `chooseFrom().by().orNone()` | Choice over explicit option ids, resolved back to your object |
| `rankedBy`, `take` | Local sort and slice over evaluated results |
| `do`, `otherwise`, `whenUncertain` | Callback selection |

Per subject, a `Probe` reduces the tree with code predicates, collects the
surviving semantic leaves into one deduplicated question set (Nouls plus any
Score/Choice for that subject), sends it as one request (chunked above
`questionsPerRequest`, bounded by `concurrency`), then folds the answers.

## Configuration

```ts
import { createSense, configure } from "jevlish";

const sense = createSense({
  apiKey,                 // or TYPESAFE_API_KEY
  model: "jev-1.13",      // or TYPESAFE_DEFAULT_MODEL / jev-latest
  client,                 // any { systemOne(request) } — a TypeSafeClient or a fake
  policy,
  concurrency: 8,
  questionsPerRequest: 32,
  cache,
});

sense.given(...); sense.from(...); sense.measure(...);

configure({ ... });      // configures the bare `given`/`from`/`measure` exports
```

## What this is not

- It does not generate text, UI, or implementations. Jev selects among
  options you supply.
- It does not defeat prompt injection. State is data and the model does not
  treat it as hostile. Keep untrusted content out of criteria, be literal in
  propositions, and test adversarial cases.
- It does not do arithmetic, counting, or date comparison. Those are code
  predicates.
- It is not a claim that other models could not implement the same
  abstraction. It is a claim that semantic judgments are cheap and calibrated
  enough to use throughout ordinary application logic.

## Examples

```sh
cp .env.example .env   # add your key
npm run example        # given/when/do, plan, from/where/rankedBy, chooseFrom, measure
```

`apps/support-desk` is a fuller sample application built on the published
package surface.

## Development

```sh
npm test        # unit tests against a scripted fake evaluator; no network
npm run typecheck
npm run build
```
