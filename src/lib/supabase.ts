import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/services/account/database.types';

export type Supabase = SupabaseClient<Database>;

// Valores públicos: van dentro de la app. Los permisos los pone RLS en la base de datos.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: Supabase | null = null;

/** Sin `.env` (por ejemplo, al clonar el repositorio) la app funciona solo en modo demo. */
export function isBackendConfigured(): boolean {
  return Boolean(url && publishableKey);
}

/**
 * Cliente de Supabase. Se crea en el primer uso y no al importar: el render estático de la web
 * se ejecuta en Node, donde no existe `localStorage`.
 */
export function getSupabase(): Supabase {
  if (client) return client;
  if (!url || !publishableKey) throw new Error('Supabase no está configurado (.env).');
  client = createClient<Database>(url, publishableKey, {
    auth: {
      // En el teléfono la sesión se guarda con AsyncStorage; en la web, en localStorage (por defecto).
      ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  if (Platform.OS !== 'web') {
    // Recomendación de Supabase para móvil: renovar la sesión solo con la app en primer plano.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }
  return client;
}
