// https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * three.js ≥ 0.18x marcó su build CommonJS como obsoleto: `build/three.cjs`
 * ejecuta `process.emitWarning(...)` al cargarse, función que no existe en
 * React Native (Hermes) → "TypeError: undefined is not a function" al abrir el
 * gemelo 3D en iOS/Android. @react-three/fiber/native hace `require('three')`,
 * así que forzamos que TODA importación de `three` use el build ESM. De paso se
 * garantiza una única instancia de three.js en la app.
 */
const THREE_ESM = path.resolve(__dirname, 'node_modules/three/build/three.module.js');

const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return { type: 'sourceFile', filePath: THREE_ESM };
  }
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
