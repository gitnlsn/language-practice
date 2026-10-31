import { LANG_NAMES, type Level, type TargetLang } from "./settings";

const LEVEL_GUIDE: Record<Level, string> = {
  A1: "very short (4-8 words), present tense, basic everyday vocabulary (greetings, family, food, numbers, places).",
  A2: "short (6-10 words), present, near future and simple past, common daily-life vocabulary.",
  B1: "medium length (8-14 words), mix of past, future and conditional tenses, opinions and plans.",
  B2: "natural length (10-18 words), subjunctive and complex clauses where natural, idiomatic but common expressions.",
  C1: "varied and nuanced (12-22 words), advanced grammar, idioms and connectors a native speaker would use.",
};

export const SYSTEM_PROMPT =
  "You are a language teacher who writes example sentences for students to read aloud and copy by hand. " +
  "Sentences must be grammatically perfect, natural (what a native speaker would actually say), " +
  "self-contained, and varied in structure. Never number them or add explanations.";

/** JSON schema for `{ sentences: string[] }` with exactly `n` items. */
export const sentencesSchema = (n: number) => ({
  type: "object",
  properties: {
    sentences: { type: "array", items: { type: "string" }, minItems: n, maxItems: n },
  },
  required: ["sentences"],
});

export interface PromptOptions {
  target: TargetLang;
  level: Level;
  topic: string;
  count: number;
  avoid: string[];
  /** Language the model writes in. When it differs from `target`, the sentences are translated afterwards. */
  writeIn?: TargetLang | "en";
}

export function sentencesPrompt(o: PromptOptions): string {
  const writeIn = o.writeIn ?? o.target;
  const topic = o.topic.trim() || "a random everyday situation (pick a different one each time)";
  const avoid = o.avoid.slice(0, 20);
  return [
    `Write ${o.count} different ${LANG_NAMES[writeIn]} sentences for a ${LANG_NAMES[o.target]} learner at CEFR level ${o.level}.`,
    writeIn !== o.target
      ? `They will be translated into ${LANG_NAMES[o.target]}, so use phrasing that translates naturally and avoid English-only idioms.`
      : "",
    `Topic: ${topic}.`,
    `Sentences should be ${LEVEL_GUIDE[o.level]}`,
    "Mix statements, questions and a little dialogue-style speech.",
    avoid.length ? `Do not repeat any of these:\n${avoid.map((s) => `- ${s}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Small models sometimes wrap each item in quotes or number it; strip that. */
const tidy = (s: string) => s.trim().replace(/^\d+[.)]\s+/, "").replace(/^["“«]\s*(.*?)\s*["”»]$/s, "$1").trim();

/** Parse the model's `{ sentences }` JSON into trimmed, non-empty sentences. */
export const parseSentences = (raw: string): string[] =>
  (JSON.parse(raw).sentences as string[]).map(tidy).filter(Boolean);

/** Drop sentences already in `avoid` or repeated within the batch. */
export function dedupe(sentences: string[], avoid: string[]): string[] {
  const seen = new Set(avoid.map(normalize));
  return sentences.filter((x) => !seen.has(normalize(x)) && (seen.add(normalize(x)), true));
}

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
