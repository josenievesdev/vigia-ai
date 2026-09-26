import type { FarmConfig } from '@/services/config/farmConfig';

export type AppRole = 'admin' | 'installer' | 'client';

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  installer: 'Instalador',
  client: 'Cliente',
};

/** Usuario de VigíaAI (tabla `profiles`). */
export interface Profile {
  id: string;
  role: AppRole;
  fullName: string;
  /** Cédula: es el usuario para iniciar sesión. */
  nationalId: string;
  phone: string | null;
  email: string | null;
  municipality: string | null;
  mustChangePassword: boolean;
  /** Suscripción del cliente ("AAAA-MM-DD"); vencida o vacía, la base de datos bloquea sus granjas. */
  paidUntil: string | null;
  createdBy: string | null;
  createdAt: string;
  /**
   * Aceptó la política de datos vigente (Ley 1581). null: no se sabe (p. ej. el instalador no ve
   * las autorizaciones de sus clientes; solo el propio usuario y el administrador).
   */
  policyAccepted: boolean | null;
}

/** Galpón de una granja (resumen para elegir cuál ver). */
export interface ZoneSummary {
  id: string;
  name: string;
  population: number;
  /** "AAAA-MM-DD" */
  hatchDate: string;
}

/** Granja guardada en Supabase, con el galpón activo listo para la simulación. */
export interface RemoteFarm {
  farmId: string;
  ownerId: string;
  /** Todos los galpones de la granja, del más antiguo al más nuevo. */
  zones: ZoneSummary[];
  /** Galpón activo: el que muestra la app. */
  zoneId: string;
  config: FarmConfig;
}

/** Datos del formulario "Agregar galpón". */
export interface NewZoneInput {
  name: string;
  population: number;
  hatchDate: number;
  lighting: FarmConfig['lighting'];
  thresholds: FarmConfig['thresholds'];
}

export interface AccountSummary extends Profile {
  farms: { id: string; name: string; placeName: string; region: string }[];
}

/** Datos del formulario "Nueva cuenta" (el instalador crea al cliente con su granja). */
export interface NewAccountInput {
  role: 'client' | 'installer';
  fullName: string;
  nationalId: string;
  phone: string;
  email: string;
  municipality: string;
  /** Solo para clientes. */
  farm?: FarmConfig;
}
