import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, Icon, SectionHeader } from '@/components/ui';
import { dateKey } from '@/domain/production/records';
import { useFarmStore } from '@/store/useFarmStore';
import { useRecordsStore } from '@/store/useRecordsStore';
import { Radius, Spacing, useTheme } from '@/theme';
import { formatCount, formatPercent } from '@/utils/format';

/** Resumen de producción del día para el inicio: lo registrado, o lo estimado si aún no se anota. */
export function ProductionCard() {
  const c = useTheme();
  const production = useFarmStore((s) => s.production);
  const records = useRecordsStore((s) => s.records);
  const today = production?.today;
  if (!today) return null;
  const todayKey = dateKey(today.day);
  const record = records.find((r) => r.date === todayKey);
  const progress = today.expectedEggs > 0 ? today.eggsSoFar / today.expectedEggs : 0;

  return (
    <Card style={styles.card}>
      <SectionHeader title="Producción de hoy" actionLabel="Ver más" href="/production" />
      <View style={styles.row}>
        <Icon name="egg-outline" size={26} color={c.primary} />
        <AppText variant="metric">{formatCount(record ? record.eggsCollected : today.eggsSoFar)}</AppText>
        <AppText variant="label" muted style={styles.flex}>
          {record ? 'huevos recogidos' : `de ~${formatCount(today.expectedEggs)} estimados`}
        </AppText>
        <Badge label={record ? 'Registrado' : 'Estimado'} tone={record ? 'normal' : 'info'} />
      </View>
      {record ? (
        <AppText variant="caption" muted>
          Postura {formatPercent(today.hens > 0 ? record.eggsCollected / today.hens : 0, 1)} · el modelo estimaba ~
          {formatCount(today.expectedEggs)}
          {record.deaths > 0 ? ` · ${record.deaths} ${record.deaths === 1 ? 'muerte' : 'muertes'}` : ''}
        </AppText>
      ) : (
        <>
          <View style={[styles.track, { backgroundColor: c.surfaceMuted }]}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: c.info }]} />
          </View>
          <Button
            label="Registrar la recolección"
            icon="clipboard-edit-outline"
            variant="secondary"
            onPress={() => router.push({ pathname: '/record', params: { date: todayKey } })}
          />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  flex: { flex: 1 },
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
});
