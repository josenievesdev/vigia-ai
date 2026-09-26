/** Ubicación geográfica de una granja (necesaria para el sol y el clima reales). */
export interface FarmLocation {
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  /** Metros sobre el nivel del mar. */
  elevation: number;
  /** Zona horaria IANA (p. ej. "America/Bogota"). */
  timezone: string;
}

export function formatLocation(location: FarmLocation): string {
  return `${location.name}, ${location.region}`;
}
