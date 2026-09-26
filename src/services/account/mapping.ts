import type { LightingProgram } from '@/domain/lighting';
import type { FarmLocation } from '@/domain/location';
import type { SpeciesProfile } from '@/domain/profiles';
import { type FarmConfig, type ThresholdSettings, thresholdsFromProfile } from '@/services/config/farmConfig';

import type { Database, Json } from './database.types';
import { isValidNationalId, normalizeNationalId } from './identity';
import { bogotaDate, bogotaMidnight } from './subscription';
import type { AccountSummary, NewAccountInput, Profile } from './types';

/** Conversión entre las filas de Supabase y la configuración que usa la simulación. */

type Tables = Database['public']['Tables'];
export type ProfileRow = Tables['profiles']['Row'];
export type FarmRow = Tables['farms']['Row'];
export type ZoneRow = Tables['zones']['Row'];
export type FarmUpdate = Tables['farms']['Update'];
export type ZoneUpdate = Tables['zones']['Update'];

export function profileFromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    role: row.role,
    fullName: row.full_name,
    nationalId: row.national_id,
    phone: row.phone,
    email: row.email,
    municipality: row.municipality,
    mustChangePassword: row.must_change_password,
    paidUntil: row.paid_until,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function accountFromRow(
  row: ProfileRow & { farms?: Pick<FarmRow, 'id' | 'name' | 'place_name' | 'region'>[] | null },
): AccountSummary {
  return {
    ...profileFromRow(row),
    farms: (row.farms ?? []).map((f) => ({ id: f.id, name: f.name, placeName: f.place_name, region: f.region })),
  };
}

function isRecord(value: Json | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function lightingFromJson(value: Json): LightingProgram {
  if (isRecord(value) && value.type === 'extended') {
    const { startHour, endHour } = value;
    if (typeof startHour === 'number' && typeof endHour === 'number') return { type: 'extended', startHour, endHour };
  }
  return { type: 'natural' };
}

/** Umbrales guardados; si falta alguno, el recomendado para la especie. */
function thresholdsFromJson(value: Json, profile: SpeciesProfile): ThresholdSettings {
  const defaults = thresholdsFromProfile(profile);
  if (!isRecord(value)) return defaults;
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof ThresholdSettings)[]) {
    const v = value[key];
    if (typeof v === 'number' && Number.isFinite(v)) result[key] = v;
  }
  return result;
}

export function locationFromFarm(farm: FarmRow): FarmLocation {
  return {
    name: farm.place_name,
    region: farm.region,
    ...(farm.district ? { district: farm.district } : {}),
    country: farm.country,
    latitude: farm.latitude,
    longitude: farm.longitude,
    elevation: farm.elevation,
    timezone: farm.timezone,
  };
}

export function configFromRows(farm: FarmRow, zone: ZoneRow, profile: SpeciesProfile): FarmConfig {
  return {
    version: 1,
    farmName: farm.name,
    location: locationFromFarm(farm),
    zoneName: zone.name,
    population: zone.population,
    hatchDate: bogotaMidnight(zone.hatch_date),
    lighting: lightingFromJson(zone.lighting),
    thresholds: thresholdsFromJson(zone.thresholds, profile),
  };
}

export function farmUpdateFromConfig(config: FarmConfig): FarmUpdate {
  const l = config.location;
  return {
    name: config.farmName.trim(),
    place_name: l.name,
    region: l.region,
    district: l.district ?? null,
    country: l.country,
    latitude: l.latitude,
    longitude: l.longitude,
    elevation: l.elevation,
    timezone: l.timezone,
  };
}

export function zoneUpdateFromConfig(config: FarmConfig): ZoneUpdate {
  return {
    name: config.zoneName.trim(),
    population: config.population,
    hatch_date: bogotaDate(config.hatchDate),
    lighting: config.lighting as unknown as Json,
    thresholds: config.thresholds as unknown as Json,
  };
}

/** Cuerpo para la Edge Function `manage-users` (crear cliente o instalador). */
export function newAccountRequest(input: NewAccountInput): Record<string, unknown> {
  const person = {
    fullName: input.fullName.trim(),
    nationalId: normalizeNationalId(input.nationalId),
    phone: input.phone.replace(/\D/g, ''),
    email: input.email.trim().toLowerCase(),
    municipality: input.municipality.trim(),
  };
  if (input.role === 'installer' || !input.farm) return { action: 'createInstaller', ...person };
  const farm = farmUpdateFromConfig(input.farm);
  const zone = zoneUpdateFromConfig(input.farm);
  return {
    action: 'createClient',
    ...person,
    farm: {
      name: farm.name,
      placeName: farm.place_name,
      region: farm.region,
      district: farm.district ?? '',
      country: farm.country,
      latitude: farm.latitude,
      longitude: farm.longitude,
      elevation: farm.elevation,
      timezone: farm.timezone,
      zone: {
        name: zone.name,
        population: zone.population,
        hatchDate: zone.hatch_date,
        lighting: zone.lighting,
        thresholds: zone.thresholds,
      },
    },
  };
}

/** Errores del formulario "Nueva cuenta", en español. */
export function validateNewAccount(input: NewAccountInput): string[] {
  const errors: string[] = [];
  if (input.fullName.trim().length < 3) errors.push('Escribe el nombre completo.');
  if (!isValidNationalId(normalizeNationalId(input.nationalId))) {
    errors.push('La cédula debe tener entre 6 y 10 dígitos.');
  }
  const phone = input.phone.replace(/\D/g, '');
  if (phone && (phone.length < 7 || phone.length > 15)) errors.push('El celular no es válido.');
  const email = input.email.trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('El correo no es válido.');
  if (input.role === 'client') {
    if (!input.farm) errors.push('Faltan los datos de la granja.');
    else {
      if (!input.farm.farmName.trim()) errors.push('Escribe el nombre de la granja.');
      if (!input.farm.zoneName.trim()) errors.push('Escribe el nombre del galpón.');
    }
  }
  return errors;
}
