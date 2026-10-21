import { h } from "./dom";
import * as store from "../store";
import type { Sentence } from "../store";
import type { PracticeMode } from "../settings";

export interface CardHandlers {
  play: (s: Sentence, card: HTMLElement) => void;
  onRemove?: (s: Sentence) => void;
}

/** One sentence card. In "listen" mode the translation starts hidden; in "produce" mode the target does. */
export function sentenceCard(s: Sentence, index: number, mode: PracticeMode, handlers: CardHandlers) {
  const hidden = mode === "listen" ? "translation" : "target";

  const reveal = () => card.classList.add("revealed");
  const target = h("p", { class: "target", lang: s.target }, s.text);
  const translation = h("p", { class: "translation", lang: s.native }, s.translation);
  (hidden === "target" ? target : translation).classList.add("concealed");
  for (const el of [target, translation]) el.addEventListener("click", reveal);

  const toggle = (key: "favorite" | "hard", btn: HTMLButtonElement) => {
    s[key] = !s[key];
    btn.setAttribute("aria-pressed", String(!!s[key]));
    void store.update(s.id, { [key]: s[key] });
  };

  const fav: HTMLButtonElement = h(
    "button",
    { class: "chip fav", "aria-pressed": String(!!s.favorite), title: "Save (S)", onclick: () => toggle("favorite", fav) },
    "★ Save",
  );
  const hard: HTMLButtonElement = h(
    "button",
    { class: "chip", "aria-pressed": String(!!s.hard), title: "Mark as hard", onclick: () => toggle("hard", hard) },
    "⚑ Hard",
  );

  const card: HTMLElement = h(
    "article",
    { class: "card", tabindex: 0, dataset: { id: s.id } },
    h("span", { class: "num" }, String(index + 1).padStart(2, "0")),
    h(
      "div",
      { class: "card-body" },
      target,
      translation,
      h(
        "div",
        { class: "actions" },
        h("button", { class: "chip play", title: "Listen (Space)", onclick: () => handlers.play(s, card) }, "▶ Listen"),
        h("button", { class: "chip reveal-btn", title: "Reveal (R)", onclick: reveal }, "Reveal"),
        fav,
        hard,
        handlers.onRemove &&
          h("button", { class: "chip ghost", title: "Delete", onclick: () => handlers.onRemove!(s) }, "Delete"),
      ),
    ),
  );
  return card;
}
