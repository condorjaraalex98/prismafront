const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withOptionalPortraitFeature(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const usesFeatures = manifest["uses-feature"] || [];

    const existing = usesFeatures.find(
      (f) => f.$ && f.$["android:name"] === "android.hardware.screen.portrait"
    );

    if (existing) {
      existing.$["android:required"] = "false";
    } else {
      usesFeatures.push({
        $: {
          "android:name": "android.hardware.screen.portrait",
          "android:required": "false",
        },
      });
    }

    manifest["uses-feature"] = usesFeatures;
    return mod;
  });
};