import { isUsable, translatorStatus } from "./capabilities";

export type Progress = (fraction: number) => void;

const translators = new Map<string, Promise<TranslatorInstance>>();

/**
 * Create (and download if needed) a translator for one direct pair. Chrome requires a user gesture to start a
 * download, so call this synchronously inside a click handler, before any `await`.
 */
export function create(src: string, tgt: string, onProgress?: Progress): Promise<TranslatorInstance> {
  const key = `${src}>${tgt}`;
  let t = translators.get(key);
  if (!t) {
    t = Translator!.create({
      sourceLanguage: src,
      targetLanguage: tgt,
      monitor: (m) => m.addEventListener("downloadprogress", (e) => onProgress?.(e.loaded)),
    });
    t.catch(() => translators.delete(key));
    translators.set(key, t);
  }
  return t;
}

/** Translation chain for a language pair: direct when Chrome supports it, otherwise pivot through English. */
export async function route(src: string, tgt: string): Promise<[string, string][]> {
  if (src === tgt) return [];
  if (isUsable(await translatorStatus(src, tgt))) return [[src, tgt]];
  if (src !== "en" && tgt !== "en") {
    const [a, b] = await Promise.all([translatorStatus(src, "en"), translatorStatus("en", tgt)]);
    if (isUsable(a) && isUsable(b)) return [[src, "en"], ["en", tgt]];
  }
  throw new Error(`Chrome can't translate ${src} → ${tgt} on this device.`);
}

export async function translate(text: string, src: string, tgt: string): Promise<string> {
  let out = text;
  for (const [a, b] of await route(src, tgt)) out = await (await create(a, b)).translate(out);
  return out;
}
