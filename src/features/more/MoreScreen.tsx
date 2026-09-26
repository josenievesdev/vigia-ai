import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Icon, type IconName, Screen } from '@/components/ui';
import { WEATHER_ATTRIBUTION } from '@/services/weather/types';
import { Radius, Spacing, useTheme } from '@/theme';

const ITEMS: { href: Href; icon: IconName; title: string; description: string }[] = [
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
  return (
    <Screen title="Más">
      <Card style={styles.list}>
        {ITEMS.map((item, i) => (
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
          Monitoreo y automatización de granjas. Versión de demostración: el interior del galpón se simula con el clima
          y el sol reales de la ubicación.
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
