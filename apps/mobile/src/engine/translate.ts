// Opus-MT on ONNX Runtime: en→fr, en→es, and en→pt through the multilingual ROMANCE model.
import { InferenceSession, Tensor } from "onnxruntime-react-native";
import { marianTokenizer, marianTranslate, type MarianModel, type OrtSession, type OrtTensorCtor } from "@viva-voz/core";
import { modelsDir, readFile } from "./models";

export type MtTarget = "fr" | "es" | "pt";

// The ROMANCE model serves several languages; a leading token picks the output.
const PREFIX: Record<MtTarget, string> = { fr: "", es: "", pt: ">>pt_br<< " };

const models = new Map<MtTarget, Promise<MarianModel>>();

export function loadTranslator(lang: MtTarget): Promise<MarianModel> {
  let m = models.get(lang);
  if (!m) {
    m = (async () => {
      const dir = `${await modelsDir()}/mt/${lang}`;
      const opts = { executionProviders: ["xnnpack" as const] };
      const [tokenizer, config, encoder, decoder] = await Promise.all([
        readFile(`${dir}/tokenizer.json`).json().then(marianTokenizer),
        readFile(`${dir}/config.json`).json(),
        InferenceSession.create(`${dir}/encoder.onnx`, opts),
        InferenceSession.create(`${dir}/decoder.onnx`, opts),
      ]);
      return { tokenizer, config, encoder: encoder as unknown as OrtSession, decoder: decoder as unknown as OrtSession };
    })();
    m.catch(() => models.delete(lang));
    models.set(lang, m);
  }
  return m;
}

/** Translate English sentences, one at a time (each is short; batching gains little on a phone CPU). */
export async function translateEnglish(sentences: string[], to: MtTarget): Promise<string[]> {
  const model = await loadTranslator(to);
  const out: string[] = [];
  for (const s of sentences) out.push(await marianTranslate(Tensor as unknown as OrtTensorCtor, model, PREFIX[to] + s));
  return out;
}
