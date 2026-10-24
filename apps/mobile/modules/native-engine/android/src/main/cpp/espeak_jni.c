// JNI bridge to eSpeak NG's grapheme→phoneme conversion (no audio synthesis; Kokoro does that).
#include <jni.h>
#include <stdlib.h>
#include <string.h>
#include <espeak-ng/speak_lib.h>

JNIEXPORT jboolean JNICALL
Java_expo_modules_nativeengine_Espeak_nativeInit(JNIEnv *env, jclass cls, jstring dataParent) {
  const char *path = (*env)->GetStringUTFChars(env, dataParent, NULL);
  int rate = espeak_Initialize(AUDIO_OUTPUT_SYNCHRONOUS, 0, path, espeakINITIALIZE_DONT_EXIT);
  (*env)->ReleaseStringUTFChars(env, dataParent, path);
  return rate > 0;
}

// Same output as `espeak-ng -q --ipa --tie=^ -v <voice>`: IPA, with '^' tying multi-letter phonemes.
JNIEXPORT jstring JNICALL
Java_expo_modules_nativeengine_Espeak_nativePhonemes(JNIEnv *env, jclass cls, jstring jtext, jstring jvoice) {
  const char *voice = (*env)->GetStringUTFChars(env, jvoice, NULL);
  espeak_ERROR err = espeak_SetVoiceByName(voice);
  if (err != EE_OK) {
    // Like the espeak-ng CLI's -v: fall back to treating the name as a language ("fr-fr" → lang/roa/fr).
    espeak_VOICE select;
    memset(&select, 0, sizeof(select));
    select.languages = voice;
    err = espeak_SetVoiceByProperties(&select);
  }
  (*env)->ReleaseStringUTFChars(env, jvoice, voice);
  if (err != EE_OK) return NULL;

  const char *text = (*env)->GetStringUTFChars(env, jtext, NULL);
  const void *ptr = text;
  const int mode = espeakPHONEMES_IPA | espeakPHONEMES_TIE | ('^' << 8);

  size_t cap = 256, len = 0;
  char *out = malloc(cap);
  out[0] = '\0';
  // One clause per call; join them with spaces like the CLI's per-clause lines.
  while (ptr != NULL) {
    const char *ps = espeak_TextToPhonemes(&ptr, espeakCHARS_UTF8, mode);
    if (ps == NULL) break;
    size_t n = strlen(ps);
    if (len + n + 2 > cap) {
      while (len + n + 2 > cap) cap *= 2;
      out = realloc(out, cap);
    }
    if (len) out[len++] = ' ';
    memcpy(out + len, ps, n);
    len += n;
    out[len] = '\0';
  }
  (*env)->ReleaseStringUTFChars(env, jtext, text);
  jstring result = (*env)->NewStringUTF(env, out);
  free(out);
  return result;
}
