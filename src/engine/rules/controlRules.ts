import type { Hysteresis } from '@/domain/profiles';
import type { ActuatorKind, SensorKind } from '@/domain/types';
import { formatReading } from '@/utils/format';

import type { Rule, RuleOutcome, ZoneContext } from '../types';

/**
 * Control por histéresis genérico.
 * `direction: 'above'` → encender cuando el valor SUPERA `on` (p. ej. temperatura).
 * `direction: 'below'` → encender cuando el valor BAJA de `on` (p. ej. nivel de agua).
 */
function hysteresisRule(config: {
  id: string;
  name: string;
  description: string;
  sensor: SensorKind;
  actuator: ActuatorKind;
  direction: 'above' | 'below';
  thresholds: (ctx: ZoneContext) => Hysteresis;
  labels: { on: string; off: string };
}): Rule {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    evaluate(ctx): RuleOutcome {
      const value = ctx.readings[config.sensor];
      const actuator = ctx.actuators[config.actuator];
      if (value === undefined || !actuator) return {};

      const { on, off } = config.thresholds(ctx);
      const shouldTurnOn = config.direction === 'above' ? value >= on : value <= on;
      const shouldTurnOff = config.direction === 'above' ? value <= off : value >= off;
      const cmp = config.direction === 'above' ? ['≥', '≤'] : ['≤', '≥'];
      const shown = formatReading(config.sensor, value);

      if (!actuator.active && shouldTurnOn) {
        return {
          commands: [
            {
              actuator: config.actuator,
              active: true,
              summary: config.labels.on,
              reason: `${shown} ${cmp[0]} ${formatReading(config.sensor, on)} (umbral de encendido)`,
              inputs: { [config.sensor]: value },
            },
          ],
        };
      }
      if (actuator.active && shouldTurnOff) {
        return {
          commands: [
            {
              actuator: config.actuator,
              active: false,
              summary: config.labels.off,
              reason: `${shown} ${cmp[1]} ${formatReading(config.sensor, off)} (umbral de apagado)`,
              inputs: { [config.sensor]: value },
            },
          ],
        };
      }
      return {};
    },
  };
}

export const ventilationRule = hysteresisRule({
  id: 'control.ventilation',
  name: 'Control de ventilación',
  description: 'Enciende la ventilación cuando la temperatura supera el umbral y la apaga al normalizarse.',
  sensor: 'temperature',
  actuator: 'ventilation',
  direction: 'above',
  thresholds: (ctx) => ctx.profile.control.ventilation,
  labels: { on: 'Ventilación activada', off: 'Ventilación desactivada' },
});

export const feederRule = hysteresisRule({
  id: 'control.feeder',
  name: 'Alimentación automática',
  description: 'Repone la tolva cuando el nivel de alimento baja y se detiene al llenarse.',
  sensor: 'feedLevel',
  actuator: 'feeder',
  direction: 'below',
  thresholds: (ctx) => ctx.profile.control.feeder,
  labels: { on: 'Alimentador activado', off: 'Alimentador detenido' },
});

export const waterPumpRule = hysteresisRule({
  id: 'control.waterPump',
  name: 'Suministro de agua',
  description: 'Activa la bomba cuando el tanque baja y la detiene al llenarse.',
  sensor: 'waterLevel',
  actuator: 'waterPump',
  direction: 'below',
  thresholds: (ctx) => ctx.profile.control.waterPump,
  labels: { on: 'Suministro de agua activado', off: 'Suministro de agua detenido' },
});

export const lightingRule: Rule = {
  id: 'control.lighting',
  name: 'Fotoperiodo',
  description: 'Mantiene la iluminación encendida durante las horas de luz definidas para la especie.',
  evaluate(ctx) {
    const lighting = ctx.actuators.lighting;
    if (!lighting || lighting.active === ctx.isPhotoperiod) return {};
    const { startHour, endHour } = ctx.profile.control.photoperiod;
    return {
      commands: [
        {
          actuator: 'lighting',
          active: ctx.isPhotoperiod,
          summary: ctx.isPhotoperiod ? 'Iluminación encendida' : 'Iluminación apagada',
          reason: ctx.isPhotoperiod
            ? `Inicio del fotoperiodo (${startHour}:00 – ${endHour}:00)`
            : `Fin del fotoperiodo (${endHour}:00)`,
          inputs: {},
        },
      ],
    };
  },
};
