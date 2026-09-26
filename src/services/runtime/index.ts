import { RuleEngine } from '@/engine/RuleEngine';
import { demoFarmSetup } from '@/services/simulation/demoFarm';
import { SimulatedSource } from '@/services/simulation/SimulatedSource';

import { FarmRuntime } from './FarmRuntime';

export { FarmRuntime } from './FarmRuntime';

let runtime: FarmRuntime | null = null;

/**
 * Punto único donde se elige la fuente de datos. Para conectar hardware real
 * bastará con cambiar `SimulatedSource` por `MqttSource` (y la configuración
 * de la granja por la que venga del backend).
 */
export function getFarmRuntime(): FarmRuntime {
  if (!runtime) {
    runtime = new FarmRuntime(new SimulatedSource({ setup: demoFarmSetup }), new RuleEngine(), demoFarmSetup, {
      // La demo arranca con un día completo de historia simulada.
      primeSeconds: 24 * 3600,
    });
  }
  return runtime;
}
