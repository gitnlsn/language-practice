import { LANG_NAMES, type Level, type TargetLang } from "../settings";
import { isUsable, promptOptions, promptStatus } from "./capabilities";
import { translate, type Progress } from "./translate";

const LEVEL_GUIDE: Record<Level, string> = {
  A1: "very short (4-8 words), present tense, basic everyday vocabulary (greetings, family, food, numbers, places).",
  A2: "short (6-10 words), present, near future and simple past, common daily-life vocabulary.",
  B1: "medium length (8-14 words), mix of past, future and conditional tenses, opinions and plans.",
  B2: "natural length (10-18 words), subjunctive and complex clauses where natural, idiomatic but common expressions.",
  C1: "varied and nuanced (12-22 words), advanced grammar, idioms and connectors a native speaker would use.",
};

const SCHEMA = (n: number) => ({
  type: "object",
  properties: {
    sentences: { type: "array", items: { type: "string" }, minItems: n, maxItems: n },
  },
  required: ["sentences"],
});

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
          content:
            "You are a language teacher who writes example sentences for students to read aloud and copy by hand. " +
            "Sentences must be grammatically perfect, natural (what a native speaker would actually say), " +
            "self-contained, and varied in structure. Never number them or add explanations.",
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
  const topic = o.topic.trim() || "a random everyday situation (pick a different one each time)";
  const avoid = o.avoid.slice(0, 20);

  const prompt = [
    `Write ${o.count} different ${LANG_NAMES[writeIn as TargetLang | "en"]} sentences for a ${LANG_NAMES[o.target]} learner at CEFR level ${o.level}.`,
    via === "pivot"
      ? `They will be translated into ${LANG_NAMES[o.target]}, so use phrasing that translates naturally and avoid English-only idioms.`
      : "",
    `Topic: ${topic}.`,
    `Sentences should be ${LEVEL_GUIDE[o.level]}`,
    "Mix statements, questions and a little dialogue-style speech.",
    avoid.length ? `Do not repeat any of these:\n${avoid.map((s) => `- ${s}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const s = await (await session(writeIn, o.onModelProgress)).clone();
  try {
    const raw = await s.prompt(prompt, { responseConstraint: SCHEMA(o.count) });
    let sentences: string[] = (JSON.parse(raw).sentences as string[]).map((x) => x.trim()).filter(Boolean);
    if (via === "pivot") sentences = await Promise.all(sentences.map((x) => translate(x, "en", o.target)));
    const seen = new Set(o.avoid.map(normalize));
    sentences = sentences.filter((x) => !seen.has(normalize(x)) && (seen.add(normalize(x)), true));
    return { sentences, via };
  } finally {
    s.destroy();
  }
}

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
