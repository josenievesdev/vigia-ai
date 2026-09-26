import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { AppText, Card, Icon, Screen, SectionHeader } from '@/components/ui';
import { NATURAL_LIGHT } from '@/domain/lighting';
import { formatLocation } from '@/domain/location';
import { useFarmStore } from '@/store/useFarmStore';
import { Radius, Spacing, useTheme } from '@/theme';
import { formatCount, formatDayMonth, formatPercent } from '@/utils/format';

import { FactorsCard } from './components/FactorsCard';
import { ProductionTable } from './components/ProductionTable';

const DAY_MS = 86_400_000;

export function ProductionScreen() {
  const c = useTheme();
  const production = useFarmStore((s) => s.production);
  const profile = useFarmStore((s) => s.profile);
  const farm = useFarmStore((s) => s.farm);
  const zone = farm?.zones[0];

  if (!production?.today || !profile || !zone || !farm) {
    return (
      <Screen title="Producción">
        <View style={styles.loading}>
          <ActivityIndicator />
          <AppText muted>Calculando la producción…</AppText>
        </View>
      </Screen>
    );
  }

  const { days, today } = production;
  const last = days[days.length - 1];
  const week = days.slice(-7);
  const month = days.slice(-30);
  const deaths30 = month.reduce((sum, d) => sum + d.mortality, 0);
  const conversion7 =
    week.reduce((sum, d) => sum + d.feedKg, 0) / Math.max(0.001, week.reduce((sum, d) => sum + (d.eggs * d.eggWeight) / 1000, 0));
  const progress = today.expectedEggs > 0 ? today.eggsSoFar / today.expectedEggs : 0;

  const bars = [
    ...month.map((d) => ({ key: d.day, label: formatDayMonth(d.day), value: d.eggs })),
    { key: today.day, label: formatDayMonth(today.day), value: today.eggsSoFar, partial: true },
  ];
  const ratePoints = month.map((d) => ({ t: d.day + DAY_MS / 2, v: d.layingRate * 100 }));
  const expectedPct = today.expectedRate * 100;

  return (
    <Screen
      title="Producción"
      subtitle={`${formatLocation(farm.location)} · ${zone.name} · ${formatCount(today.hens)} gallinas · ${Math.round(today.ageWeeks)} semanas`}>
      <Card style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: c.primarySoft }]}>
            <Icon name="egg-outline" size={28} color={c.primary} />
          </View>
          <View style={styles.flex}>
            <AppText variant="caption" muted>
              HUEVOS HOY
            </AppText>
            <View style={styles.heroValue}>
              <AppText style={styles.heroNumber}>{formatCount(today.eggsSoFar)}</AppText>
              <AppText variant="label" muted>
                de ~{formatCount(today.expectedEggs)} esperados
              </AppText>
            </View>
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: c.surfaceMuted }]}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: c.primary }]} />
        </View>
        <AppText variant="caption" muted>
          Postura proyectada {formatPercent(today.projectedRate, 1)} · esperada por edad {formatPercent(today.expectedRate, 1)}.
          La mayoría se pone en la mañana.
        </AppText>
      </Card>

      <View style={styles.kpis}>
        <Kpi label="Postura ayer" value={last ? formatPercent(last.layingRate, 1) : '—'} hint={last ? `${formatCount(last.eggs)} huevos` : ''} />
        <Kpi label="Mortalidad 30 días" value={String(deaths30)} hint={formatPercent(deaths30 / Math.max(1, today.hens + deaths30), 2)} />
        <Kpi label="Alimento ayer" value={last ? `${Math.round(last.feedPerBird)} g` : '—'} hint={last ? `${Math.round(last.waterPerBird)} ml de agua/ave` : ''} />
        <Kpi label="Conversión 7 días" value={conversion7.toFixed(2)} hint="kg alimento / kg huevo" />
      </View>

      <FactorsCard
        factors={today.factors}
        previous={today.previous}
        hens={today.hens}
        expectedRate={today.expectedRate}
        profile={profile.production}
        program={zone.lighting ?? NATURAL_LIGHT}
      />

      <Card style={styles.section}>
        <SectionHeader title="Huevos por día" />
        <BarChart
          data={bars}
          formatValue={(v) => formatCount(v)}
          accessibilityLabel={`Huevos por día, últimos ${month.length} días. Ayer: ${last ? formatCount(last.eggs) : 'sin datos'}.`}
        />
        <AppText variant="caption" muted>
          La barra clara es hoy (hasta ahora). Mantén presionado para ver cada día.
        </AppText>
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Postura (%)" />
        {ratePoints.length > 1 ? (
          <TimeSeriesChart
            points={ratePoints}
            from={ratePoints[0].t - DAY_MS / 2}
            to={ratePoints[ratePoints.length - 1].t + DAY_MS / 2}
            formatValue={(v) => `${v.toFixed(1)} %`}
            formatTime={formatDayMonth}
            reference={{ value: expectedPct, label: `Esperada por edad ${expectedPct.toFixed(0)} %` }}
            plotHeight={150}
            accessibilityLabel={`Postura diaria de los últimos ${month.length} días frente a la esperada por edad (${expectedPct.toFixed(0)} %).`}
          />
        ) : null}
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Últimos 7 días" />
        <ProductionTable days={week} />
      </Card>

      <AppText variant="caption" muted style={styles.note}>
        Días anteriores estimados con el clima real de {farm.location.name} (Open-Meteo); hoy, con las condiciones del
        galpón simulado. Curvas de referencia aproximadas de ponedoras comerciales.
      </AppText>
    </Screen>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  const c = useTheme();
  return (
    <View style={[styles.kpi, { backgroundColor: c.surface, borderColor: c.border }]}>
      <AppText variant="caption" muted numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="heading">{value}</AppText>
      {hint ? (
        <AppText variant="caption" muted numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: Spacing.md, paddingTop: 120 },
  flex: { flex: 1 },
  hero: { gap: Spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heroIcon: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  heroValue: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, flexWrap: 'wrap' },
  heroNumber: { fontSize: 40, lineHeight: 46, fontWeight: '700' },
  track: { height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  kpi: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: Spacing.md,
    gap: 2,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: Spacing.md },
  note: { textAlign: 'center', paddingHorizontal: Spacing.lg },
});
