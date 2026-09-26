import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, Icon, Notice, Screen, SectionHeader, TextField } from '@/components/ui';
import {
  dateKey,
  dateNoon,
  EGGS_PER_TRAY,
  eggsFromTrays,
  FEED_BAG_KG,
  type ProductionRecord,
  RECORD_DAYS_BACK,
  shiftDate,
  validateRecord,
} from '@/domain/production/records';
import { refreshFarmAfterRecord } from '@/features/account/session';
import { toAccountError } from '@/services/account/api';
import { useFarmStore } from '@/store/useFarmStore';
import { useRecordsStore } from '@/store/useRecordsStore';
import { Radius, Spacing, useTheme } from '@/theme';
import { formatCount, formatPercent, formatWeekday } from '@/utils/format';

import { saveRecord } from './records';

/**
 * Registro diario de producción de un galpón: lo que se recogió de verdad. Lo llena el galponero
 * (o el dueño) al final del día; se puede corregir hasta 7 días atrás.
 */
export function RecordScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  // Fecha real del teléfono (no la del reloj simulado, que en modo acelerado va adelantado).
  const [today] = useState(() => dateKey(Date.now()));
  const [date, setDate] = useState(() =>
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date <= today ? params.date : today,
  );
  const records = useRecordsStore((s) => s.records);
  const zoneId = useRecordsStore((s) => s.zoneId);
  const config = useFarmStore((s) => s.config);
  const production = useFarmStore((s) => s.production);

  if (!config || !zoneId) {
    return (
      <Screen topInset={false}>
        <ActivityIndicator />
      </Screen>
    );
  }

  const existing = records.find((r) => r.date === date) ?? null;
  // Las aves vivas ya descuentan las muertes de este mismo registro si se está corrigiendo.
  const hens = config.population + (existing?.deaths ?? 0);
  const estimate =
    production?.today && dateKey(production.today.day) === date
      ? production.today.expectedEggs
      : (production?.days.find((d) => dateKey(d.day) === date)?.eggs ?? null);

  return (
    <Screen topInset={false} subtitle={`${config.zoneName} · ${formatCount(config.population)} aves vivas`}>
      <DatePicker date={date} today={today} onChange={setDate} />
      {/* `key`: al cambiar de día, el formulario arranca con lo registrado ese día. */}
      <RecordForm key={date} date={date} today={today} zoneId={zoneId} existing={existing} hens={hens} estimate={estimate} />
    </Screen>
  );
}

function dayName(date: string, today: string): string {
  if (date === today) return `Hoy · ${formatWeekday(dateNoon(date))}`;
  if (date === shiftDate(today, -1)) return `Ayer · ${formatWeekday(dateNoon(date))}`;
  return formatWeekday(dateNoon(date));
}

function DatePicker({ date, today, onChange }: { date: string; today: string; onChange: (d: string) => void }) {
  const c = useTheme();
  const canBack = date > shiftDate(today, -RECORD_DAYS_BACK);
  const canForward = date < today;
  return (
    <View style={[styles.datePicker, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Pressable
        onPress={() => onChange(shiftDate(date, -1))}
        disabled={!canBack}
        accessibilityRole="button"
        accessibilityLabel="Día anterior"
        hitSlop={8}
        style={[styles.dateButton, { opacity: canBack ? 1 : 0.3 }]}>
        <Icon name="chevron-left" size={26} color={c.text} />
      </Pressable>
      <AppText variant="label" style={styles.dateLabel}>
        {dayName(date, today)}
      </AppText>
      <Pressable
        onPress={() => onChange(shiftDate(date, 1))}
        disabled={!canForward}
        accessibilityRole="button"
        accessibilityLabel="Día siguiente"
        hitSlop={8}
        style={[styles.dateButton, { opacity: canForward ? 1 : 0.3 }]}>
        <Icon name="chevron-right" size={26} color={c.text} />
      </Pressable>
    </View>
  );
}

/** "" → 0; solo dígitos → número; cualquier otra cosa → NaN (la validación lo explica). */
function parseCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

function parseBags(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

const asText = (n: number | undefined) => (n ? String(n) : '');

interface RecordFormProps {
  date: string;
  /** Fecha de hoy ("AAAA-MM-DD"), fijada al abrir la pantalla. */
  today: string;
  zoneId: string;
  existing: ProductionRecord | null;
  hens: number;
  /** Huevos que el modelo estima para ese día (con el clima del día anterior). */
  estimate: number | null;
}

function RecordForm({ date, today, zoneId, existing, hens, estimate }: RecordFormProps) {
  const c = useTheme();
  const [trays, setTrays] = useState(existing ? asText(Math.floor(existing.eggsCollected / EGGS_PER_TRAY)) : '');
  const [loose, setLoose] = useState(existing ? asText(existing.eggsCollected % EGGS_PER_TRAY) : '');
  const [broken, setBroken] = useState(asText(existing?.eggsBroken));
  const [floor, setFloor] = useState(asText(existing?.eggsFloor));
  const [dirty, setDirty] = useState(asText(existing?.eggsDirty));
  const [deaths, setDeaths] = useState(asText(existing?.deaths));
  const [bags, setBags] = useState(
    existing?.feedKg != null ? String(Math.round((existing.feedKg / FEED_BAG_KG) * 10) / 10).replace('.', ',') : '',
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const total = eggsFromTrays(parseCount(trays) || 0, parseCount(loose) || 0);
  const feedKg = parseBags(bags);
  const rate = hens > 0 ? total / hens : 0;
  const difference = estimate && total > 0 ? total / estimate - 1 : null;

  const submit = () => {
    const values = [trays, loose, broken, floor, dirty, deaths].map(parseCount);
    const record: ProductionRecord = {
      zoneId,
      date,
      eggsCollected: eggsFromTrays(values[0], values[1]),
      eggsBroken: values[2],
      eggsFloor: values[3],
      eggsDirty: values[4],
      deaths: values[5],
      feedKg: feedKg === null || Number.isNaN(feedKg) ? feedKg : Math.round(feedKg * FEED_BAG_KG * 10) / 10,
      notes: notes.trim() || null,
    };
    const problems: string[] = [];
    if (!trays.trim() && !loose.trim()) problems.push('Escribe cuántos huevos recogiste (cubetas y sueltos).');
    if (values.some(Number.isNaN)) problems.push('Usa solo números enteros en los conteos.');
    if (feedKg !== null && Number.isNaN(feedKg)) problems.push('Escribe los bultos con números, por ejemplo 3,5.');
    if (!problems.length) problems.push(...validateRecord(record, hens, today));
    setErrors(problems);
    if (problems.length) return;

    setSaving(true);
    saveRecord(record)
      .then(async (outcome) => {
        // Las muertes cambian las aves vivas del galpón: se recarga la granja con el dato nuevo.
        await refreshFarmAfterRecord(outcome.deathsDelta).catch(() => undefined);
        router.back();
      })
      .catch((e: unknown) => {
        setErrors([toAccountError(e).message]);
        setSaving(false);
      });
  };

  return (
    <>
      {existing ? (
        <Notice
          tone={existing.pending ? 'warning' : 'info'}
          text={
            existing.pending
              ? 'Este día está guardado en el teléfono y se enviará cuando haya señal. Puedes corregirlo.'
              : 'Este día ya tiene registro: al guardar lo corriges.'
          }
        />
      ) : null}

      <Card style={styles.section}>
        <SectionHeader title="Huevos recogidos" />
        <AppText variant="caption" muted>
          Cuenta todos los huevos del galpón: los del nido, los del piso, rotos y sucios.
        </AppText>
        <View style={styles.pair}>
          <View style={styles.flex}>
            <TextField label={`Cubetas (${EGGS_PER_TRAY})`} value={trays} onChangeText={setTrays} keyboardType="number-pad" placeholder="0" />
          </View>
          <View style={styles.flex}>
            <TextField label="Sueltos" value={loose} onChangeText={setLoose} keyboardType="number-pad" placeholder="0" />
          </View>
        </View>
        <View style={[styles.total, { backgroundColor: c.primarySoft }]}>
          <Icon name="egg-outline" size={22} color={c.primary} />
          <View style={styles.flex}>
            <AppText variant="label">
              Total: {formatCount(total)} huevos · postura {formatPercent(rate, 1)}
            </AppText>
            {estimate ? (
              <AppText variant="caption" muted>
                El modelo estimaba ~{formatCount(estimate)} para este día
                {difference !== null ? ` (${formatPercent(Math.abs(difference), 0)} ${difference >= 0 ? 'más' : 'menos'})` : ''}
                .
              </AppText>
            ) : null}
          </View>
        </View>
        <AppText variant="label">De esos, ¿cuántos…?</AppText>
        <View style={styles.pair}>
          <View style={styles.flex}>
            <TextField label="Rotos" value={broken} onChangeText={setBroken} keyboardType="number-pad" placeholder="0" />
          </View>
          <View style={styles.flex}>
            <TextField label="De piso" value={floor} onChangeText={setFloor} keyboardType="number-pad" placeholder="0" />
          </View>
          <View style={styles.flex}>
            <TextField label="Sucios" value={dirty} onChangeText={setDirty} keyboardType="number-pad" placeholder="0" />
          </View>
        </View>
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Aves y alimento" />
        <TextField label="Aves muertas este día" value={deaths} onChangeText={setDeaths} keyboardType="number-pad" placeholder="0" />
        <TextField
          label={`Alimento servido (bultos de ${FEED_BAG_KG} kg)`}
          value={bags}
          onChangeText={setBags}
          keyboardType="decimal-pad"
          placeholder="Opcional, p. ej. 3,5"
        />
        {feedKg !== null && !Number.isNaN(feedKg) && hens > 0 ? (
          <AppText variant="caption" muted>
            {formatCount(feedKg * FEED_BAG_KG)} kg · {Math.round((feedKg * FEED_BAG_KG * 1000) / hens)} g por ave
          </AppText>
        ) : null}
        <TextField label="Notas" value={notes} onChangeText={setNotes} placeholder="Opcional: algo raro del día" multiline maxLength={500} />
      </Card>

      {errors.map((e) => (
        <Notice key={e} tone="critical" text={e} />
      ))}
      <Button label={existing ? 'Guardar corrección' : 'Guardar registro'} icon="content-save-outline" onPress={submit} loading={saving} />
      {existing?.pending ? <Badge label="Pendiente de enviar" tone="warning" dot /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.xs,
  },
  dateButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  dateLabel: { flex: 1, textAlign: 'center' },
  section: { gap: Spacing.sm },
  pair: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
  total: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm + 2, borderRadius: Radius.md },
});
