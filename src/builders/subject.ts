import type { EntryType } from "@typesafe-ai/sdk";
import type { Condition } from "../expressions/condition.js";
import { type Judgment, EvidenceLog, decided, uncertain } from "../judgment.js";
import type { AcceptancePolicy } from "../policy.js";
import { Probe } from "../runtime/probe.js";
import type { Runtime } from "../runtime/runtime.js";
import { toState } from "../state.js";

/** One subject prepared for judgment: the original object, its projected state, and the policy in force. */
export interface SubjectContext<T> {
  readonly runtime: Runtime;
  readonly subject: T;
  readonly state: EntryType;
  readonly policy: AcceptancePolicy;
}

export type Projection<T> = (subject: T) => unknown;

export function contextFor<T>(
  runtime: Runtime,
  subject: T,
  projection: Projection<T> | undefined,
  policy: AcceptancePolicy,
): SubjectContext<T> {
  return {
    runtime,
    subject,
    state: toState(projection ? projection(subject) : subject),
    policy,
  };
}

/** Build the probe for a predicate without sending anything. */
export function prepare<T>(ctx: SubjectContext<T>, condition: Condition<T>) {
  const log = new EvidenceLog(ctx.policy);
  const probe = new Probe(ctx.subject, ctx.state, log);
  const bound = probe.bind(condition);
  return { log, probe, bound };
}

/** Judge one predicate about one subject. */
export async function judge<T>(ctx: SubjectContext<T>, condition: Condition<T>): Promise<Judgment<boolean>> {
  const { log, probe, bound } = prepare(ctx, condition);
  const answers = probe.needsInference ? await ctx.runtime.ask(probe.state, probe.questions, log) : {};
  const truth = probe.resolve(bound, answers, ctx.policy);
  return truth === "uncertain" ? uncertain(log.toEvidence()) : decided(truth, log.toEvidence());
}
