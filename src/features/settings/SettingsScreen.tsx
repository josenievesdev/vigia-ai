import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Icon, Screen, SectionHeader, Segmented, Stepper, TextField } from '@/components/ui';
import { getSpeciesProfile } from '@/domain/profiles';
import { applyFarmConfig } from '@/services/runtime';
import {
  type FarmConfig,
  flockAgeWeeks,
  hatchDateForAge,
  type ThresholdSettings,
  thresholdsFromProfile,
  validateConfig,
} from '@/services/config/farmConfig';
import { useFarmStore } from '@/store/useFarmStore';
import { Radius, Spacing, useTheme } from '@/theme';
import { formatCount } from '@/utils/format';

import { LocationPicker } from './components/LocationPicker';

export function SettingsScreen() {
  const config = useFarmStore((s) => s.config);
  const now = useFarmStore((s) => s.now);
  // Hora de referencia para convertir edad ↔ fecha de nacimiento, fijada al abrir. Al guardar,
  // la simulación se reinicia (`now` vuelve a null un instante) y el formulario no debe desmontarse.
  const [openedAt, setOpenedAt] = useState(now);
  if (openedAt === null && now !== null) setOpenedAt(now);

  if (!config || openedAt === null) {
    return (
      <Screen topInset={false}>
        <ActivityIndicator />
      </Screen>
    );
  }
  return <SettingsForm initial={config} now={openedAt} />;
}

type LightMode = 'natural' | 'extended';

function SettingsForm({ initial, now }: { initial: FarmConfig; now: number }) {
  const c = useTheme();
  const [draft, setDraft] = useState(initial);
  const [age, setAge] = useState(() => Math.round(flockAgeWeeks(initial, now)));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const candidate: FarmConfig = { ...draft, hatchDate: hatchDateForAge(age, now) };
  const errors = validateConfig(candidate);
  const initialAge = Math.round(flockAgeWeeks(initial, now));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || age !== initialAge;
  const t = draft.thresholds;

  const update = (patch: Partial<FarmConfig>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setStatus('idle');
  };
  const updateT = (patch: Partial<ThresholdSettings>) => update({ thresholds: { ...draft.thresholds, ...patch } });
  const lightMode: LightMode = draft.lighting.type;
  const program = draft.lighting.type === 'extended' ? draft.lighting : { startHour: 5, endHour: 21 };

  const save = () => {
    setStatus('saving');
    applyFarmConfig(candidate)
      .then(() => {
        // Lo guardado pasa a ser la nueva base del formulario (ya no hay cambios pendientes).
        setDraft(candidate);
        setStatus('saved');
      })
      .catch((error: unknown) => {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'No se pudo guardar.');
      });
  };

  return (
    <Screen topInset={false} subtitle="Los cambios se guardan en el teléfono y reinician la simulación con la nueva configuración.">
      <Card style={styles.section}>
        <SectionHeader title="Granja" />
        <TextField label="Nombre" value={draft.farmName} onChangeText={(farmName) => update({ farmName })} />
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Ubicación" />
        <AppText variant="caption" muted>
          Define el clima real (Open-Meteo) y la salida y puesta del sol.
        </AppText>
        <LocationPicker value={draft.location} onChange={(location) => update({ location })} />
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Galpón" />
        <TextField label="Nombre del galpón" value={draft.zoneName} onChangeText={(zoneName) => update({ zoneName })} />
        <Stepper
          label="Número de aves"
          hint="Aves vivas hoy; la app descuenta la mortalidad diaria"
          value={draft.population}
          onChange={(population) => update({ population: Math.round(population) })}
          step={50}
          min={50}
          max={200_000}
          format={formatCount}
        />
        <Stepper
          label="Edad del lote"
          hint="Define la curva de postura esperada"
          value={age}
          onChange={(v) => {
            setAge(Math.round(v));
            setStatus('idle');
          }}
          min={16}
          max={100}
          unit="sem"
        />
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Programa de luz" />
        <Segmented<LightMode>
          value={lightMode}
          onChange={(mode) =>
            update({ lighting: mode === 'natural' ? { type: 'natural' } : { type: 'extended', ...program } })
          }
          options={[
            { value: 'natural', label: 'Luz natural' },
            { value: 'extended', label: 'Con lámparas' },
          ]}
        />
        <AppText variant="caption" muted>
          {lightMode === 'natural'
            ? 'Las aves duermen al oscurecer. Menos consumo eléctrico, pero menor postura (~12 h de luz en el trópico).'
            : 'Las lámparas completan la luz que falta dentro del horario. Más postura; más consumo eléctrico.'}
        </AppText>
        {draft.lighting.type === 'extended' ? (
          <>
            <Stepper
              label="Encender desde"
              value={program.startHour}
              onChange={(startHour) => update({ lighting: { type: 'extended', startHour, endHour: program.endHour } })}
              min={0}
              max={12}
              unit="h"
            />
            <Stepper
              label="Apagar a las"
              value={program.endHour}
              onChange={(endHour) => update({ lighting: { type: 'extended', startHour: program.startHour, endHour } })}
              min={12}
              max={24}
              unit="h"
            />
          </>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Ventilación y temperatura" />
        <Stepper label="Encender ventilación a" value={t.ventilationOn} onChange={(v) => updateT({ ventilationOn: v })} min={18} max={40} step={0.5} precision={1} unit="°C" />
        <Stepper label="Apagar ventilación a" value={t.ventilationOff} onChange={(v) => updateT({ ventilationOff: v })} min={15} max={38} step={0.5} precision={1} unit="°C" />
        <Stepper label="Alerta de calor (advertencia)" value={t.tempWarning} onChange={(v) => updateT({ tempWarning: v })} min={20} max={42} step={0.5} precision={1} unit="°C" />
        <Stepper label="Alerta de calor (crítica)" value={t.tempCritical} onChange={(v) => updateT({ tempCritical: v })} min={22} max={45} step={0.5} precision={1} unit="°C" />
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Agua" />
        <Stepper label="Bomba enciende bajo" value={t.pumpOn} onChange={(v) => updateT({ pumpOn: v })} min={5} max={90} step={5} unit="%" />
        <Stepper label="Bomba se detiene en" value={t.pumpOff} onChange={(v) => updateT({ pumpOff: v })} min={20} max={100} step={5} unit="%" />
        <Stepper label="Alerta (advertencia) bajo" value={t.waterWarning} onChange={(v) => updateT({ waterWarning: v })} min={5} max={60} step={5} unit="%" />
        <Stepper label="Alerta (crítica) bajo" value={t.waterCritical} onChange={(v) => updateT({ waterCritical: v })} min={0} max={50} step={5} unit="%" />
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Alimento" />
        <Stepper label="Alimentador enciende bajo" value={t.feederOn} onChange={(v) => updateT({ feederOn: v })} min={5} max={90} step={5} unit="%" />
        <Stepper label="Alimentador se detiene en" value={t.feederOff} onChange={(v) => updateT({ feederOff: v })} min={20} max={100} step={5} unit="%" />
        <Stepper label="Alerta (advertencia) bajo" value={t.feedWarning} onChange={(v) => updateT({ feedWarning: v })} min={5} max={60} step={5} unit="%" />
        <Stepper label="Alerta (crítica) bajo" value={t.feedCritical} onChange={(v) => updateT({ feedCritical: v })} min={0} max={50} step={5} unit="%" />
        <Pressable
          onPress={() => updateT(thresholdsFromProfile(getSpeciesProfile('layingHens')))}
          accessibilityRole="button"
          style={styles.link}>
          <Icon name="restore" size={16} color={c.primary} />
          <AppText variant="caption" color={c.primary}>
            Restaurar umbrales recomendados para ponedoras
          </AppText>
        </Pressable>
      </Card>

      {errors.length ? (
        <Card style={[styles.section, { borderColor: c.critical }]}>
          {errors.map((e) => (
            <View key={e} style={styles.errorRow}>
              <Icon name="alert-circle-outline" size={16} color={c.critical} />
              <AppText variant="caption" color={c.critical} style={styles.flex}>
                {e}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      <Pressable
        onPress={save}
        disabled={!dirty || errors.length > 0 || status === 'saving'}
        accessibilityRole="button"
        style={[styles.primary, { backgroundColor: c.primary, opacity: !dirty || errors.length > 0 ? 0.45 : 1 }]}>
        {status === 'saving' ? (
          <ActivityIndicator color={c.textInverse} />
        ) : (
          <AppText variant="label" color={c.textInverse}>
            Guardar y aplicar
          </AppText>
        )}
      </Pressable>
      {status === 'saved' ? (
        <AppText variant="caption" color={c.normal} style={styles.center}>
          Configuración guardada y aplicada.
        </AppText>
      ) : null}
      {status === 'error' ? (
        <AppText variant="caption" color={c.critical} style={styles.center}>
          {message}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  flex: { flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, paddingTop: Spacing.xs },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
  primary: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md },
  center: { textAlign: 'center' },
});
