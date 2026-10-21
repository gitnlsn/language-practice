/// <reference lib="webworker" />
import { KokoroTTS } from "kokoro-js";
import { phonemize } from "./phonemize";

export type WorkerRequest =
  | { type: "load" }
  | { type: "speak"; id: number; text: string; lang: string; voice: string; speed: number };

export type WorkerResponse =
  | { type: "progress"; fraction: number }
  | { type: "ready"; device: "webgpu" | "wasm" }
  | { type: "audio"; id: number; samples: Float32Array; sampleRate: number }
  | { type: "error"; id?: number; message: string };

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const post = (msg: WorkerResponse, transfer: Transferable[] = []) => self.postMessage(msg, transfer);

let tts: Promise<KokoroTTS> | null = null;

async function load(): Promise<KokoroTTS> {
  const gpu = (navigator as any).gpu;
  const device = gpu && (await gpu.requestAdapter().catch(() => null)) ? "webgpu" : "wasm";
  // fp32 on WebGPU (quantized models are unreliable there); q8 keeps the WASM download small.
  const files = new Map<string, { loaded: number; total: number }>();
  const model = await KokoroTTS.from_pretrained(MODEL, {
    device,
    dtype: device === "webgpu" ? "fp32" : "q8",
    progress_callback: (p: any) => {
      if (p.status !== "progress" || !p.total) return;
      files.set(p.file, { loaded: p.loaded, total: p.total });
      let loaded = 0, total = 0;
      for (const f of files.values()) (loaded += f.loaded), (total += f.total);
      post({ type: "progress", fraction: loaded / total });
    },
  });
  post({ type: "ready", device });
  return model;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === "load") {
    tts ??= load();
    tts.catch((err) => {
      tts = null;
      post({ type: "error", message: String(err?.message ?? err) });
    });
    return;
  }
  try {
    tts ??= load();
    const model = await tts;
    const phonemes = await phonemize(msg.text, msg.lang);
    const { input_ids } = model.tokenizer(phonemes, { truncation: true });
    const audio = await model.generate_from_ids(input_ids, { voice: msg.voice as any, speed: msg.speed });
    const samples = audio.audio as Float32Array;
    post({ type: "audio", id: msg.id, samples, sampleRate: audio.sampling_rate }, [samples.buffer]);
  } catch (err: any) {
    post({ type: "error", id: msg.id, message: String(err?.message ?? err) });
  }
};
