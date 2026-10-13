const { withInfoPlist, withXcodeProject, createRunOncePlugin } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withLiveActivitiesInfoPlist = (config) => {
  return withInfoPlist(config, (config) => {
    config.modResults.NSSupportsLiveActivities = true;
    config.modResults.NSSupportsLiveActivitiesFrequentUpdates = true;
    return config;
  });
};

const withLiveActivitiesWidgetExtension = (config) => {
  return withXcodeProject(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const iosDir = config.modRequest.platformProjectRoot;
    const targetName = "ParkZoneWidgets";
    const targetSourceDir = path.join(projectRoot, "targets", "widgets");
    const targetDestDir = path.join(iosDir, targetName);

    // Ensure directory exists
    if (!fs.existsSync(targetDestDir)) {
      fs.mkdirSync(targetDestDir, { recursive: true });
    }

    // Copy Swift files
    if (fs.existsSync(targetSourceDir)) {
      const files = fs.readdirSync(targetSourceDir);
      for (const file of files) {
        fs.copyFileSync(
          path.join(targetSourceDir, file),
          path.join(targetDestDir, file)
        );
      }
    }

    // Create Info.plist for widget extension
    const widgetInfoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key>
    <string>ParkZone Widgets</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.widgetkit-extension</string>
    </dict>
</dict>
</plist>`;
    fs.writeFileSync(path.join(targetDestDir, "Info.plist"), widgetInfoPlist, "utf8");

    return config;
  });
};

const withLiveActivities = (config) => {
  config = withLiveActivitiesInfoPlist(config);
  config = withLiveActivitiesWidgetExtension(config);
  return config;
};

module.exports = createRunOncePlugin(withLiveActivities, "withLiveActivities", "1.0.0");
