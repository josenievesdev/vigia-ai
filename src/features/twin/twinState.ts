import { SENSOR_KINDS } from '@/domain/catalog';
import type { SpeciesProfile } from '@/domain/profiles';
import { readingStatus } from '@/domain/status';
import { hourOfDay } from '@/domain/time';
import type { ActuatorKind, Alert, AlertType, SensorKind, Timestamp } from '@/domain/types';
import { formatReading } from '@/utils/format';

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

export interface TwinState {
  /** 0 (noche) … 1 (mediodía). */
  daylight: number;
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
  isPhotoperiod: boolean;
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

const RANK: Record<TwinStatus, number> = { neutral: 0, normal: 1, offline: 2, warning: 3, critical: 4 };
const worst = (...s: TwinStatus[]): TwinStatus => s.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'neutral');

export function buildTwinState(input: TwinInput): TwinState {
  const { profile, readings, actuators } = input;
  const hour = hourOfDay(input.now);
  const daylight = Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12));

  const sensorStatus = (kind: SensorKind): TwinStatus => {
    const r = readings[kind];
    if (!r || !r.online) return 'offline';
    if (r.value === undefined) return 'neutral';
    return readingStatus(kind, r.value, profile, { isPhotoperiod: input.isPhotoperiod });
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
      detail: `Óptimo ${t.min}–${t.max} °C y ${h.min}–${h.max} % de humedad`,
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
      detail: input.isPhotoperiod ? 'Periodo de luz: se espera movimiento' : 'Periodo de descanso',
      sensorKind: 'animalActivity',
    },
    {
      id: 'lighting',
      label: 'Iluminación',
      status: withAlert('lighting', sensorStatus('light')),
      value: `${on('lighting') ? 'Encendida' : 'Apagada'} · ${show('light')}`,
      detail: `Fotoperiodo ${profile.control.photoperiod.startHour}:00 – ${profile.control.photoperiod.endHour}:00`,
      sensorKind: 'light',
    },
  ];

  return {
    daylight,
    lampsOn: on('lighting'),
    fanActive: on('ventilation'),
    feederActive: on('feeder'),
    pumpActive: on('waterPump'),
    feedLevel: feedLevel === undefined ? null : feedLevel / 100,
    waterLevel: waterLevel === undefined ? null : waterLevel / 100,
    activity: activityValue === undefined ? 0.5 : Math.min(1, Math.max(0, activityValue / 100)),
    resting: !input.isPhotoperiod,
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
