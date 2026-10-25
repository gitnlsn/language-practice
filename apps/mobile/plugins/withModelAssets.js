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
  return withGradleProperties(config, (c) => {
    const set = (key, value) => {
      const p = c.modResults.find((x) => x.type === "property" && x.key === key);
      if (p) p.value = value;
      else c.modResults.push({ type: "property", key, value });
    };
    // Every phone this targets (and the arm64 emulator) is arm64; skip the other ABIs.
    set("reactNativeArchitectures", "arm64-v8a");
    // Memory: a from-scratch build (as EAS does) compiles every native module; with Gradle's defaults that went past
    // 20 GB on an 8 GB Mac. Build one module at a time with two workers, and cap the Gradle and Kotlin heaps.
    // 3 GB still leaves room for packaging and signing the ~1.4 GB bundle (2 GB failed intermittently).
    set("org.gradle.jvmargs", "-Xmx3072m -XX:MaxMetaspaceSize=768m");
    set("kotlin.daemon.jvmargs", "-Xmx1536m");
    set("org.gradle.parallel", "false");
    set("org.gradle.workers.max", "2");
    return c;
  });
};
