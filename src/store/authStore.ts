import { createStore } from 'zustand/vanilla';

import type { SessionStatus } from '@/services/account/access';
import type { SubscriptionState } from '@/services/account/subscription';
import type { Profile } from '@/services/account/types';

/** Granja de un cliente que el administrador o un instalador está viendo. */
export interface ViewingFarm {
  ownerId: string;
  ownerName: string;
  farmName: string;
}

export interface AuthState {
  status: SessionStatus;
  profile: Profile | null;
  subscription: SubscriptionState | null;
  /** Administrador o instalador viendo la granja de un cliente (null: granja demo). */
  viewing: ViewingFarm | null;
  /** Sin conexión al abrir: se usan los últimos datos guardados en el teléfono. */
  offline: boolean;
  /** Aviso para la pantalla de ingreso (p. ej. "tu sesión se cerró"). */
  notice: string | null;
}

const initialState: AuthState = {
  status: 'loading',
  profile: null,
  subscription: null,
  viewing: null,
  offline: false,
  notice: null,
};

/** Estado de la sesión (sin React). La orquestación vive en `services/account/session.ts`. */
export const authStore = createStore<AuthState>()(() => initialState);

export const authActions = {
  signedOut(notice: string | null = null) {
    authStore.setState({ ...initialState, status: 'signedOut', notice }, true);
  },
  demo() {
    authStore.setState({ ...initialState, status: 'demo' }, true);
  },
  signedIn(profile: Profile, subscription: SubscriptionState, offline: boolean) {
    authStore.setState({ status: 'signedIn', profile, subscription, offline, notice: null });
  },
  updateProfile(profile: Profile, subscription: SubscriptionState) {
    authStore.setState({ profile, subscription });
  },
  setViewing(viewing: ViewingFarm | null) {
    authStore.setState({ viewing });
  },
};
