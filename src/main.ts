import "./style.css";
import { loadSettings, saveSettings } from "./settings";
import { practiceView } from "./ui/practice";
import { libraryView } from "./ui/library";
import { needsSetup, setupView } from "./ui/setup";
import { speaker } from "./tts/speak";
import type { Deck } from "./ui/deck";

type View = "practice" | "library" | "setup";

const settings = loadSettings();
const save = () => saveSettings(settings);
const $ = (id: string) => document.getElementById(id)!;

let active: View = "practice";
const decks: Partial<Record<View, Deck>> = {};

function show(view: View) {
  decks[active]?.stopAll();
  active = view;
  for (const v of ["practice", "library", "setup"] as View[]) {
    $(`view-${v}`).hidden = v !== view;
    document.querySelector(`[data-view="${v}"]`)!.setAttribute("aria-selected", String(v === view));
  }
  if (view === "library") void library.refresh();
  if (view === "setup") void setup.refresh();
  history.replaceState(null, "", `#${view}`);
}

async function updateSetupDot() {
  $("setup-dot").hidden = !(await needsSetup(settings));
}

const practice = practiceView($("view-practice"), settings, save, () => show("setup"));
const library = libraryView($("view-library"), settings, (items) => {
  practice.load(items);
  show("practice");
});
const setup = setupView($("view-setup"), settings, save, () => void updateSetupDot());
decks.practice = practice.deck;
decks.library = library.deck;

document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) =>
  b.addEventListener("click", () => show(b.dataset.view as View)),
);

window.addEventListener("hashchange", () => {
  const v = location.hash.slice(1) as View;
  if (v !== active && ["practice", "library", "setup"].includes(v)) show(v);
});

document.addEventListener("keydown", (e) => {
  if (decks[active]?.keydown(e)) e.preventDefault();
});

// Kokoro's model is cached after the first download, so warming it up in the background is cheap.
if (settings.engine === "kokoro") speaker.loadKokoro();

const initial = location.hash.slice(1) as View;
const linked = ["practice", "library", "setup"].includes(initial);
show(linked ? initial : "practice");
void needsSetup(settings).then((needed) => {
  $("setup-dot").hidden = !needed;
  if (needed && !linked) show("setup");
});
