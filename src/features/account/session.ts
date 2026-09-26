import { getSpeciesProfile } from '@/domain/profiles';
import { loadRecords, syncPendingRecords } from '@/features/production/records';
import { getSupabase, isBackendConfigured } from '@/lib/supabase';
import { accessFor } from '@/services/account/access';
import {
  AccountError,
  acceptDataPolicy,
  addZone,
  changePassword,
  deleteZone,
  fetchFarmOf,
  fetchProfile,
  saveRemoteFarm,
  signInWithNationalId,
  toAccountError,
} from '@/services/account/api';
import {
  activeZoneFor,
  cacheAccount,
  cachedAccount,
  clearAccountCache,
  rememberActiveZone,
} from '@/services/account/cache';
import { bogotaDate, subscriptionState } from '@/services/account/subscription';
import type { NewZoneInput, Profile, RemoteFarm } from '@/services/account/types';
import type { FarmConfig } from '@/services/config/farmConfig';
import { applyFarmConfig, type ConfigStore, startFarm, stopFarm } from '@/services/runtime';
import { authActions, authStore, type OpenFarm } from '@/store/authStore';
import { farmStore } from '@/store/farmStore';
import { recordsActions } from '@/store/recordsStore';

/**
 * Sesión de VigíaAI: ingreso con cédula, cambio de la contraseña inicial, autorización de datos,
 * suscripción y qué granja corre en la simulación (la real desde Supabase, con su galpón activo, o
 * la demo guardada en el teléfono). Las pantallas llaman estas funciones en sus manejadores; la
 * navegación sigue sola al estado.
 */

const speciesProfile = getSpeciesProfile('layingHens');
/** Si el servidor no responde en este tiempo, se abre con lo guardado en el teléfono. */
const NETWORK_TIMEOUT_MS = 10_000;
let listening = false;

function withTimeout<T>(promise: Promise<T>, ms = NETWORK_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AccountError('El servidor no responde. Revisa tu internet.', true)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const localSignOut = () =>
  isBackendConfigured() ? getSupabase().auth.signOut({ scope: 'local' }).catch(() => undefined) : Promise.resolve();

function openFarmFrom(farm: RemoteFarm): OpenFarm {
  return { farmId: farm.farmId, ownerId: farm.ownerId, zones: farm.zones, activeZoneId: farm.zoneId };
}

/** El resumen del galpón activo sigue a la configuración guardada (nombre, aves, lote). */
function withConfig(farm: RemoteFarm, config: FarmConfig): RemoteFarm {
  return {
    ...farm,
    config,
    zones: farm.zones.map((z) =>
      z.id === farm.zoneId
        ? { ...z, name: config.zoneName, population: config.population, hatchDate: bogotaDate(config.hatchDate) }
        : z,
    ),
  };
}

async function cacheIfOwn(farm: RemoteFarm): Promise<void> {
  const { profile } = authStore.getState();
  if (profile?.id === farm.ownerId) await cacheAccount(profile, farm);
}

/** Granja de Supabase como origen de la configuración: "Guardar" en Configuración escribe allá. */
function remoteConfigStore(farm: RemoteFarm): ConfigStore {
  let current = farm;
  return {
    load: async () => current.config,
    save: async (config) => {
      await saveRemoteFarm(getSupabase(), current, config);
      current = withConfig(current, config);
      authActions.setFarm(openFarmFrom(current));
      await cacheIfOwn(current);
    },
  };
}

/** Pone en marcha una granja real: la simulación de su galpón activo y sus registros diarios. */
async function openRemoteFarm(farm: RemoteFarm): Promise<void> {
  authActions.setFarm(openFarmFrom(farm));
  recordsActions.reset();
  void rememberActiveZone(farm.ownerId, farm.zoneId);
  void loadRecords();
  await startFarm(remoteConfigStore(farm));
}

/** Granja demo del teléfono: "Ver demo", y administrador o instalador sin un cliente abierto. */
async function openDemoFarm(): Promise<void> {
  authActions.setFarm(null);
  recordsActions.reset();
  void loadRecords();
  await startFarm();
}

function closeFarm(): void {
  stopFarm();
  authActions.setFarm(null);
  recordsActions.reset();
}

/** Un cliente con la contraseña ya cambiada, la autorización dada y al día necesita su granja. */
function needsFarm(profile: Profile): boolean {
  return (
    profile.role === 'client' &&
    !profile.mustChangePassword &&
    profile.policyAccepted !== false &&
    subscriptionState(profile.paidUntil, Date.now()).status !== 'expired'
  );
}

async function fetchAccountData(userId: string): Promise<{ profile: Profile | null; farm: RemoteFarm | null }> {
  const sb = getSupabase();
  const profile = await fetchProfile(sb, userId);
  const farm =
    profile && needsFarm(profile)
      ? await fetchFarmOf(sb, profile.id, speciesProfile, await activeZoneFor(profile.id))
      : null;
  return { profile, farm };
}

/** Sin señal: abre con la última copia guardada en el teléfono. false si no hay copia útil. */
async function openFromCache(userId?: string): Promise<boolean> {
  const cached = await cachedAccount(userId);
  if (!cached || (needsFarm(cached.profile) && !cached.farm)) return false;
  await applyAccount(cached.profile, cached.farm, true);
  return true;
}

async function loadAccount(userId: string): Promise<void> {
  let data: Awaited<ReturnType<typeof fetchAccountData>>;
  try {
    data = await withTimeout(fetchAccountData(userId));
  } catch (error) {
    const e = toAccountError(error);
    if (e.offline && (await openFromCache(userId))) return;
    throw e;
  }
  await applyAccount(data.profile, data.farm, false);
}

async function applyAccount(profile: Profile | null, farm: RemoteFarm | null, offline: boolean): Promise<void> {
  if (!profile) {
    await localSignOut();
    authActions.signedOut('Tu usuario no tiene perfil. Comunícate con el administrador.');
    return;
  }
  authActions.signedIn(profile, subscriptionState(profile.paidUntil, Date.now()), offline);
  if (!offline) await cacheAccount(profile, farm);

  if (accessFor(authStore.getState()) !== 'app') {
    closeFarm(); // Falta la contraseña propia o la autorización de datos, o la suscripción venció.
    return;
  }
  if (profile.role !== 'client') {
    // Administrador e instaladores empiezan en la granja demo; desde Clientes abren la de un cliente.
    authActions.setViewing(null);
    await openDemoFarm();
    return;
  }
  if (!farm) {
    closeFarm();
    await localSignOut();
    authActions.signedOut('Tu cuenta no tiene una granja asignada. Comunícate con tu instalador.');
    return;
  }
  await openRemoteFarm(farm);
}

/** Al abrir la app: recupera la sesión guardada en el teléfono, si la hay. */
export async function bootstrapSession(): Promise<void> {
  if (!isBackendConfigured()) {
    authActions.signedOut();
    return;
  }
  const sb = getSupabase();
  if (!listening) {
    listening = true;
    sb.auth.onAuthStateChange((event) => {
      // Sesión cerrada desde otro lugar, o vencida sin poder renovarse: volver al ingreso.
      if (event === 'SIGNED_OUT' && authStore.getState().status === 'signedIn') {
        closeFarm();
        authActions.signedOut('Tu sesión se cerró. Vuelve a ingresar.');
      }
    });
  }
  try {
    const { data, error } = await withTimeout(sb.auth.getSession());
    if (data.session) {
      await loadAccount(data.session.user.id);
      return;
    }
    // Sin señal la sesión guardada no se puede renovar: se abre con la copia del teléfono.
    if (error && toAccountError(error).offline && (await openFromCache())) return;
    authActions.signedOut();
  } catch (error) {
    const e = toAccountError(error);
    if (e.offline && (await openFromCache())) return;
    authActions.signedOut(e.message);
  }
}

export async function signIn(nationalId: string, password: string): Promise<void> {
  const userId = await signInWithNationalId(getSupabase(), nationalId, password);
  try {
    await loadAccount(userId);
  } catch (error) {
    await localSignOut();
    throw toAccountError(error);
  }
}

export async function signOut(): Promise<void> {
  closeFarm();
  authActions.signedOut();
  await clearAccountCache();
  await localSignOut();
}

/**
 * Cambia la contraseña. En el primer ingreso también registra la autorización de datos (si se
 * pide) y continúa con la carga de la cuenta.
 */
export async function completePasswordChange(password: string, acceptPolicy = false): Promise<void> {
  const sb = getSupabase();
  await changePassword(sb, password);
  if (acceptPolicy) await acceptDataPolicy(sb);
  const { profile } = authStore.getState();
  if (profile && (profile.mustChangePassword || acceptPolicy)) await loadAccount(profile.id);
}

/** Autorización de tratamiento de datos (Ley 1581) y continuar. */
export async function acceptPolicyAndContinue(): Promise<void> {
  await acceptDataPolicy(getSupabase());
  const { profile } = authStore.getState();
  if (profile) await loadAccount(profile.id);
}

/** Vuelve a consultar la cuenta (por ejemplo, después de pagar). */
export async function refreshAccount(): Promise<void> {
  const { profile } = authStore.getState();
  if (profile) await loadAccount(profile.id);
}

/**
 * Al volver la app a primer plano: si el instalador restableció la contraseña o cambió la
 * suscripción, la app se entera sin reiniciar; y se envían los registros pendientes. Sin conexión
 * no hace nada.
 */
export async function refreshProfileQuietly(): Promise<void> {
  const { status, profile, offline } = authStore.getState();
  if (status !== 'signedIn' || !profile) return;
  try {
    const fresh = await fetchProfile(getSupabase(), profile.id);
    if (!fresh) return;
    if (offline) {
      // Volvió la señal: se recarga todo desde el servidor.
      await loadAccount(fresh.id);
      return;
    }
    const before = accessFor(authStore.getState());
    authActions.updateProfile(fresh, subscriptionState(fresh.paidUntil, Date.now()));
    const after = accessFor(authStore.getState());
    if (after !== before) {
      if (after === 'app') await loadAccount(fresh.id);
      else closeFarm();
      return;
    }
    if ((await syncPendingRecords()) > 0) void loadRecords();
  } catch {
    // Sin conexión: se conserva lo que hay.
  }
}

/** Probar la app sin cuenta: granja demo guardada en el teléfono. */
export async function enterDemo(): Promise<void> {
  authActions.demo();
  await openDemoFarm();
}

export function leaveDemo(): void {
  closeFarm();
  authActions.signedOut();
}

/** Administrador o instalador: abrir la granja de un cliente en la app. */
export async function viewClientFarm(ownerId: string, ownerName: string): Promise<void> {
  const farm = await fetchFarmOf(getSupabase(), ownerId, speciesProfile, await activeZoneFor(ownerId));
  if (!farm) throw new AccountError('Este cliente no tiene una granja registrada.');
  authActions.setViewing({ ownerId, ownerName, farmName: farm.config.farmName });
  await openRemoteFarm(farm);
}

export async function stopViewingClient(): Promise<void> {
  authActions.setViewing(null);
  await openDemoFarm();
}

// --- Galpones -----------------------------------------------------------------------------------------

/** Cambia el galpón que muestra la app (se recuerda para la próxima vez). */
export async function switchZone(zoneId: string | null): Promise<void> {
  const farm = authStore.getState().farm;
  if (!farm) return;
  const next = await fetchFarmOf(getSupabase(), farm.ownerId, speciesProfile, zoneId);
  if (!next) throw new AccountError('No se encontró la granja.');
  await cacheIfOwn(next);
  await openRemoteFarm(next);
}

/** Agrega un galpón a la granja abierta y lo deja activo. */
export async function createZone(input: NewZoneInput): Promise<void> {
  const farm = authStore.getState().farm;
  if (!farm) throw new AccountError('Los galpones se agregan en una granja real, no en la demo.');
  const zoneId = await addZone(getSupabase(), farm.farmId, input);
  await switchZone(zoneId);
}

/** Elimina un galpón con sus registros (administrador o instalador). */
export async function removeZone(zoneId: string): Promise<void> {
  const farm = authStore.getState().farm;
  if (!farm) return;
  await deleteZone(getSupabase(), zoneId);
  await switchZone(farm.activeZoneId === zoneId ? null : farm.activeZoneId);
}

/**
 * Después de guardar un registro con muertes: cambian las aves vivas del galpón. En una granja real
 * las descuenta la base de datos (aquí solo se recarga); en la demo, la configuración del teléfono.
 */
export async function refreshFarmAfterRecord(deathsDelta: number): Promise<void> {
  if (deathsDelta === 0) return;
  const farm = authStore.getState().farm;
  if (farm) {
    const next = await fetchFarmOf(getSupabase(), farm.ownerId, speciesProfile, farm.activeZoneId);
    if (!next) return;
    authActions.setFarm(openFarmFrom(next));
    await cacheIfOwn(next);
    await startFarm(remoteConfigStore(next));
    return;
  }
  const config = farmStore.getState().config;
  if (config) await applyFarmConfig({ ...config, population: Math.max(1, config.population - deathsDelta) });
}
