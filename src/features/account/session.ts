import { getSpeciesProfile } from '@/domain/profiles';
import { getSupabase, isBackendConfigured } from '@/lib/supabase';
import { accessFor } from '@/services/account/access';
import {
  AccountError,
  changePassword,
  fetchFarmOf,
  fetchProfile,
  saveRemoteFarm,
  signInWithNationalId,
  toAccountError,
} from '@/services/account/api';
import { cacheAccount, cachedAccount, clearAccountCache } from '@/services/account/cache';
import { subscriptionState } from '@/services/account/subscription';
import type { Profile, RemoteFarm } from '@/services/account/types';
import { type ConfigStore, startFarm, stopFarm } from '@/services/runtime';
import { authActions, authStore } from '@/store/authStore';

/**
 * Sesión de VigíaAI: ingreso con cédula, cambio de la contraseña inicial, suscripción y qué
 * granja corre en la simulación (la del cliente desde Supabase o la demo guardada en el teléfono).
 * Las pantallas llaman estas funciones en sus manejadores; la navegación sigue sola al estado.
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

/** Granja de Supabase como origen de la configuración: "Guardar" en Configuración escribe allá. */
function remoteConfigStore(farm: RemoteFarm): ConfigStore {
  let current = farm;
  return {
    load: async () => current.config,
    save: async (config) => {
      await saveRemoteFarm(getSupabase(), current, config);
      current = { ...current, config };
      const { profile } = authStore.getState();
      if (profile?.id === current.ownerId) await cacheAccount(profile, current);
    },
  };
}

/** Un cliente con la contraseña ya cambiada y al día necesita cargar su granja. */
function needsFarm(profile: Profile): boolean {
  return (
    profile.role === 'client' &&
    !profile.mustChangePassword &&
    subscriptionState(profile.paidUntil, Date.now()).status !== 'expired'
  );
}

async function fetchAccountData(userId: string): Promise<{ profile: Profile | null; farm: RemoteFarm | null }> {
  const sb = getSupabase();
  const profile = await fetchProfile(sb, userId);
  const farm = profile && needsFarm(profile) ? await fetchFarmOf(sb, profile.id, speciesProfile) : null;
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
    stopFarm(); // Falta cambiar la contraseña, o la suscripción está vencida.
    return;
  }
  if (profile.role !== 'client') {
    // Administrador e instaladores empiezan en la granja demo; desde Clientes abren la de un cliente.
    authActions.setViewing(null);
    await startFarm();
    return;
  }
  if (!farm) {
    stopFarm();
    await localSignOut();
    authActions.signedOut('Tu cuenta no tiene una granja asignada. Comunícate con tu instalador.');
    return;
  }
  await startFarm(remoteConfigStore(farm));
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
        stopFarm();
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
  stopFarm();
  authActions.signedOut();
  await clearAccountCache();
  await localSignOut();
}

/** Cambia la contraseña; si era la inicial, continúa con la carga de la cuenta. */
export async function completePasswordChange(password: string): Promise<void> {
  await changePassword(getSupabase(), password);
  const { profile } = authStore.getState();
  if (profile?.mustChangePassword) await loadAccount(profile.id);
}

/** Vuelve a consultar la cuenta (por ejemplo, después de pagar). */
export async function refreshAccount(): Promise<void> {
  const { profile } = authStore.getState();
  if (profile) await loadAccount(profile.id);
}

/**
 * Al volver la app a primer plano: si el instalador restableció la contraseña o cambió la
 * suscripción, la app se entera sin reiniciar. Sin conexión no hace nada.
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
    if (after === before) return;
    if (after === 'app') await loadAccount(fresh.id);
    else stopFarm();
  } catch {
    // Sin conexión: se conserva lo que hay.
  }
}

/** Probar la app sin cuenta: granja demo guardada en el teléfono. */
export async function enterDemo(): Promise<void> {
  authActions.demo();
  await startFarm();
}

export function leaveDemo(): void {
  stopFarm();
  authActions.signedOut();
}

/** Administrador o instalador: abrir la granja de un cliente en la app. */
export async function viewClientFarm(ownerId: string, ownerName: string): Promise<void> {
  const farm = await fetchFarmOf(getSupabase(), ownerId, speciesProfile);
  if (!farm) throw new AccountError('Este cliente no tiene una granja registrada.');
  authActions.setViewing({ ownerId, ownerName, farmName: farm.config.farmName });
  await startFarm(remoteConfigStore(farm));
}

export async function stopViewingClient(): Promise<void> {
  authActions.setViewing(null);
  await startFarm();
}
