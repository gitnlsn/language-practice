import { field, h, segmented, select } from "./dom";
import { hasPromptApi, hasTranslatorApi, isUsable, promptStatus, translatorStatus, type Status } from "../ai/capabilities";
import { session, strategyFor } from "../ai/generate";
import { create, route } from "../ai/translate";
import { bestSystemVoice, speaker, type KokoroState } from "../tts/speak";
import { KOKORO_VOICES, LANG_NAMES, SAMPLE, TARGETS, type Engine, type Settings, type TargetLang } from "@viva-voz/core";

const LABEL: Record<Status, string> = {
  available: "Ready",
  downloadable: "Needs download",
  downloading: "Downloading…",
  unavailable: "Not available",
  unsupported: "Not supported",
};

const badge = (s: Status | "ok" | "warn", text?: string) =>
  h("span", { class: `badge ${s === "available" || s === "ok" ? "ok" : isUsable(s as Status) || s === "warn" ? "warn" : "bad"}` }, text ?? LABEL[s as Status]);

const row = (title: string, detail: Node | string, right: Node) =>
  h("div", { class: "setup-row" }, h("div", {}, h("p", { class: "setup-title" }, title), h("p", { class: "muted" }, detail)), right);

/** Overall readiness, used for the dot on the Setup tab. */
export async function needsSetup(settings: Settings): Promise<boolean> {
  if (!hasPromptApi() || !hasTranslatorApi()) return true;
  const lang = (await strategyFor(settings.target)) === "direct" ? settings.target : "en";
  return (await promptStatus(lang)) !== "available";
}

export function setupView(root: HTMLElement, settings: Settings, save: () => void, onChange: () => void) {
  const aiSection = h("div", { class: "panel" });
  const voiceSection = h("div", { class: "panel" });
  const progress = h("p", { class: "status busy", hidden: true });

  async function renderAI() {
    if (!hasPromptApi() || !hasTranslatorApi()) {
      aiSection.replaceChildren(
        h("h2", {}, "Sentences & translations"),
        h(
          "div",
          { class: "notice" },
          h("p", {}, h("b", {}, "Chrome's built-in AI isn't available in this browser.")),
          h(
            "ul",
            {},
            h("li", {}, "Use desktop Google Chrome 138 or newer (macOS, Windows, Linux or ChromeOS)."),
            h("li", {}, "You need about 22 GB of free disk space for the one-time model download, and either a GPU with more than 4 GB of VRAM or 16 GB of RAM."),
            h("li", {}, "If it still doesn't appear, enable ", h("code", {}, "chrome://flags/#prompt-api-for-gemini-nano"), " and ", h("code", {}, "chrome://flags/#translation-api"), ", then restart Chrome."),
          ),
        ),
      );
      return;
    }

    const rows: Node[] = [];
    const translatorStatusCache = new Map<string, Status>();
    // Everything that may need downloading; collected up front so the click handler can start it synchronously.
    const modelLangs = new Set<string>();
    for (const t of TARGETS) {
      const direct = await promptStatus(t);
      const en = isUsable(direct) ? direct : await promptStatus("en");
      if (isUsable(direct)) modelLangs.add(t);
      else if (isUsable(en)) modelLangs.add("en");
      rows.push(
        row(
          `Write ${LANG_NAMES[t]} sentences`,
          isUsable(direct)
            ? "Gemini Nano writes directly in this language."
            : isUsable(en)
              ? "Gemini Nano can't write this language yet, so it writes in English and Chrome translates."
              : "Gemini Nano isn't available on this device.",
          badge(isUsable(direct) ? direct : isUsable(en) ? (en === "available" ? "ok" : en) : "unavailable", isUsable(direct) || !isUsable(en) ? undefined : en === "available" ? "Ready (via English)" : LABEL[en]),
        ),
      );
    }
    const pairs: [string, string][] = [];
    for (const t of TARGETS) {
      pairs.push([t, settings.native]);
      if ((await strategyFor(t)) === "pivot") pairs.push(["en", t]);
    }
    for (const [a, b] of pairs) {
      let status: Status = "unavailable";
      let pairLegs: [string, string][] = [];
      try {
        pairLegs = await route(a, b);
        const statuses = await Promise.all(pairLegs.map(([x, y]) => translatorStatus(x, y)));
        pairLegs.forEach(([x, y], i) => translatorStatusCache.set(`${x}>${y}`, statuses[i]));
        status = statuses.every((s) => s === "available") ? "available" : statuses.find((s) => s !== "available")!;
      } catch {
        // no route
      }
      // Chrome downloads one translator pack per click, so each pair gets its own button.
      const missing = pairLegs.find(([x, y]) => translatorStatusCache.get(`${x}>${y}`) !== "available");
      const right = h("div", { class: "row-right" }, badge(status));
      if (isUsable(status) && status !== "available" && missing) {
        const btn: HTMLButtonElement = h("button", {
          class: "secondary",
          onclick: () => {
            const [x, y] = missing;
            btn.disabled = true;
            create(x, y, (f) => (btn.textContent = `${Math.round(f * 100)}%`))
              .then(() => renderAI(), (err) => ((btn.textContent = "Retry"), (btn.disabled = false), console.warn(err)));
          },
        }, "Download");
        right.append(btn);
      }
      const via = pairLegs.length > 1 ? " (via English)" : "";
      rows.push(row(`Translate ${LANG_NAMES[a as TargetLang]} → ${LANG_NAMES[b as TargetLang]}`, `On-device Chrome translator${via}.`, right));
    }

    const downloadBtn: HTMLButtonElement = h("button", { class: "primary", onclick: () => void downloadAll() }, "Prepare model & voice");
    async function downloadAll() {
      downloadBtn.disabled = true;
      progress.hidden = false;
      progress.className = "status busy";
      progress.textContent = "Preparing…";
      const done = new Map<string, number>();
      const track = (key: string) => (f: number) => {
        done.set(key, f);
        const avg = [...done.values()].reduce((x, y) => x + y, 0) / done.size;
        progress.textContent = `Downloading ${done.size} model${done.size === 1 ? "" : "s"}… ${Math.round(avg * 100)}%`;
      };
      // Start downloads before the first await: Chrome only allows it during the click's user activation.
      const jobs = [...modelLangs].map((l) => session(l, track(`model-${l}`)));
      if (settings.engine === "kokoro") speaker.loadKokoro();
      try {
        await Promise.all(jobs);
        progress.textContent = "All set.";
      } catch (err: any) {
        progress.textContent = `Couldn't finish: ${err?.message ?? err}`;
      } finally {
        downloadBtn.disabled = false;
        await renderAI();
        progress.hidden = false;
        progress.className = "status";
        onChange();
      }
    }

    aiSection.replaceChildren(
      h("h2", {}, "Sentences & translations"),
      h("p", { class: "muted" }, "Everything runs on your computer with Chrome's built-in Gemini Nano and Translator. Nothing is sent to a server."),
      ...rows,
      h("div", { class: "row-actions" }, downloadBtn, h("button", { class: "secondary", onclick: () => void renderAI() }, "Re-check")),
      progress,
    );
  }

  const kokoroBadge = h("span");
  const kokoroDetail = h("span");
  const loadBtn: HTMLButtonElement = h("button", { class: "secondary", onclick: () => speaker.loadKokoro() }, "Load voice model");
  speaker.onKokoroState((s: KokoroState) => {
    loadBtn.hidden = s.status === "ready" || s.status === "loading";
    if (s.status === "idle") {
      kokoroBadge.replaceChildren(badge("downloadable", "Not loaded"));
      kokoroDetail.textContent = "Kokoro 82M runs in your browser. About 90–330 MB is downloaded once, then cached.";
    } else if (s.status === "loading") {
      kokoroBadge.replaceChildren(badge("downloading", `Loading ${Math.round(s.fraction * 100)}%`));
      kokoroDetail.textContent = "Downloading the voice model (cached after the first time)…";
    } else if (s.status === "ready") {
      kokoroBadge.replaceChildren(badge("available"));
      kokoroDetail.textContent = `Running on ${s.device === "webgpu" ? "your GPU (WebGPU)" : "the CPU (WebAssembly)"}.`;
    } else {
      kokoroBadge.replaceChildren(badge("unavailable", "Error"));
      kokoroDetail.textContent = `${s.message} — the system voice will be used instead.`;
    }
  });

  function renderVoices() {
    const systemVoices = TARGETS.map((t) => `${LANG_NAMES[t]}: ${bestSystemVoice(t)?.name ?? "none installed"}`).join(" · ");
    voiceSection.replaceChildren(
      h("h2", {}, "Voice"),
      field(
        "Engine",
        segmented<Engine>(
          "engine",
          [
            { value: "kokoro", label: "Natural (Kokoro)" },
            { value: "system", label: "System voice" },
          ],
          settings.engine,
          (v) => {
            settings.engine = v;
            save();
            if (v === "kokoro") speaker.loadKokoro();
          },
        ),
      ),
      row("Kokoro natural voice", kokoroDetail, h("div", { class: "row-right" }, kokoroBadge, loadBtn)),
      ...TARGETS.map((t) =>
        row(
          `${LANG_NAMES[t]} voice`,
          h(
            "span",
            { class: "voice-pick" },
            select("Voice", KOKORO_VOICES[t].map((v) => ({ value: v.id, label: v.label })), settings.voices[t], (v) => {
              settings.voices[t] = v;
              save();
            }),
          ),
          h(
            "button",
            {
              class: "secondary",
              onclick: () => void speaker.speak(SAMPLE[t], t, { engine: settings.engine, voice: settings.voices[t], speed: settings.speed }),
            },
            "▶ Test",
          ),
        ),
      ),
      row(
        "System voices (fallback)",
        systemVoices,
        h("span", { class: "muted small" }, "Tip: on macOS, install Premium voices in System Settings → Accessibility → Spoken Content."),
      ),
    );
  }

  speechSynthesis.addEventListener?.("voiceschanged", renderVoices);
  root.replaceChildren(aiSection, voiceSection);
  void renderAI();
  renderVoices();

  return { refresh: renderAI };
}
