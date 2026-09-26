import { useStore } from 'zustand';

import { accessFor, type Access } from '@/services/account/access';

import { type AuthState, authStore } from './authStore';

/** Hook de React para leer la sesión con un selector. */
export function useAuthStore<T>(selector: (state: AuthState) => T): T {
  return useStore(authStore, selector);
}

/** Qué parte de la app puede ver el usuario ahora (valor primitivo: estable para el selector). */
export function useAccess(): Access {
  return useStore(authStore, accessFor);
}
