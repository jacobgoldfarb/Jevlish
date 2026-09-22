import type {
  ChoiceResponse,
  EntryType,
  NoulResponse,
  Question,
  Questions,
  ScoreResponse,
  SystemOneRequest,
  SystemOneResult,
} from "@typesafe-ai/sdk";
import type { Transport } from "./runtime/transport.js";

export type Script = (
  question: Question,
  state: EntryType,
  id: string,
) => NoulResponse | ChoiceResponse | ScoreResponse;

export interface FakeTransport extends Transport {
  readonly calls: SystemOneRequest<Questions>[];
}

/** A deterministic transport that answers each question with a local script. */
export function fake(script: Script): FakeTransport {
  const calls: SystemOneRequest<Questions>[] = [];
  return {
    calls,
    async systemOne(request) {
      calls.push(request);
      const answers = Object.fromEntries(
        Object.entries(request.questions).map(([id, question]) => [
          id,
          script(question, request.state, id),
        ]),
      );
      return {
        model: "fake-model",
        answers,
        usage: { input_tokens: 0, output_tokens: 0 },
      } as SystemOneResult<Questions>;
    },
  };
}

/** Build a Noul response with the given probability of yes. */
export const yes = (probability: number): NoulResponse => ({
  type: "noul",
  noul: probability,
});

/** Build a Choice response. */
export const pick = (
  choice: string,
  confidence: number,
  probabilities: Record<string, number> = { [choice]: 1 },
): ChoiceResponse => ({
  type: "choice",
  choice,
  confidence,
  probabilities,
});

/** Build a Score response over `levels` positions. */
export function rate(score: number, confidence: number, levels: number): ScoreResponse {
  const probabilities: Record<string, number> = {};
  const legend: Record<string, EntryType> = {};
  for (let index = 0; index < levels; index += 1) {
    probabilities[String(index)] = index === Math.round(score) ? 1 : 0;
    legend[String(index)] = `level ${index}`;
  }
  return {
    type: "score",
    score,
    confidence,
    legend,
    probabilities,
  } as unknown as ScoreResponse;
}

/** Read a question's instructions as text for scripted matching. */
export function textOf(question: Question): string {
  const instructions = question.instructions;
  if (typeof instructions === "string") return instructions;
  if (instructions && typeof instructions === "object" && !Array.isArray(instructions)) {
    const nested = (instructions as Record<string, unknown>).question;
    if (typeof nested === "string") return nested;
  }
  return JSON.stringify(instructions);
}

export type { Fixture, GradeOptions, GradeReport } from "./testing.js";
