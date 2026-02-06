import { DEFAULT_STATE } from "./defaults.js";

const STORAGE_KEY = "promptTemplates";

const storage =
  globalThis.browser?.storage?.local ??
  globalThis.chrome?.storage?.local;

if (!storage) {
  throw new Error("Storage API unavailable");
}

export async function loadState() {
  const result = await storage.get(STORAGE_KEY);
  if (result?.[STORAGE_KEY]) {
    return result[STORAGE_KEY];
  }

  await storage.set({ [STORAGE_KEY]: DEFAULT_STATE });
  return DEFAULT_STATE;
}

export async function saveState(state) {
  await storage.set({ [STORAGE_KEY]: state });
}
