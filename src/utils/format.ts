import { SENSOR_KINDS } from '@/domain/catalog';
import type { SensorKind, Timestamp } from '@/domain/types';

export function formatValue(kind: SensorKind, value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(SENSOR_KINDS[kind].precision);
}

export function formatReading(kind: SensorKind, value: number | undefined): string {
  if (value === undefined) return '—';
  const { unit } = SENSOR_KINDS[kind];
  const sep = unit === '%' || unit === '°C' || unit.startsWith('/') ? '' : ' ';
  return `${formatValue(kind, value)}${sep}${unit}`;
}

export function formatClock(time: Timestamp): string {
  const d = new Date(time);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Hora corta con contexto de día: "14:05", "ayer 21:00" o "12/03 08:00". */
export function formatTimeShort(time: Timestamp, now: Timestamp): string {
  const d = new Date(time);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (time >= startOfToday) return formatClock(time);
  if (time >= startOfToday - 86_400_000) return `ayer ${formatClock(time)}`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${formatClock(time)}`;
}

export function formatRelative(from: Timestamp, now: Timestamp): string {
  const minutes = Math.max(0, Math.round((now - from) / 60000));
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** "25/09" */
export function formatDayMonth(time: Timestamp): string {
  const d = new Date(time);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "jue 25/09" */
export function formatWeekday(time: Timestamp): string {
  return `${WEEKDAYS[new Date(time).getDay()]} ${formatDayMonth(time)}`;
}

/** Porcentaje entero de una fracción 0–1: "89 %". */
export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)} %`;
}

/** Número con separador de miles en español: "1.200". */
export function formatCount(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
