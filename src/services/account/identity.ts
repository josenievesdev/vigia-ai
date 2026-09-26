/**
 * Identidad por cédula. Supabase Auth trabaja con correo, así que cada usuario tiene un alias
 * interno "<cédula>@vigia.local" que nadie ve; el correo real se guarda en el perfil.
 * Debe coincidir con la Edge Function `manage-users` y con `scripts/seed-admin.mjs`.
 */
export const LOGIN_EMAIL_DOMAIN = 'vigia.local';

/** Solo los dígitos: "1.065.123.456" → "1065123456". */
export function normalizeNationalId(input: string): string {
  return input.replace(/\D/g, '');
}

export function isValidNationalId(nationalId: string): boolean {
  return /^\d{6,10}$/.test(nationalId);
}

export function loginEmailFor(nationalId: string): string {
  return `${normalizeNationalId(nationalId)}@${LOGIN_EMAIL_DOMAIN}`;
}

export const MIN_PASSWORD_LENGTH = 8;

/** Reglas de la contraseña nueva (la inicial es la cédula). Devuelve el problema o null. */
export function passwordProblem(password: string, confirm: string, nationalId: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password === nationalId) return 'La contraseña no puede ser tu cédula.';
  if (password !== confirm) return 'Las contraseñas no coinciden.';
  return null;
}
