import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Icon, type IconName } from '@/components/ui';
import type { LightingProgram } from '@/domain/lighting';
import type { DayConditions, LayingFactors } from '@/domain/production/types';
import type { ProductionProfile } from '@/domain/profiles';
import { Radius, Spacing, useTheme } from '@/theme';
import { formatCount } from '@/utils/format';

type FactorKey = keyof LayingFactors;

interface FactorInfo {
  label: string;
  icon: IconName;
  detail: (c: DayConditions, p: ProductionProfile) => string;
  advice?: (ctx: { program: LightingProgram }) => string | null;
}

const FACTORS: Record<FactorKey, FactorInfo> = {
  light: {
    label: 'Horas de luz',
    icon: 'white-balance-sunny',
    detail: (c, p) => `${c.lightHours.toFixed(1)} h de luz ayer (óptimo ${p.optimalLightHours} h)`,
    advice: ({ program }) =>
      program.type === 'natural' ? 'Un programa de luz de 16 h recuperaría estos huevos (Más → Configuración).' : null,
  },
  heat: {
    label: 'Calor',
    icon: 'thermometer-alert',
    detail: (c, p) =>
      `${Math.round(c.heatDegreeHours)} °C·h por encima de ${p.heatThreshold} °C ayer (máx. ${c.maxTemperature.toFixed(1)} °C)`,
    advice: () => 'En días así ayudan la nebulización, el sombreado del techo y agua fresca.',
  },
  water: {
    label: 'Falta de agua',
    icon: 'water-off',
    detail: (c) => `${c.waterOutageHours.toFixed(1)} h con el tanque vacío ayer`,
    advice: () => 'Revise el suministro y la capacidad del tanque.',
  },
  feed: {
    label: 'Falta de alimento',
    icon: 'grain',
    detail: (c) => `${c.feedOutageHours.toFixed(1)} h con la tolva vacía ayer`,
    advice: () => 'Revise el silo y el sinfín del alimentador.',
  },
  health: {
    label: 'Salud',
    icon: 'medical-bag',
    detail: (c) => `${c.sickHours.toFixed(1)} h de decaimiento de día sin causa ambiental`,
    advice: () => 'Conviene una revisión veterinaria.',
  },
};

interface FactorsCardProps {
  factors: LayingFactors;
  previous: DayConditions;
  hens: number;
  expectedRate: number;
  profile: ProductionProfile;
  program: LightingProgram;
}

/** Explica qué reduce la postura de hoy y cuántos huevos cuesta cada causa. */
export function FactorsCard({ factors, previous, hens, expectedRate, profile, program }: FactorsCardProps) {
  const c = useTheme();
  const rows = (Object.keys(FACTORS) as FactorKey[])
    .map((key) => ({ key, loss: 1 - factors[key] }))
    .filter((r) => r.loss >= 0.005)
    .sort((a, b) => b.loss - a.loss);

  return (
    <Card style={styles.card}>
      <AppText variant="heading">¿Qué está afectando la postura hoy?</AppText>
      <AppText variant="caption" muted>
        El huevo tarda ~25 h en formarse: la postura de hoy depende de las condiciones de ayer.
      </AppText>
      {rows.length === 0 ? (
        <View style={styles.row}>
          <Icon name="check-circle-outline" size={20} color={c.normal} />
          <AppText variant="label" style={styles.flex}>
            Sin pérdidas: las condiciones de ayer fueron buenas.
          </AppText>
        </View>
      ) : (
        rows.map(({ key, loss }) => {
          const info = FACTORS[key];
          const eggsLost = Math.round(hens * expectedRate * loss);
          const advice = info.advice?.({ program }) ?? null;
          return (
            <View key={key} style={[styles.factor, { borderColor: c.border }]}>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: c.warningSoft }]}>
                  <Icon name={info.icon} size={18} color={c.warning} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="label">
                    {info.label}: −{(loss * 100).toFixed(1)} %
                  </AppText>
                  <AppText variant="caption" muted>
                    {info.detail(previous, profile)}
                  </AppText>
                </View>
                <AppText variant="label" style={styles.lost}>
                  ≈ {formatCount(eggsLost)} huevos
                </AppText>
              </View>
              {advice ? (
                key === 'light' ? (
                  <Pressable onPress={() => router.push('/settings')} accessibilityRole="link">
                    <AppText variant="caption" color={c.primary}>
                      {advice}
                    </AppText>
                  </Pressable>
                ) : (
                  <AppText variant="caption" muted>
                    {advice}
                  </AppText>
                )
              ) : null}
            </View>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  factor: { gap: Spacing.xs + 2, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  icon: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  lost: { textAlign: 'right' },
});
