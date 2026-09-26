/**
 * Prueba de integración contra el Supabase real, con el mismo código que usa la app (api.ts).
 * Corre con jest.live.config.js (entorno Node, con `fetch` real).
 * Crea usuarios temporales (cédulas 9100000xx) y los borra al final. No corre con `npm test`:
 *   npm run test:live      (necesita .env con EXPO_PUBLIC_SUPABASE_* y SUPABASE_ACCESS_TOKEN)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { layingHensProfile } from '@/domain/profiles/layingHens';
import { defaultConfig } from '@/services/config/farmConfig';

import * as api from '../api';
import type { Database } from '../database.types';
import { loginEmailFor } from '../identity';
import { blockDate, extendOneMonth } from '../subscription';

type Supabase = SupabaseClient<Database>;

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const token = process.env.SUPABASE_ACCESS_TOKEN ?? '';

const ADMIN = '910000001';
const CLIENT = '910000002';
const INSTALLER = '910000003';
const OTHER_CLIENT = '910000004';
const newClient = (): Supabase => createClient<Database>(url, publishableKey, { auth: { persistSession: false } });

jest.setTimeout(90_000);

describe('Supabase en vivo: cuentas, granja y suscripción', () => {
  let root: Supabase;
  let admin: Supabase;
  let adminId = '';
  let clientId = '';

  beforeAll(async () => {
    if (!url || !publishableKey || !token) throw new Error('Faltan variables en .env (ver .env.example).');
    const ref = new URL(url).hostname.split('.')[0];
    const keys = (await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json())) as { type: string; api_key: string }[];
    const secret = keys.find((k) => k.type === 'secret')?.api_key ?? '';
    root = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

    // Restos de una corrida interrumpida.
    const { data: stale } = await root
      .from('profiles')
      .select('id')
      .in('national_id', [ADMIN, CLIENT, INSTALLER, OTHER_CLIENT]);
    for (const s of stale ?? []) await root.auth.admin.deleteUser(s.id);

    const { data, error } = await root.auth.admin.createUser({ email: loginEmailFor(ADMIN), password: ADMIN, email_confirm: true });
    if (error) throw error;
    adminId = data.user.id;
    await root.from('profiles').insert({
      id: adminId,
      role: 'admin',
      full_name: 'Admin de Prueba',
      national_id: ADMIN,
      must_change_password: false,
    });
    admin = newClient();
    await api.signInWithNationalId(admin, ADMIN, ADMIN);
  });

  afterAll(async () => {
    const { data: temporary } = await root
      .from('profiles')
      .select('id')
      .in('national_id', [CLIENT, INSTALLER, OTHER_CLIENT, ADMIN]);
    for (const t of temporary ?? []) await root.auth.admin.deleteUser(t.id).catch(() => undefined);
  });

  it('el administrador crea un cliente con su granja y lo ve en la lista', async () => {
    const created = await api.createAccount(admin, {
      role: 'client',
      fullName: 'Cliente de Prueba',
      nationalId: CLIENT,
      phone: '300 000 0000',
      email: 'prueba@correo.com',
      municipality: 'Valledupar',
      farm: { ...defaultConfig(layingHensProfile), farmName: 'Granja de Prueba' },
    });
    clientId = created.userId;
    expect(created.farmId).toBeTruthy();

    const list = await api.listAccounts(admin, 'client');
    const row = list.find((a) => a.id === clientId);
    expect(row?.farms[0]?.name).toBe('Granja de Prueba');
    expect(row?.mustChangePassword).toBe(true);
    expect((await api.fetchAccount(admin, clientId))?.nationalId).toBe(CLIENT);
  });

  it('el cliente entra con su cédula, cambia la contraseña y ve su granja', async () => {
    const client = newClient();
    await expect(api.signInWithNationalId(client, CLIENT, 'equivocada')).rejects.toThrow('Cédula o contraseña incorrecta.');
    await api.signInWithNationalId(client, CLIENT, CLIENT);
    expect((await api.fetchProfile(client, clientId))?.mustChangePassword).toBe(true);

    await api.changePassword(client, 'PruebaSegura2026');
    expect((await api.fetchProfile(client, clientId))?.mustChangePassword).toBe(false);

    const farm = await api.fetchFarmOf(client, clientId, layingHensProfile);
    expect(farm?.config.farmName).toBe('Granja de Prueba');
    await api.saveRemoteFarm(client, farm!, { ...farm!.config, population: 900 });
    expect((await api.fetchFarmOf(client, clientId, layingHensProfile))?.config.population).toBe(900);
    expect((await api.installerContact(client))?.fullName).toBe('Admin de Prueba');
  });

  it('sin pago la base de datos bloquea la granja; con pago vuelve', async () => {
    const client = newClient();
    await api.signInWithNationalId(client, CLIENT, 'PruebaSegura2026');
    await api.setPaidUntil(admin, clientId, blockDate(Date.now()));
    expect(await api.fetchFarmOf(client, clientId, layingHensProfile)).toBeNull();

    await api.setPaidUntil(admin, clientId, extendOneMonth(null, Date.now()));
    expect(await api.fetchFarmOf(client, clientId, layingHensProfile)).not.toBeNull();
    await expect(api.setPaidUntil(client, clientId, '2099-01-01')).rejects.toThrow();
  });

  it('restablecer devuelve la contraseña a la cédula; eliminar borra todo', async () => {
    await api.resetPassword(admin, clientId);
    const client = newClient();
    await api.signInWithNationalId(client, CLIENT, CLIENT);
    expect((await api.fetchProfile(client, clientId))?.mustChangePassword).toBe(true);

    await api.deleteAccount(admin, clientId);
    clientId = '';
    const { data } = await root.from('farms').select('id').eq('name', 'Granja de Prueba');
    expect(data).toEqual([]);
  });

  it('el instalador solo gestiona los clientes que él creó', async () => {
    const farm = { ...defaultConfig(layingHensProfile), farmName: 'Granja del Admin' };
    await api.createAccount(admin, { role: 'installer', fullName: 'Instalador de Prueba', nationalId: INSTALLER, phone: '', email: '', municipality: '' });
    const other = await api.createAccount(admin, { role: 'client', fullName: 'Cliente del Admin', nationalId: OTHER_CLIENT, phone: '', email: '', municipality: '', farm });

    const installer = newClient();
    await api.signInWithNationalId(installer, INSTALLER, INSTALLER);
    const mine = await api.createAccount(installer, {
      role: 'client',
      fullName: 'Cliente del Instalador',
      nationalId: CLIENT,
      phone: '',
      email: '',
      municipality: '',
      farm: { ...farm, farmName: 'Granja del Instalador' },
    });
    const visible = await api.listAccounts(installer, 'client');
    expect(visible.map((a) => a.nationalId)).toEqual([CLIENT]);
    expect(await api.fetchFarmOf(installer, other.userId, layingHensProfile)).toBeNull();

    await expect(
      api.createAccount(installer, { role: 'installer', fullName: 'Otro Instalador', nationalId: '910000005', phone: '', email: '', municipality: '' }),
    ).rejects.toThrow('Solo el administrador crea instaladores.');
    await expect(api.resetPassword(installer, other.userId)).rejects.toThrow('Solo puedes gestionar las cuentas que creaste.');
    await expect(api.deleteAccount(installer, mine.userId)).rejects.toThrow('Solo el administrador elimina cuentas.');
    await expect(api.setPaidUntil(installer, mine.userId, '2099-01-01')).rejects.toThrow();
  });

  it('sin sesión no se ve nada y nadie puede registrarse solo', async () => {
    const anonymous = newClient();
    const { data } = await anonymous.from('profiles').select('id');
    expect(data ?? []).toEqual([]);
    const { error } = await anonymous.auth.signUp({ email: 'intruso@correo.com', password: 'Intruso2026' });
    expect(error?.message).toMatch(/not allowed/i);
  });
});
