cmake_minimum_required(VERSION 3.18)
# eSpeak NG's library only; its dictionaries are compiled on the host (scripts/fetch-native-deps.sh).
project(nativeengine VERSION 1.52.0 LANGUAGES C)

set(ESPEAK ${CMAKE_CURRENT_SOURCE_DIR}/../../../../vendor/espeak-ng)

set(USE_MBROLA OFF)
set(USE_LIBSONIC OFF)
set(USE_LIBPCAUDIO OFF)
set(USE_ASYNC OFF)
set(USE_SPEECHPLAYER OFF)
set(USE_KLATT OFF)
set(HAVE_MKSTEMP ON)

add_library(espeak-include INTERFACE)
target_include_directories(espeak-include INTERFACE ${ESPEAK}/src/include ${ESPEAK}/src/include/compat)
add_subdirectory(${ESPEAK}/src/ucd-tools ucd-tools)
add_subdirectory(${ESPEAK}/src/libespeak-ng libespeak-ng)

add_library(nativeengine SHARED espeak_jni.c)
target_link_libraries(nativeengine PRIVATE espeak-ng log)
