// eSpeak NG for the web: kokoro-js only ships an English-only eSpeak build, so we use the full wasm build.
// The French/Spanish phoneme cleanup shared with the Android app lives in @viva-voz/core.
import ESpeakNG from "espeak-ng";
import wasmUrl from "espeak-ng/dist/espeak-ng.wasm?url";
import { phonemize as corePhonemize } from "@viva-voz/core";

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

export const phonemize = (text: string, lang: string) => corePhonemize(text, lang, runEspeak);
