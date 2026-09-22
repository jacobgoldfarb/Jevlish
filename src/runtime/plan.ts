import type { Probe } from "./probe.js";
import type { PlannedRequest, Runtime } from "./runtime.js";

/**
 * What would happen if you ran this. Which state leaves the process, which
 * questions are asked, how many subjects were settled by code alone, and how
 * the questions batch into requests.
 */
export interface Plan {
  readonly subjectCount: number;
  readonly decidedByCode: number;
  readonly questionCount: number;
  readonly requestCount: number;
  readonly requests: readonly PlannedRequest[];
  readonly notes: readonly string[];
}

export function planFor(runtime: Runtime, probes: readonly Probe<unknown>[], notes: string[] = []): Plan {
  const requests = probes.flatMap((probe) =>
    probe.needsInference ? runtime.planRequests(probe.state, probe.questions) : [],
  );
  const decidedByCode = probes.filter((probe) => !probe.needsInference).length;
  const questionCount = probes.reduce((sum, probe) => sum + probe.questionCount, 0);
  return {
    subjectCount: probes.length,
    decidedByCode,
    questionCount,
    requestCount: requests.length,
    requests,
    notes,
  };
}
