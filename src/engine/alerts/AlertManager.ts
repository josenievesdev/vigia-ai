import type { Alert, HealthStatus, Severity, Timestamp } from '@/domain/types';
import { createId } from '@/utils/id';

import type { KeyedAlertSignal } from '../types';

export interface AlertReconcileOptions {
  /**
   * Tiempo (hora de la granja) que una condición debe estar ausente antes de
   * resolver la alerta. Evita alertas que se abren y cierran por ruido del sensor.
   */
  resolveAfterMs: number;
}

export const DEFAULT_ALERT_OPTIONS: AlertReconcileOptions = { resolveAfterMs: 2 * 60 * 1000 };

export interface AlertReconcileResult {
  active: Alert[];
  created: Alert[];
  resolved: Alert[];
}

/**
 * Ciclo de vida de alertas: crea, actualiza (severidad/mensaje), mantiene y
 * resuelve. Función pura: recibe las alertas activas y las señales actuales.
 */
export function reconcileAlerts(
  active: Alert[],
  signals: KeyedAlertSignal[],
  now: Timestamp,
  options: AlertReconcileOptions = DEFAULT_ALERT_OPTIONS,
): AlertReconcileResult {
  const byKey = new Map(signals.map((s) => [s.key, s]));
  const next: Alert[] = [];
  const created: Alert[] = [];
  const resolved: Alert[] = [];

  for (const alert of active) {
    const signal = byKey.get(alert.key);
    if (signal) {
      byKey.delete(alert.key);
      const changed = signal.severity !== alert.severity || signal.message !== alert.message;
      next.push({
        ...alert,
        severity: signal.severity,
        title: signal.title,
        message: signal.message,
        lastDetectedAt: now,
        updatedAt: changed ? now : alert.updatedAt,
      });
    } else if (now - alert.lastDetectedAt >= options.resolveAfterMs) {
      resolved.push({ ...alert, status: 'resolved', resolvedAt: now, updatedAt: now });
    } else {
      next.push(alert);
    }
  }

  for (const signal of byKey.values()) {
    const alert: Alert = {
      id: createId('alr'),
      key: signal.key,
      type: signal.type,
      severity: signal.severity,
      zoneId: signal.zoneId,
      sensorId: signal.sensorId,
      title: signal.title,
      message: signal.message,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastDetectedAt: now,
    };
    created.push(alert);
    next.push(alert);
  }

  return { active: next, created, resolved };
}

const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };

export function compareAlerts(a: Alert, b: Alert): number {
  return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.createdAt - a.createdAt;
}

/** Estado general derivado de las alertas activas. */
export function computeHealth(active: Alert[]): HealthStatus {
  if (active.some((a) => a.severity === 'critical')) return 'critical';
  if (active.some((a) => a.severity === 'warning')) return 'warning';
  return 'normal';
}
