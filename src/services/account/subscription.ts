/**
 * Suscripción del cliente. La base de datos es la que bloquea (RLS); aquí solo se calcula
 * lo que la app muestra y las fechas que registra el administrador.
 */

const DAY_MS = 86_400_000;
/** Colombia está en UTC−5 todo el año (sin horario de verano). */
const BOGOTA_OFFSET_MS = -5 * 3_600_000;
/** Aviso de "vence pronto" desde estos días antes. */
const EXPIRING_DAYS = 5;

/** Fecha de hoy en Colombia ("AAAA-MM-DD"): las suscripciones vencen a medianoche local. */
export function bogotaDate(time: number): string {
  return new Date(time + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Medianoche de Colombia de una fecha "AAAA-MM-DD". */
export function bogotaMidnight(date: string): number {
  return Date.parse(`${date}T00:00:00-05:00`);
}

export type SubscriptionStatus = 'active' | 'expiring' | 'expired';

export interface SubscriptionState {
  status: SubscriptionStatus;
  paidUntil: string | null;
  /** Días que faltan (0 = vence hoy; negativo = vencida). */
  daysLeft: number;
}

export function subscriptionState(paidUntil: string | null, now: number): SubscriptionState {
  if (!paidUntil) return { status: 'expired', paidUntil, daysLeft: -1 };
  const daysLeft = Math.round((Date.parse(paidUntil) - Date.parse(bogotaDate(now))) / DAY_MS);
  const status: SubscriptionStatus = daysLeft < 0 ? 'expired' : daysLeft <= EXPIRING_DAYS ? 'expiring' : 'active';
  return { status, paidUntil, daysLeft };
}

/** Un mes más desde la fecha vigente, o desde hoy si ya venció (31 ene → 28/29 feb). */
export function extendOneMonth(paidUntil: string | null, now: number): string {
  const today = bogotaDate(now);
  const base = paidUntil && paidUntil >= today ? paidUntil : today;
  const d = new Date(`${base}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

/** Fecha vencida (ayer) para bloquear de inmediato. */
export function blockDate(now: number): string {
  return bogotaDate(now - DAY_MS);
}

/** "26/10/2026" */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export function subscriptionLabel(state: SubscriptionState): string {
  if (state.status === 'expired') {
    return state.paidUntil ? `Vencida desde el ${formatDate(state.paidUntil)}` : 'Sin pago registrado';
  }
  if (state.daysLeft === 0) return 'Vence hoy';
  if (state.status === 'expiring') return `Vence en ${state.daysLeft} ${state.daysLeft === 1 ? 'día' : 'días'}`;
  return `Al día hasta el ${formatDate(state.paidUntil!)}`;
}
