import { h } from "./dom";
import { LANG_NAMES } from "@viva-voz/core";
import type { Sentence } from "../store";

/** Fill the print-only sheet and open the print dialog: each sentence, its translation, and lines to copy by hand. */
export function printSheet(items: Sentence[], heading: string) {
  const sheet = document.getElementById("print-sheet")!;
  const date = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  sheet.replaceChildren(
    h("header", {}, h("h1", {}, heading), h("p", {}, date)),
    ...items.map((s, i) =>
      h(
        "section",
        { class: "print-item" },
        h("p", { class: "print-target", lang: s.target }, h("b", {}, `${i + 1}. `), s.text),
        h("p", { class: "print-translation" }, `${LANG_NAMES[s.native]}: ${s.translation}`),
        h("div", { class: "print-lines" }, h("span"), h("span")),
      ),
    ),
  );
  window.print();
}
