const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Exclude @react-native/debugger-frontend from production bundles
// It uses private class fields not supported by Hermes
const existingBlockList = config.resolver.blockList;
const debuggerBlockList = /node_modules\/@react-native\/debugger-frontend\/.*/;

if (existingBlockList instanceof RegExp) {
  config.resolver.blockList = new RegExp(
    existingBlockList.source + "|" + debuggerBlockList.source
  );
} else {
  config.resolver.blockList = debuggerBlockList;
}

module.exports = config;