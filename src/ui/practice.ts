import { field, h, segmented, select } from "./dom";
import { Deck } from "./deck";
import { printSheet } from "./print";
import { generateSentences } from "../ai/generate";
import { create, translate } from "../ai/translate";
import { hasPromptApi, hasTranslatorApi } from "../ai/capabilities";
import * as store from "../store";
import { LANG_NAMES, type Level, type NativeLang, type Settings, type TargetLang } from "../settings";

const TOPICS = [
  "ordering at a café or restaurant",
  "travel and directions",
  "shopping",
  "work and meetings",
  "family and friends",
  "health and the doctor",
  "weather and seasons",
  "hobbies and weekends",
  "home and daily routine",
  "feelings and opinions",
  "small talk with a neighbour",
  "phone calls and appointments",
];

export function practiceView(root: HTMLElement, settings: Settings, save: () => void, goSetup: () => void) {
  const deck = new Deck(() => settings);
  const status = h("p", { class: "status", role: "status" });
  const setStatus = (msg: string | Node, kind: "" | "error" | "busy" = "") => {
    status.className = `status ${kind}`;
    status.replaceChildren(msg);
  };

  const topic = h("input", {
    type: "text",
    placeholder: "Anything — or leave empty for a surprise",
    value: settings.topic,
    list: "topic-presets",
    oninput: () => ((settings.topic = topic.value), save()),
  });

  const generateBtn: HTMLButtonElement = h("button", { class: "primary", onclick: () => void generate() }, "Generate sentences");

  async function generate() {
    if (!hasPromptApi() || !hasTranslatorApi()) {
      setStatus(h("span", {}, "Chrome's built-in AI isn't available here. ", h("a", { href: "#", onclick: (e: Event) => (e.preventDefault(), goSetup()) }, "Open Setup")), "error");
      return;
    }
    generateBtn.disabled = true;
    const { target, native, level, count } = settings;
    // Kick off the translator download while we still hold the click's user activation (Chrome requires it).
    create(target, native).catch(() => {});
    try {
      setStatus("Writing sentences…", "busy");
      const result = await generateSentences({
        target,
        level,
        count,
        topic: settings.topic,
        avoid: await store.recentTexts(target),
        // Chrome reports progress even for an already-downloaded model (0 → 1), so only show real downloads.
        onModelProgress: (f) => f < 1 && setStatus(`Downloading the language model… ${Math.round(f * 100)}%`, "busy"),
      });
      if (!result.sentences.length) throw new Error("The model returned no new sentences. Try again or change the topic.");

      setStatus(`Translating into ${LANG_NAMES[native]}…`, "busy");
      const translations = await Promise.all(result.sentences.map((t) => translate(t, target, native)));
      const now = Date.now();
      const items: store.Sentence[] = result.sentences.map((text, i) => ({
        id: `${now}-${i}`,
        target,
        text,
        native,
        translation: translations[i],
        level,
        topic: settings.topic.trim(),
        createdAt: now,
      }));
      await store.add(items);
      deck.set(items);
      setStatus(
        result.via === "pivot"
          ? `Gemini Nano can't write ${LANG_NAMES[target]} on this device yet, so it wrote in English and Chrome translated.`
          : "",
      );
      refreshToolbar();
    } catch (err: any) {
      console.error(err);
      setStatus(h("span", {}, `${err?.message ?? err} `, h("a", { href: "#", onclick: (e: Event) => (e.preventDefault(), goSetup()) }, "Check Setup")), "error");
    } finally {
      generateBtn.disabled = false;
    }
  }

  const playAllBtn: HTMLButtonElement = h("button", {
    class: "secondary",
    onclick: () => (playAllBtn.dataset.playing ? deck.stopAll() : void deck.playAll()),
  });
  deck.onPlayAllChange = (playing) => {
    if (playing) playAllBtn.dataset.playing = "1";
    else delete playAllBtn.dataset.playing;
    playAllBtn.textContent = playing ? "■ Stop" : "▶ Play all & repeat";
  };
  deck.onPlayAllChange(false);

  const printBtn = h("button", {
    class: "secondary",
    onclick: () => printSheet(deck.sentences, `${LANG_NAMES[settings.target]} · ${settings.level}${settings.topic ? ` · ${settings.topic}` : ""}`),
  }, "Print for handwriting");

  const toolbar = h(
    "div",
    { class: "toolbar" },
    segmented(
      "mode",
      [
        { value: "listen", label: "Listen → repeat" },
        { value: "produce", label: "Translate → say" },
      ],
      settings.mode,
      (v) => ((settings.mode = v), save(), deck.render()),
    ),
    segmented(
      "speed",
      [
        { value: 0.7, label: "0.7×" },
        { value: 0.85, label: "0.85×" },
        { value: 1, label: "1×" },
      ],
      settings.speed,
      (v) => ((settings.speed = v), save()),
    ),
    h("div", { class: "spacer" }),
    playAllBtn,
    printBtn,
  );

  function refreshToolbar() {
    toolbar.hidden = deck.size === 0;
    empty.hidden = deck.size > 0;
  }

  const empty = h(
    "div",
    { class: "empty" },
    h("p", { class: "empty-title" }, "Pick a language, level and topic, then generate."),
    h("p", {}, "Listen, read aloud, and copy each sentence by hand. Shortcuts: Space to listen, ↑/↓ to move, R to reveal, S to save."),
  );

  root.replaceChildren(
    h(
      "form",
      { class: "controls", onsubmit: (e: Event) => (e.preventDefault(), void generate()) },
      field(
        "Practice",
        segmented<TargetLang>(
          "target",
          [
            { value: "fr", label: "Français" },
            { value: "es", label: "Español" },
          ],
          settings.target,
          (v) => ((settings.target = v), save()),
        ),
      ),
      field(
        "Translate to",
        select<NativeLang>(
          "Translate to",
          [
            { value: "pt", label: "Português" },
            { value: "en", label: "English" },
          ],
          settings.native,
          (v) => ((settings.native = v), save()),
        ),
      ),
      field(
        "Level",
        segmented<Level>("level", (["A1", "A2", "B1", "B2", "C1"] as Level[]).map((l) => ({ value: l, label: l })), settings.level, (v) => ((settings.level = v), save())),
      ),
      h("div", { class: "field grow" }, h("span", { class: "field-label" }, "Topic"), topic),
      h("datalist", { id: "topic-presets" }, ...TOPICS.map((t) => h("option", { value: t }))),
      field(
        "How many",
        select<number>("How many", [3, 5, 8, 10].map((n) => ({ value: n, label: String(n) })), settings.count, (v) => ((settings.count = v), save())),
      ),
      h("div", { class: "field submit" }, generateBtn),
    ),
    status,
    toolbar,
    empty,
    deck.el,
  );
  refreshToolbar();

  return {
    deck,
    /** Load a set of saved sentences into the practice deck. */
    load(items: store.Sentence[]) {
      deck.set(items);
      setStatus("");
      refreshToolbar();
    },
  };
}
