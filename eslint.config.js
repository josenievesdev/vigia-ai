// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions es código Deno (Edge Functions): no es parte de la app.
    ignores: ["dist/*", "supabase/functions/**"],
  },
  {
    // React Three Fiber usa props de three.js (position, args, intensity…) que esta regla no conoce.
    files: ["src/features/twin/scene/**/*.tsx", "src/features/twin/TwinViewport.tsx"],
    rules: { "react/no-unknown-property": "off" },
  },
]);
