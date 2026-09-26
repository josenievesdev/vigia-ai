/** Códigos de tiempo WMO (los que usa Open-Meteo) en español. */
const DESCRIPTIONS: Record<number, string> = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna',
  55: 'Llovizna intensa',
  56: 'Llovizna helada',
  57: 'Llovizna helada',
  61: 'Lluvia ligera',
  63: 'Lluvia',
  65: 'Lluvia fuerte',
  66: 'Lluvia helada',
  67: 'Lluvia helada',
  71: 'Nevada ligera',
  73: 'Nevada',
  75: 'Nevada fuerte',
  77: 'Granos de nieve',
  80: 'Chubascos ligeros',
  81: 'Chubascos',
  82: 'Chubascos fuertes',
  85: 'Chubascos de nieve',
  86: 'Chubascos de nieve',
  95: 'Tormenta',
  96: 'Tormenta con granizo',
  99: 'Tormenta con granizo',
};

export function describeWeather(code: number): string {
  return DESCRIPTIONS[code] ?? 'Condición desconocida';
}

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'heavyRain' | 'snow' | 'storm';

export function weatherKind(code: number): WeatherKind {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code === 65 || code === 82) return 'heavyRain';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 81)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

/** true si llueve (o llovizna) según el código o la precipitación medida. */
export function isRaining(code: number, precipitationMm: number): boolean {
  const kind = weatherKind(code);
  return precipitationMm > 0.05 || kind === 'drizzle' || kind === 'rain' || kind === 'heavyRain' || kind === 'storm';
}
