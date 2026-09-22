import type { Questions, SystemOneRequest, SystemOneResult } from "@typesafe-ai/sdk";

/**
 * The only thing the runtime needs from a transport. `TypeSafeClient`
 * satisfies it directly; tests supply a scripted fake.
 */
export interface Evaluator {
  systemOne(request: SystemOneRequest<Questions>): Promise<SystemOneResult<Questions>>;
}

/** Cached results are keyed by model + state + questions; policy is applied after. */
export interface Cache {
  get(key: string): Promise<SystemOneResult<Questions> | undefined> | SystemOneResult<Questions> | undefined;
  set(key: string, value: SystemOneResult<Questions>): Promise<void> | void;
}

export function memoryCache(): Cache & { readonly size: number; clear(): void } {
  const store = new Map<string, SystemOneResult<Questions>>();
  return {
    get: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, value);
    },
    get size() {
      return store.size;
    },
    clear: () => store.clear(),
  };
}

/** Minimal counting semaphore for bounding in-flight requests. */
export class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError("concurrency must be a positive integer");
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
}
