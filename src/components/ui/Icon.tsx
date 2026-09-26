import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import type { ActuatorKind, AlertType, SensorKind } from '@/domain/types';
import { type WeatherKind, weatherKind } from '@/services/weather/weatherCodes';

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

const WEATHER_ICONS: Record<WeatherKind, { day: IconName; night: IconName }> = {
  clear: { day: 'weather-sunny', night: 'weather-night' },
  partly: { day: 'weather-partly-cloudy', night: 'weather-night-partly-cloudy' },
  cloudy: { day: 'weather-cloudy', night: 'weather-cloudy' },
  fog: { day: 'weather-fog', night: 'weather-fog' },
  drizzle: { day: 'weather-rainy', night: 'weather-rainy' },
  rain: { day: 'weather-rainy', night: 'weather-rainy' },
  heavyRain: { day: 'weather-pouring', night: 'weather-pouring' },
  snow: { day: 'weather-snowy', night: 'weather-snowy' },
  storm: { day: 'weather-lightning-rainy', night: 'weather-lightning-rainy' },
};

export function weatherIcon(code: number, isDay: boolean): IconName {
  const icons = WEATHER_ICONS[weatherKind(code)];
  return isDay ? icons.day : icons.night;
}

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
