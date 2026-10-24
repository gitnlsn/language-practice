import { parseSettings, SETTINGS_KEY, type Settings } from "@viva-voz/core";

export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY));
  } catch {
    // storage unavailable: fall back to defaults
    return parseSettings(null);
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}
