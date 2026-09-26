import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Icon, type IconName, Screen } from '@/components/ui';
import { AccountCard } from '@/features/account/components/AccountCard';
import { WEATHER_ATTRIBUTION } from '@/services/weather/types';
import { useAuthStore } from '@/store/useAuthStore';
import { Radius, Spacing, useTheme } from '@/theme';

interface Item {
  href: Href;
  icon: IconName;
  title: string;
  description: string;
}

const ACCOUNTS_ITEM: Item = {
  href: '/accounts',
  icon: 'account-group-outline',
  title: 'Clientes',
  description: 'Crear cuentas con su granja, abrir granjas de clientes y restablecer contraseñas.',
};

const ITEMS: Item[] = [
  {
    href: '/automation',
    icon: 'tune-variant',
    title: 'Control de equipos',
    description: 'Encender o apagar equipos, modo automático y registro de decisiones.',
  },
  {
    href: '/settings',
    icon: 'cog-outline',
    title: 'Configuración',
    description: 'Granja, ubicación, galpón, programa de luz y umbrales.',
  },
  {
    href: '/demo',
    icon: 'flask-outline',
    title: 'Modo demo',
    description: 'En vivo o acelerado, y escenarios para presentar la plataforma.',
  },
];

export function MoreScreen() {
  const c = useTheme();
  const role = useAuthStore((s) => s.profile?.role);
  const staff = role === 'admin' || role === 'installer';
  const items = staff
    ? [
        {
          ...ACCOUNTS_ITEM,
          title: role === 'admin' ? 'Clientes e instaladores' : 'Mis clientes',
          description: role === 'admin' ? `${ACCOUNTS_ITEM.description} Registrar pagos.` : ACCOUNTS_ITEM.description,
        },
        ...ITEMS,
      ]
    : ITEMS;

  return (
    <Screen title="Más">
      <AccountCard />
      <Card style={styles.list}>
        {items.map((item, i) => (
          <Pressable
            key={item.title}
            onPress={() => router.push(item.href)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
              pressed && { opacity: 0.7 },
            ]}>
            <View style={[styles.icon, { backgroundColor: c.primarySoft }]}>
              <Icon name={item.icon} size={22} color={c.primary} />
            </View>
            <View style={styles.body}>
              <AppText variant="label">{item.title}</AppText>
              <AppText variant="caption" muted>
                {item.description}
              </AppText>
            </View>
            <Icon name="chevron-right" size={22} color={c.textMuted} />
          </Pressable>
        ))}
      </Card>

      <Card style={styles.about}>
        <AppText variant="heading">Acerca de VigíaAI</AppText>
        <AppText variant="caption" muted>
          Monitoreo y automatización de granjas. Mientras no haya sensores instalados, el interior del galpón se simula
          con el clima y el sol reales de la ubicación.
        </AppText>
        <AppText variant="caption" muted>
          {WEATHER_ATTRIBUTION}. Uso no comercial.
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  icon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  about: { gap: Spacing.sm },
});
