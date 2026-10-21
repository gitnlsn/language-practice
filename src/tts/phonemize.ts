// French/Spanish grapheme→phoneme conversion for Kokoro.
// kokoro-js only ships an English-only eSpeak build, so we use the full eSpeak NG wasm build
// and mirror the post-processing Kokoro's Python pipeline (misaki EspeakG2P) applies.
import ESpeakNG from "espeak-ng";
import wasmUrl from "espeak-ng/dist/espeak-ng.wasm?url";

const ESPEAK_VOICE: Record<string, string> = { fr: "fr-fr", es: "es" };

// Same tie-bar replacements as misaki's EspeakG2P.
const E2M: [string, string][] = [
  ["a^ɪ", "I"], ["a^ʊ", "W"], ["d^z", "ʣ"], ["d^ʒ", "ʤ"], ["e^ɪ", "A"],
  ["o^ʊ", "O"], ["ə^ʊ", "Q"], ["s^s", "S"], ["t^s", "ʦ"], ["t^ʃ", "ʧ"], ["ɔ^ɪ", "Y"],
];

// Punctuation Kokoro understands; kept as-is between phonemized chunks (same set as kokoro-js).
const PUNCT = /(\s*[;:,.!?¡¿—…"«»“”(){}[\]]+\s*)+/g;

let compiled: Promise<WebAssembly.Module> | null = null;

async function runEspeak(text: string, voice: string): Promise<string> {
  compiled ??= WebAssembly.compileStreaming(fetch(wasmUrl));
  const wasm = await compiled;
  const mod = await ESpeakNG({
    arguments: ["--phonout", "out", "-q", "-b", "1", "--ipa", "--tie=^", "-v", voice, "-f", "in.txt"],
    preRun: [(m: any) => m.FS.writeFile("in.txt", text)],
    instantiateWasm(imports: WebAssembly.Imports, done: (i: WebAssembly.Instance, m: WebAssembly.Module) => void) {
      WebAssembly.instantiate(wasm, imports).then((inst) => done(inst, wasm));
      return {};
    },
  });
  return mod.FS.readFile("out", { encoding: "utf8" });
}

function clean(ps: string): string {
  ps = ps.replace(/\([a-z-]+\)/g, ""); // language-switch flags like (en)…(fr)
  for (const [a, b] of E2M) ps = ps.replaceAll(a, b);
  return ps.replace(/[\^-]/g, "").replace(/\s+/g, " ").trim();
}

export async function phonemize(text: string, lang: string): Promise<string> {
  const voice = ESPEAK_VOICE[lang];
  if (!voice) throw new Error(`No phonemizer for ${lang}`);
  text = text.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

  const parts: { punct: boolean; text: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(PUNCT)) {
    if (m.index > last) parts.push({ punct: false, text: text.slice(last, m.index) });
    parts.push({ punct: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ punct: false, text: text.slice(last) });

  const out: string[] = [];
  for (const p of parts) out.push(p.punct ? p.text : clean(await runEspeak(p.text, voice)));
  return out.join("").trim();
}
