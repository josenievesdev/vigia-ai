import { layingHensProfile } from '@/domain/profiles/layingHens';
import { parseGeocoding } from '@/services/weather/geocoding';

import { loadConfig, saveConfig } from '../configStorage';
import {
  defaultConfig,
  type FarmConfig,
  flockAgeWeeks,
  hatchDateForAge,
  parseStoredConfig,
  profileWithThresholds,
  setupFromConfig,
  validateConfig,
} from '../farmConfig';

// Las fábricas de jest.mock no admiten import: se usa require.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const NOW = new Date(2026, 8, 26, 12).getTime();
const base = () => defaultConfig(layingHensProfile, NOW);

describe('configuración de la granja', () => {
  it('la configuración de fábrica es válida y refleja el perfil', () => {
    const c = base();
    expect(validateConfig(c)).toEqual([]);
    expect(c.thresholds.ventilationOn).toBe(layingHensProfile.control.ventilation.on);
    expect(c.location.name).toBe('Valledupar');
    expect(c.lighting.type).toBe('natural');
  });

  it('detecta configuraciones incoherentes con mensajes claros', () => {
    const c = base();
    const bad: FarmConfig = {
      ...c,
      farmName: ' ',
      thresholds: { ...c.thresholds, ventilationOff: 30, ventilationOn: 27, tempWarning: 33, tempCritical: 32 },
      lighting: { type: 'extended', startHour: 20, endHour: 6 },
    };
    const errors = validateConfig(bad);
    expect(errors).toEqual(
      expect.arrayContaining([
        'La granja necesita un nombre.',
        'La ventilación debe apagarse por debajo de la temperatura de encendido.',
        'La temperatura de advertencia debe ser menor que la crítica.',
        'El programa de luz debe empezar antes de terminar (entre 0 y 24 h).',
      ]),
    );
  });

  it('aplica umbrales propios sobre el perfil de la especie', () => {
    const c = base();
    const p = profileWithThresholds(layingHensProfile, { ...c.thresholds, ventilationOn: 26, tempCritical: 34 });
    expect(p.control.ventilation.on).toBe(26);
    expect(p.alerts.highTemperature.critical).toBe(34);
    expect(p.production).toBe(layingHensProfile.production);
  });

  it('arma la granja con nombre, ubicación, galpón y programa de luz', () => {
    const c = { ...base(), farmName: 'La Esperanza', population: 3000, lighting: { type: 'extended' as const, startHour: 4, endHour: 20 } };
    const setup = setupFromConfig(c);
    expect(setup.farm.name).toBe('La Esperanza');
    expect(setup.farm.zones[0].population).toBe(3000);
    expect(setup.farm.zones[0].lighting).toEqual({ type: 'extended', startHour: 4, endHour: 20 });
    expect(setup.sensors.length).toBeGreaterThan(0);
  });

  it('la edad del lote avanza con el tiempo', () => {
    const c = { ...base(), hatchDate: hatchDateForAge(40, NOW) };
    expect(flockAgeWeeks(c, NOW)).toBeCloseTo(40);
    expect(flockAgeWeeks(c, NOW + 14 * 86_400_000)).toBeCloseTo(42);
  });

  it('ignora datos guardados dañados o inválidos', () => {
    expect(parseStoredConfig(null)).toBeNull();
    expect(parseStoredConfig('{no es json')).toBeNull();
    expect(parseStoredConfig(JSON.stringify({ version: 2 }))).toBeNull();
    const invalid = { ...base(), thresholds: { ...base().thresholds, pumpOn: 99, pumpOff: 50 } };
    expect(parseStoredConfig(JSON.stringify(invalid))).toBeNull();
    expect(parseStoredConfig(JSON.stringify(base()))).toEqual(base());
  });

  it('guarda y recupera la configuración en el teléfono', async () => {
    expect((await loadConfig(layingHensProfile)).farmName).toBe('Granja El Paraíso');
    const custom = { ...base(), farmName: 'Villa Rosa', population: 800 };
    await saveConfig(custom);
    const loaded = await loadConfig(layingHensProfile);
    expect(loaded.farmName).toBe('Villa Rosa');
    expect(loaded.population).toBe(800);
  });

  it('interpreta resultados de búsqueda de ciudades', () => {
    const places = parseGeocoding({
      results: [
        { name: 'Montería', admin1: 'Córdoba', admin2: 'Municipio de Montería', country: 'Colombia', latitude: 8.74, longitude: -75.88, elevation: 18, timezone: 'America/Bogota' },
        { name: 'Sin coordenadas', timezone: 'America/Bogota' },
        { name: 'Montería', admin1: 'Magdalena', admin2: 'Zona Bananera', country: 'Colombia', latitude: 10.75, longitude: -74.2, elevation: 16, timezone: 'America/Bogota' },
        // Duplicado de GeoNames (mismo caserío, ~2 km): no se puede distinguir, se descarta.
        { name: 'Montería', admin1: 'Magdalena', admin2: 'Zona Bananera', country: 'Colombia', latitude: 10.73, longitude: -74.19, elevation: 19, timezone: 'America/Bogota' },
      ],
    });
    expect(places).toEqual([
      {
        name: 'Montería',
        region: 'Córdoba',
        district: 'Municipio de Montería',
        country: 'Colombia',
        latitude: 8.74,
        longitude: -75.88,
        elevation: 18,
        timezone: 'America/Bogota',
      },
      {
        name: 'Montería',
        region: 'Magdalena',
        district: 'Zona Bananera',
        country: 'Colombia',
        latitude: 10.75,
        longitude: -74.2,
        elevation: 16,
        timezone: 'America/Bogota',
      },
    ]);
    expect(parseGeocoding({})).toEqual([]);
  });
});
