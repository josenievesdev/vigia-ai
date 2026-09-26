import type { BehaviorWorld } from '@/domain/behavior/types';
import { SENSOR_KINDS } from '@/domain/catalog';
import type { LightingProgram, LightState } from '@/domain/lighting';
import type { SpeciesProfile } from '@/domain/profiles';
import { readingStatus } from '@/domain/status';
import type { ActuatorKind, Alert, AlertType, SensorKind, Timestamp } from '@/domain/types';
import { isRaining } from '@/services/weather/weatherCodes';
import type { OutsideConditions } from '@/services/weather/types';
import { formatClock, formatReading } from '@/utils/format';

/**
 * Traduce el estado de la granja al estado visual del gemelo digital.
 * Función pura (sin three.js ni React): la escena 3D solo dibuja lo que
 * decide este módulo, y el panel 2D muestra la misma información en texto.
 */

export type TwinElementId = 'climate' | 'hens' | 'ventilation' | 'feeder' | 'water' | 'lighting';
export type TwinStatus = 'normal' | 'warning' | 'critical' | 'offline' | 'neutral';

export interface TwinElement {
  id: TwinElementId;
  label: string;
  status: TwinStatus;
  value: string;
  detail: string;
  /** Variable con historial para abrir su detalle. */
  sensorKind: SensorKind;
}

export interface TwinSensorNode {
  kind: SensorKind;
  label: string;
  status: TwinStatus;
}

/** Condiciones que perciben las aves (entrada de su comportamiento, fase 6.3). */
export interface FlockConditions {
  /** 0–1: estrés por calor (temperatura interior, agravado por la humedad). */
  heatStress: number;
  /** 0–1: frío. */
  cold: number;
  /** 0–1: decaimiento sin causa ambiental (enfermedad, estrés). */
  sickness: number;
  waterAvailable: boolean;
  feedAvailable: boolean;
}

export interface TwinState {
  /** Luz natural 0 (noche) … 1 (día pleno), según el sol real. */
  daylight: number;
  /** Posición real del sol (grados). */
  sun: { elevation: number; azimuth: number };
  /** 0–1: intensidad del crepúsculo (cielo anaranjado al amanecer/atardecer). */
  twilight: number;
  /** 0–1: nubosidad real. */
  cloudCover: number;
  /** 0 (seco) … 1 (aguacero). */
  rain: number;
  flock: FlockConditions;
  lampsOn: boolean;
  fanActive: boolean;
  feederActive: boolean;
  pumpActive: boolean;
  /** 0–1, null si no hay dato. */
  feedLevel: number | null;
  waterLevel: number | null;
  /** 0–1: cuánto se mueven las aves. */
  activity: number;
  /** Aves en reposo (noche). */
  resting: boolean;
  climateStatus: TwinStatus;
  sensors: TwinSensorNode[];
  elements: TwinElement[];
  /** Severidad de alerta activa por elemento (para halos). */
  alerts: Record<TwinElementId, 'warning' | 'critical' | null>;
}

export interface TwinInput {
  now: Timestamp;
  profile: SpeciesProfile;
  light: LightState;
  lighting: LightingProgram;
  /** Clima exterior (real o de respaldo); null si aún no hay datos. */
  outside: OutsideConditions | null;
  readings: Partial<Record<SensorKind, { value: number | undefined; online: boolean }>>;
  actuators: Partial<Record<ActuatorKind, boolean>>;
  alerts: Alert[];
  sensorIds: Partial<Record<SensorKind, string>>;
}

const ALERT_ELEMENT: Record<AlertType, TwinElementId> = {
  highTemperature: 'climate',
  lowTemperature: 'climate',
  highHumidity: 'climate',
  lowWater: 'water',
  lowFeed: 'feeder',
  lowActivity: 'hens',
  abnormalBehavior: 'hens',
  sensorOffline: 'climate', // se corrige según el sensor afectado
};

/** Elemento del gemelo al que pertenece cada sensor. */
export const SENSOR_ELEMENT: Record<SensorKind, TwinElementId> = {
  temperature: 'climate',
  humidity: 'climate',
  light: 'lighting',
  waterLevel: 'water',
  feedLevel: 'feeder',
  animalActivity: 'hens',
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const RANK: Record<TwinStatus, number> = { neutral: 0, normal: 1, offline: 2, warning: 3, critical: 4 };
const worst = (...s: TwinStatus[]): TwinStatus => s.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'neutral');

export function buildTwinState(input: TwinInput): TwinState {
  const { profile, readings, actuators, light, outside } = input;
  const temperature = readings.temperature?.online ? readings.temperature.value : undefined;

  const sensorStatus = (kind: SensorKind): TwinStatus => {
    const r = readings[kind];
    if (!r || !r.online) return 'offline';
    if (r.value === undefined) return 'neutral';
    return readingStatus(kind, r.value, profile, { isLightPeriod: light.isLightPeriod, temperature });
  };
  const value = (kind: SensorKind) => (readings[kind]?.online ? readings[kind]?.value : undefined);
  const show = (kind: SensorKind) => formatReading(kind, value(kind));

  // Alertas activas → elemento afectado.
  const alerts: TwinState['alerts'] = {
    climate: null,
    hens: null,
    ventilation: null,
    feeder: null,
    water: null,
    lighting: null,
  };
  const sensorKindById = new Map(Object.entries(input.sensorIds).map(([k, id]) => [id, k as SensorKind]));
  for (const a of input.alerts) {
    if (a.status !== 'active' || a.severity === 'info') continue;
    const kind = a.sensorId ? sensorKindById.get(a.sensorId) : undefined;
    const element = a.type === 'sensorOffline' && kind ? SENSOR_ELEMENT[kind] : ALERT_ELEMENT[a.type];
    if (alerts[element] !== 'critical') alerts[element] = a.severity;
  }
  const withAlert = (id: TwinElementId, status: TwinStatus) => worst(status, alerts[id] ?? 'neutral');

  const climateStatus = withAlert('climate', worst(sensorStatus('temperature'), sensorStatus('humidity')));
  const feedLevel = value('feedLevel');
  const waterLevel = value('waterLevel');
  const activityValue = value('animalActivity');
  const on = (a: ActuatorKind) => actuators[a] ?? false;
  const { temperature: t, humidity: h } = profile.comfort;

  const elements: TwinElement[] = [
    {
      id: 'climate',
      label: 'Clima del galpón',
      status: climateStatus,
      value: `${show('temperature')} · ${show('humidity')}`,
      detail: `${outside ? `Exterior ${Math.round(outside.temperature)} °C · ` : ''}Óptimo ${t.min}–${t.max} °C y ${h.min}–${h.max} % de humedad`,
      sensorKind: 'temperature',
    },
    {
      id: 'ventilation',
      label: 'Ventilación',
      status: withAlert('ventilation', 'normal'),
      value: on('ventilation') ? 'Encendida' : 'Apagada',
      detail: `Se enciende a ${profile.control.ventilation.on} °C y se apaga a ${profile.control.ventilation.off} °C`,
      sensorKind: 'temperature',
    },
    {
      id: 'feeder',
      label: 'Alimentación',
      status: withAlert('feeder', sensorStatus('feedLevel')),
      value: `Tolva ${show('feedLevel')}${on('feeder') ? ' · alimentador activo' : ''}`,
      detail: `Repone bajo ${profile.control.feeder.on} % y se detiene al ${profile.control.feeder.off} %`,
      sensorKind: 'feedLevel',
    },
    {
      id: 'water',
      label: 'Agua',
      status: withAlert('water', sensorStatus('waterLevel')),
      value: `Tanque ${show('waterLevel')}${on('waterPump') ? ' · bomba activa' : ''}`,
      detail: `Bombea bajo ${profile.control.waterPump.on} % y se detiene al ${profile.control.waterPump.off} %`,
      sensorKind: 'waterLevel',
    },
    {
      id: 'hens',
      label: 'Aves',
      status: withAlert('hens', sensorStatus('animalActivity')),
      value: `Actividad ${show('animalActivity')}`,
      detail: light.isLightPeriod ? 'De día: se espera movimiento' : 'De noche: las aves duermen',
      sensorKind: 'animalActivity',
    },
    {
      id: 'lighting',
      label: 'Iluminación',
      status: withAlert('lighting', sensorStatus('light')),
      value: `${on('lighting') ? 'Encendida' : 'Apagada'} · ${show('light')}`,
      detail:
        input.lighting.type === 'natural'
          ? `Luz natural${light.sun ? ` · amanece ${formatClock(light.sun.sunrise)} · anochece ${formatClock(light.sun.sunset)}` : ''}`
          : `Programa de luz ${input.lighting.startHour}:00 – ${input.lighting.endHour}:00`,
      sensorKind: 'light',
    },
  ];

  // Lo que "sienten" las aves (usa el mismo criterio que las alertas del perfil).
  const humidity = readings.humidity?.online ? readings.humidity.value : undefined;
  const comfortMax = profile.comfort.temperature.max;
  const heatSpan = profile.alerts.highTemperature.critical - comfortMax;
  const humidityFactor = 1 + Math.max(0, (humidity ?? 60) - 60) / 100;
  const heatStress = temperature === undefined ? 0 : clamp01(((temperature - comfortMax) / heatSpan) * humidityFactor);
  const cold = temperature === undefined ? 0 : clamp01((profile.comfort.temperature.min - temperature) / 8);
  const waterAvailable = waterLevel === undefined || waterLevel > 5;
  const feedAvailable = feedLevel === undefined || feedLevel > 5;
  const expectedActive = light.isLightPeriod && heatStress < 0.3 && waterAvailable && feedAvailable;
  const warnActivity = profile.alerts.lowActivity.warning;
  const sickness =
    expectedActive && activityValue !== undefined && activityValue < warnActivity
      ? clamp01((warnActivity - activityValue) / warnActivity + 0.3)
      : 0;
  const raining = outside ? isRaining(outside.weatherCode, outside.precipitation) : false;

  return {
    daylight: light.natural,
    sun: { elevation: light.sunElevation, azimuth: light.sunAzimuth },
    twilight: clamp01(1 - Math.abs(light.sunElevation) / 7),
    cloudCover: outside ? clamp01(outside.cloudCover / 100) : 0.2,
    rain: raining ? clamp01(0.3 + (outside?.precipitation ?? 0) / 4) : 0,
    flock: { heatStress, cold, sickness, waterAvailable, feedAvailable },
    lampsOn: on('lighting'),
    fanActive: on('ventilation'),
    feederActive: on('feeder'),
    pumpActive: on('waterPump'),
    feedLevel: feedLevel === undefined ? null : feedLevel / 100,
    waterLevel: waterLevel === undefined ? null : waterLevel / 100,
    activity: activityValue === undefined ? 0.5 : Math.min(1, Math.max(0, activityValue / 100)),
    resting: !light.isLightPeriod,
    climateStatus,
    sensors: (Object.keys(SENSOR_KINDS) as SensorKind[]).map((kind) => ({
      kind,
      label: SENSOR_KINDS[kind].label,
      status: sensorStatus(kind),
    })),
    elements,
    alerts,
  };
}

/** Lo que perciben las aves en el gemelo: luz (sol o lámparas), calor, frío, salud y recursos. */
export function behaviorWorldFor(twin: TwinState): BehaviorWorld {
  return {
    light: Math.max(twin.daylight, twin.lampsOn ? 1 : 0),
    heatStress: twin.flock.heatStress,
    cold: twin.flock.cold,
    sickness: twin.flock.sickness,
    waterAvailable: twin.flock.waterAvailable,
    feedAvailable: twin.flock.feedAvailable,
    fanActive: twin.fanActive,
  };
}
