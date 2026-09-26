/**
 * Registro diario de producción (el dato real) y su comparación con el modelo (lo esperado).
 * El modelo ya no es "el dato": sirve de referencia para detectar a tiempo cuando la postura real
 * cae sin que el clima lo explique. Módulo puro, con pruebas.
 */

/** Huevos por cubeta (panal) en Colombia. */
export const EGGS_PER_TRAY = 30;
/** Un bulto de alimento balanceado (kg). */
export const FEED_BAG_KG = 40;
/** Días hacia atrás que se pueden registrar o corregir. */
export const RECORD_DAYS_BACK = 7;

/** Lo que se recogió un día en un galpón. Fecha "AAAA-MM-DD" en la hora local de la granja. */
export interface ProductionRecord {
  zoneId: string;
  date: string;
  /** Todos los huevos recogidos (cubetas + sueltos), incluidos rotos, de piso y sucios. */
  eggsCollected: number;
  eggsBroken: number;
  eggsFloor: number;
  eggsDirty: number;
  deaths: number;
  /** Alimento servido en el día (kg); opcional. */
  feedKg: number | null;
  notes: string | null;
  /** Guardado en el teléfono, pendiente de enviar al servidor (sin señal). */
  pending?: boolean;
}

/** "AAAA-MM-DD" de un instante en la hora local (la del teléfono = la de la granja). */
export function dateKey(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Instante del mediodía local de una fecha "AAAA-MM-DD" (para formatearla sin saltos de zona). */
export function dateNoon(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

/** Fecha desplazada `days` días ("AAAA-MM-DD"). */
export function shiftDate(date: string, days: number): string {
  const t = new Date(dateNoon(date));
  t.setDate(t.getDate() + days);
  return dateKey(t.getTime());
}

export function eggsFromTrays(trays: number, loose: number): number {
  return Math.max(0, Math.round(trays)) * EGGS_PER_TRAY + Math.max(0, Math.round(loose));
}

/** Errores del registro, en español. `hens`: aves vivas del galpón; `today`: fecha de hoy. */
export function validateRecord(record: ProductionRecord, hens: number, today: string): string[] {
  const errors: string[] = [];
  const counts = [record.eggsCollected, record.eggsBroken, record.eggsFloor, record.eggsDirty, record.deaths];
  if (counts.some((n) => !Number.isInteger(n) || n < 0)) errors.push('Usa solo números enteros, sin signos.');
  if (record.date > today) errors.push('No se puede registrar un día que aún no llega.');
  if (record.date < shiftDate(today, -RECORD_DAYS_BACK)) {
    errors.push(`Solo se pueden registrar los últimos ${RECORD_DAYS_BACK} días.`);
  }
  if (record.eggsBroken + record.eggsFloor + record.eggsDirty > record.eggsCollected) {
    errors.push('Rotos, de piso y sucios no pueden sumar más que el total recogido.');
  }
  // Una gallina pone como máximo un huevo al día.
  if (hens > 0 && record.eggsCollected > hens * 1.05) {
    errors.push(`Hay más huevos (${record.eggsCollected}) que gallinas (${hens}): revisa el conteo.`);
  }
  if (record.deaths > hens) errors.push('Las muertes no pueden ser más que las aves del galpón.');
  if (record.feedKg !== null && (!Number.isFinite(record.feedKg) || record.feedKg < 0)) {
    errors.push('El alimento debe ser un número positivo.');
  } else if (record.feedKg !== null && hens > 0 && record.feedKg > hens * 0.3) {
    errors.push('El alimento parece demasiado (más de 300 g por ave): revisa los bultos.');
  }
  if ((record.notes?.length ?? 0) > 500) errors.push('Las notas no pueden pasar de 500 caracteres.');
  return errors;
}

/** Estimado del modelo para un día (huevos del día completo y aves de ese día). */
export interface DailyEstimate {
  date: string;
  eggs: number;
  hens: number;
}

export interface DayComparison {
  date: string;
  record: ProductionRecord | null;
  estimatedEggs: number;
  hens: number;
  /** Postura real (huevos recogidos / aves), si hay registro. */
  realRate: number | null;
  estimatedRate: number;
  /** real / estimado − 1 (por ejemplo −0,05 = 5 % por debajo). null sin registro. */
  deviation: number | null;
}

export function compareDays(estimates: DailyEstimate[], records: ProductionRecord[]): DayComparison[] {
  const byDate = new Map(records.map((r) => [r.date, r]));
  return estimates.map((e) => {
    const record = byDate.get(e.date) ?? null;
    return {
      date: e.date,
      record,
      estimatedEggs: e.eggs,
      hens: e.hens,
      realRate: record && e.hens > 0 ? record.eggsCollected / e.hens : null,
      estimatedRate: e.hens > 0 ? e.eggs / e.hens : 0,
      deviation: record && e.eggs > 0 ? record.eggsCollected / e.eggs - 1 : null,
    };
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const MIN_CALIBRATION_DAYS = 5;

/**
 * Ajuste del modelo a la granja: con al menos 5 días registrados, la mediana de real/estimado de
 * los últimos 14 (acotada entre ×0,6 y ×1,3). Corrige lo que el modelo no sabe (raza, galpón).
 */
export function calibration(comparisons: DayComparison[]): { factor: number; days: number } | null {
  const ratios = comparisons
    .filter((c) => c.deviation !== null)
    .slice(-14)
    .map((c) => 1 + (c.deviation as number));
  if (ratios.length < MIN_CALIBRATION_DAYS) return null;
  return { factor: Math.min(1.3, Math.max(0.6, median(ratios))), days: ratios.length };
}

/** Caída que dispara el aviso: por debajo de lo normal de la granja en más de este porcentaje. */
export const DROP_THRESHOLD = 0.08;

/**
 * Caída de postura: los dos últimos días registrados (el último de hoy o de ayer), ambos más de
 * un 8 % por debajo de lo esperado para esta granja. Lo esperado ya incluye el calor y la luz de
 * cada día, así que la caída es algo que el clima no explica (salud, agua, alimento, nidos…).
 */
export function layingDrop(comparisons: DayComparison[], today: string): { days: number; deviation: number } | null {
  const recorded = comparisons.filter((c) => c.deviation !== null);
  const recent = recorded.slice(-2);
  if (recent.length < 2 || recent[1].date < shiftDate(today, -1)) return null;
  // Lo "normal" de la granja se mide sin los días que se evalúan.
  const factor = calibration(recorded.slice(0, -2))?.factor ?? 1;
  const deviations = recent.map((c) => (1 + (c.deviation as number)) / factor - 1);
  if (!deviations.every((d) => d < -DROP_THRESHOLD)) return null;
  return { days: recent.length, deviation: (deviations[0] + deviations[1]) / 2 };
}
