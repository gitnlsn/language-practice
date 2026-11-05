// Speech facade (port of apps/web/src/tts/speak.ts): Kokoro, on-device, with the system voice as fallback.
import * as Speech from "expo-speech";
import { AudioContext, type AudioBuffer, type AudioBufferSourceNode } from "react-native-audio-api";
import { KOKORO_SAMPLE_RATE, type Engine } from "@viva-voz/core";
import { synthesize } from "./kokoro";

const BCP47: Record<string, string> = { fr: "fr-FR", es: "es-ES", en: "en-US", pt: "pt-BR" };

/** What to synthesize: one sentence in one voice at one speed. */
export interface SynthRequest {
  text: string;
  lang: string;
  voice: string;
  speed: number;
}

interface Job extends SynthRequest {
  key: string;
  /** Someone is waiting to hear it: never dropped, and runs before background work. */
  urgent: boolean;
  resolve: (buf: AudioBuffer) => void;
  reject: (err: unknown) => void;
}

/** Synthesized clips kept in memory (a clip is a few hundred KB). */
const CACHE_LIMIT = 60;

class Cancelled extends Error {}

const keyOf = (r: SynthRequest) => `${r.voice}|${r.speed}|${r.text}`;

class Speaker {
  private cache = new Map<string, Promise<AudioBuffer>>();
  /** Keys whose audio is synthesized and ready to play. */
  private done = new Set<string>();
  private listeners = new Set<() => void>();
  /** Kokoro runs one sentence at a time, so the first sentence isn't slowed down by the others. */
  private queue: Job[] = [];
  private working = false;
  private ctx: AudioContext | null = null;
  private current: AudioBufferSourceNode | null = null;
  /** Bumped on every stop; a speak whose synthesis finishes after a newer stop/speak is dropped. */
  private gen = 0;

  private audioCtx() {
    return (this.ctx ??= new AudioContext({ sampleRate: KOKORO_SAMPLE_RATE }));
  }

  /** Notified whenever a clip becomes ready (or is dropped). */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  /** Queued or being synthesized right now. */
  isPending(r: SynthRequest): boolean {
    const key = keyOf(r);
    return this.cache.has(key) && !this.done.has(key);
  }

  /**
   * Synthesize with Kokoro (cached per voice/speed/text). `urgent` puts it at the front of the queue, for a
   * sentence that is about to play.
   */
  synth(r: SynthRequest, urgent = false): Promise<AudioBuffer> {
    const key = keyOf(r);
    const cached = this.cache.get(key);
    if (cached) {
      if (urgent) this.promote(key);
      return cached;
    }
    const p = new Promise<AudioBuffer>((resolve, reject) => {
      const job: Job = { ...r, key, urgent, resolve, reject };
      if (urgent) this.queue.unshift(job);
      else this.queue.push(job);
    });
    p.then(
      () => {
        if (this.cache.get(key) !== p) return;
        this.done.add(key);
        this.evict();
        this.emit();
      },
      () => {
        if (this.cache.get(key) !== p) return;
        this.cache.delete(key);
        this.emit();
      },
    );
    this.cache.set(key, p);
    this.emit();
    void this.pump();
    return p;
  }

  /**
   * Get a whole set ready in the background, in order. Background work for sentences no longer in the set
   * (an older set) is dropped so it doesn't hold up this one.
   */
  preload(items: SynthRequest[]) {
    const wanted = new Set(items.map(keyOf));
    this.queue = this.queue.filter((job) => {
      if (job.urgent || wanted.has(job.key)) return true;
      job.reject(new Cancelled());
      return false;
    });
    for (const r of items) this.synth(r).catch(() => {});
  }

  private promote(key: string) {
    const i = this.queue.findIndex((job) => job.key === key);
    if (i < 0) return;
    const [job] = this.queue.splice(i, 1);
    job.urgent = true;
    this.queue.unshift(job);
  }

  private async pump() {
    if (this.working) return;
    this.working = true;
    try {
      for (let job = this.queue.shift(); job; job = this.queue.shift()) {
        try {
          const { samples, sampleRate } = await synthesize(job.text, job.lang, job.voice, job.speed);
          const buf = this.audioCtx().createBuffer(1, samples.length, sampleRate);
          buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
          job.resolve(buf);
        } catch (err) {
          job.reject(err);
        }
      }
    } finally {
      this.working = false;
    }
  }

  /** Drop the oldest finished clips once the cache is over its limit. */
  private evict() {
    for (const key of this.done) {
      if (this.done.size <= CACHE_LIMIT) break;
      this.done.delete(key);
      this.cache.delete(key);
    }
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
        const buf = await this.synth({ text, lang, voice: opts.voice, speed: opts.speed }, true);
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
      src.onEnded = () => {
        if (this.current === src) this.current = null;
        resolve();
      };
      src.start();
    });
  }

  private speakSystem(text: string, lang: string, speed: number): Promise<void> {
    return new Promise((resolve) => {
      Speech.speak(text, { language: BCP47[lang] ?? lang, rate: speed, onDone: resolve, onStopped: resolve, onError: () => resolve() });
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
    void Speech.stop();
  }
}

export const speaker = new Speaker();
