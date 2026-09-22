import { given } from "jevlish";
import { ticket } from "./support.js";
import { needsAttention } from "./vocabulary.js";

const decision = await given(ticket)
  .seenAs((t) => ({ subject: t.subject, body: t.body }))
  .when(needsAttention)
  .do((t) => `escalated ${t.id}`)
  .otherwise(() => "left alone")
  .whenUncertain((t, judgment) => `review ${t.id}: ${judgment.evidence.judgments.length} judgments`);

decision.branch; // "do" | "otherwise" | "uncertain"
decision.result; // string
decision.judgment; // Judgment<boolean>, with the evidence behind the branch
