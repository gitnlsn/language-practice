export * from "./settings";
export * from "./sentences";
export * from "./prompt";
export * from "./phonemes";
export * from "./kokoro";
export * from "./marian";

/** Shadowing: how long to stay silent after a sentence so the learner can repeat it aloud. */
export const repeatPauseMs = (spokenMs: number) => Math.min(spokenMs * 1.2, 12000) + 800;
