// Minimal typings for Chrome's built-in AI APIs (Prompt API + Translator API).
// https://developer.chrome.com/docs/ai/built-in-apis

type AIAvailability = "unavailable" | "downloadable" | "downloading" | "available";

interface AIDownloadProgressEvent extends Event {
  loaded: number; // 0..1
}

interface AICreateMonitor extends EventTarget {
  addEventListener(type: "downloadprogress", listener: (e: AIDownloadProgressEvent) => void): void;
}

interface AILanguageExpectation {
  type: "text";
  languages?: string[];
}

interface LanguageModelCreateOptions {
  initialPrompts?: { role: "system" | "user" | "assistant"; content: string }[];
  expectedInputs?: AILanguageExpectation[];
  expectedOutputs?: AILanguageExpectation[];
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
  monitor?: (m: AICreateMonitor) => void;
}

interface LanguageModelSession {
  prompt(input: string, options?: { responseConstraint?: object; signal?: AbortSignal }): Promise<string>;
  clone(): Promise<LanguageModelSession>;
  destroy(): void;
}

declare var LanguageModel:
  | {
      availability(options?: Omit<LanguageModelCreateOptions, "monitor" | "initialPrompts">): Promise<AIAvailability>;
      create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
    }
  | undefined;

interface TranslatorOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

interface TranslatorInstance {
  translate(text: string): Promise<string>;
  destroy(): void;
}

declare var Translator:
  | {
      availability(options: TranslatorOptions): Promise<AIAvailability>;
      create(options: TranslatorOptions & { monitor?: (m: AICreateMonitor) => void }): Promise<TranslatorInstance>;
    }
  | undefined;
