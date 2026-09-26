import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Notice, Screen, SectionHeader, Segmented, Stepper, TextField } from '@/components/ui';
import type { FarmLocation } from '@/domain/location';
import { getSpeciesProfile } from '@/domain/profiles';
import { LocationPicker } from '@/features/settings/components/LocationPicker';
import { getSupabase } from '@/lib/supabase';
import { createAccount, toAccountError } from '@/services/account/api';
import { validateNewAccount } from '@/services/account/mapping';
import type { NewAccountInput } from '@/services/account/types';
import { type FarmConfig, hatchDateForAge, thresholdsFromProfile } from '@/services/config/farmConfig';
import { VALLEDUPAR } from '@/services/simulation/demoFarm';
import { useAuthStore } from '@/store/useAuthStore';
import { Spacing } from '@/theme';
import { formatCount, formatNationalId } from '@/utils/format';

type LightMode = 'natural' | 'extended';

const EMPTY_PERSON = { fullName: '', nationalId: '', phone: '', email: '', municipality: '' };

/**
 * Nueva cuenta, creada por el instalador (o el administrador) al terminar la instalación.
 * El cliente queda con su granja y su galpón; entra con su cédula como usuario y contraseña inicial.
 */
export function NewAccountScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const myRole = useAuthStore((s) => s.profile?.role);
  const role: NewAccountInput['role'] = params.role === 'installer' && myRole === 'admin' ? 'installer' : 'client';

  const [person, setPerson] = useState(EMPTY_PERSON);
  const [farmName, setFarmName] = useState('');
  const [location, setLocation] = useState<FarmLocation>(VALLEDUPAR);
  const [zoneName, setZoneName] = useState('Galpón 1');
  const [population, setPopulation] = useState(1000);
  const [age, setAge] = useState(20);
  const [lightMode, setLightMode] = useState<LightMode>('natural');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [created, setCreated] = useState<{ fullName: string; nationalId: string } | null>(null);

  const title = role === 'client' ? 'Nuevo cliente' : 'Nuevo instalador';
  const set = (patch: Partial<typeof EMPTY_PERSON>) => setPerson((p) => ({ ...p, ...patch }));

  const submit = () => {
    const now = Date.now();
    const farm: FarmConfig | undefined =
      role === 'client'
        ? {
            version: 1,
            farmName,
            location,
            zoneName,
            population,
            hatchDate: hatchDateForAge(age, now),
            lighting: lightMode === 'natural' ? { type: 'natural' } : { type: 'extended', startHour: 5, endHour: 21 },
            thresholds: thresholdsFromProfile(getSpeciesProfile('layingHens')),
          }
        : undefined;
    const input: NewAccountInput = { role, ...person, farm };
    const problems = validateNewAccount(input);
    setErrors(problems);
    if (problems.length) return;
    setSaving(true);
    createAccount(getSupabase(), input)
      .then((result) => setCreated({ fullName: person.fullName.trim(), nationalId: result.nationalId }))
      .catch((e: unknown) => setErrors([toAccountError(e).message]))
      .finally(() => setSaving(false));
  };

  const startOver = () => {
    setCreated(null);
    setPerson(EMPTY_PERSON);
    setFarmName('');
    setErrors([]);
  };

  if (created) {
    return (
      <Screen topInset={false}>
        <Stack.Screen options={{ title }} />
        <Notice tone="normal" text={`Cuenta creada para ${created.fullName}.`} />
        <Card style={styles.section}>
          <AppText variant="heading">Entrégale estos datos</AppText>
          <View style={styles.credential}>
            <AppText muted>Usuario</AppText>
            <AppText variant="label">{formatNationalId(created.nationalId)}</AppText>
          </View>
          <View style={styles.credential}>
            <AppText muted>Contraseña inicial</AppText>
            <AppText variant="label">La misma cédula</AppText>
          </View>
          <AppText variant="caption" muted>
            Al entrar la primera vez, la app le pedirá crear su propia contraseña: lo ideal es hacerlo juntos al
            terminar la instalación.{role === 'client' ? ' La cuenta incluye 30 días de suscripción.' : ''}
          </AppText>
        </Card>
        <Button label="Listo" onPress={() => router.back()} />
        <Button label="Crear otra cuenta" variant="secondary" onPress={startOver} />
      </Screen>
    );
  }

  return (
    <Screen topInset={false} subtitle="Usuario: la cédula. Contraseña inicial: la misma cédula.">
      <Stack.Screen options={{ title }} />
      <Card style={styles.section}>
        <SectionHeader title={role === 'client' ? 'Datos del cliente' : 'Datos del instalador'} />
        <TextField label="Nombre completo" value={person.fullName} onChangeText={(fullName) => set({ fullName })} autoCapitalize="words" />
        <TextField label="Cédula" value={person.nationalId} onChangeText={(nationalId) => set({ nationalId })} keyboardType="number-pad" maxLength={13} />
        <TextField label="Celular" value={person.phone} onChangeText={(phone) => set({ phone })} keyboardType="phone-pad" />
        <TextField
          label="Correo electrónico"
          value={person.email}
          onChangeText={(email) => set({ email })}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField label="Municipio" value={person.municipality} onChangeText={(municipality) => set({ municipality })} />
      </Card>

      {role === 'client' ? (
        <>
          <Card style={styles.section}>
            <SectionHeader title="Granja" />
            <TextField label="Nombre de la granja" value={farmName} onChangeText={setFarmName} placeholder="Ej.: Granja La Esperanza" />
            <LocationPicker value={location} onChange={setLocation} />
          </Card>

          <Card style={styles.section}>
            <SectionHeader title="Galpón" />
            <TextField label="Nombre del galpón" value={zoneName} onChangeText={setZoneName} />
            <Stepper
              label="Número de aves"
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
              Los umbrales empiezan con los recomendados para ponedoras; se ajustan después en Configuración.
            </AppText>
          </Card>
        </>
      ) : null}

      {errors.map((e) => (
        <Notice key={e} tone="critical" text={e} />
      ))}
      <Button label="Crear cuenta" icon="account-plus-outline" onPress={submit} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  credential: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
});
