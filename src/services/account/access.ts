import type { SubscriptionState } from './subscription';
import type { Profile } from './types';

/** Estado de la sesión: cargando, sin sesión, con usuario, o demo sin cuenta. */
export type SessionStatus = 'loading' | 'signedOut' | 'signedIn' | 'demo';

/** Qué parte de la app puede ver el usuario ahora. */
export type Access = 'loading' | 'signedOut' | 'changePassword' | 'consent' | 'blocked' | 'app';

export function accessFor(state: {
  status: SessionStatus;
  profile: Profile | null;
  subscription: SubscriptionState | null;
}): Access {
  switch (state.status) {
    case 'loading':
      return 'loading';
    case 'signedOut':
      return 'signedOut';
    case 'demo':
      return 'app';
    case 'signedIn': {
      const { profile, subscription } = state;
      if (!profile) return 'loading';
      // Primero la contraseña: la inicial (la cédula) no puede quedarse.
      if (profile.mustChangePassword) return 'changePassword';
      // Autorización de datos (Ley 1581): la dan clientes e instaladores; el administrador es el responsable.
      if (profile.role !== 'admin' && profile.policyAccepted === false) return 'consent';
      if (profile.role === 'client' && subscription?.status === 'expired') return 'blocked';
      return 'app';
    }
  }
}
