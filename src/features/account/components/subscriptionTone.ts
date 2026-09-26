import type { SubscriptionStatus } from '@/services/account/subscription';
import type { Tone } from '@/theme';

/** Color de estado de la suscripción (siempre acompañado de su texto). */
export const SUBSCRIPTION_TONES: Record<SubscriptionStatus, Tone> = {
  active: 'normal',
  expiring: 'warning',
  expired: 'critical',
};
