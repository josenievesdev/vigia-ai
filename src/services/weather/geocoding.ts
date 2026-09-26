import type { FarmLocation } from '@/domain/location';

/** Búsqueda de ciudades con Open-Meteo Geocoding (sin clave de API). */

interface GeocodingResult {
  name?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  elevation?: unknown;
  timezone?: unknown;
  country?: unknown;
  admin1?: unknown;
  admin2?: unknown;
}

export function parseGeocoding(json: unknown): FarmLocation[] {
  const results = (json as { results?: GeocodingResult[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  const places = results.flatMap((r): FarmLocation[] =>
    typeof r.name === 'string' &&
    typeof r.latitude === 'number' &&
    typeof r.longitude === 'number' &&
    typeof r.timezone === 'string'
      ? [
          {
            name: r.name,
            region: typeof r.admin1 === 'string' ? r.admin1 : '',
            ...(typeof r.admin2 === 'string' && r.admin2 ? { district: r.admin2 } : {}),
            country: typeof r.country === 'string' ? r.country : '',
            latitude: r.latitude,
            longitude: r.longitude,
            elevation: typeof r.elevation === 'number' ? r.elevation : 0,
            timezone: r.timezone,
          },
        ]
      : [],
  );
  // GeoNames repite algunos caseríos; si el usuario no puede distinguirlos, basta con el primero.
  const seen = new Set<string>();
  return places.filter((p) => {
    const key = [p.name, p.district, p.region, p.country].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchPlaces(query: string, fetchImpl: typeof fetch = fetch): Promise<FarmLocation[]> {
  const name = query.trim();
  if (name.length < 2) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=8&language=es&format=json`;
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Geocoding: HTTP ${response.status}`);
    return parseGeocoding(await response.json());
  } finally {
    clearTimeout(timer);
  }
}
