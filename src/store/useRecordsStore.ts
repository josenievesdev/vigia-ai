import { useStore } from 'zustand';

import { type RecordsState, recordsStore } from './recordsStore';

/** Hook de React para leer los registros diarios con un selector. */
export function useRecordsStore<T>(selector: (state: RecordsState) => T): T {
  return useStore(recordsStore, selector);
}
