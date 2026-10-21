// Speech facade: Kokoro (natural, on-device) with the browser's Web Speech API as fallback.
import type { WorkerRequest, WorkerResponse } from "./kokoro.worker";
import type { Engine } from "../settings";

export type KokoroState =
  | { status: "idle" }
  | { status: "loading"; fraction: number }
  | { status: "ready"; device: string }
  | { status: "error"; message: string };

type Listener = (s: KokoroState) => void;

const BCP47: Record<string, string> = { fr: "fr-FR", es: "es-ES", en: "en-US", pt: "pt-BR" };

class Speaker {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (b: AudioBuffer) => void; reject: (e: Error) => void }>();
  private cache = new Map<string, Promise<AudioBuffer>>();
  private ctx: AudioContext | null = null;
  private current: AudioBufferSourceNode | null = null;
  /** Bumped on every stop; a speak whose synthesis finishes after a newer stop/speak is dropped. */
  private gen = 0;
  private listeners = new Set<Listener>();
  state: KokoroState = { status: "idle" };

  onKokoroState(fn: Listener) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private setState(s: KokoroState) {
    this.state = s;
    this.listeners.forEach((fn) => fn(s));
  }

  loadKokoro() {
    if (this.worker && this.state.status !== "error") return;
    this.worker?.terminate();
    this.worker = new Worker(new URL("./kokoro.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.handle(e.data);
    this.setState({ status: "loading", fraction: 0 });
    this.post({ type: "load" });
  }

  private post(msg: WorkerRequest) {
    this.worker!.postMessage(msg);
  }

  private handle(msg: WorkerResponse) {
    switch (msg.type) {
      case "progress":
        this.setState({ status: "loading", fraction: msg.fraction });
        break;
      case "ready":
        this.setState({ status: "ready", device: msg.device });
        break;
      case "audio": {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        const buf = this.audioCtx().createBuffer(1, msg.samples.length, msg.sampleRate);
        buf.copyToChannel(msg.samples as Float32Array<ArrayBuffer>, 0);
        p?.resolve(buf);
        break;
      }
      case "error":
        if (msg.id != null) {
          this.pending.get(msg.id)?.reject(new Error(msg.message));
          this.pending.delete(msg.id);
        } else {
          this.setState({ status: "error", message: msg.message });
          this.pending.forEach((p) => p.reject(new Error(msg.message)));
          this.pending.clear();
        }
    }
  }

  private audioCtx() {
    return (this.ctx ??= new AudioContext());
  }

  /** Synthesize with Kokoro (cached per voice/speed/text). */
  synth(text: string, lang: string, voice: string, speed: number): Promise<AudioBuffer> {
    const key = `${voice}|${speed}|${text}`;
    let p = this.cache.get(key);
    if (!p) {
      this.loadKokoro();
      const id = this.nextId++;
      p = new Promise<AudioBuffer>((resolve, reject) => this.pending.set(id, { resolve, reject }));
      p.catch(() => this.cache.delete(key));
      this.cache.set(key, p);
      this.post({ type: "speak", id, text, lang, voice, speed });
    }
    return p;
  }

  /**
   * Speak and resolve when playback ends (or is superseded by another speak/stop).
   * `onStart` fires when audio actually begins. Falls back to the system voice if Kokoro fails.
   */
  async speak(
    text: string,
    lang: string,
    opts: { engine: Engine; voice: string; speed: number; onStart?: () => void },
  ): Promise<void> {
    this.stop();
    const gen = this.gen;
    if (opts.engine === "kokoro") {
      try {
        const buf = await this.synth(text, lang, opts.voice, opts.speed);
        if (gen !== this.gen) return;
        opts.onStart?.();
        return await this.play(buf);
      } catch (err) {
        if (gen !== this.gen) return;
        console.warn("Kokoro failed, using system voice", err);
      }
    }
    opts.onStart?.();
    return this.speakSystem(text, lang, opts.speed);
  }

  private play(buf: AudioBuffer): Promise<void> {
    const ctx = this.audioCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    this.current = src;
    return new Promise((resolve) => {
      src.onended = () => {
        if (this.current === src) this.current = null;
        resolve();
      };
      src.start();
    });
  }

  private speakSystem(text: string, lang: string, speed: number): Promise<void> {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = BCP47[lang] ?? lang;
      const voice = bestSystemVoice(lang);
      if (voice) u.voice = voice;
      u.rate = speed;
      u.onend = u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }

  stop() {
    this.gen++;
    try {
      this.current?.stop();
    } catch {
      // already stopped
    }
    this.current = null;
    speechSynthesis.cancel();
  }
}

/** Prefer macOS Premium/Enhanced voices, then local voices, for the language. */
export function bestSystemVoice(lang: string): SpeechSynthesisVoice | undefined {
  const tag = (BCP47[lang] ?? lang).toLowerCase();
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
  const score = (v: SpeechSynthesisVoice) =>
    (/premium/i.test(v.name) ? 8 : /enhanced|natural|neural/i.test(v.name) ? 4 : 0) +
    (v.lang.toLowerCase() === tag ? 2 : 0) +
    (v.localService ? 1 : 0);
  return voices.sort((a, b) => score(b) - score(a))[0];
}

export const speaker = new Speaker();
