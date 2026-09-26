import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { AppText, Badge, Button, Card, Icon, Notice, Screen, SectionHeader } from '@/components/ui';
import { NATURAL_LIGHT } from '@/domain/lighting';
import { formatLocation } from '@/domain/location';
import {
  calibration,
  compareDays,
  type DailyEstimate,
  dateKey,
  dateNoon,
  layingDrop,
  MIN_CALIBRATION_DAYS,
} from '@/domain/production/records';
import { ZoneSwitcher } from '@/features/zones/ZoneSwitcher';
import { useFarmStore } from '@/store/useFarmStore';
import { useRecordsStore } from '@/store/useRecordsStore';
import { Radius, Spacing, useTheme } from '@/theme';
import { formatCount, formatDayMonth, formatPercent } from '@/utils/format';

import { FactorsCard } from './components/FactorsCard';
import { ProductionTable } from './components/ProductionTable';
import { loadRecords } from './records';

const DAY_MS = 86_400_000;

/**
 * Producción del galpón activo. Lo registrado por la granja es el dato; el modelo (con el clima
 * real) es la referencia: sirve para ver si la postura está donde debería y avisar cuando cae
 * sin que el clima lo explique.
 */
export function ProductionScreen() {
  const c = useTheme();
  const production = useFarmStore((s) => s.production);
  const profile = useFarmStore((s) => s.profile);
  const farm = useFarmStore((s) => s.farm);
  const records = useRecordsStore((s) => s.records);
  const recordsStatus = useRecordsStore((s) => s.status);
  const zone = farm?.zones[0];

  // Al volver a esta pestaña se traen los registros que haya hecho otra persona (dueño, galponero).
  useFocusEffect(
    useCallback(() => {
      void loadRecords();
    }, []),
  );

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
  const month = days.slice(-30);
  const todayKey = dateKey(today.day);
  const estimates: DailyEstimate[] = [
    ...month.map((d) => ({ date: dateKey(d.day), eggs: d.eggs, hens: d.hens })),
    { date: todayKey, eggs: today.expectedEggs, hens: today.hens },
  ];
  const comparisons = compareDays(estimates, records);
  const todayRow = comparisons[comparisons.length - 1];
  const yesterdayRow = comparisons[comparisons.length - 2];
  const yesterdayModel = days[days.length - 1];
  const recordedDays = comparisons.filter((r) => r.record).length;
  const fit = calibration(comparisons);
  const drop = layingDrop(comparisons, todayKey);

  const recorded30 = comparisons.filter((r) => r.record);
  const deaths30 = recorded30.length
    ? recorded30.reduce((sum, r) => sum + (r.record?.deaths ?? 0), 0)
    : month.reduce((sum, d) => sum + d.mortality, 0);
  const week = days.slice(-7);
  const conversion7 =
    week.reduce((sum, d) => sum + d.feedKg, 0) / Math.max(0.001, week.reduce((sum, d) => sum + (d.eggs * d.eggWeight) / 1000, 0));
  const yesterdayFeed = yesterdayRow?.record?.feedKg;

  const bars = comparisons.map((r) => ({
    key: r.date,
    label: formatDayMonth(dateNoon(r.date)),
    value: r.record ? r.record.eggsCollected : r.date === todayKey ? today.eggsSoFar : r.estimatedEggs,
    partial: !r.record,
  }));
  const ratePoints = month.map((d) => ({ t: d.day + DAY_MS / 2, v: d.layingRate * 100 }));
  const expectedPct = today.expectedRate * 100;

  return (
    <Screen
      title="Producción"
      subtitle={`${formatLocation(farm.location)} · ${zone.name} · ${formatCount(today.hens)} gallinas · ${Math.round(today.ageWeeks)} semanas`}>
      <ZoneSwitcher />

      <Card style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: c.primarySoft }]}>
            <Icon name="egg-outline" size={28} color={c.primary} />
          </View>
          <View style={styles.flex}>
            <View style={styles.heroTitle}>
              <AppText variant="caption" muted>
                HOY
              </AppText>
              <Badge
                label={todayRow.record ? (todayRow.record.pending ? 'Registrado · sin enviar' : 'Registrado') : 'Estimado'}
                tone={todayRow.record ? 'normal' : 'info'}
              />
            </View>
            <View style={styles.heroValue}>
              <AppText style={styles.heroNumber}>
                {formatCount(todayRow.record ? todayRow.record.eggsCollected : today.eggsSoFar)}
              </AppText>
              <AppText variant="label" muted>
                {todayRow.record ? 'huevos recogidos' : `de ~${formatCount(today.expectedEggs)} estimados`}
              </AppText>
            </View>
          </View>
        </View>
        <AppText variant="caption" muted>
          {todayRow.record
            ? `Postura ${formatPercent(todayRow.realRate ?? 0, 1)} · el modelo estimaba ~${formatCount(today.expectedEggs)}${todayRow.deviation !== null ? ` (${todayRow.deviation >= 0 ? '+' : '−'}${formatPercent(Math.abs(todayRow.deviation), 0)})` : ''}.`
            : `Estimado por el modelo con el clima de ayer: postura ${formatPercent(today.projectedRate, 1)} (por edad, ${formatPercent(today.expectedRate, 1)}). La mayoría se pone en la mañana.`}
        </AppText>
        <Button
          label={todayRow.record ? 'Corregir el registro de hoy' : 'Registrar la recolección de hoy'}
          icon={todayRow.record ? 'pencil-outline' : 'clipboard-edit-outline'}
          variant={todayRow.record ? 'secondary' : 'primary'}
          onPress={() => router.push({ pathname: '/record', params: { date: todayKey } })}
        />
        {!yesterdayRow?.record ? (
          <AppText
            variant="caption"
            color={c.primary}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/record', params: { date: yesterdayRow.date } })}>
            ¿Falta el registro de ayer? Anotarlo
          </AppText>
        ) : null}
      </Card>

      {drop ? (
        <Notice
          tone="warning"
          text={`La postura registrada lleva ${drop.days} días un ${formatPercent(Math.abs(drop.deviation), 0)} por debajo de lo normal de tu granja, y el clima no lo explica. Revisa agua, alimento, salud de las aves y nidos.`}
        />
      ) : null}
      {recordsStatus === 'error' ? (
        <Notice tone="warning" text="Sin conexión: se muestran los registros guardados en este teléfono." />
      ) : null}

      <View style={styles.kpis}>
        <Kpi
          label="Postura ayer"
          value={yesterdayRow?.realRate != null ? formatPercent(yesterdayRow.realRate, 1) : yesterdayModel ? formatPercent(yesterdayModel.layingRate, 1) : '—'}
          hint={yesterdayRow?.record ? `registrada · ${formatCount(yesterdayRow.record.eggsCollected)} huevos` : 'estimada'}
        />
        <Kpi
          label="Muertes 30 días"
          value={String(deaths30)}
          hint={
            recorded30.length
              ? `registradas en ${recorded30.length} ${recorded30.length === 1 ? 'día' : 'días'}`
              : 'estimadas'
          }
        />
        <Kpi
          label="Alimento ayer"
          value={
            yesterdayFeed != null && yesterdayRow.hens > 0
              ? `${Math.round((yesterdayFeed * 1000) / yesterdayRow.hens)} g`
              : yesterdayModel
                ? `${Math.round(yesterdayModel.feedPerBird)} g`
                : '—'
          }
          hint={yesterdayFeed != null ? 'por ave · registrado' : 'por ave · estimado'}
        />
        <Kpi label="Conversión 7 días" value={conversion7.toFixed(2)} hint="estimada · kg alimento / kg huevo" />
      </View>

      <Card style={styles.section}>
        <SectionHeader title="Registrado frente a estimado" />
        <AppText variant="caption" muted>
          {fit
            ? `Con ${fit.days} días registrados, tu granja rinde el ${formatPercent(fit.factor, 0)} de lo que estima el modelo. Los avisos de caída se miden contra ese nivel.`
            : `Registra al menos ${MIN_CALIBRATION_DAYS} días para ajustar el modelo a tu granja (llevas ${recordedDays}). Así lo esperado se parece más a tu lote.`}
        </AppText>
        <ProductionTable rows={comparisons.slice(-7)} />
      </Card>

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
          accessibilityLabel={`Huevos por día, últimos ${bars.length} días: ${recordedDays} registrados y el resto estimados.`}
        />
        <AppText variant="caption" muted>
          Barras sólidas: lo registrado. Barras claras: estimado por el modelo (días sin registro, y hoy hasta ahora).
          Mantén presionado para ver cada día.
        </AppText>
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Postura estimada (%)" />
        {ratePoints.length > 1 ? (
          <TimeSeriesChart
            points={ratePoints}
            from={ratePoints[0].t - DAY_MS / 2}
            to={ratePoints[ratePoints.length - 1].t + DAY_MS / 2}
            formatValue={(v) => `${v.toFixed(1)} %`}
            formatTime={formatDayMonth}
            reference={{ value: expectedPct, label: `Esperada por edad ${expectedPct.toFixed(0)} %` }}
            plotHeight={150}
            accessibilityLabel={`Postura estimada de los últimos ${month.length} días frente a la esperada por edad (${expectedPct.toFixed(0)} %).`}
          />
        ) : null}
      </Card>

      <AppText variant="caption" muted style={styles.note}>
        Registrado: lo que anotó la granja. Estimado: modelo con el clima real de {farm.location.name} (Open-Meteo) y las
        condiciones del galpón (simulado mientras no haya sensores). Curvas de referencia de ponedoras comerciales.
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
  heroTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  heroValue: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, flexWrap: 'wrap' },
  heroNumber: { fontSize: 40, lineHeight: 46, fontWeight: '700' },
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
