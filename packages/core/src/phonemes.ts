// French/Spanish grapheme→phoneme conversion for Kokoro.
// Mirrors the post-processing Kokoro's Python pipeline (misaki EspeakG2P) applies to eSpeak NG output.
// The eSpeak call itself is platform-specific (wasm on the web, native on Android), so it is injected.

/** Runs eSpeak NG on `text` with `voice`, returning IPA with `^` as the tie character (`--ipa --tie=^`). */
export type Espeak = (text: string, voice: string) => Promise<string>;

export const ESPEAK_VOICE: Record<string, string> = { fr: "fr-fr", es: "es" };

// Same tie-bar replacements as misaki's EspeakG2P.
const E2M: [string, string][] = [
  ["a^ɪ", "I"], ["a^ʊ", "W"], ["d^z", "ʣ"], ["d^ʒ", "ʤ"], ["e^ɪ", "A"],
  ["o^ʊ", "O"], ["ə^ʊ", "Q"], ["s^s", "S"], ["t^s", "ʦ"], ["t^ʃ", "ʧ"], ["ɔ^ɪ", "Y"],
];

// Punctuation Kokoro understands; kept as-is between phonemized chunks (same set as kokoro-js).
const PUNCT = /(\s*[;:,.!?¡¿—…"«»“”(){}[\]]+\s*)+/g;

function clean(ps: string): string {
  ps = ps.replace(/\([a-z-]+\)/g, ""); // language-switch flags like (en)…(fr)
  for (const [a, b] of E2M) ps = ps.replaceAll(a, b);
  return ps.replace(/[\^-]/g, "").replace(/\s+/g, " ").trim();
}

export async function phonemize(text: string, lang: string, espeak: Espeak): Promise<string> {
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
  for (const p of parts) out.push(p.punct ? p.text : clean(await espeak(p.text, voice)));
  return out.join("").trim();
}
