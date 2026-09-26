import type { Rule } from '../types';

import {
  highHumidityAlert,
  highTemperatureAlert,
  lowActivityAlert,
  lowFeedAlert,
  lowTemperatureAlert,
  lowWaterAlert,
  sensorOfflineAlert,
} from './alertRules';
import { feederRule, lightingRule, ventilationRule, waterPumpRule } from './controlRules';

/** Conjunto por defecto. El orden define la prioridad si dos reglas mandan el mismo actuador. */
export const defaultRules: Rule[] = [
  ventilationRule,
  feederRule,
  waterPumpRule,
  lightingRule,
  highTemperatureAlert,
  lowTemperatureAlert,
  highHumidityAlert,
  lowWaterAlert,
  lowFeedAlert,
  lowActivityAlert,
  sensorOfflineAlert,
];
