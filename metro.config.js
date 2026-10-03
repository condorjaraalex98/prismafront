const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Para soportar jspdf u otras librerías web sin romper React Native Nativo:
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
};

module.exports = config;