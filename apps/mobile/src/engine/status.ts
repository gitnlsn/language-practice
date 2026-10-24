// Loads the models in the background at startup and reports progress to the Setup tab.
import { useSyncExternalStore } from "react";
import { loadKokoro } from "./kokoro";
import { loadWriter } from "./generate";
import { modelsDir } from "./models";
import { loadTranslator, type MtTarget } from "./translate";

export type PartState = { status: "idle" | "loading" | "ready" } | { status: "error"; message: string };
export type Part = "files" | "voice" | "writer" | "translators";

let state: Record<Part, PartState> = {
  files: { status: "idle" },
  voice: { status: "idle" },
  writer: { status: "idle" },
  translators: { status: "idle" },
};
const listeners = new Set<() => void>();

function set(part: Part, s: PartState) {
  state = { ...state, [part]: s };
  listeners.forEach((l) => l());
}

async function track(part: Part, job: () => Promise<unknown>) {
  if (state[part].status === "loading" || state[part].status === "ready") return;
  set(part, { status: "loading" });
  try {
    await job();
    set(part, { status: "ready" });
  } catch (e: any) {
    set(part, { status: "error", message: String(e?.message ?? e) });
  }
}

/** Unpack (first launch only), then load the voice, the sentence writer and the translators, one after another. */
export async function warmUp(target: MtTarget, native: "en" | "pt") {
  await track("files", modelsDir);
  if (state.files.status !== "ready") return;
  await track("voice", loadKokoro);
  await track("writer", loadWriter);
  await track("translators", () => Promise.all([loadTranslator(target), native === "pt" ? loadTranslator("pt") : null]));
}

export function useEngineStatus() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}
