import { h, isTyping } from "./dom";
import { sentenceCard } from "./card";
import { speaker } from "../tts/speak";
import type { Sentence } from "../store";
import { repeatPauseMs, type Settings } from "@viva-voz/core";

/** A list of sentence cards with single play, "play all with pauses" (shadowing) and keyboard navigation. */
export class Deck {
  readonly el = h("div", { class: "deck" });
  private items: Sentence[] = [];
  private cards: HTMLElement[] = [];
  private current = 0;
  private runId = 0;
  private speakId = 0;
  onPlayAllChange?: (playing: boolean) => void;

  private settings: () => Settings;
  private onRemove?: (s: Sentence) => void;

  constructor(settings: () => Settings, onRemove?: (s: Sentence) => void) {
    this.settings = settings;
    this.onRemove = onRemove;
  }

  get size() {
    return this.items.length;
  }

  get sentences() {
    return this.items;
  }

  set(items: Sentence[]) {
    this.stopAll();
    this.items = items;
    this.render();
    this.prefetch(0);
  }

  render() {
    const mode = this.settings().mode;
    this.cards = this.items.map((s, i) =>
      sentenceCard(s, i, mode, {
        play: (_, card) => {
          this.focus(this.cards.indexOf(card));
          this.toggle(this.current);
        },
        onRemove: this.onRemove,
      }),
    );
    this.cards.forEach((c, i) => c.addEventListener("focus", () => this.mark(i)));
    this.el.replaceChildren(...this.cards);
    this.mark(Math.min(this.current, this.cards.length - 1));
  }

  private mark(i: number) {
    if (i < 0) return;
    this.current = i;
    this.cards.forEach((c, j) => c.classList.toggle("current", j === i));
  }

  private focus(i: number) {
    if (i < 0 || i >= this.cards.length) return;
    this.mark(i);
    this.cards[i].focus({ preventScroll: true });
    this.cards[i].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /** Warm the Kokoro cache for the next couple of sentences so playback starts instantly. */
  private prefetch(from: number) {
    const s = this.settings();
    if (s.engine !== "kokoro") return;
    for (const item of this.items.slice(from, from + 2)) {
      speaker.synth(item.text, item.target, s.voices[item.target], s.speed).catch(() => {});
    }
  }

  /** Play the card, or stop it if it is already loading/speaking. */
  private toggle(i: number) {
    const busy = this.cards[i]?.matches(".loading, .speaking");
    this.stopAll();
    if (!busy) void this.speak(i);
  }

  private setPlayState(card: HTMLElement, state: "idle" | "loading" | "speaking") {
    card.classList.toggle("loading", state === "loading");
    card.classList.toggle("speaking", state === "speaking");
    const btn = card.querySelector<HTMLButtonElement>(".play");
    if (!btn) return;
    btn.textContent = state === "loading" ? "Loading…" : state === "speaking" ? "■ Stop" : "▶ Listen";
    btn.setAttribute("aria-busy", String(state === "loading"));
  }

  private async speak(i: number) {
    const item = this.items[i];
    if (!item) return;
    const s = this.settings();
    const card = this.cards[i];
    const id = ++this.speakId;
    this.setPlayState(card, "loading");
    this.prefetch(i + 1);
    try {
      await speaker.speak(item.text, item.target, {
        engine: s.engine,
        voice: s.voices[item.target],
        speed: s.speed,
        onStart: () => id === this.speakId && this.setPlayState(card, "speaking"),
      });
    } finally {
      if (id === this.speakId) this.setPlayState(card, "idle");
    }
  }

  /** Shadowing: play each sentence, then leave a silent gap long enough to repeat it aloud. */
  async playAll() {
    const run = ++this.runId;
    this.onPlayAllChange?.(true);
    for (let i = this.current; i < this.items.length && run === this.runId; i++) {
      this.focus(i);
      const started = performance.now();
      await this.speak(i);
      const spoken = performance.now() - started;
      if (run !== this.runId) break;
      this.cards[i].classList.add("your-turn");
      await new Promise((r) => setTimeout(r, repeatPauseMs(spoken)));
      this.cards[i]?.classList.remove("your-turn");
    }
    if (run === this.runId) this.onPlayAllChange?.(false);
  }

  stopAll() {
    if (this.runId) this.onPlayAllChange?.(false);
    this.runId++;
    this.speakId++;
    this.cards.forEach((c) => {
      c.classList.remove("your-turn");
      this.setPlayState(c, "idle");
    });
    speaker.stop();
  }

  /** Keyboard shortcuts; returns true if handled. */
  keydown(e: KeyboardEvent): boolean {
    if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey || !this.cards.length) return false;
    const card = this.cards[this.current];
    switch (e.key) {
      case " ":
        if (e.target instanceof HTMLButtonElement) return false;
        this.toggle(this.current);
        return true;
      case "ArrowDown":
      case "ArrowRight":
      case "j":
        this.focus(this.current + 1);
        return true;
      case "ArrowUp":
      case "ArrowLeft":
      case "k":
        this.focus(this.current - 1);
        return true;
      case "r":
        card.classList.add("revealed");
        return true;
      case "s":
        card.querySelector<HTMLButtonElement>(".fav")?.click();
        return true;
    }
    return false;
  }
}
