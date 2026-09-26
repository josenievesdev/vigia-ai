import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ProductionRecord } from '@/domain/production/records';

import type { RecordsRepository } from './repository';

/** Galpón de la granja demo (sin cuenta), que solo existe en el teléfono. */
export const DEMO_ZONE_ID = 'demo';

async function read(key: string): Promise<ProductionRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ProductionRecord[]) : [];
  } catch {
    return [];
  }
}

const sameDay = (a: ProductionRecord, zoneId: string, date: string) => a.zoneId === zoneId && a.date === date;

/** Registros guardados en el teléfono: los de la granja demo. */
export function localRecords(key = 'vigia.records.demo.v1'): RecordsRepository {
  return {
    async list(zoneId, fromDate) {
      return (await read(key))
        .filter((r) => r.zoneId === zoneId && r.date >= fromDate)
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    async save(record) {
      const clean = { ...record, pending: undefined };
      const rest = (await read(key)).filter((r) => !sameDay(r, record.zoneId, record.date));
      await AsyncStorage.setItem(key, JSON.stringify([...rest, clean]));
      return clean;
    },
    async remove(zoneId, date) {
      const rest = (await read(key)).filter((r) => !sameDay(r, zoneId, date));
      await AsyncStorage.setItem(key, JSON.stringify(rest));
    },
  };
}

/**
 * Registros de granjas reales guardados sin señal, pendientes de enviar. Se reenvían al volver la
 * conexión; como cada día de un galpón es un solo registro, reenviar no duplica nada.
 */
export const recordsOutbox = localRecords('vigia.records.outbox.v1');
