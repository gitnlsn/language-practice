// The weights bundled in the APK, unpacked once into app storage (ONNX Runtime and llama.cpp need file paths).
import { File } from "expo-file-system";
import NativeEngine from "../../modules/native-engine";

let dir: Promise<string> | null = null;

export function modelsDir(): Promise<string> {
  dir ??= NativeEngine.prepareModels();
  dir.catch(() => (dir = null));
  return dir;
}

export const readFile = (path: string) => new File(`file://${path}`);
