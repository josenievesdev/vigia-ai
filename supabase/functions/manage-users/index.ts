// VigíaAI · Gestión de cuentas (Edge Function, Deno).
// Crea clientes (con su granja y galpón) e instaladores, restablece contraseñas y elimina usuarios.
// Necesita la clave secreta del proyecto, por eso vive en el servidor y nunca dentro de la app.
import { withSupabase } from 'npm:@supabase/server@1';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Alias interno de correo: Supabase Auth trabaja con correo; en VigíaAI el usuario es la cédula. */
const LOGIN_EMAIL_DOMAIN = 'vigia.local';
const loginEmail = (nationalId: string) => `${nationalId}@${LOGIN_EMAIL_DOMAIN}`;

const THRESHOLD_KEYS = [
  'ventilationOn', 'ventilationOff', 'tempWarning', 'tempCritical',
  'pumpOn', 'pumpOff', 'waterWarning', 'waterCritical',
  'feederOn', 'feederOff', 'feedWarning', 'feedCritical',
];

type Role = 'admin' | 'installer' | 'client';
interface Caller {
  id: string;
  role: Role;
}
type Body = Record<string, unknown>;

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const digits = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '') : '');
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// --- Validación ----------------------------------------------------------------------------------

function parsePerson(body: Body) {
  const person = {
    fullName: text(body.fullName),
    nationalId: digits(body.nationalId),
    phone: digits(body.phone),
    email: text(body.email).toLowerCase(),
    municipality: text(body.municipality),
  };
  if (person.fullName.length < 3) throw new HttpError(400, 'Escribe el nombre completo.');
  if (!/^\d{6,10}$/.test(person.nationalId)) throw new HttpError(400, 'La cédula debe tener entre 6 y 10 dígitos.');
  if (person.phone && !/^\d{7,15}$/.test(person.phone)) throw new HttpError(400, 'El celular no es válido.');
  if (person.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(person.email)) throw new HttpError(400, 'El correo no es válido.');
  return person;
}

function parseFarm(raw: unknown) {
  const farm = (raw ?? {}) as Body;
  const zone = (farm.zone ?? {}) as Body;
  const thresholds = (zone.thresholds ?? {}) as Body;
  const lighting = (zone.lighting ?? { type: 'natural' }) as Body;

  if (!text(farm.name)) throw new HttpError(400, 'Escribe el nombre de la granja.');
  if (!text(farm.placeName) || !isNum(farm.latitude) || !isNum(farm.longitude)) {
    throw new HttpError(400, 'Elige la ubicación de la granja.');
  }
  if (!text(zone.name)) throw new HttpError(400, 'Escribe el nombre del galpón.');
  if (!Number.isInteger(zone.population) || (zone.population as number) < 1 || (zone.population as number) > 200_000) {
    throw new HttpError(400, 'El número de aves debe estar entre 1 y 200.000.');
  }
  if (typeof zone.hatchDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(zone.hatchDate)) {
    throw new HttpError(400, 'Falta la edad del lote.');
  }
  if (lighting.type !== 'natural' && lighting.type !== 'extended') throw new HttpError(400, 'Programa de luz no válido.');
  if (!THRESHOLD_KEYS.every((k) => isNum(thresholds[k]))) throw new HttpError(400, 'Faltan umbrales del galpón.');

  return {
    farm: {
      name: text(farm.name),
      placeName: text(farm.placeName),
      region: text(farm.region),
      district: text(farm.district),
      country: text(farm.country),
      latitude: farm.latitude,
      longitude: farm.longitude,
      elevation: isNum(farm.elevation) ? farm.elevation : 0,
      timezone: text(farm.timezone) || 'America/Bogota',
    },
    zone: {
      name: text(zone.name),
      population: zone.population,
      hatchDate: zone.hatchDate,
      lighting,
      thresholds: Object.fromEntries(THRESHOLD_KEYS.map((k) => [k, thresholds[k]])),
    },
  };
}

/** Mensaje en español para errores de la base de datos (restricciones y duplicados). */
function dbMessage(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'Ya existe un usuario con esa cédula.';
  if (error.code === '23514') return 'Algún dato no es válido. Revisa el formulario.';
  return `No se pudo guardar: ${error.message}`;
}

// --- Acciones ------------------------------------------------------------------------------------

async function createAuthUser(admin: SupabaseClient, nationalId: string, role: Role): Promise<string> {
  const { data: existing } = await admin.from('profiles').select('id').eq('national_id', nationalId).maybeSingle();
  if (existing) throw new HttpError(409, 'Ya existe un usuario con esa cédula.');
  const { data, error } = await admin.auth.admin.createUser({
    email: loginEmail(nationalId),
    password: nationalId, // Contraseña inicial: la misma cédula; la app obliga a cambiarla al entrar.
    email_confirm: true,
    app_metadata: { role },
  });
  if (error || !data.user) {
    if (error && /already|registered|exists/i.test(error.message)) throw new HttpError(409, 'Ya existe un usuario con esa cédula.');
    throw new HttpError(400, `No se pudo crear el usuario: ${error?.message ?? 'sin respuesta'}`);
  }
  return data.user.id;
}

async function createClient(admin: SupabaseClient, caller: Caller, body: Body) {
  const person = parsePerson(body);
  const { farm, zone } = parseFarm(body.farm);
  const userId = await createAuthUser(admin, person.nationalId, 'client');
  const { data: farmId, error } = await admin.rpc('provision_client', {
    p_user_id: userId,
    p_created_by: caller.id,
    p_profile: person,
    p_farm: farm,
    p_zone: zone,
  });
  if (error) {
    await admin.auth.admin.deleteUser(userId); // Sin perfil no debe quedar un usuario suelto.
    throw new HttpError(400, dbMessage(error));
  }
  return { userId, farmId, nationalId: person.nationalId };
}

async function createInstaller(admin: SupabaseClient, caller: Caller, body: Body) {
  if (caller.role !== 'admin') throw new HttpError(403, 'Solo el administrador crea instaladores.');
  const person = parsePerson(body);
  const userId = await createAuthUser(admin, person.nationalId, 'installer');
  const { error } = await admin.from('profiles').insert({
    id: userId,
    role: 'installer',
    full_name: person.fullName,
    national_id: person.nationalId,
    phone: person.phone || null,
    email: person.email || null,
    municipality: person.municipality || null,
    created_by: caller.id,
  });
  if (error) {
    await admin.auth.admin.deleteUser(userId);
    throw new HttpError(400, dbMessage(error));
  }
  return { userId, nationalId: person.nationalId };
}

async function loadTarget(admin: SupabaseClient, caller: Caller, userId: string) {
  const { data: target } = await admin
    .from('profiles')
    .select('id, role, national_id, created_by')
    .eq('id', userId)
    .maybeSingle();
  if (!target) throw new HttpError(404, 'Usuario no encontrado.');
  if (caller.role !== 'admin' && target.created_by !== caller.id) {
    throw new HttpError(403, 'Solo puedes gestionar las cuentas que creaste.');
  }
  return target as { id: string; role: Role; national_id: string; created_by: string | null };
}

async function resetPassword(admin: SupabaseClient, caller: Caller, body: Body) {
  const target = await loadTarget(admin, caller, text(body.userId));
  const { error } = await admin.auth.admin.updateUserById(target.id, { password: target.national_id });
  if (error) throw new HttpError(400, `No se pudo restablecer: ${error.message}`);
  await admin.from('profiles').update({ must_change_password: true }).eq('id', target.id);
  return { ok: true };
}

async function deleteUser(admin: SupabaseClient, caller: Caller, body: Body) {
  if (caller.role !== 'admin') throw new HttpError(403, 'Solo el administrador elimina cuentas.');
  const target = await loadTarget(admin, caller, text(body.userId));
  if (target.id === caller.id) throw new HttpError(400, 'No puedes eliminar tu propio usuario.');
  // Borra el usuario de Auth; la base de datos elimina en cascada su perfil, granjas y galpones.
  const { error } = await admin.auth.admin.deleteUser(target.id);
  if (error) throw new HttpError(400, `No se pudo eliminar: ${error.message}`);
  return { ok: true };
}

// --- Entrada -------------------------------------------------------------------------------------

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.');
      const callerId = ctx.userClaims?.id;
      if (!callerId) throw new HttpError(401, 'Inicia sesión de nuevo.');
      const admin = ctx.supabaseAdmin as SupabaseClient;
      const { data: caller } = await admin.from('profiles').select('id, role').eq('id', callerId).maybeSingle();
      if (!caller || caller.role === 'client') throw new HttpError(403, 'Tu usuario no puede gestionar cuentas.');

      const body = (await req.json().catch(() => ({}))) as Body;
      switch (body.action) {
        case 'createClient':
          return json(await createClient(admin, caller as Caller, body));
        case 'createInstaller':
          return json(await createInstaller(admin, caller as Caller, body));
        case 'resetPassword':
          return json(await resetPassword(admin, caller as Caller, body));
        case 'deleteUser':
          return json(await deleteUser(admin, caller as Caller, body));
        default:
          throw new HttpError(400, 'Acción desconocida.');
      }
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error('[manage-users]', error);
      return json({ error: 'Error inesperado en el servidor.' }, 500);
    }
  }),
};
