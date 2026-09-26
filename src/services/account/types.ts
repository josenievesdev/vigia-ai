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
}

/** Granja guardada en Supabase, con su primer galpón, lista para la simulación. */
export interface RemoteFarm {
  farmId: string;
  zoneId: string;
  ownerId: string;
  config: FarmConfig;
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
