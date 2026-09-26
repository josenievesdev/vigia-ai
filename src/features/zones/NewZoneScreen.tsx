import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText, Button, Card, Notice, Screen, Segmented, Stepper, TextField } from '@/components/ui';
import { getSpeciesProfile } from '@/domain/profiles';
import { createZone } from '@/features/account/session';
import { toAccountError } from '@/services/account/api';
import { hatchDateForAge, thresholdsFromProfile } from '@/services/config/farmConfig';
import { useAuthStore } from '@/store/useAuthStore';
import { useFarmStore } from '@/store/useFarmStore';
import { Spacing } from '@/theme';
import { formatCount } from '@/utils/format';

type LightMode = 'natural' | 'extended';

/** Agregar un galpón a la granja abierta. Queda en pantalla al crearlo. */
export function NewZoneScreen() {
  const zones = useAuthStore((s) => s.farm?.zones.length ?? 0);
  const thresholds = useFarmStore((s) => s.config?.thresholds);
  const [name, setName] = useState(`Galpón ${zones + 1}`);
  const [population, setPopulation] = useState(1000);
  const [age, setAge] = useState(20);
  const [lightMode, setLightMode] = useState<LightMode>('natural');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) {
      setError('Escribe el nombre del galpón.');
      return;
    }
    setError(null);
    setSaving(true);
    createZone({
      name,
      population,
      hatchDate: hatchDateForAge(age, Date.now()),
      lighting: lightMode === 'natural' ? { type: 'natural' } : { type: 'extended', startHour: 5, endHour: 21 },
      // Los mismos umbrales del galpón que se estaba viendo (misma granja, mismo clima).
      thresholds: thresholds ?? thresholdsFromProfile(getSpeciesProfile('layingHens')),
    })
      .then(() => router.back())
      .catch((e: unknown) => setError(toAccountError(e).message))
      .finally(() => setSaving(false));
  };

  return (
    <Screen topInset={false} subtitle="Cada galpón tiene su lote de aves, su programa de luz y sus registros.">
      <Card style={styles.section}>
        <TextField label="Nombre del galpón" value={name} onChangeText={setName} />
        <Stepper
          label="Número de aves"
          hint="Aves vivas hoy"
          value={population}
          onChange={(v) => setPopulation(Math.round(v))}
          step={50}
          min={50}
          max={200_000}
          format={formatCount}
        />
        <Stepper label="Edad del lote" hint="Define la curva de postura esperada" value={age} onChange={(v) => setAge(Math.round(v))} min={16} max={100} unit="sem" />
        <Segmented<LightMode>
          value={lightMode}
          onChange={setLightMode}
          options={[
            { value: 'natural', label: 'Luz natural' },
            { value: 'extended', label: 'Con lámparas' },
          ]}
        />
        <AppText variant="caption" muted>
          Los umbrales de ventilación, agua y alimento se copian del galpón actual; se ajustan en Configuración.
        </AppText>
      </Card>
      {error ? <Notice tone="critical" text={error} /> : null}
      <Button label="Agregar galpón" icon="plus" onPress={submit} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
});
