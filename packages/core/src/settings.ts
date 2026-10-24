export type TargetLang = "fr" | "es";
export type NativeLang = "en" | "pt";
export type Level = "A1" | "A2" | "B1" | "B2" | "C1";
export type Engine = "kokoro" | "system";
export type PracticeMode = "listen" | "produce";

export interface Settings {
  target: TargetLang;
  native: NativeLang;
  level: Level;
  topic: string;
  count: number;
  engine: Engine;
  speed: number;
  mode: PracticeMode;
  voices: Record<TargetLang, string>;
}

export const TARGETS: TargetLang[] = ["fr", "es"];
export const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1"];

export const LANG_NAMES: Record<TargetLang | NativeLang, string> = {
  fr: "French",
  es: "Spanish",
  en: "English",
  pt: "Portuguese",
};

export const KOKORO_VOICES: Record<TargetLang, { id: string; label: string }[]> = {
  fr: [{ id: "ff_siwis", label: "Siwis (female)" }],
  es: [
    { id: "ef_dora", label: "Dora (female)" },
    { id: "em_alex", label: "Alex (male)" },
  ],
};

/** A short sentence per language for testing the voice. */
export const SAMPLE: Record<TargetLang, string> = {
  fr: "Bonjour ! Je voudrais un café et un croissant, s'il vous plaît.",
  es: "¡Hola! ¿Me pone un café con leche y una tostada, por favor?",
};

export const TOPICS = [
  "ordering at a café or restaurant",
  "travel and directions",
  "shopping",
  "work and meetings",
  "family and friends",
  "health and the doctor",
  "weather and seasons",
  "hobbies and weekends",
  "home and daily routine",
  "feelings and opinions",
  "small talk with a neighbour",
  "phone calls and appointments",
];

export const DEFAULT_SETTINGS: Settings = {
  target: "fr",
  native: "pt",
  level: "A2",
  topic: "",
  count: 5,
  engine: "kokoro",
  speed: 0.85,
  mode: "listen",
  voices: { fr: "ff_siwis", es: "ef_dora" },
};

export const SETTINGS_KEY = "lp.settings";

/** Parse stored settings JSON over the defaults; corrupt or missing data yields the defaults. */
export function parseSettings(raw: string | null | undefined): Settings {
  let saved: Partial<Settings> = {};
  try {
    if (raw) saved = JSON.parse(raw);
  } catch {
    // corrupt: fall back to defaults
  }
  return { ...DEFAULT_SETTINGS, ...saved, voices: { ...DEFAULT_SETTINGS.voices, ...saved.voices } };
}
