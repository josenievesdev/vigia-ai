import type { ProductionRecord } from '@/domain/production/records';

/** Dónde se guardan los registros diarios: Supabase (granja real) o el teléfono (demo). */
export interface RecordsRepository {
  /** Registros de un galpón desde `fromDate` ("AAAA-MM-DD"), del más antiguo al más nuevo. */
  list(zoneId: string, fromDate: string): Promise<ProductionRecord[]>;
  /** Crea o corrige el registro de ese galpón y esa fecha. */
  save(record: ProductionRecord): Promise<ProductionRecord>;
  remove(zoneId: string, date: string): Promise<void>;
}
