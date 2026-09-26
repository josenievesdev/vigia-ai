import type { SupabaseClient } from '@supabase/supabase-js';

import type { ProductionRecord } from '@/domain/production/records';
import { toAccountError } from '@/services/account/api';
import type { Database } from '@/services/account/database.types';

import type { RecordsRepository } from './repository';

type RecordRow = Database['public']['Tables']['production_records']['Row'];

export function recordFromRow(row: RecordRow): ProductionRecord {
  return {
    zoneId: row.zone_id,
    date: row.record_date,
    eggsCollected: row.eggs_collected,
    eggsBroken: row.eggs_broken,
    eggsFloor: row.eggs_floor,
    eggsDirty: row.eggs_dirty,
    deaths: row.deaths,
    feedKg: row.feed_kg === null ? null : Number(row.feed_kg),
    notes: row.notes,
  };
}

function values(record: ProductionRecord) {
  return {
    eggs_collected: record.eggsCollected,
    eggs_broken: record.eggsBroken,
    eggs_floor: record.eggsFloor,
    eggs_dirty: record.eggsDirty,
    deaths: record.deaths,
    feed_kg: record.feedKg,
    notes: record.notes?.trim() || null,
  };
}

/**
 * Registros en Supabase. RLS decide quién los ve y los escribe (dueño al día, su instalador y el
 * administrador); al guardar, la base de datos descuenta las muertes de las aves del galpón.
 */
export function supabaseRecords(sb: SupabaseClient<Database>): RecordsRepository {
  const update = (record: ProductionRecord) =>
    sb
      .from('production_records')
      .update(values(record))
      .eq('zone_id', record.zoneId)
      .eq('record_date', record.date)
      .select();

  return {
    async list(zoneId, fromDate) {
      const { data, error } = await sb
        .from('production_records')
        .select('*')
        .eq('zone_id', zoneId)
        .gte('record_date', fromDate)
        .order('record_date');
      if (error) throw toAccountError(error, 'No se pudieron cargar los registros.');
      return data.map(recordFromRow);
    },

    // Corregir primero; si ese día no existe, crearlo. (Un upsert también intentaría cambiar
    // galpón y fecha, columnas que la base de datos no deja modificar).
    async save(record) {
      const updated = await update(record);
      if (updated.error) throw toAccountError(updated.error, 'No se pudo guardar el registro.');
      if (updated.data.length) return recordFromRow(updated.data[0]);

      const inserted = await sb
        .from('production_records')
        .insert({ zone_id: record.zoneId, record_date: record.date, ...values(record) })
        .select()
        .single();
      if (!inserted.error) return recordFromRow(inserted.data);
      if (inserted.error.code === '23505') {
        // Otra persona lo creó al mismo tiempo: se corrige el que ya existe.
        const retry = await update(record);
        if (!retry.error && retry.data.length) return recordFromRow(retry.data[0]);
      }
      throw toAccountError(inserted.error, 'No se pudo guardar el registro.');
    },

    async remove(zoneId, date) {
      const { error } = await sb.from('production_records').delete().eq('zone_id', zoneId).eq('record_date', date);
      if (error) throw toAccountError(error, 'No se pudo borrar el registro.');
    },
  };
}
