const light = {
  background: '#F3F5F1',
  surface: '#FFFFFF',
  surfaceMuted: '#EBEFE8',
  border: '#DDE3DA',
  text: '#15211A',
  textMuted: '#5C6B62',
  textInverse: '#FFFFFF',

  primary: '#1F7A4D',
  primarySoft: '#DCEFE3',

  normal: '#15803D',
  normalSoft: '#DCFCE7',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  critical: '#B91C1C',
  criticalSoft: '#FEE2E2',
  info: '#1D4ED8',
  infoSoft: '#DBEAFE',

  water: '#0284C7',
  feed: '#A16207',
  offline: '#6B7280',

  // Gráficas (serie única = slot 1 de la paleta categórica validada; contraste ≥ 3:1).
  chartLine: '#2A78D6',
  chartGrid: '#E8ECE6',
  chartAxis: '#C9D1C6',
  /** Tono de contexto: franjas de equipos y minigráficas. */
  chartMuted: '#8A968F',
};

export type ColorTokens = typeof light;

const dark: ColorTokens = {
  background: '#0D1310',
  surface: '#161F1A',
  surfaceMuted: '#1E2923',
  border: '#28352D',
  text: '#E6EEE8',
  textMuted: '#93A399',
  textInverse: '#0D1310',

  primary: '#4ADE80',
  primarySoft: '#173A26',

  normal: '#4ADE80',
  normalSoft: '#173A26',
  warning: '#FBBF24',
  warningSoft: '#3B2E0C',
  critical: '#F87171',
  criticalSoft: '#431616',
  info: '#60A5FA',
  infoSoft: '#172A4A',

  water: '#38BDF8',
  feed: '#FACC15',
  offline: '#9CA3AF',

  chartLine: '#3987E5',
  chartGrid: '#24302A',
  chartAxis: '#34423A',
  chartMuted: '#6B7A71',
};

export const Colors = { light, dark };
