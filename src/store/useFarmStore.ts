import { useStore } from 'zustand';

import { type FarmState, farmStore } from './farmStore';

/** Hook de React para leer el store con un selector. */
export function useFarmStore<T>(selector: (state: FarmState) => T): T {
  return useStore(farmStore, selector);
}
