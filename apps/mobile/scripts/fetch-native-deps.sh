#!/usr/bin/env bash
# Development-time only: fetches the model weights and eSpeak NG source that get bundled into the APK.
# The app itself never touches the network.
set -euo pipefail
cd "$(dirname "$0")/.."

KOKORO=https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main
ESPEAK_TAG=1.52.0 # the web build bundles 1.52-dev; keep phonemes in step
MODELS=assets/models
VENDOR=modules/native-engine/vendor
CMAKE=${CMAKE:-$(ls -d "${ANDROID_HOME:-$HOME/Library/Android/sdk}"/cmake/*/bin/cmake | tail -1)}

fetch() { [ -s "$2" ] || { echo "↓ $2"; mkdir -p "$(dirname "$2")"; curl -fL --retry 3 -o "$2.part" "$1" && mv "$2.part" "$2"; }; }

fetch "$KOKORO/onnx/model_quantized.onnx" "$MODELS/kokoro/model_quantized.onnx"
fetch "$KOKORO/tokenizer.json" "$MODELS/kokoro/tokenizer.json"
for v in ff_siwis ef_dora em_alex; do fetch "$KOKORO/voices/$v.bin" "$MODELS/kokoro/voices/$v.bin"; done

# Sentence writer: a small LLM writes English (where small models are reliable)…
fetch "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_0.gguf" "$MODELS/llm/qwen2.5-1.5b-instruct-q4_0.gguf"
# …and Opus-MT (CC-BY 4.0, Helsinki-NLP) translates it: en→fr, en→es, and en→pt via the ROMANCE model.
for pair in fr:opus-mt-en-fr es:opus-mt-en-es pt:opus-mt-en-ROMANCE; do
  dir=$MODELS/mt/${pair%%:*}; repo=https://huggingface.co/Xenova/${pair#*:}/resolve/main
  fetch "$repo/onnx/encoder_model_quantized.onnx" "$dir/encoder.onnx"
  fetch "$repo/onnx/decoder_model_merged_quantized.onnx" "$dir/decoder.onnx"
  fetch "$repo/tokenizer.json" "$dir/tokenizer.json"
  fetch "$repo/config.json" "$dir/config.json"
done

if [ ! -d "$VENDOR/espeak-ng" ]; then
  fetch "https://github.com/espeak-ng/espeak-ng/archive/refs/tags/$ESPEAK_TAG.tar.gz" "$VENDOR/espeak-ng.tar.gz"
  tar -xzf "$VENDOR/espeak-ng.tar.gz" -C "$VENDOR" && mv "$VENDOR/espeak-ng-$ESPEAK_TAG" "$VENDOR/espeak-ng"
  rm "$VENDOR/espeak-ng.tar.gz"
fi

# eSpeak's dictionaries are compiled by eSpeak itself, so build it once for the host, then keep only fr/es.
if [ ! -s "$MODELS/espeak-ng-data/phontab" ]; then
  SRC=$VENDOR/espeak-ng
  "$CMAKE" -S "$SRC" -B "$SRC/build-host" -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=OFF \
    -DUSE_MBROLA=OFF -DUSE_LIBSONIC=OFF -DUSE_LIBPCAUDIO=OFF -DUSE_ASYNC=OFF -DUSE_SPEECHPLAYER=OFF >/dev/null
  "$CMAKE" --build "$SRC/build-host" -j8 >/dev/null 2>&1
  DATA=$SRC/build-host/espeak-ng-data
  mkdir -p "$MODELS/espeak-ng-data/lang/roa"
  cp "$DATA"/{phontab,phonindex,phondata,intonations,fr_dict,es_dict} "$MODELS/espeak-ng-data/"
  cp "$DATA"/lang/roa/{fr,es} "$MODELS/espeak-ng-data/lang/roa/"
fi

echo "✓ native deps ready"
