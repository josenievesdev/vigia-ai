import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, Notice } from '@/components/ui';
import { subscriptionLabel } from '@/services/account/subscription';
import { useAuthStore } from '@/store/useAuthStore';
import { Radius, Spacing, useTheme } from '@/theme';

import { stopViewingClient } from '../session';

/**
 * Aviso de cuenta en el inicio: granja de un cliente abierta por el administrador o un instalador,
 * sin conexión, o suscripción a punto de vencer.
 */
export function AccountBanner() {
  const c = useTheme();
  const viewing = useAuthStore((s) => s.viewing);
  const offline = useAuthStore((s) => s.offline);
  const role = useAuthStore((s) => s.profile?.role);
  const subscription = useAuthStore((s) => s.subscription);

  if (viewing) {
    return (
      <Pressable
        onPress={() => void stopViewingClient()}
        accessibilityRole="button"
        accessibilityHint="Vuelve a la granja demo"
        style={[styles.root, { backgroundColor: c.infoSoft }]}>
        <Icon name="account-eye-outline" size={20} color={c.info} />
        <View style={styles.body}>
          <AppText variant="label" color={c.info}>
            Granja de {viewing.ownerName}
          </AppText>
          <AppText variant="caption" color={c.text}>
            {viewing.farmName} · Toca para salir
          </AppText>
        </View>
        <Icon name="close" size={20} color={c.info} />
      </Pressable>
    );
  }
  if (offline) return <Notice tone="warning" text="Sin conexión: se muestran los últimos datos guardados en el teléfono." />;
  if (role === 'client' && subscription?.status === 'expiring') {
    return <Notice tone="warning" text={`Suscripción: ${subscriptionLabel(subscription).toLowerCase()}. Comunícate con tu instalador para renovarla.`} />;
  }
  return null;
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md },
  body: { flex: 1 },
});
