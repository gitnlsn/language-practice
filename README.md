# Viva Voz

Read-aloud practice for French and Spanish. It generates sentences at your level, translates them into Portuguese or English, and reads them with a natural voice so you can listen, repeat and copy them by hand.

Runs entirely in the browser, with no backend or API keys:

- **Sentences**: Chrome's built-in Gemini Nano (Prompt API). If the model can't write a language directly, it writes in English and Chrome translates.
- **Translations**: Chrome's built-in Translator API.
- **Voice**: [Kokoro 82M](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) via `kokoro-js` (WebGPU, falling back to WASM). French and Spanish are phonemized with the full eSpeak NG wasm build (`src/tts/phonemize.ts`), because `kokoro-js` only bundles English. If Kokoro fails, the system voice (Web Speech API) is used.

## Run

```sh
npm install
npm run dev
```

Open the printed URL in **desktop Chrome**. On first use, go to **Setup**:

1. **Prepare model & voice** downloads Gemini Nano (one-time) and the Kokoro voice (cached).
2. Click **Download** on each translator row. Chrome only allows one download per click.

## Use

- Pick language, translation language, level (A1–C1), topic and count, then **Generate**.
- **Listen → repeat** hides the translation; **Translate → say** hides the sentence. Click blurred text to reveal it.
- **Play all & repeat** plays each sentence, then leaves a pause for you to say it.
- **Print for handwriting** prints the sentences with lines to copy them.
- Keyboard: `Space` listen · `↑/↓` move · `R` reveal · `S` save.
- History, saved and "hard" sentences are stored locally in IndexedDB (**Saved** tab).
