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

const DEFAULTS: Settings = {
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

const KEY = "lp.settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...DEFAULTS, ...saved, voices: { ...DEFAULTS.voices, ...saved.voices } };
    }
  } catch {
    // storage unavailable or corrupt: fall back to defaults
  }
  return structuredClone(DEFAULTS);
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}
