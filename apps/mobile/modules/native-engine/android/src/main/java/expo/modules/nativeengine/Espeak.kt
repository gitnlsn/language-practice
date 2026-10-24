package expo.modules.nativeengine

object Espeak {
  init {
    System.loadLibrary("nativeengine")
  }

  /** [dataParent] is the directory that contains `espeak-ng-data`. */
  @JvmStatic external fun nativeInit(dataParent: String): Boolean

  @JvmStatic external fun nativePhonemes(text: String, voice: String): String?
}
