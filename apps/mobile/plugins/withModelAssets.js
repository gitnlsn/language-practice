// Native build settings for the bundled models (android/ is generated, so they live here).
const { withAppBuildGradle, withGradleProperties } = require("expo/config-plugins");

module.exports = function withModelAssets(config) {
  // Weights are already compressed; storing them as-is keeps builds fast and costs almost nothing.
  config = withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes("noCompress")) {
      c.modResults.contents = c.modResults.contents.replace(
        /android\s*\{/,
        `android {\n    androidResources {\n        noCompress += ["onnx", "gguf", "bin"]\n    }`,
      );
    }
    return c;
  });
  // Every phone this targets (and the arm64 emulator) is arm64; skip the other ABIs.
  return withGradleProperties(config, (c) => {
    const p = c.modResults.find((x) => x.type === "property" && x.key === "reactNativeArchitectures");
    if (p) p.value = "arm64-v8a";
    else c.modResults.push({ type: "property", key: "reactNativeArchitectures", value: "arm64-v8a" });
    return c;
  });
};
