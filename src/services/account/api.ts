import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import type { SpeciesProfile } from '@/domain/profiles';
import type { FarmConfig } from '@/services/config/farmConfig';

import type { Database } from './database.types';
import { DATA_POLICY_VERSION } from './dataPolicy';
import { loginEmailFor } from './identity';
import {
  accountFromRow,
  configFromRows,
  farmUpdateFromConfig,
  newAccountRequest,
  profileFromRow,
  zoneInsertFromInput,
  zoneSummaryFromRow,
  zoneUpdateFromConfig,
} from './mapping';
import type { AccountSummary, NewAccountInput, NewZoneInput, Profile, RemoteFarm } from './types';

/** Operaciones con Supabase. Reciben el cliente como parámetro (sin dependencias de React). */

type Supabase = SupabaseClient<Database>;

/** Error con un mensaje listo para mostrar (en español). `offline`: no hubo conexión. */
export class AccountError extends Error {
  constructor(
    message: string,
    readonly offline = false,
  ) {
    super(message);
    this.name = 'AccountError';
  }
}

const OFFLINE_MESSAGE = 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.';

function isNetworkError(error: unknown): boolean {
  const e = error as { message?: string; name?: string } | null;
  return (
    e?.name === 'AuthRetryableFetchError' ||
    /network|fetch|timed? ?out|load failed|connection/i.test(String(e?.message ?? error))
  );
}

/** Traduce un error de Supabase a un mensaje para el usuario. */
export function toAccountError(error: unknown, fallback = 'Algo salió mal. Intenta de nuevo.'): AccountError {
  if (error instanceof AccountError) return error;
  if (isNetworkError(error)) return new AccountError(OFFLINE_MESSAGE, true);
  const e = error as { status?: number; code?: string } | null;
  if (e?.status === 429) return new AccountError('Demasiados intentos. Espera un momento e intenta de nuevo.');
  return new AccountError(fallback);
}

// --- Sesión ----------------------------------------------------------------------------------------

/** Inicia sesión con la cédula. Devuelve el id del usuario. */
export async function signInWithNationalId(sb: Supabase, nationalId: string, password: string): Promise<string> {
  const { data, error } = await sb.auth.signInWithPassword({ email: loginEmailFor(nationalId), password });
  if (error) {
    if (error.code === 'invalid_credentials' || error.status === 400) {
      throw new AccountError('Cédula o contraseña incorrecta.');
    }
    throw toAccountError(error, 'No se pudo iniciar sesión.');
  }
  return data.user.id;
}

export async function fetchProfile(sb: Supabase, userId: string): Promise<Profile | null> {
  const { data, error } = await sb
    .from('profiles')
    .select('*, data_consents(policy_version)')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw toAccountError(error, 'No se pudo cargar tu perfil.');
  return data ? profileFromRow(data) : null;
}

/** Registra que el usuario aceptó la política de datos vigente (Ley 1581). */
export async function acceptDataPolicy(sb: Supabase): Promise<void> {
  const { error } = await sb.from('data_consents').insert({ policy_version: DATA_POLICY_VERSION });
  // Ya la había aceptado (por ejemplo, un reintento sin señal): no es un error.
  if (error && error.code !== '23505') throw toAccountError(error, 'No se pudo guardar la autorización.');
}

/** Cambia la contraseña y marca que ya no es la inicial. */
export async function changePassword(sb: Supabase, password: string): Promise<void> {
  const { error } = await sb.auth.updateUser({ password });
  if (error) {
    if (error.code === 'same_password') throw new AccountError('La contraseña nueva debe ser distinta de la actual.');
    if (error.code === 'weak_password') throw new AccountError('La contraseña es muy débil. Usa una más larga.');
    throw toAccountError(error, 'No se pudo cambiar la contraseña.');
  }
  const { error: rpcError } = await sb.rpc('mark_password_changed');
  if (rpcError) throw toAccountError(rpcError, 'No se pudo cambiar la contraseña.');
}

// --- Granja ----------------------------------------------------------------------------------------

/**
 * Primera granja de un dueño con todos sus galpones (RLS decide si el usuario puede verla).
 * El galpón activo es `preferredZoneId` si existe; si no, el más antiguo.
 */
export async function fetchFarmOf(
  sb: Supabase,
  ownerId: string,
  profile: SpeciesProfile,
  preferredZoneId?: string | null,
): Promise<RemoteFarm | null> {
  const { data, error } = await sb
    .from('farms')
    .select('*, zones(*)')
    .eq('owner_id', ownerId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (error) throw toAccountError(error, 'No se pudo cargar la granja.');
  const zones = [...(data?.zones ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const zone = zones.find((z) => z.id === preferredZoneId) ?? zones[0];
  if (!data || !zone) return null;
  return {
    farmId: data.id,
    ownerId: data.owner_id,
    zones: zones.map(zoneSummaryFromRow),
    zoneId: zone.id,
    config: configFromRows(data, zone, profile),
  };
}

/** Agrega un galpón a la granja. Devuelve su id. */
export async function addZone(sb: Supabase, farmId: string, input: NewZoneInput): Promise<string> {
  const { data, error } = await sb.from('zones').insert(zoneInsertFromInput(farmId, input)).select('id').single();
  if (error) throw toAccountError(error, 'No se pudo agregar el galpón.');
  return data.id;
}

/** Elimina un galpón con sus registros (solo administrador o instalador; la granja conserva al menos uno). */
export async function deleteZone(sb: Supabase, zoneId: string): Promise<void> {
  const { data, error } = await sb.from('zones').delete().eq('id', zoneId).select('id');
  if (error) {
    if (/al menos un galpón/.test(error.message)) throw new AccountError('La granja debe tener al menos un galpón.');
    throw toAccountError(error, 'No se pudo eliminar el galpón.');
  }
  if (!data.length) throw new AccountError('Solo el administrador o el instalador pueden eliminar galpones.');
}

export async function saveRemoteFarm(sb: Supabase, farm: RemoteFarm, config: FarmConfig): Promise<void> {
  const [f, z] = await Promise.all([
    sb.from('farms').update(farmUpdateFromConfig(config)).eq('id', farm.farmId).select('id'),
    sb.from('zones').update(zoneUpdateFromConfig(config)).eq('id', farm.zoneId).select('id'),
  ]);
  const error = f.error ?? z.error;
  if (error) throw toAccountError(error, 'No se pudo guardar en el servidor.');
  // Con RLS, una fila que el usuario no puede tocar no da error: simplemente no se actualiza.
  if (!f.data?.length || !z.data?.length) {
    throw new AccountError('No tienes permiso para cambiar esta granja (¿suscripción vencida?).');
  }
}

// --- Cuentas (administrador e instaladores) ---------------------------------------------------------

const ACCOUNT_SELECT = '*, farms!farms_owner_id_fkey(id, name, place_name, region), data_consents(policy_version)' as const;

/** `consentsVisible`: solo el administrador ve las autorizaciones de datos de otros usuarios. */
export async function listAccounts(
  sb: Supabase,
  role: 'client' | 'installer',
  consentsVisible: boolean,
): Promise<AccountSummary[]> {
  const { data, error } = await sb.from('profiles').select(ACCOUNT_SELECT).eq('role', role).order('full_name');
  if (error) throw toAccountError(error, 'No se pudo cargar la lista.');
  return data.map((row) => accountFromRow(row, consentsVisible));
}

export async function fetchAccount(sb: Supabase, id: string, consentsVisible: boolean): Promise<AccountSummary | null> {
  const { data, error } = await sb.from('profiles').select(ACCOUNT_SELECT).eq('id', id).maybeSingle();
  if (error) throw toAccountError(error, 'No se pudo cargar la cuenta.');
  return data ? accountFromRow(data, consentsVisible) : null;
}

async function manageUsers<T>(sb: Supabase, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.functions.invoke('manage-users', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { error?: string } | null;
      throw new AccountError(payload?.error ?? 'El servidor rechazó la solicitud.');
    }
    throw toAccountError(error, 'No se pudo contactar al servidor.');
  }
  return data as T;
}

export function createAccount(sb: Supabase, input: NewAccountInput) {
  return manageUsers<{ userId: string; nationalId: string; farmId?: string }>(sb, newAccountRequest(input));
}

export function resetPassword(sb: Supabase, userId: string) {
  return manageUsers<{ ok: true }>(sb, { action: 'resetPassword', userId });
}

export function deleteAccount(sb: Supabase, userId: string) {
  return manageUsers<{ ok: true }>(sb, { action: 'deleteUser', userId });
}

/** Administrador: hasta cuándo pagó el cliente ("AAAA-MM-DD"; una fecha pasada lo bloquea). */
export async function setPaidUntil(sb: Supabase, clientId: string, date: string): Promise<void> {
  const { error } = await sb.rpc('set_paid_until', { p_client_id: clientId, p_paid_until: date });
  if (error) throw toAccountError(error, 'No se pudo registrar el pago.');
}

/** Contacto del instalador que creó la cuenta (pantalla de suscripción vencida). */
export async function installerContact(sb: Supabase): Promise<{ fullName: string; phone: string | null } | null> {
  const { data, error } = await sb.rpc('my_installer_contact');
  if (error) throw toAccountError(error, 'No se pudo cargar el contacto.');
  const row = data?.[0];
  return row ? { fullName: row.full_name, phone: row.phone } : null;
}
