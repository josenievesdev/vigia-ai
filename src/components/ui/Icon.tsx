import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import type { ActuatorKind, AlertType, SensorKind } from '@/domain/types';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const Icon = MaterialCommunityIcons;

export const SENSOR_ICONS: Record<SensorKind, IconName> = {
  temperature: 'thermometer',
  humidity: 'water-percent',
  light: 'white-balance-sunny',
  waterLevel: 'cup-water',
  feedLevel: 'grain',
  animalActivity: 'run',
};

export const ACTUATOR_ICONS: Record<ActuatorKind, IconName> = {
  ventilation: 'fan',
  feeder: 'silo',
  waterPump: 'water-pump',
  lighting: 'lightbulb-on-outline',
};

export const ALERT_ICONS: Record<AlertType, IconName> = {
  highTemperature: 'thermometer-alert',
  lowTemperature: 'snowflake-alert',
  highHumidity: 'water-alert',
  lowWater: 'water-off',
  lowFeed: 'grain',
  lowActivity: 'bird',
  sensorOffline: 'access-point-network-off',
  abnormalBehavior: 'cctv',
};
