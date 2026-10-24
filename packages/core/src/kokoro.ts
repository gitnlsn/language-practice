// The parts of kokoro-js the Android app reimplements: tokenizing phonemes and picking the voice's style vector.
// The model itself is run by whichever ONNX Runtime the platform has.

export const KOKORO_SAMPLE_RATE = 24000;
const STYLE_DIM = 256;
const MAX_TOKENS = 510; // 512 with the two "$" padding tokens

export interface KokoroTokenizer {
  vocab: Map<string, number>;
  /** Characters the model doesn't know; stripped before lookup (the tokenizer's normalizer). */
  unknown: RegExp;
}

/** Build from the model's `tokenizer.json`. */
export function kokoroTokenizer(json: {
  model: { vocab: Record<string, number> };
  normalizer: { pattern: { Regex: string } };
}): KokoroTokenizer {
  return { vocab: new Map(Object.entries(json.model.vocab)), unknown: new RegExp(json.normalizer.pattern.Regex, "gu") };
}

/** Phoneme string → input ids, one per character, wrapped in "$" (id 0) like the tokenizer's post-processor. */
export function kokoroIds(tok: KokoroTokenizer, phonemes: string): number[] {
  const ids: number[] = [];
  for (const ch of phonemes.replace(tok.unknown, "")) {
    const id = tok.vocab.get(ch);
    if (id != null) ids.push(id);
    if (ids.length === MAX_TOKENS) break;
  }
  return [0, ...ids, 0];
}

/** A voice file holds one 256-float style vector per utterance length; pick the row for these ids. */
export function kokoroStyle(voice: Float32Array, idCount: number): Float32Array {
  const row = Math.min(Math.max(idCount - 2, 0), 509);
  return voice.slice(row * STYLE_DIM, (row + 1) * STYLE_DIM);
}
