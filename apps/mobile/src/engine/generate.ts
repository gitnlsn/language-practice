// Sentences on Android, fully offline: Qwen2.5 1.5B writes English at the level (small models are reliable in
// English), then Opus-MT translates into the practice language and the learner's language.
import { initLlama, type LlamaContext } from "llama.rn";
import {
  dedupe,
  ENGLISH_SYSTEM_PROMPT,
  englishSentencesPrompt,
  isCompleteSentence,
  parseSentences,
  sentencesGrammar,
  type Level,
  type NativeLang,
  type TargetLang,
} from "@viva-voz/core";
import { modelsDir } from "./models";
import { translateEnglish } from "./translate";

const MODEL = "llm/qwen2.5-1.5b-instruct-q4_0.gguf";

// Qwen's ChatML, built here: llama.rn's message formatting left out the assistant header and ignored
// response_format on this model, so the prompt and the JSON grammar are passed directly.
const chatml = (system: string, user: string) =>
  `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n`;

let llm: Promise<LlamaContext> | null = null;

export function loadWriter(): Promise<LlamaContext> {
  llm ??= modelsDir().then((dir) => initLlama({ model: `${dir}/${MODEL}`, n_ctx: 2048, n_gpu_layers: 0 }));
  llm.catch(() => (llm = null));
  return llm;
}

export interface GenerateOptions {
  target: TargetLang;
  native: NativeLang;
  level: Level;
  topic: string;
  count: number;
  /** Recent English originals, so the model doesn't repeat itself. */
  avoid: string[];
}

export interface Generated {
  source: string;
  text: string;
  translation: string;
}

export interface GenerateTimings {
  write: number;
  translate: number;
}

/**
 * Write the English batch, then translate one sentence at a time, handing each to `onItem` as soon as it's ready
 * so the list fills in while the rest are still translating.
 */
export async function generateSentences(
  o: GenerateOptions,
  onItem?: (item: Generated) => void,
): Promise<{ items: Generated[]; timings: GenerateTimings }> {
  const ctx = await loadWriter();
  let t = Date.now();
  const res = await ctx.completion({
    prompt: chatml(ENGLISH_SYSTEM_PROMPT, englishSentencesPrompt(o)),
    grammar: sentencesGrammar(o.count),
    temperature: 0.8,
    n_predict: 600,
  });
  let parsed: string[];
  try {
    parsed = parseSentences(res.text);
  } catch {
    throw new Error(`The model didn't return the expected JSON: ${res.text.slice(0, 200)}`);
  }
  const english = dedupe(parsed.filter(isCompleteSentence), o.avoid);
  const write = Date.now() - t;

  t = Date.now();
  const items: Generated[] = [];
  for (const source of english) {
    const [text] = await translateEnglish([source], o.target);
    // English learners already have the original; Portuguese is translated from the English, not from the target.
    const [translation] = o.native === "en" ? [source] : await translateEnglish([source], "pt");
    const item = { source, text, translation };
    items.push(item);
    onItem?.(item);
  }
  return { items, timings: { write, translate: Date.now() - t } };
}
