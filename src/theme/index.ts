import { useColorScheme } from '@/hooks/use-color-scheme';
import type { HealthStatus, Severity } from '@/domain/types';

import { Colors, type ColorTokens } from './colors';

export type { ColorTokens } from './colors';

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export function useTheme(): ColorTokens {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Colors.dark : Colors.light;
}

export type Tone = HealthStatus | Severity | 'offline' | 'neutral';

export function toneColors(c: ColorTokens, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'normal':
      return { fg: c.normal, bg: c.normalSoft };
    case 'warning':
      return { fg: c.warning, bg: c.warningSoft };
    case 'critical':
      return { fg: c.critical, bg: c.criticalSoft };
    case 'info':
      return { fg: c.info, bg: c.infoSoft };
    case 'offline':
      return { fg: c.offline, bg: c.surfaceMuted };
    default:
      return { fg: c.textMuted, bg: c.surfaceMuted };
  }
}
