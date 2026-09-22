import type { EntryType, Questions, SystemOneResult } from "@typesafe-ai/sdk";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { SenseError } from "../errors.js";
import type { Answer, EvidenceLog } from "../judgment.js";
import { type AcceptancePolicy, type PartialPolicy, defaultPolicy, resolvePolicy } from "../policy.js";
import { stableStringify } from "../state.js";
import { type Cache, type Evaluator, Semaphore } from "./evaluator.js";

export interface SenseConfig {
  /** API key; falls back to TYPESAFE_API_KEY. Ignored when `client` is given. */
  readonly apiKey?: string;
  /** Model name; falls back to the SDK default (`jev-latest`). */
  readonly model?: string;
  /** Bring your own transport (a TypeSafeClient, or a fake in tests). */
  readonly client?: Evaluator;
  /** Acceptance thresholds. These are yours to tune. */
  readonly policy?: PartialPolicy;
  /** Maximum in-flight requests. Default 8. */
  readonly concurrency?: number;
  /** Questions packed into one request before splitting. Default 32. */
  readonly questionsPerRequest?: number;
  /** Optional response cache. */
  readonly cache?: Cache;
}

export interface PlannedRequest {
  readonly state: EntryType;
  readonly questions: Questions;
}

/** Owns transport, batching, concurrency, caching, and the default policy. */
export class Runtime {
  readonly policy: AcceptancePolicy;
  readonly questionsPerRequest: number;
  readonly model: string | undefined;

  private readonly semaphore: Semaphore;
  private readonly cache: Cache | undefined;
  private readonly config: SenseConfig;
  private evaluator: Evaluator | undefined;

  constructor(config: SenseConfig = {}) {
    this.config = config;
    this.policy = resolvePolicy(defaultPolicy, config.policy);
    this.questionsPerRequest = config.questionsPerRequest ?? 32;
    this.model = config.model;
    this.semaphore = new Semaphore(config.concurrency ?? 8);
    this.cache = config.cache;
    this.evaluator = config.client;
    if (this.questionsPerRequest < 1) throw new RangeError("questionsPerRequest must be at least 1");
  }

  /** Split a question set into the requests that would actually be sent. */
  planRequests(state: EntryType, questions: Questions): PlannedRequest[] {
    const entries = Object.entries(questions);
    const requests: PlannedRequest[] = [];
    for (let i = 0; i < entries.length; i += this.questionsPerRequest) {
      requests.push({
        state,
        questions: Object.fromEntries(entries.slice(i, i + this.questionsPerRequest)),
      });
    }
    return requests;
  }

  /**
   * Ask every question about one state. Questions are chunked, chunks run
   * under the concurrency limit, and each chunk is cached independently.
   * Returns the merged answers keyed by question id.
   */
  async ask(state: EntryType, questions: Questions, log: EvidenceLog): Promise<Record<string, Answer>> {
    const requests = this.planRequests(state, questions);
    if (requests.length === 0) return {};
    const results = await Promise.all(requests.map((request) => this.send(request, log)));
    return Object.assign({}, ...results) as Record<string, Answer>;
  }

  private async send(request: PlannedRequest, log: EvidenceLog): Promise<Record<string, Answer>> {
    const model = this.model ?? this.client().defaultModelName;
    const key = stableStringify({ model, state: request.state, questions: request.questions });
    const cached = await this.cache?.get(key);
    const result = cached ?? (await this.semaphore.run(() => this.client().evaluator.systemOne({
      state: request.state,
      questions: request.questions,
      ...(this.model ? { model: this.model } : {}),
    })));
    if (!cached) await this.cache?.set(key, result);
    log.requests.push({
      model: result.model,
      state: request.state,
      questions: request.questions,
      answers: result.answers as Record<string, Answer>,
      usage: result.usage,
      cached: cached !== undefined,
    });
    return result.answers as Record<string, Answer>;
  }

  private client(): { evaluator: Evaluator; defaultModelName: string } {
    if (!this.evaluator) {
      try {
        const client = new TypeSafeClient({
          ...(this.config.apiKey ? { apiKey: this.config.apiKey } : {}),
          ...(this.config.model ? { defaultModel: this.config.model } : {}),
        });
        this.evaluator = client;
        return { evaluator: client, defaultModelName: client.defaultModel };
      } catch (error) {
        throw new SenseError(
          "Could not create a TypeSafe client. Pass `apiKey` or set TYPESAFE_API_KEY, or supply `client`.",
          { cause: error },
        );
      }
    }
    const defaultModelName =
      this.evaluator instanceof TypeSafeClient ? this.evaluator.defaultModel : (this.model ?? "custom");
    return { evaluator: this.evaluator, defaultModelName };
  }
}

export type { SystemOneResult };
