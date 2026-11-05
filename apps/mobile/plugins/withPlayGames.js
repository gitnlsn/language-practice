// Play Games Services: puts the Play Games project ID in the manifest (android/ is generated, so it lives here).
// Without an appId nothing is added and the app runs with Play Games turned off.
const { AndroidConfig, withAndroidManifest, withStringsXml } = require("expo/config-plugins");

const META = "com.google.android.gms.games.APP_ID";
const STRING = "game_services_project_id";

module.exports = function withPlayGames(config, { appId } = {}) {
  const id = String(appId ?? "").trim();
  if (!id) return config;
  if (!/^\d+$/.test(id)) throw new Error(`withPlayGames: appId should be the numeric Play Games project ID, got "${id}"`);

  config = withStringsXml(config, (c) => {
    c.modResults = AndroidConfig.Strings.setStringItem(
      [AndroidConfig.Resources.buildResourceItem({ name: STRING, value: id, translatable: false })],
      c.modResults,
    );
    return c;
  });
  return withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, META, `@string/${STRING}`);
    return c;
  });
};
