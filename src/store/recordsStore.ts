import { createStore } from 'zustand/vanilla';

import type { ProductionRecord } from '@/domain/production/records';

/** Registros diarios del galpón activo (reales o pendientes de enviar). */
export interface RecordsState {
  zoneId: string | null;
  records: ProductionRecord[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

const initialState: RecordsState = { zoneId: null, records: [], status: 'idle', error: null };

export const recordsStore = createStore<RecordsState>()(() => initialState);

const byDate = (a: ProductionRecord, b: ProductionRecord) => a.date.localeCompare(b.date);

export const recordsActions = {
  reset() {
    recordsStore.setState(initialState, true);
  },
  loading(zoneId: string) {
    const same = recordsStore.getState().zoneId === zoneId;
    recordsStore.setState({ zoneId, status: 'loading', error: null, records: same ? recordsStore.getState().records : [] });
  },
  loaded(zoneId: string, records: ProductionRecord[]) {
    recordsStore.setState({ zoneId, records: [...records].sort(byDate), status: 'ready', error: null });
  },
  /** Sin conexión: se muestra lo que haya en el teléfono. */
  failed(zoneId: string, error: string, records: ProductionRecord[]) {
    recordsStore.setState({ zoneId, records: [...records].sort(byDate), status: 'error', error });
  },
  upsert(record: ProductionRecord) {
    const { zoneId, records } = recordsStore.getState();
    if (zoneId !== record.zoneId) return;
    const rest = records.filter((r) => r.date !== record.date);
    recordsStore.setState({ records: [...rest, record].sort(byDate) });
  },
};
