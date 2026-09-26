// Jest para las pruebas en vivo contra Supabase (`npm run test:live`).
// Reutiliza la transformación de jest-expo, pero no su setup: ese reemplaza `fetch` por uno que
// en las pruebas no sale a la red. Solo corre archivos *.live.test.ts (`npm test` los ignora).
const preset = require('jest-expo/jest-preset');

module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.live.test.ts'],
  transform: preset.transform,
  transformIgnorePatterns: preset.transformIgnorePatterns,
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  globalSetup: '<rootDir>/jest.global-setup.js',
};
