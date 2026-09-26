// Crea el primer administrador de VigíaAI con ADMIN_CEDULA y ADMIN_EMAIL de .env.
// Usuario: la cédula. Contraseña inicial: la misma cédula (la app obliga a cambiarla al entrar).
//   npm run db:seed-admin
import { createClient } from '@supabase/supabase-js';

/** Debe coincidir con LOGIN_EMAIL_DOMAIN de la app (src/services/account/identity.ts). */
const LOGIN_EMAIL_DOMAIN = 'vigia.local';

const fail = (message) => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const token = process.env.SUPABASE_ACCESS_TOKEN;
const nationalId = (process.env.ADMIN_CEDULA ?? '').replace(/\D/g, '');
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() || null;
const fullName = process.env.ADMIN_NAME?.trim() || 'Administrador';
if (!url || !token) fail('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_ACCESS_TOKEN en .env.');
if (!/^\d{6,10}$/.test(nationalId)) fail('ADMIN_CEDULA debe tener entre 6 y 10 dígitos.');

// La clave secreta se pide a la API de administración con el token de la cuenta: nunca se guarda en disco.
const ref = new URL(url).hostname.split('.')[0];
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!response.ok) fail(`No se pudieron leer las claves del proyecto (HTTP ${response.status}).`);
const keys = await response.json();
const secret = keys.find((k) => k.type === 'secret')?.api_key ?? keys.find((k) => k.name === 'service_role')?.api_key;
if (!secret) fail('El proyecto no tiene clave secreta.');

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: existing, error: lookupError } = await admin
  .from('profiles')
  .select('id, role')
  .eq('national_id', nationalId)
  .maybeSingle();
if (lookupError) fail(lookupError.message);
if (existing) {
  console.log(`Ya existe un usuario con esa cédula (rol: ${existing.role}). No se hizo nada.`);
  process.exit(0);
}

const { data, error } = await admin.auth.admin.createUser({
  email: `${nationalId}@${LOGIN_EMAIL_DOMAIN}`,
  password: nationalId,
  email_confirm: true,
  app_metadata: { role: 'admin' },
});
if (error || !data.user) fail(error?.message ?? 'No se pudo crear el usuario.');

const { error: profileError } = await admin.from('profiles').insert({
  id: data.user.id,
  role: 'admin',
  full_name: fullName,
  national_id: nationalId,
  email,
});
if (profileError) {
  await admin.auth.admin.deleteUser(data.user.id);
  fail(profileError.message);
}

console.log(`✔ Administrador creado: ${fullName}.`);
console.log('  Usuario: la cédula de ADMIN_CEDULA. Contraseña inicial: la misma cédula (se cambia al entrar).');
