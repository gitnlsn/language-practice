// Opus-MT (Marian) translation on any ONNX Runtime binding: the SentencePiece Unigram tokenizer and greedy
// decoding with the merged decoder's KV cache. Mirrors transformers.js so outputs match the web/Node version.

/** The subset of onnxruntime-common both onnxruntime-node and onnxruntime-react-native provide. */
export interface OrtTensorCtor {
  new (type: "int64", data: BigInt64Array, dims: readonly number[]): unknown;
  new (type: "float32", data: Float32Array, dims: readonly number[]): unknown;
  new (type: "bool", data: Uint8Array, dims: readonly number[]): unknown;
}
interface OrtValue {
  data: unknown;
  dims: readonly number[];
}
export interface OrtSession {
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtValue>>;
}

export interface MarianTokenizer {
  pieces: string[];
  scores: number[];
  ids: Map<string, number>;
  maxPieceLength: number;
  unkScore: number;
  languageCodes: Set<string>;
}

const EOS = 0;
const UNK = 1;
const SPACE = "▁";

/** Build from the model's `tokenizer.json` (a Unigram model over Metaspace-prefixed words). */
export function marianTokenizer(json: { model: { vocab: [string, number][] } }): MarianTokenizer {
  const pieces = json.model.vocab.map(([p]) => p);
  const scores = json.model.vocab.map(([, s]) => s);
  return {
    pieces,
    scores,
    ids: new Map(pieces.map((p, i) => [p, i])),
    maxPieceLength: Math.max(...pieces.map((p) => [...p].length)),
    unkScore: Math.min(...scores) - 10,
    languageCodes: new Set(pieces.filter((p) => /^>>\w+<<$/.test(p))),
  };
}

/** Best segmentation of one "▁word" by Viterbi over piece log-probabilities. */
function segment(tok: MarianTokenizer, word: string): number[] {
  const chars = [...word];
  const best = new Array<number>(chars.length + 1).fill(-Infinity);
  const from = new Array<number>(chars.length + 1).fill(0);
  const piece = new Array<number>(chars.length + 1).fill(UNK);
  best[0] = 0;
  for (let end = 1; end <= chars.length; end++) {
    for (let start = Math.max(0, end - tok.maxPieceLength); start < end; start++) {
      if (best[start] === -Infinity) continue;
      const id = tok.ids.get(chars.slice(start, end).join(""));
      const score = id == null ? (end - start === 1 ? tok.unkScore : -Infinity) : tok.scores[id];
      if (best[start] + score > best[end]) {
        best[end] = best[start] + score;
        from[end] = start;
        piece[end] = id ?? UNK;
      }
    }
  }
  const out: number[] = [];
  for (let end = chars.length; end > 0; end = from[end]) out.push(piece[end]);
  // Consecutive unknown characters collapse into one <unk>, as SentencePiece does.
  return out.reverse().filter((id, i, a) => !(id === UNK && a[i - 1] === UNK));
}

/** Text → ids ending in </s>. A leading ">>xx<<" language code (multilingual models) is kept as one token. */
export function marianEncode(tok: MarianTokenizer, text: string): number[] {
  const ids: number[] = [];
  let rest = text.trim();
  const code = /^(>>\w+<<)\s*/.exec(rest);
  if (code && tok.languageCodes.has(code[1])) {
    ids.push(tok.ids.get(code[1])!);
    rest = rest.slice(code[0].length);
  }
  for (const word of rest.split(/\s+/).filter(Boolean)) ids.push(...segment(tok, SPACE + word));
  ids.push(EOS);
  return ids;
}

export function marianDecode(tok: MarianTokenizer, ids: number[], pad: number): string {
  return ids
    .filter((id) => id !== EOS && id !== pad)
    .map((id) => tok.pieces[id])
    .join("")
    .replaceAll(SPACE, " ")
    .trim();
}

export interface MarianModel {
  tokenizer: MarianTokenizer;
  encoder: OrtSession;
  decoder: OrtSession;
  /** From config.json: `decoder_start_token_id` (= pad), `decoder_layers`, `decoder_attention_heads`, `d_model`. */
  config: { decoder_start_token_id: number; decoder_layers: number; decoder_attention_heads: number; d_model: number };
}

const int64 = (Tensor: OrtTensorCtor, xs: number[]) => new Tensor("int64", BigInt64Array.from(xs, BigInt), [1, xs.length]);

/** Greedy translation (num_beams = 1), like transformers.js `pipeline(...)(text, { num_beams: 1 })`. */
export async function marianTranslate(Tensor: OrtTensorCtor, m: MarianModel, text: string, maxTokens = 256): Promise<string> {
  const { decoder_start_token_id: pad, decoder_layers: layers, decoder_attention_heads: heads, d_model } = m.config;
  const src = marianEncode(m.tokenizer, text);
  const mask = int64(Tensor, src.map(() => 1));
  const { last_hidden_state } = await m.encoder.run({ input_ids: int64(Tensor, src), attention_mask: mask });

  const headDim = d_model / heads;
  const empty = () => new Tensor("float32", new Float32Array(0), [1, heads, 0, headDim]);
  let past: Record<string, unknown> = {};
  for (let l = 0; l < layers; l++)
    for (const kind of ["decoder", "encoder"])
      for (const kv of ["key", "value"]) past[`past_key_values.${l}.${kind}.${kv}`] = empty();

  const out: number[] = [];
  let next = pad;
  for (let step = 0; step < Math.min(maxTokens, src.length * 3 + 10); step++) {
    const r = await m.decoder.run({
      input_ids: int64(Tensor, [next]),
      encoder_attention_mask: mask,
      encoder_hidden_states: last_hidden_state,
      use_cache_branch: new Tensor("bool", Uint8Array.of(step > 0 ? 1 : 0), [1]),
      ...past,
    });
    const logits = r.logits.data as Float32Array;
    const vocab = r.logits.dims[2];
    const base = logits.length - vocab;
    next = EOS;
    let top = -Infinity;
    for (let i = 0; i < vocab; i++) {
      if (i === pad) continue; // generation_config bad_words_ids: never emit <pad>
      if (logits[base + i] > top) (top = logits[base + i]), (next = i);
    }
    if (next === EOS) break;
    out.push(next);
    // The decoder's self-attention cache grows each step; the cross-attention cache is fixed after step 0.
    const nextPast: Record<string, unknown> = {};
    for (let l = 0; l < layers; l++)
      for (const kv of ["key", "value"]) {
        nextPast[`past_key_values.${l}.decoder.${kv}`] = r[`present.${l}.decoder.${kv}`];
        nextPast[`past_key_values.${l}.encoder.${kv}`] =
          step === 0 ? r[`present.${l}.encoder.${kv}`] : past[`past_key_values.${l}.encoder.${kv}`];
      }
    past = nextPast;
  }
  return marianDecode(m.tokenizer, out, pad);
}
