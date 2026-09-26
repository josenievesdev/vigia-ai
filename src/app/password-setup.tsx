import { ChangePasswordScreen } from '@/features/account/ChangePasswordScreen';

/** Primer ingreso: crear la contraseña propia (la inicial es la cédula). */
export default function PasswordSetupRoute() {
  return <ChangePasswordScreen mode="setup" />;
}
