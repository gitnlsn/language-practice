// Loads the voice in the background at startup and reports progress to the Setup tab.
import { useSyncExternalStore } from "react";
import { loadKokoro } from "./kokoro";
import { modelsDir } from "./models";

export type PartState = { status: "idle" | "loading" | "ready" } | { status: "error"; message: string };
export type Part = "files" | "voice";

let state: Record<Part, PartState> = {
  files: { status: "idle" },
  voice: { status: "idle" },
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

/** Unpack (first launch only), then load the voice. */
export async function warmUp() {
  await track("files", modelsDir);
  if (state.files.status !== "ready") return;
  await track("voice", loadKokoro);
}

export function useEngineStatus() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}
