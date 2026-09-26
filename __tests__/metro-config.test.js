/**
 * @jest-environment node
 *
 * Regresión: en React Native (Hermes) no existe `process.emitWarning`, que el
 * build CommonJS de three.js ejecuta al cargarse. Metro debe resolver `three`
 * al build ESM (ver metro.config.js).
 */
const fs = require('fs');
const path = require('path');

const config = require('../metro.config');

describe('metro.config: three.js en nativo', () => {
  it('resuelve `three` al build ESM', () => {
    const result = config.resolver.resolveRequest({ resolveRequest: jest.fn() }, 'three', 'ios');
    expect(result.type).toBe('sourceFile');
    expect(path.basename(result.filePath)).toBe('three.module.js');
    expect(path.basename(path.dirname(result.filePath))).toBe('build');
    expect(fs.existsSync(result.filePath)).toBe(true);
  });

  it('el build ESM no usa APIs exclusivas de Node al cargarse', () => {
    const { filePath } = config.resolver.resolveRequest({ resolveRequest: jest.fn() }, 'three', 'android');
    expect(fs.readFileSync(filePath, 'utf8')).not.toContain('process.emitWarning');
  });
});
