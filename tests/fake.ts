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
import type { Transport } from "../src/index.js";

export type Script = (question: Question, state: EntryType, id: string) => NoulResponse | ChoiceResponse | ScoreResponse;

export interface FakeTransport extends Transport {
  readonly calls: SystemOneRequest<Questions>[];
}

/** A transport that answers each question by running a script against it. */
export function fake(script: Script): FakeTransport {
  const calls: SystemOneRequest<Questions>[] = [];
  return {
    calls,
    async systemOne(request) {
      calls.push(request);
      const answers = Object.fromEntries(
        Object.entries(request.questions).map(([id, question]) => [id, script(question, request.state, id)]),
      );
      return {
        model: "fake-model",
        answers,
        usage: { input_tokens: 0, output_tokens: 0 },
      } as SystemOneResult<Questions>;
    },
  };
}

export const yes = (probability: number): NoulResponse => ({ type: "noul", noul: probability });

export const pick = (choice: string, confidence: number, probabilities: Record<string, number> = { [choice]: 1 }): ChoiceResponse => ({
  type: "choice",
  choice,
  confidence,
  probabilities,
});

export const rate = (score: number, confidence: number, levels: number): ScoreResponse => {
  const probabilities: Record<string, number> = {};
  const legend: Record<string, EntryType> = {};
  for (let i = 0; i < levels; i += 1) {
    probabilities[String(i)] = i === Math.round(score) ? 1 : 0;
    legend[String(i)] = `level ${i}`;
  }
  return { type: "score", score, confidence, legend, probabilities } as unknown as ScoreResponse;
};

/** Text of a question's instructions, whether plain or structured. */
export function textOf(question: Question): string {
  const instructions = question.instructions;
  if (typeof instructions === "string") return instructions;
  if (instructions && typeof instructions === "object" && !Array.isArray(instructions)) {
    const nested = (instructions as Record<string, unknown>).question;
    if (typeof nested === "string") return nested;
  }
  return JSON.stringify(instructions);
}
