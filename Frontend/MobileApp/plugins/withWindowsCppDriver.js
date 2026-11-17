const { withProjectBuildGradle } = require('expo/config-plugins');

const driverConfiguration = `
if (System.getProperty("os.name").toLowerCase().contains("windows")) {
  subprojects { nativeProject ->
    ["com.android.application", "com.android.library"].each { pluginId ->
      nativeProject.plugins.withId(pluginId) {
        nativeProject.extensions.getByName("androidComponents").finalizeDsl { androidDsl ->
          def cmakeOptions = androidDsl.defaultConfig.externalNativeBuild.cmake
          def windowsCppDriverFlag = "--driver-mode=g++"
          def previousFlags = cmakeOptions.arguments.find { it.startsWith("-DCMAKE_CXX_FLAGS=") }
          if (previousFlags == null) {
            cmakeOptions.arguments.add("-DCMAKE_CXX_FLAGS=" + windowsCppDriverFlag)
          } else if (!previousFlags.contains(windowsCppDriverFlag)) {
            cmakeOptions.arguments.remove(previousFlags)
            cmakeOptions.arguments.add(previousFlags + " " + windowsCppDriverFlag)
          }
        }
      }
    }
  }
}
`;

module.exports = function withWindowsCppDriver(config) {
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      throw new Error('The Windows C++ driver plugin requires a Groovy root build.gradle.');
    }
    modConfig.modResults.contents = modConfig.modResults.contents.replace(
      driverConfiguration + '\n',
      ''
    );
    if (!modConfig.modResults.contents.includes('def windowsCppDriverFlag =')) {
      const rootPlugin = 'apply plugin: "com.facebook.react.rootproject"';
      if (!modConfig.modResults.contents.includes(rootPlugin)) {
        throw new Error('React Native root plugin not found in build.gradle.');
      }
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        rootPlugin,
        driverConfiguration + '\n' + rootPlugin
      );
    }
    return modConfig;
  });
};
