// Kokoro 82M on ONNX Runtime (Android), from the files bundled in the APK.
import { InferenceSession, Tensor } from "onnxruntime-react-native";
import { KOKORO_SAMPLE_RATE, kokoroIds, kokoroStyle, kokoroTokenizer, phonemize, type KokoroTokenizer } from "@viva-voz/core";
import NativeEngine from "../../modules/native-engine";
import { modelsDir, readFile as read } from "./models";

export type Provider = "cpu" | "xnnpack";

interface Loaded {
  dir: string;
  session: InferenceSession;
  tokenizer: KokoroTokenizer;
}

let loaded: Promise<Loaded> | null = null;
const voices = new Map<string, Promise<Float32Array>>();

export function loadKokoro(provider: Provider = "xnnpack"): Promise<Loaded> {
  loaded ??= (async () => {
    const dir = `${await modelsDir()}/kokoro`;
    const [session, tokenizer] = await Promise.all([
      InferenceSession.create(`${dir}/model_quantized.onnx`, { executionProviders: [provider] }),
      read(`${dir}/tokenizer.json`).json().then(kokoroTokenizer),
    ]);
    return { dir, session, tokenizer };
  })();
  loaded.catch(() => (loaded = null));
  return loaded;
}

function voiceData(dir: string, voice: string): Promise<Float32Array> {
  let v = voices.get(voice);
  if (!v) {
    v = read(`${dir}/voices/${voice}.bin`).arrayBuffer().then((b) => new Float32Array(b));
    v.catch(() => voices.delete(voice));
    voices.set(voice, v);
  }
  return v;
}

export const espeak = (text: string, voice: string) => NativeEngine.phonemes(text, voice);

export interface Synthesis {
  samples: Float32Array;
  sampleRate: number;
  phonemes: string;
  timings: { phonemize: number; synth: number };
}

export async function synthesize(text: string, lang: string, voice: string, speed: number): Promise<Synthesis> {
  const { dir, session, tokenizer } = await loadKokoro();
  const t0 = Date.now();
  const phonemes = await phonemize(text, lang, espeak);
  const t1 = Date.now();
  const ids = kokoroIds(tokenizer, phonemes);
  const { waveform } = await session.run({
    input_ids: new Tensor("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]),
    style: new Tensor("float32", kokoroStyle(await voiceData(dir, voice), ids.length), [1, 256]),
    speed: new Tensor("float32", new Float32Array([speed]), [1]),
  });
  return {
    samples: waveform.data as Float32Array,
    sampleRate: KOKORO_SAMPLE_RATE,
    phonemes,
    timings: { phonemize: t1 - t0, synth: Date.now() - t1 },
  };
}
