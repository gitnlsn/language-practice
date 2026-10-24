import { dedupe, parseSentences, sentencesPrompt, sentencesSchema, SYSTEM_PROMPT, type Level, type TargetLang } from "@viva-voz/core";
import { isUsable, promptOptions, promptStatus } from "./capabilities";
import { translate, type Progress } from "./translate";

export interface GenerateOptions {
  target: TargetLang;
  level: Level;
  topic: string;
  count: number;
  avoid: string[];
  onModelProgress?: Progress;
}

export interface GenerateResult {
  sentences: string[];
  /** "direct": Gemini Nano wrote in the target language. "pivot": wrote in English, then Chrome translated. */
  via: "direct" | "pivot";
}

const sessions = new Map<string, Promise<LanguageModelSession>>();

/** Create (and download if needed) a model session. Like translators, call it before any `await` in a click handler. */
export function session(outputLang: string, onProgress?: Progress) {
  let s = sessions.get(outputLang);
  if (!s) {
    s = LanguageModel!.create({
      ...promptOptions(outputLang),
      initialPrompts: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
      ],
      monitor: (m) => m.addEventListener("downloadprogress", (e) => onProgress?.(e.loaded)),
    });
    s.catch(() => sessions.delete(outputLang));
    sessions.set(outputLang, s);
  }
  return s;
}

/** Which strategy will be used for a language, without generating anything. */
export async function strategyFor(target: TargetLang): Promise<GenerateResult["via"]> {
  return isUsable(await promptStatus(target)) ? "direct" : "pivot";
}

export async function generateSentences(o: GenerateOptions): Promise<GenerateResult> {
  const via = await strategyFor(o.target);
  const writeIn = via === "direct" ? o.target : "en";
  const prompt = sentencesPrompt({ ...o, writeIn });

  const s = await (await session(writeIn, o.onModelProgress)).clone();
  try {
    const raw = await s.prompt(prompt, { responseConstraint: sentencesSchema(o.count) });
    let sentences = parseSentences(raw);
    if (via === "pivot") sentences = await Promise.all(sentences.map((x) => translate(x, "en", o.target)));
    return { sentences: dedupe(sentences, o.avoid), via };
  } finally {
    s.destroy();
  }
}
