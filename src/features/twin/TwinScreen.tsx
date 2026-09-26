import { useIsFocused } from 'expo-router';
import { lazy, Suspense, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { FlockAction } from '@/domain/behavior/types';
import { AppText, Badge, Icon } from '@/components/ui';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFarmStore } from '@/store/useFarmStore';
import { Radius, Spacing, toneColors, useTheme } from '@/theme';

import { FlockSummary } from './components/FlockSummary';
import { LocationOverlay } from './components/LocationOverlay';
import { STATUS_LABEL, TwinPanel } from './components/TwinPanel';
import { ELEMENT_FOCUS, HEN_FIGURES, VIEWS, type ViewId } from './scene/layout';
import type { TwinElementId, TwinStatus } from './twinState';
import { useTwinState } from './useTwinState';

const LEGEND: TwinStatus[] = ['normal', 'warning', 'critical', 'offline'];

/**
 * El visor 3D (three.js + expo-gl) se carga aparte: si falla en algún
 * dispositivo, la pantalla sigue funcionando con el panel de estado.
 */
const TwinViewport = lazy(() => import('./TwinViewport').then((m) => ({ default: m.TwinViewport })));

export function TwinScreen() {
  const c = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const focused = useIsFocused();
  const [view, setView] = useState<ViewId>('general');
  const [selected, setSelected] = useState<TwinElementId | null>(null);
  const [flockCounts, setFlockCounts] = useState<Record<FlockAction, number> | null>(null);
  const twin = useTwinState();
  const zone = useFarmStore((s) => s.farm?.zones[0]);

  const chooseView = (id: ViewId) => {
    setSelected(null);
    setView(id);
  };
  const goal = selected ? ELEMENT_FOCUS[selected] : VIEWS[view];
  const perFigure = zone ? Math.round(zone.population / HEN_FIGURES) : 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="title">Gemelo digital</AppText>
          <AppText muted>
            {zone?.name ?? 'Galpón'} · representación en tiempo real
          </AppText>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsBar}
        contentContainerStyle={styles.chips}>
        {(Object.keys(VIEWS) as ViewId[]).map((id) => {
          const active = !selected && view === id;
          return (
            <Pressable
              key={id}
              onPress={() => chooseView(id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : c.surface },
              ]}>
              <AppText variant="label" color={active ? c.primary : c.textMuted}>
                {VIEWS[id].label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.viewport, { borderColor: c.border }]}>
        {twin ? (
          <ErrorBoundary fallback={(error) => <ViewerUnavailable error={error} />}>
            <Suspense fallback={<Loading />}>
              <TwinViewport
                twin={twin}
                goal={goal}
                selected={selected}
                onSelect={setSelected}
                colors={c}
                scheme={scheme}
                active={focused}
                onFlockSummary={setFlockCounts}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <Loading />
        )}
        <LocationOverlay />
        <View style={[styles.overlay, styles.legend, { backgroundColor: c.surface }]}>
          {LEGEND.map((status) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: toneColors(c, status).fg }]} />
              <AppText variant="caption" muted>
                {STATUS_LABEL[status]}
              </AppText>
            </View>
          ))}
          <AppText variant="caption" muted>
            · 1 figura ≈ {perFigure} aves
          </AppText>
        </View>
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <View style={styles.hint}>
          <Icon name="gesture-tap" size={14} color={c.textMuted} />
          <AppText variant="caption" muted>
            Toca un elemento en el 3D o en la lista · arrastra para girar
          </AppText>
        </View>
        <FlockSummary counts={flockCounts} />
        {twin ? (
          <TwinPanel elements={twin.elements} selected={selected} onSelect={setSelected} />
        ) : null}
        {twin && Object.values(twin.alerts).some(Boolean) ? (
          <View style={styles.alertNote}>
            <Badge label="Hay alertas activas" tone="critical" dot />
            <AppText variant="caption" muted style={styles.flex}>
              Los elementos afectados se marcan en el 3D con un anillo o un tinte de color.
            </AppText>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator />
    </View>
  );
}

/** Respaldo si el 3D no puede ejecutarse en el dispositivo. */
function ViewerUnavailable({ error }: { error: Error }) {
  const c = useTheme();
  return (
    <View style={styles.loading}>
      <Icon name="cube-off-outline" size={36} color={c.textMuted} />
      <AppText variant="label">Vista 3D no disponible en este dispositivo</AppText>
      <AppText variant="caption" muted style={styles.center}>
        El estado de cada elemento sigue disponible en la lista de abajo.
      </AppText>
      {__DEV__ ? (
        <AppText variant="caption" color={c.critical} style={styles.center}>
          {error.message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  chipsBar: { flexGrow: 0 },
  chips: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm, alignItems: 'center' },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill, borderWidth: 1 },
  viewport: {
    flex: 1.25,
    minHeight: 260,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg },
  center: { textAlign: 'center' },
  overlay: {
    pointerEvents: 'none',
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    opacity: 0.92,
  },
  hint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
  legend: { bottom: Spacing.sm, left: Spacing.sm, right: Spacing.sm, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  panel: { flex: 1 },
  panelContent: { padding: Spacing.lg, gap: Spacing.md },
  alertNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
