import { SENSOR_KINDS } from '@/domain/catalog';
import type { Band } from '@/domain/profiles';
import { bandStatus } from '@/domain/status';
import type { AlertType, SensorKind } from '@/domain/types';
import { formatReading } from '@/utils/format';

import type { AlertSignal, Rule, ZoneContext } from '../types';

/** Tiempo sin lecturas tras el cual un sensor se considera desconectado (hora de la granja). */
export const SENSOR_STALE_MS = 5 * 60 * 1000;

function sensorIdOf(ctx: ZoneContext, kind: SensorKind): string | undefined {
  return ctx.sensors.find((s) => s.sensor.kind === kind)?.sensor.id;
}

function thresholdRule(config: {
  id: string;
  name: string;
  description: string;
  type: AlertType;
  sensor: SensorKind;
  direction: 'above' | 'below';
  band: (ctx: ZoneContext) => Band;
  title: string;
  message: (value: string, ctx: ZoneContext) => string;
  /** Condición adicional para evaluar (p. ej. solo de día). */
  when?: (ctx: ZoneContext) => boolean;
}): Rule {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    evaluate(ctx) {
      const value = ctx.readings[config.sensor];
      if (value === undefined || (config.when && !config.when(ctx))) return {};
      const severity = bandStatus(value, config.band(ctx), config.direction);
      if (severity === 'normal') return {};
      const alert: AlertSignal = {
        type: config.type,
        severity,
        sensorId: sensorIdOf(ctx, config.sensor),
        title: config.title,
        message: config.message(formatReading(config.sensor, value), ctx),
      };
      return { alerts: [alert] };
    },
  };
}

export const highTemperatureAlert = thresholdRule({
  id: 'alert.highTemperature',
  name: 'Temperatura elevada',
  description: 'Detecta estrés por calor.',
  type: 'highTemperature',
  sensor: 'temperature',
  direction: 'above',
  band: (ctx) => ctx.profile.alerts.highTemperature,
  title: 'Temperatura elevada',
  message: (v, ctx) =>
    `${v} en ${ctx.zone.name}. Riesgo de estrés por calor${ctx.actuators.ventilation?.active ? ' con la ventilación ya activa' : ''}.`,
});

export const lowTemperatureAlert = thresholdRule({
  id: 'alert.lowTemperature',
  name: 'Temperatura baja',
  description: 'Detecta frío excesivo.',
  type: 'lowTemperature',
  sensor: 'temperature',
  direction: 'below',
  band: (ctx) => ctx.profile.alerts.lowTemperature,
  title: 'Temperatura baja',
  message: (v, ctx) => `${v} en ${ctx.zone.name}. Revise cortinas y calefacción.`,
});

export const highHumidityAlert = thresholdRule({
  id: 'alert.highHumidity',
  name: 'Humedad elevada',
  description: 'Humedad que favorece amoníaco y enfermedades respiratorias.',
  type: 'highHumidity',
  sensor: 'humidity',
  direction: 'above',
  band: (ctx) => ctx.profile.alerts.highHumidity,
  title: 'Humedad elevada',
  message: (v, ctx) => `${v} en ${ctx.zone.name}. Verifique ventilación y estado de la cama.`,
});

export const lowWaterAlert = thresholdRule({
  id: 'alert.lowWater',
  name: 'Falta de agua',
  description: 'Nivel del tanque por debajo del mínimo.',
  type: 'lowWater',
  sensor: 'waterLevel',
  direction: 'below',
  band: (ctx) => ctx.profile.alerts.lowWater,
  title: 'Nivel de agua bajo',
  message: (v, ctx) =>
    ctx.actuators.waterPump?.active
      ? `Tanque al ${v} con la bomba activa. Posible corte de suministro o fuga.`
      : `Tanque al ${v}. Las aves pueden quedarse sin agua.`,
});

export const lowFeedAlert = thresholdRule({
  id: 'alert.lowFeed',
  name: 'Falta de alimento',
  description: 'Nivel de la tolva por debajo del mínimo.',
  type: 'lowFeed',
  sensor: 'feedLevel',
  direction: 'below',
  band: (ctx) => ctx.profile.alerts.lowFeed,
  title: 'Nivel de alimento bajo',
  message: (v, ctx) =>
    ctx.actuators.feeder?.active
      ? `Tolva al ${v} con el alimentador activo. Revise el silo o el sinfín.`
      : `Tolva al ${v}. Reponga alimento.`,
});

export const lowActivityAlert = thresholdRule({
  id: 'alert.lowActivity',
  name: 'Actividad animal baja',
  description: 'Movimiento de las aves inferior al esperado durante el periodo de luz.',
  type: 'lowActivity',
  sensor: 'animalActivity',
  direction: 'below',
  band: (ctx) => ctx.profile.alerts.lowActivity,
  // Se da 1 h de margen tras encender la luz para que las aves se activen.
  when: (ctx) => ctx.isPhotoperiod && ctx.hour >= ctx.profile.control.photoperiod.startHour + 1,
  title: 'Actividad animal baja',
  message: (v, ctx) =>
    `Índice de actividad ${v} en ${ctx.zone.name}. Posible enfermedad, estrés o problema de bienestar.`,
});

export const sensorOfflineAlert: Rule = {
  id: 'alert.sensorOffline',
  name: 'Sensor desconectado',
  description: 'Un sensor dejó de reportar o reporta datos antiguos.',
  evaluate(ctx) {
    const alerts: AlertSignal[] = ctx.sensors
      .filter((s) => !s.online || s.lastSeenAt === null || ctx.now - s.lastSeenAt > SENSOR_STALE_MS)
      .map((s) => ({
        type: 'sensorOffline',
        severity: 'warning',
        sensorId: s.sensor.id,
        title: `Sensor de ${SENSOR_KINDS[s.sensor.kind].label.toLowerCase()} desconectado`,
        message: `${s.sensor.label} (${s.sensor.deviceId}) no reporta datos. La automatización que depende de él queda en pausa.`,
      }));
    return { alerts };
  },
};
