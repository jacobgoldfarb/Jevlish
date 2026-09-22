import { configure, defaultPolicy, given } from "jevlish";
import { ticket } from "./support.js";
import { blocked } from "./vocabulary.js";

defaultPolicy;
// { noul: { yesAbove: 0.9, noBelow: 0.1 }, choice: { minConfidence: 0.5 }, score: { minConfidence: 0.5 } }

// For the shared runtime:
configure({ policy: { noul: { yesAbove: 0.8, noBelow: 0.2 } } });

// For one expression:
const lenient = await given(ticket).withPolicy({ noul: { yesAbove: 0.7, noBelow: 0.3 } }).when(blocked);

lenient.evidence.policy.noul.yesAbove; // 0.7: the policy that was applied is part of the evidence
