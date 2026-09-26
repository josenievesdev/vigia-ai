import type { ActuatorCommand, Decision } from '@/domain/types';
import { createId } from '@/utils/id';

import { defaultRules } from './rules';
import type { DecisionEngine, EngineResult, KeyedAlertSignal, Rule, ZoneContext } from './types';

export function alertKey(type: string, zoneId: string, sensorId?: string): string {
  return `${type}:${zoneId}:${sensorId ?? ''}`;
}

/**
 * Motor de decisiones v1: evalúa reglas deterministas por zona.
 * - Solo manda actuadores en modo automático.
 * - Solo emite un comando si cambia el estado actual (sin decisiones redundantes).
 * - Cada comando queda registrado como Decision con su motivo.
 */
export class RuleEngine implements DecisionEngine {
  constructor(private readonly rules: Rule[] = defaultRules) {}

  evaluate(zones: ZoneContext[]): EngineResult {
    const commands: ActuatorCommand[] = [];
    const decisions: Decision[] = [];
    const alertSignals: KeyedAlertSignal[] = [];

    for (const ctx of zones) {
      const claimed = new Set<string>();

      for (const rule of this.rules) {
        const outcome = rule.evaluate(ctx);

        for (const intent of outcome.commands ?? []) {
          const target = ctx.actuators[intent.actuator];
          if (!target || target.mode !== 'auto' || target.active === intent.active) continue;
          if (claimed.has(target.actuator.id)) continue;
          claimed.add(target.actuator.id);

          const command: ActuatorCommand = { actuatorId: target.actuator.id, active: intent.active };
          commands.push(command);
          decisions.push({
            id: createId('dec'),
            timestamp: ctx.now,
            source: 'rule',
            ruleId: rule.id,
            zoneId: ctx.zone.id,
            summary: intent.summary,
            reason: intent.reason,
            inputs: intent.inputs,
            commands: [command],
          });
        }

        for (const signal of outcome.alerts ?? []) {
          alertSignals.push({
            ...signal,
            zoneId: ctx.zone.id,
            key: alertKey(signal.type, ctx.zone.id, signal.sensorId),
          });
        }
      }
    }

    return { commands, decisions, alertSignals };
  }
}
