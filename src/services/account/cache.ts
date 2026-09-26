import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Profile, RemoteFarm } from './types';

/**
 * Copia en el teléfono del perfil y la granja del usuario: en el campo la señal falla, y la app
 * debe abrir igual con los últimos datos conocidos. Se borra al cerrar sesión.
 */

const KEY = 'vigia.account.v1';

interface CachedAccount {
  profile: Profile;
  farm: RemoteFarm | null;
}

export async function cacheAccount(profile: Profile, farm: RemoteFarm | null): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ profile, farm } satisfies CachedAccount));
  } catch (error) {
    console.warn('[VigíaAI] No se pudo guardar la copia local de la cuenta:', error);
  }
}

/** Copia guardada (de ese usuario, si se indica). */
export async function cachedAccount(userId?: string): Promise<CachedAccount | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const cached = raw ? (JSON.parse(raw) as CachedAccount) : null;
    if (!cached?.profile?.id) return null;
    return userId === undefined || cached.profile.id === userId ? cached : null;
  } catch {
    return null;
  }
}

export async function clearAccountCache(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

/** Último galpón que se vio de cada granja (por dueño): la app vuelve a abrir en ese. */
const ZONE_KEY = 'vigia.activeZone.v1';

async function readZones(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(ZONE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function activeZoneFor(ownerId: string): Promise<string | null> {
  return (await readZones())[ownerId] ?? null;
}

export async function rememberActiveZone(ownerId: string, zoneId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ZONE_KEY, JSON.stringify({ ...(await readZones()), [ownerId]: zoneId }));
  } catch {
    // No es grave: la próxima vez abre en el primer galpón.
  }
}
