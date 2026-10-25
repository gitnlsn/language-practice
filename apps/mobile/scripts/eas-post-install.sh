#!/usr/bin/env bash
# EAS Build hook (eas-build-post-install): runs after `npm install`, before Gradle.
set -euo pipefail
cd "$(dirname "$0")/.."

# Models and eSpeak source; a no-op when .easignore already brought them along.
./scripts/fetch-native-deps.sh

# react-native-audio-api downloads its prebuilt codecs (opus, vorbis, ffmpeg) from a Gradle task during the build,
# which left them missing at link time in a fresh EAS checkout. Fetch them up front; the script skips what exists.
AUDIO_API=$(dirname "$(node -p "require.resolve('react-native-audio-api/package.json')")")
(cd "$AUDIO_API/android" && bash ../scripts/download-prebuilt-binaries.sh android)
