import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SpeciesProfile } from '@/domain/profiles';

import { defaultConfig, type FarmConfig, parseStoredConfig } from './farmConfig';

const KEY = 'vigia.farmConfig.v1';

/** Configuración guardada en el teléfono, o la de fábrica si no hay (o está dañada). */
export async function loadConfig(profile: SpeciesProfile): Promise<FarmConfig> {
  try {
    return parseStoredConfig(await AsyncStorage.getItem(KEY)) ?? defaultConfig(profile);
  } catch (error) {
    console.warn('[VigíaAI] No se pudo leer la configuración:', error);
    return defaultConfig(profile);
  }
}

export async function saveConfig(config: FarmConfig): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(config));
}
