import type { Questions, SystemOneRequest, SystemOneResult } from "@typesafe-ai/sdk";

/**
 * The only thing the runtime needs from a transport. `TypeSafeClient`
 * satisfies it directly; tests supply a scripted fake.
 */
export interface Transport {
  systemOne(request: SystemOneRequest<Questions>): Promise<SystemOneResult<Questions>>;
}

/** Cached results are keyed by model + state + questions; policy is applied after. */
export interface Cache {
  get(key: string): Promise<SystemOneResult<Questions> | undefined> | SystemOneResult<Questions> | undefined;
  set(key: string, value: SystemOneResult<Questions>): Promise<void> | void;
}

/** An in-process cache with no eviction. Pass it as `cache` to `configure` or `createSense`. */
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
