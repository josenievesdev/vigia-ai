import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { AppText, Badge, Card, EmptyState, Icon, Screen, SectionHeader, Segmented, SENSOR_ICONS } from '@/components/ui';
import { SENSOR_KINDS } from '@/domain/catalog';
import { targetRange, thresholdBands } from '@/domain/status';
import type { SensorKind } from '@/domain/types';
import { AlertCard } from '@/features/alerts/components/AlertCard';
import { DecisionItem } from '@/features/automation/components/DecisionItem';
import { readingTone } from '@/features/dashboard/readingTone';
import { useFarmClock } from '@/hooks/use-farm-clock';
import { useSensorHistory } from '@/hooks/use-history';
import { computeStats, hourlySummary } from '@/services/history/analytics';
import { useReading, usePrimaryZone } from '@/store/selectors';
import { useFarmStore } from '@/store/useFarmStore';
import { Radius, Spacing, type Tone, toneColors, useTheme } from '@/theme';
import { formatReading, formatTimeShort, formatValue } from '@/utils/format';

import { BandLegend } from './components/BandLegend';
import { HourlyTable } from './components/HourlyTable';
import { StatsRow } from './components/StatsRow';

const RANGES = [
  { value: 3600_000, label: '1 h' },
  { value: 6 * 3600_000, label: '6 h' },
  { value: 24 * 3600_000, label: '24 h' },
];

const TONE_LABEL: Record<Tone, string> = {
  normal: 'Normal',
  info: 'Info',
  warning: 'Advertencia',
  critical: 'Crítico',
  offline: 'Sin conexión',
  neutral: 'Sin datos',
};

const isSensorKind = (k: string | undefined): k is SensorKind => !!k && k in SENSOR_KINDS;

export function SensorDetailScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  if (!isSensorKind(kind)) {
    return (
      <Screen topInset={false}>
        <Stack.Screen options={{ title: 'Sensor' }} />
        <EmptyState icon="help-circle-outline" title="Sensor no encontrado" />
      </Screen>
    );
  }
  return <SensorDetail kind={kind} />;
}

function SensorDetail({ kind }: { kind: SensorKind }) {
  const c = useTheme();
  const [rangeMs, setRangeMs] = useState(RANGES[1].value);
  const [showTable, setShowTable] = useState(false);
  const zone = usePrimaryZone();
  const profile = useFarmStore((s) => s.profile);
  const sensor = useFarmStore((s) => s.sensors.find((x) => x.zoneId === zone?.id && x.kind === kind));
  const alerts = useFarmStore((s) => s.alerts);
  const resolvedAlerts = useFarmStore((s) => s.resolvedAlerts);
  const decisions = useFarmStore((s) => s.decisions);
  const reading = useReading(zone?.id, kind);
  const lastSeenAt = useFarmStore((s) => (sensor ? (s.sensorStatus[sensor.id]?.lastSeenAt ?? null) : null));
  const { now, isPhotoperiod } = useFarmClock();
  const history = useSensorHistory(zone?.id, kind, rangeMs);

  const info = SENSOR_KINDS[kind];
  const header = <Stack.Screen options={{ title: info.label }} />;
  if (!profile || !zone || !sensor || now === null) {
    return (
      <Screen topInset={false}>
        {header}
        <EmptyState icon="timer-sand" title="Cargando datos…" />
      </Screen>
    );
  }

  const tone = readingTone(kind, reading, profile, { isPhotoperiod });
  const { fg, bg } = toneColors(c, tone);
  const bands = thresholdBands(kind, profile);
  const target = targetRange(kind, profile);
  const stats = computeStats(history.points, target ?? undefined);
  const fixedDomain: [number, number] | undefined =
    info.unit === '%' || info.unit === '/100' ? [0, 100] : undefined;
  const format = (v: number) => formatReading(kind, v);

  const relatedIds = new Set(history.strips.map((strip) => strip.id));
  const periodDecisions = decisions
    .filter((d) => d.timestamp >= history.from && d.commands.some((cmd) => relatedIds.has(cmd.actuatorId)))
    .slice(0, 8);
  const periodAlerts = [...alerts, ...resolvedAlerts]
    .filter((a) => a.sensorId === sensor.id && (a.status === 'active' || (a.resolvedAt ?? 0) >= history.from))
    .slice(0, 5);

  const rangeLabel = RANGES.find((r) => r.value === rangeMs)?.label ?? '';
  const summary = stats
    ? `${info.label}, últimas ${rangeLabel}: mínimo ${format(stats.min)}, promedio ${format(stats.avg)}, máximo ${format(stats.max)}.`
    : `${info.label}: sin datos en el periodo.`;

  return (
    <Screen topInset={false}>
      {header}

      <Card style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: bg }]}>
          <Icon name={SENSOR_ICONS[kind]} size={26} color={fg} />
        </View>
        <View style={styles.heroBody}>
          <View style={styles.heroValueRow}>
            <AppText style={styles.heroValue}>{reading.online ? formatValue(kind, reading.value) : '—'}</AppText>
            <AppText variant="heading" muted>
              {info.unit}
            </AppText>
          </View>
          <AppText variant="caption" muted>
            {zone.name} · {sensor.deviceId} ·{' '}
            {lastSeenAt === null ? 'sin lecturas' : `última lectura ${formatTimeShort(lastSeenAt, now)}`}
          </AppText>
        </View>
        <Badge label={TONE_LABEL[tone]} tone={tone} dot />
      </Card>

      <Segmented value={rangeMs} onChange={setRangeMs} options={RANGES} />

      <Card style={styles.section}>
        <TimeSeriesChart
          points={history.points}
          from={history.from}
          to={history.to}
          bands={bands}
          fixedDomain={fixedDomain}
          formatValue={format}
          strips={history.strips}
          accessibilityLabel={summary}
        />
        <BandLegend bands={bands} unit={info.unit} showEquipment={history.strips.length > 0} />
        <AppText variant="caption" muted>
          Mantén presionado y desliza sobre la gráfica para ver valores.
        </AppText>
      </Card>

      <StatsRow kind={kind} stats={stats} rangeLabel={target?.label ?? null} />

      <Card style={styles.section}>
        <Pressable
          onPress={() => setShowTable((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showTable }}
          style={styles.toggle}>
          <AppText variant="heading" style={styles.flex}>
            Tabla por hora
          </AppText>
          <Icon name={showTable ? 'chevron-up' : 'chevron-down'} size={22} color={c.textMuted} />
        </Pressable>
        {showTable ? <HourlyTable kind={kind} rows={hourlySummary(history.points)} now={now} /> : null}
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Eventos del periodo" />
        {periodAlerts.map((a) => (
          <AlertCard key={a.id} alert={a} now={now} compact />
        ))}
        {periodDecisions.map((d) => (
          <DecisionItem key={d.id} decision={d} now={now} />
        ))}
        {!periodAlerts.length && !periodDecisions.length ? (
          <AppText variant="caption" muted>
            Sin alertas ni acciones de equipos en este periodo.
          </AppText>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heroIcon: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  heroBody: { flex: 1, gap: 2 },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  heroValue: { fontSize: 44, lineHeight: 50, fontWeight: '700' },
  section: { gap: Spacing.md },
  toggle: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
