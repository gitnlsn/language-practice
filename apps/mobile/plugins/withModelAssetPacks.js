// Play Store bundles: move the bundled models out of the base module into install-time asset packs.
//
// Google Play caps the base module's download size (500 MB) but allows install-time asset packs of up to 1.5 GB
// each. Install-time packs are installed by Play together with the app and are read through the same
// AssetManager, so the app code doesn't change and the app still never downloads anything itself.
//
// Enabled with ECO_ASSET_PACKS=1 (set for the EAS "production" profile in eas.json). Without it, the models stay
// in the base APK via modules/native-engine (debug builds, sideloaded APKs).
const fs = require("fs");
const path = require("path");
const { withAppBuildGradle, withDangerousMod, withSettingsGradle } = require("expo/config-plugins");

// pack name → model folders (under assets/models) it carries. Each must stay under 1.5 GB.
const PACKS = {
  models_llm: ["llm"],
  models_mt: ["mt"],
  models_voice: ["kokoro", "espeak-ng-data"],
};

const enabled = () => process.env.ECO_ASSET_PACKS === "1";

// android/ isn't always regenerated from scratch, so a non-bundle build must undo a previous bundle build's setup.
function withoutAssetPacks(config) {
  const includes = new RegExp(`\\ninclude ':(${Object.keys(PACKS).join("|")})'`, "g");
  config = withSettingsGradle(config, (c) => {
    c.modResults.contents = c.modResults.contents.replace(includes, "");
    return c;
  });
  return withAppBuildGradle(config, (c) => {
    c.modResults.contents = c.modResults.contents.replace(/\n\s*assetPacks = \[[^\]]*\]/, "");
    return c;
  });
}

module.exports = function withModelAssetPacks(config) {
  if (!enabled()) return withoutAssetPacks(config);

  config = withDangerousMod(config, [
    "android",
    async (c) => {
      const android = c.modRequest.platformProjectRoot;
      const models = path.join(c.modRequest.projectRoot, "assets", "models");
      for (const [pack, dirs] of Object.entries(PACKS)) {
        const assets = path.join(android, pack, "src", "main", "assets");
        fs.mkdirSync(assets, { recursive: true });
        fs.writeFileSync(
          path.join(android, pack, "build.gradle"),
          `plugins {\n  id 'com.android.asset-pack'\n}\n\nassetPack {\n  packName = "${pack}"\n  dynamicDelivery {\n    deliveryType = "install-time"\n  }\n}\n`,
        );
        // Link rather than copy the ~1.4 GB of weights.
        for (const dir of dirs) {
          const link = path.join(assets, dir);
          if (!fs.existsSync(path.join(models, dir))) throw new Error(`Missing assets/models/${dir}: run scripts/fetch-native-deps.sh`);
          fs.rmSync(link, { recursive: true, force: true });
          fs.symlinkSync(path.relative(assets, path.join(models, dir)), link, "dir");
        }
      }
      return c;
    },
  ]);

  config = withSettingsGradle(config, (c) => {
    for (const pack of Object.keys(PACKS)) {
      if (!c.modResults.contents.includes(`':${pack}'`)) c.modResults.contents += `\ninclude ':${pack}'`;
    }
    return c;
  });

  return withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes("assetPacks")) {
      const list = Object.keys(PACKS).map((p) => `":${p}"`).join(", ");
      c.modResults.contents = c.modResults.contents.replace(/android\s*\{/, `android {\n    assetPacks = [${list}]`);
    }
    return c;
  });
};
