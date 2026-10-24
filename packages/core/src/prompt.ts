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

/** The same shape as a llama.cpp GBNF grammar, for runtimes that take a grammar rather than a JSON schema. */
export function sentencesGrammar(n: number): string {
  const item = "ws string";
  return [
    `root ::= "{" ws "\\"sentences\\"" ws ":" ws "[" ${item}${` ws "," ${item}`.repeat(n - 1)} ws "]" ws "}"`,
    `string ::= "\\"" ( [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ( ["\\\\/bfnrt] | "u" [0-9a-fA-F]{4} ) )* "\\""`,
    `ws ::= [ \\t\\n]{0,20}`,
  ].join("\n");
}

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

// Android: a small local model writes English (where it is reliable) and Opus-MT translates. The prompt never
// names the learner's language: small models drift into it and stop writing English.
const ENGLISH_LEVEL: Record<Level, string> = {
  A1: "very short (4-8 words), present tense, basic everyday words",
  A2: "short (6-10 words), present, near future and simple past, common daily-life words",
  B1: "medium length (8-14 words), past, future and conditional, opinions and plans",
  B2: "10-18 words, complex clauses (if/although/unless/so that), hypotheticals, common idioms",
  C1: "12-22 words, nuanced, advanced connectors and idiomatic expressions",
};

export const ENGLISH_SYSTEM_PROMPT =
  "You write example sentences in plain, natural English for language learners. Output English only.";

export function englishSentencesPrompt(o: { level: Level; topic: string; count: number; avoid: string[] }): string {
  const avoid = o.avoid.slice(0, 20);
  return [
    `Write ${o.count} different English sentences at CEFR level ${o.level}.`,
    `Topic: ${o.topic.trim() || "a random everyday situation (pick a different one each time)"}.`,
    `Sentences: ${ENGLISH_LEVEL[o.level]}.`,
    "Mix statements, questions and dialogue-style lines. Use simple, literal wording that translates well; avoid English-only idioms and phrasal verbs.",
    "Each item must be one complete sentence ending with . ? or !",
    avoid.length ? `Do not repeat any of these:\n${avoid.map((s) => `- ${s}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Drop fragments a small model sometimes emits (no final punctuation). */
export const isCompleteSentence = (s: string) => /[.?!…]["”»)]?$/.test(s.trim());

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
