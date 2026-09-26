import { layingHensProfile } from '@/domain/profiles/layingHens';
import { defaultConfig } from '@/services/config/farmConfig';

import { accessFor } from '../access';
import { AccountError, toAccountError } from '../api';
import { isValidNationalId, loginEmailFor, normalizeNationalId, passwordProblem } from '../identity';
import {
  configFromRows,
  type FarmRow,
  farmUpdateFromConfig,
  newAccountRequest,
  validateNewAccount,
  type ZoneRow,
  zoneUpdateFromConfig,
} from '../mapping';
import {
  blockDate,
  bogotaDate,
  extendOneMonth,
  subscriptionLabel,
  subscriptionState,
} from '../subscription';
import type { Profile } from '../types';

/** Hora de Colombia expresada en UTC (Colombia = UTC−5). */
const bogota = (iso: string) => Date.parse(`${iso}-05:00`);

const profile = (patch: Partial<Profile> = {}): Profile => ({
  id: 'u1',
  role: 'client',
  fullName: 'Ana Pérez',
  nationalId: '1065123456',
  phone: null,
  email: null,
  municipality: null,
  mustChangePassword: false,
  paidUntil: '2026-10-26',
  createdBy: 'i1',
  createdAt: '2026-09-26T00:00:00Z',
  policyAccepted: true,
  ...patch,
});

describe('identidad por cédula', () => {
  it('acepta la cédula escrita con puntos o espacios', () => {
    expect(normalizeNationalId('1.065.123.456')).toBe('1065123456');
    expect(normalizeNationalId(' 77 123 456 ')).toBe('77123456');
    expect(isValidNationalId('1065123456')).toBe(true);
    expect(isValidNationalId('12345')).toBe(false);
    expect(isValidNationalId('12345678901')).toBe(false);
  });

  it('usa un alias interno de correo que nadie ve', () => {
    expect(loginEmailFor('1.065.123.456')).toBe('1065123456@vigia.local');
  });

  it('la contraseña nueva: 8+ caracteres, distinta de la cédula y confirmada', () => {
    expect(passwordProblem('corta', 'corta', '1065123456')).toMatch(/8 caracteres/);
    expect(passwordProblem('1065123456', '1065123456', '1065123456')).toMatch(/cédula/);
    expect(passwordProblem('Gallinas2026', 'Gallinas2025', '1065123456')).toMatch(/no coinciden/);
    expect(passwordProblem('Gallinas2026', 'Gallinas2026', '1065123456')).toBeNull();
  });
});

describe('suscripción', () => {
  it('la fecha de hoy es la de Colombia, no la de UTC', () => {
    // 21:00 del 30/09 en Colombia ya es 1/10 en UTC.
    expect(bogotaDate(bogota('2026-09-30T21:00:00'))).toBe('2026-09-30');
    expect(bogotaDate(bogota('2026-10-01T00:30:00'))).toBe('2026-10-01');
  });

  it('al día, por vencer y vencida', () => {
    const now = bogota('2026-09-26T10:00:00');
    expect(subscriptionState('2026-10-26', now)).toMatchObject({ status: 'active', daysLeft: 30 });
    expect(subscriptionState('2026-09-29', now)).toMatchObject({ status: 'expiring', daysLeft: 3 });
    expect(subscriptionState('2026-09-26', now)).toMatchObject({ status: 'expiring', daysLeft: 0 });
    expect(subscriptionState('2026-09-25', now)).toMatchObject({ status: 'expired' });
    expect(subscriptionState(null, now).status).toBe('expired');
    expect(subscriptionLabel(subscriptionState('2026-09-26', now))).toBe('Vence hoy');
    expect(subscriptionLabel(subscriptionState('2026-10-26', now))).toBe('Al día hasta el 26/10/2026');
  });

  it('registrar un pago suma un mes desde la fecha vigente o desde hoy', () => {
    const now = bogota('2026-09-26T10:00:00');
    expect(extendOneMonth('2026-10-26', now)).toBe('2026-11-26');
    expect(extendOneMonth('2026-08-01', now)).toBe('2026-10-26'); // vencida: desde hoy
    expect(extendOneMonth(null, now)).toBe('2026-10-26');
    expect(extendOneMonth('2027-01-31', now)).toBe('2027-02-28'); // sin saltar a marzo
    expect(blockDate(now)).toBe('2026-09-25');
  });
});

describe('acceso según la cuenta', () => {
  const now = bogota('2026-09-26T10:00:00');
  const signedIn = (p: Profile) => ({ status: 'signedIn' as const, profile: p, subscription: subscriptionState(p.paidUntil, now) });

  it('primero se cambia la contraseña inicial, luego se revisa el pago', () => {
    expect(accessFor(signedIn(profile({ mustChangePassword: true, paidUntil: null })))).toBe('changePassword');
    expect(accessFor(signedIn(profile({ paidUntil: '2026-09-01' })))).toBe('blocked');
    expect(accessFor(signedIn(profile()))).toBe('app');
  });

  it('pide la autorización de datos a clientes e instaladores, no al administrador', () => {
    expect(accessFor(signedIn(profile({ policyAccepted: false })))).toBe('consent');
    expect(accessFor(signedIn(profile({ role: 'installer', policyAccepted: false })))).toBe('consent');
    expect(accessFor(signedIn(profile({ role: 'admin', policyAccepted: false })))).toBe('app');
    // Primero la contraseña propia; "no se sabe" (null) no bloquea.
    expect(accessFor(signedIn(profile({ mustChangePassword: true, policyAccepted: false })))).toBe('changePassword');
    expect(accessFor(signedIn(profile({ policyAccepted: null })))).toBe('app');
    // Sin autorización no se revisa todavía el pago: primero autorizar.
    expect(accessFor(signedIn(profile({ policyAccepted: false, paidUntil: '2026-09-01' })))).toBe('consent');
  });

  it('el administrador y los instaladores no dependen de la suscripción', () => {
    expect(accessFor(signedIn(profile({ role: 'installer', paidUntil: null })))).toBe('app');
    expect(accessFor(signedIn(profile({ role: 'admin', paidUntil: null })))).toBe('app');
  });

  it('demo sin cuenta, sin sesión y cargando', () => {
    expect(accessFor({ status: 'demo', profile: null, subscription: null })).toBe('app');
    expect(accessFor({ status: 'signedOut', profile: null, subscription: null })).toBe('signedOut');
    expect(accessFor({ status: 'loading', profile: null, subscription: null })).toBe('loading');
  });
});

describe('granja: filas de Supabase ↔ configuración', () => {
  const config = defaultConfig(layingHensProfile, bogota('2026-09-26T10:00:00'));
  const farmRow = (): FarmRow => ({
    id: 'f1',
    owner_id: 'u1',
    installer_id: 'i1',
    created_at: '2026-09-26T00:00:00Z',
    updated_at: '2026-09-26T00:00:00Z',
    ...(farmUpdateFromConfig(config) as Omit<FarmRow, 'id' | 'owner_id' | 'installer_id' | 'created_at' | 'updated_at'>),
  });
  const zoneRow = (): ZoneRow => ({
    id: 'z1',
    farm_id: 'f1',
    species: 'layingHens',
    created_at: '2026-09-26T00:00:00Z',
    updated_at: '2026-09-26T00:00:00Z',
    ...(zoneUpdateFromConfig(config) as Omit<ZoneRow, 'id' | 'farm_id' | 'species' | 'created_at' | 'updated_at'>),
  });

  it('ida y vuelta conserva la configuración (la fecha del lote, al día)', () => {
    const back = configFromRows(farmRow(), zoneRow(), layingHensProfile);
    expect(back.farmName).toBe(config.farmName);
    expect(back.location).toEqual(config.location);
    expect(back.population).toBe(config.population);
    expect(back.lighting).toEqual(config.lighting);
    expect(back.thresholds).toEqual(config.thresholds);
    expect(Math.abs(back.hatchDate - config.hatchDate)).toBeLessThan(24 * 3600_000);
  });

  it('umbrales incompletos o dañados usan los recomendados', () => {
    const back = configFromRows(farmRow(), { ...zoneRow(), thresholds: { ventilationOn: 30 }, lighting: 'x' }, layingHensProfile);
    expect(back.thresholds.ventilationOn).toBe(30);
    expect(back.thresholds.ventilationOff).toBe(config.thresholds.ventilationOff);
    expect(back.lighting).toEqual({ type: 'natural' });
  });

  it('arma la solicitud para crear un cliente con su granja', () => {
    const body = newAccountRequest({
      role: 'client',
      fullName: ' Ana Pérez ',
      nationalId: '1.065.123.456',
      phone: '300 123 4567',
      email: 'Ana@Correo.com ',
      municipality: 'Valledupar',
      farm: config,
    });
    expect(body).toMatchObject({ action: 'createClient', fullName: 'Ana Pérez', nationalId: '1065123456', phone: '3001234567', email: 'ana@correo.com' });
    expect((body.farm as { zone: { hatchDate: string } }).zone.hatchDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('valida el formulario en español', () => {
    const errors = validateNewAccount({ role: 'client', fullName: 'A', nationalId: '12', phone: '12', email: 'x', municipality: '' });
    expect(errors).toEqual([
      'Escribe el nombre completo.',
      'La cédula debe tener entre 6 y 10 dígitos.',
      'El celular no es válido.',
      'El correo no es válido.',
      'Faltan los datos de la granja.',
    ]);
    expect(validateNewAccount({ role: 'installer', fullName: 'Luis Gómez', nationalId: '77123456', phone: '', email: '', municipality: '' })).toEqual([]);
  });
});

describe('errores para el usuario', () => {
  it('sin conexión se reconoce y se explica', () => {
    const e = toAccountError(new TypeError('Network request failed'));
    expect(e).toBeInstanceOf(AccountError);
    expect(e.offline).toBe(true);
    expect(e.message).toMatch(/Sin conexión/);
  });

  it('demasiados intentos y errores desconocidos', () => {
    expect(toAccountError({ status: 429, message: 'rate limit' }).message).toMatch(/Demasiados intentos/);
    expect(toAccountError({ message: 'boom' }, 'No se pudo guardar.').message).toBe('No se pudo guardar.');
  });
});
