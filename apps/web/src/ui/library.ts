import { h, segmented } from "./dom";
import { Deck } from "./deck";
import { printSheet } from "./print";
import * as store from "../store";
import { filterSentences, type LibraryFilter as Filter, type Settings, type TargetLang } from "@viva-voz/core";

export function libraryView(root: HTMLElement, settings: Settings, practice: (items: store.Sentence[]) => void) {
  let filter: Filter = "favorite";
  let lang: TargetLang | "any" = "any";

  const deck = new Deck(
    () => settings,
    async (s) => {
      await store.remove(s.id);
      void refresh();
    },
  );
  const count = h("span", { class: "muted" });
  const actions = h(
    "div",
    { class: "toolbar" },
    count,
    h("div", { class: "spacer" }),
    h("button", { class: "secondary", onclick: () => practice(deck.sentences.slice(0, 20)) }, "Practice these"),
    h("button", { class: "secondary", onclick: () => printSheet(deck.sentences.slice(0, 30), "Saved sentences") }, "Print"),
  );
  const empty = h("p", { class: "empty" });

  async function refresh() {
    const items = filterSentences(await store.all(), filter, lang);
    deck.set(items);
    count.textContent = `${items.length} sentence${items.length === 1 ? "" : "s"}`;
    actions.hidden = !items.length;
    empty.hidden = !!items.length;
    empty.textContent =
      filter === "favorite" ? "Nothing saved yet. Press ★ Save on a sentence you like." :
      filter === "hard" ? "No sentences marked as hard." : "No history yet.";
  }

  root.replaceChildren(
    h(
      "div",
      { class: "controls" },
      segmented<Filter>(
        "filter",
        [
          { value: "favorite", label: "★ Saved" },
          { value: "hard", label: "⚑ Hard" },
          { value: "all", label: "History" },
        ],
        filter,
        (v) => ((filter = v), void refresh()),
      ),
      segmented<TargetLang | "any">(
        "lib-lang",
        [
          { value: "any", label: "All" },
          { value: "fr", label: "Français" },
          { value: "es", label: "Español" },
        ],
        lang,
        (v) => ((lang = v), void refresh()),
      ),
    ),
    actions,
    empty,
    deck.el,
  );

  return { deck, refresh };
}
