import { requireNativeModule } from "expo";

interface NativeEngine {
  /** Unpacks the bundled models into app storage (no-op after the first run) and returns that directory. */
  prepareModels(): Promise<string>;
  /** eSpeak NG IPA output with `^` ties, like `espeak-ng -q --ipa --tie=^ -v <voice>`. */
  phonemes(text: string, voice: string): Promise<string>;
}

export default requireNativeModule<NativeEngine>("NativeEngine");
