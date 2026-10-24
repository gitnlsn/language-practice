const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Native sources and model weights are packaged by Gradle, not bundled by Metro.
config.resolver.blockList = [/modules\/native-engine\/vendor\/.*/, /assets\/models\/.*/];

module.exports = config;
