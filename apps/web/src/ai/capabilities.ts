export type Status = AIAvailability | "unsupported";

export const hasPromptApi = () => typeof LanguageModel !== "undefined";
export const hasTranslatorApi = () => typeof Translator !== "undefined";

export function promptOptions(outputLang: string) {
  return {
    expectedInputs: [{ type: "text" as const, languages: ["en"] }],
    expectedOutputs: [{ type: "text" as const, languages: [outputLang] }],
  };
}

/** Availability of Gemini Nano producing text in `lang`. */
export async function promptStatus(lang: string): Promise<Status> {
  if (!hasPromptApi()) return "unsupported";
  try {
    return await LanguageModel!.availability(promptOptions(lang));
  } catch {
    return "unavailable";
  }
}

export async function translatorStatus(sourceLanguage: string, targetLanguage: string): Promise<Status> {
  if (!hasTranslatorApi()) return "unsupported";
  try {
    return await Translator!.availability({ sourceLanguage, targetLanguage });
  } catch {
    return "unavailable";
  }
}

export const isUsable = (s: Status) => s === "available" || s === "downloadable" || s === "downloading";
