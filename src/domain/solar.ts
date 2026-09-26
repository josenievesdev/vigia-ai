import type { Timestamp } from './types';

/**
 * Posición del sol y horas de salida/puesta, calculadas localmente (sin red)
 * con las ecuaciones de la NOAA ("General Solar Position Calculations").
 * Precisión de ~1–2 minutos: suficiente para iluminación, conducta animal y
 * programas de luz.
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;

export interface SunPosition {
  /** Grados sobre el horizonte (negativo = bajo el horizonte). */
  elevation: number;
  /** Grados desde el norte, en sentido horario (90 = este, 180 = sur, 270 = oeste). */
  azimuth: number;
}

export interface SunTimes {
  /** Alba civil (sol a −6°). */
  dawn: Timestamp;
  sunrise: Timestamp;
  sunset: Timestamp;
  /** Anochecer civil (sol a −6°). */
  dusk: Timestamp;
}

/** Ángulos cenitales de referencia. */
export const ZENITH = {
  /** Salida/puesta oficial (incluye refracción y radio solar). */
  official: 90.833,
  civil: 96,
} as const;

function solarParams(time: Timestamp) {
  const d = new Date(time);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((time - yearStart) / DAY_MS) + 1;
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hours - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const declination =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  return { eqTime, declination, hours };
}

export function sunPosition(time: Timestamp, latitude: number, longitude: number): SunPosition {
  const { eqTime, declination, hours } = solarParams(time);
  const trueSolarMinutes = hours * 60 + eqTime + 4 * longitude;
  const hourAngle = (trueSolarMinutes / 4 - 180) * RAD;
  const lat = latitude * RAD;
  const cosZenith =
    Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith)));
  // Azimut medido desde el sur (positivo hacia el oeste) → se convierte a "desde el norte".
  const fromSouth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat),
  );
  return {
    elevation: 90 - zenith / RAD,
    azimuth: (fromSouth / RAD + 180 + 360) % 360,
  };
}

/** Día local aproximado (por longitud) que contiene `time`, como medianoche UTC de esa fecha. */
function localDayStartUtc(time: Timestamp, longitude: number): Timestamp {
  const shifted = new Date(time + longitude * 4 * 60_000);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

/**
 * Momentos en que el sol cruza `zenith` (subiendo y bajando) el día local de `time`.
 * Devuelve null en día o noche polar (no ocurre en el trópico).
 */
export function sunCrossings(
  time: Timestamp,
  latitude: number,
  longitude: number,
  zenith: number,
): { rise: Timestamp; set: Timestamp } | null {
  const dayStart = localDayStartUtc(time, longitude);
  const noonUtc = dayStart + (720 - 4 * longitude) * 60_000;
  const { eqTime, declination } = solarParams(noonUtc);
  const lat = latitude * RAD;
  const cosHa = Math.cos(zenith * RAD) / (Math.cos(lat) * Math.cos(declination)) - Math.tan(lat) * Math.tan(declination);
  if (cosHa > 1 || cosHa < -1) return null;
  const ha = Math.acos(cosHa) / RAD;
  return {
    rise: dayStart + (720 - 4 * (longitude + ha) - eqTime) * 60_000,
    set: dayStart + (720 - 4 * (longitude - ha) - eqTime) * 60_000,
  };
}

export function sunTimes(time: Timestamp, latitude: number, longitude: number): SunTimes | null {
  const official = sunCrossings(time, latitude, longitude, ZENITH.official);
  const civil = sunCrossings(time, latitude, longitude, ZENITH.civil);
  if (!official || !civil) return null;
  return { dawn: civil.rise, sunrise: official.rise, sunset: official.set, dusk: civil.set };
}
