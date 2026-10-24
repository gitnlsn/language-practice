package expo.modules.nativeengine

import android.content.Context
import android.content.res.AssetManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class NativeEngineModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var espeakReady = false

  override fun definition() = ModuleDefinition {
    Name("NativeEngine")

    // Unpacks the models bundled in the APK into app storage (once per install/update): ONNX Runtime
    // and eSpeak need real file paths. Returns that directory.
    AsyncFunction("prepareModels") {
      prepareModels().absolutePath
    }

    AsyncFunction("phonemes") { text: String, voice: String ->
      synchronized(Espeak) {
        if (!espeakReady) {
          espeakReady = Espeak.nativeInit(prepareModels().absolutePath)
          if (!espeakReady) throw IllegalStateException("eSpeak NG failed to initialise")
        }
        Espeak.nativePhonemes(text, voice) ?: throw IllegalArgumentException("Unknown eSpeak voice: $voice")
      }
    }
  }

  @Synchronized
  private fun prepareModels(): File {
    val dir = File(context.filesDir, "models")
    val stamp = File(dir, ".installed")
    val version = context.packageManager.getPackageInfo(context.packageName, 0).lastUpdateTime.toString()
    if (stamp.exists() && stamp.readText() == version) return dir
    dir.deleteRecursively()
    for (name in listOf("kokoro", "espeak-ng-data", "mt", "llm")) copyAssets(context.assets, name, File(dir, name))
    stamp.writeText(version)
    return dir
  }

  private fun copyAssets(assets: AssetManager, path: String, dest: File) {
    val children = assets.list(path).orEmpty()
    if (children.isEmpty()) {
      dest.parentFile?.mkdirs()
      assets.open(path).use { input -> dest.outputStream().use { input.copyTo(it, 1 shl 16) } }
    } else {
      for (child in children) copyAssets(assets, "$path/$child", File(dest, child))
    }
  }
}
