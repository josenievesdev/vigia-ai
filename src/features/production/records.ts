import { dateKey, type ProductionRecord, shiftDate } from '@/domain/production/records';
import { getSupabase } from '@/lib/supabase';
import { toAccountError } from '@/services/account/api';
import { DEMO_ZONE_ID, localRecords, recordsOutbox } from '@/services/records/localRecords';
import { supabaseRecords } from '@/services/records/supabaseRecords';
import { authStore } from '@/store/authStore';
import { recordsActions, recordsStore } from '@/store/recordsStore';

/**
 * Registro diario de producción del galpón activo: en Supabase si hay una granja real abierta, o en
 * el teléfono con la granja demo. Sin señal, lo de una granja real se guarda en el teléfono y se
 * envía después (un registro por galpón y día: reenviar no duplica).
 */

/** Días de registros que se cargan (el modelo estima los últimos 30). */
const HISTORY_DAYS = 45;
const demoRecords = localRecords();

function target(): { zoneId: string; remote: boolean } {
  const farm = authStore.getState().farm;
  return farm ? { zoneId: farm.activeZoneId, remote: true } : { zoneId: DEMO_ZONE_ID, remote: false };
}

/** Galpón al que van los registros ahora (el activo, o el de la demo). */
export function activeRecordsZone(): string {
  return target().zoneId;
}

const asPending = (records: ProductionRecord[]) => records.map((r) => ({ ...r, pending: true }));

/** Lo guardado en el servidor más lo pendiente del teléfono (lo pendiente es más reciente). */
function merge(saved: ProductionRecord[], pending: ProductionRecord[]): ProductionRecord[] {
  const pendingDates = new Set(pending.map((r) => r.date));
  return [...saved.filter((r) => !pendingDates.has(r.date)), ...pending];
}

export async function loadRecords(): Promise<void> {
  const { zoneId, remote } = target();
  recordsActions.loading(zoneId);
  const from = shiftDate(dateKey(Date.now()), -HISTORY_DAYS);
  if (!remote) {
    recordsActions.loaded(zoneId, await demoRecords.list(zoneId, from));
    return;
  }
  try {
    await syncPendingRecords();
    const saved = await supabaseRecords(getSupabase()).list(zoneId, from);
    const pending = asPending(await recordsOutbox.list(zoneId, from));
    if (activeRecordsZone() === zoneId) recordsActions.loaded(zoneId, merge(saved, pending));
  } catch (error) {
    const pending = asPending(await recordsOutbox.list(zoneId, from));
    if (activeRecordsZone() === zoneId) recordsActions.failed(zoneId, toAccountError(error).message, pending);
  }
}

export interface SaveOutcome {
  /** `queued`: sin señal, quedó en el teléfono y se enviará después. */
  status: 'saved' | 'queued';
  /** Muertes nuevas frente a lo que ya había registrado ese día (cambian las aves del galpón). */
  deathsDelta: number;
}

export async function saveRecord(record: ProductionRecord): Promise<SaveOutcome> {
  const { remote } = target();
  const previous = recordsStore.getState().records.find((r) => r.date === record.date);
  const deathsDelta = record.deaths - (previous?.deaths ?? 0);
  if (!remote) {
    recordsActions.upsert(await demoRecords.save(record));
    return { status: 'saved', deathsDelta };
  }
  try {
    const saved = await supabaseRecords(getSupabase()).save(record);
    await recordsOutbox.remove(record.zoneId, record.date);
    recordsActions.upsert(saved);
    return { status: 'saved', deathsDelta };
  } catch (error) {
    const e = toAccountError(error);
    if (!e.offline) throw e;
    await recordsOutbox.save(record);
    recordsActions.upsert({ ...record, pending: true });
    // Las aves del galpón se descuentan en el servidor cuando el registro llegue.
    return { status: 'queued', deathsDelta: 0 };
  }
}

/** Envía lo que quedó pendiente en el teléfono. Devuelve cuántos registros se enviaron. */
export async function syncPendingRecords(): Promise<number> {
  const farm = authStore.getState().farm;
  if (!farm) return 0;
  const sb = getSupabase();
  let sent = 0;
  for (const zone of farm.zones) {
    for (const record of await recordsOutbox.list(zone.id, '0000-01-01')) {
      try {
        await supabaseRecords(sb).save(record);
        await recordsOutbox.remove(record.zoneId, record.date);
        sent++;
      } catch (error) {
        if (toAccountError(error).offline) return sent; // Sigue sin señal: se intenta después.
        console.warn('[VigíaAI] Registro pendiente rechazado por el servidor:', error);
      }
    }
  }
  return sent;
}
