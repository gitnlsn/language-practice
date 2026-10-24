// Speech facade (port of apps/web/src/tts/speak.ts): Kokoro, on-device, with the system voice as fallback.
import * as Speech from "expo-speech";
import { AudioContext, type AudioBuffer, type AudioBufferSourceNode } from "react-native-audio-api";
import { KOKORO_SAMPLE_RATE, type Engine } from "@viva-voz/core";
import { synthesize } from "./kokoro";

const BCP47: Record<string, string> = { fr: "fr-FR", es: "es-ES", en: "en-US", pt: "pt-BR" };

class Speaker {
  private cache = new Map<string, Promise<AudioBuffer>>();
  private ctx: AudioContext | null = null;
  private current: AudioBufferSourceNode | null = null;
  /** Bumped on every stop; a speak whose synthesis finishes after a newer stop/speak is dropped. */
  private gen = 0;

  private audioCtx() {
    return (this.ctx ??= new AudioContext({ sampleRate: KOKORO_SAMPLE_RATE }));
  }

  /** Synthesize with Kokoro (cached per voice/speed/text). */
  synth(text: string, lang: string, voice: string, speed: number): Promise<AudioBuffer> {
    const key = `${voice}|${speed}|${text}`;
    let p = this.cache.get(key);
    if (!p) {
      p = synthesize(text, lang, voice, speed).then(({ samples, sampleRate }) => {
        const buf = this.audioCtx().createBuffer(1, samples.length, sampleRate);
        buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
        return buf;
      });
      p.catch(() => this.cache.delete(key));
      this.cache.set(key, p);
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
