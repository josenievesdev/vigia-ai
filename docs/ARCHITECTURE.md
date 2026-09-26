# Arquitectura de VigíaAI

## 1. Definición de producto

VigíaAI es una plataforma de monitoreo y automatización de granjas con dos tipos de usuario:

| Usuario | Necesidad principal |
|---|---|
| **Propietario de granja** | Saber en segundos si todo está bien, enterarse a tiempo de los problemas y actuar a distancia. |
| **Integrador de automatización agropecuaria** | Instalar sensores y actuadores en granjas de clientes y tener una plataforma de supervisión lista, multi-granja y ampliable. |

Primera vertical: **gallinas ponedoras**. Todo lo específico de la especie (umbrales, fotoperiodo, consumos, sensores esperados) vive en un **perfil productivo** (`src/domain/profiles`). Para añadir, por ejemplo, pollos de engorde o un invernadero, basta con crear un perfil nuevo; el motor, la simulación y la UI se mantienen.

## 2. Principio central

> La app no sabe si los datos vienen de una simulación o de un ESP32 real.

Toda la telemetría entra por la interfaz `TelemetrySource` (`src/services/telemetry`). Hoy la implementa `SimulatedSource`; mañana lo harán `MqttSource` y `CloudSource` sin cambios en el motor ni en la UI. El único punto donde se elige la fuente es `src/services/runtime/index.ts`.

## 3. Flujo de datos (circuito cerrado)

```
 TelemetrySource ──TelemetryBatch──► FarmRuntime ──ingest──► store (Zustand) ──► UI
        ▲                                 │
        │                                 ├─ append ──► HistoryRepository ──► gráficas
        │                                 ├─ buildZoneContexts(store)
        │                                 ├─ DecisionEngine.evaluate(contexts)
        │                                 │     ├─ comandos ─────────────┐
        │                                 │     ├─ decisiones (log) ──► store
        │                                 │     └─ señales de alerta
        │                                 └─ reconcileAlerts ─────────► store
        └──────────────── sendCommand ◄───────────────────────────────┘
```

- **Circuito cerrado:** en la simulación, los actuadores alteran el modelo físico. Si se enciende la ventilación, la temperatura baja; si se activa el alimentador, la tolva sube. Con el hardware real, el ESP32 hará lo mismo.
- **La fuente de verdad del estado de los actuadores es el dispositivo.** La app envía comandos y refleja lo que el dispositivo reporta.
- **`FarmRuntime` no depende de React.** Puede migrarse a un servicio en segundo plano o a un backend (por ejemplo, Edge Functions) para que la automatización funcione aunque la app esté cerrada.

## 4. Capas

| Capa | Carpeta | Depende de React/Expo |
|---|---|---|
| Dominio | `src/domain` | No |
| Motor | `src/engine` | No |
| Servicios | `src/services` | No |
| Estado | `src/store` | Mínimo (hooks de Zustand) |
| UI | `src/features`, `src/components`, `src/app` | Sí |

`domain`, `engine` y `services` se prueban con Jest sin emulador (`npm test`).

## 5. Motor de decisiones

- **Contrato:** `DecisionEngine.evaluate(zones: ZoneContext[]) → { commands, decisions, alertSignals }`.
- **v1, `RuleEngine`:** reglas deterministas en `src/engine/rules`.
  - Control (con histéresis): ventilación, alimentador, bomba de agua y fotoperiodo.
  - Alertas: temperatura alta y baja, humedad, agua, alimento, actividad animal y sensor desconectado.
- **Garantías:**
  - Solo manda actuadores en modo **automático**. El modo manual del usuario tiene prioridad.
  - Nunca emite un comando redundante.
  - Cada comando genera una `Decision` con motivo legible y los valores de entrada (trazabilidad).
  - Un sensor desconectado no aporta valor: las reglas que dependen de él se pausan y se genera una alerta.
- **Futuro, IA:** un `AIEngine` podrá envolver al `RuleEngine`: las reglas quedan como red de seguridad y la IA propone decisiones con `source: 'ai'`. La UI ya distingue el origen de cada decisión (regla, IA o usuario).

## 6. Alertas

`reconcileAlerts` (función pura) gestiona el ciclo de vida de las alertas:
- **Deduplicación** por clave `tipo:zona:sensor`.
- **Escalado o desescalado** de severidad sin crear alertas nuevas.
- **Antiparpadeo:** una alerta solo se resuelve si la condición desaparece durante 2 minutos (hora de la granja).
- **Historial** de las alertas resueltas.

## 7. Historial y gráficas (fase 4)

- **`HistoryRepository`** (`src/services/history`) es la frontera del historial. Hoy la implementa `InMemoryHistory`:
  - un punto por minuto (promedio de las lecturas de ese minuto);
  - 26 h de retención;
  - los cortes de sensor se guardan como `NaN` y dibujan un hueco en la línea;
  - los periodos de encendido de cada equipo se guardan como intervalos.
- **Historia previa simulada:** al arrancar, `SimulatedSource.prime()` simula las 24 h anteriores pasando por el motor real. La app abre con gráficas, decisiones y alertas de un día completo (~40 ms en Node).
- **`useSensorHistory`** (`src/hooks/use-history.ts`) es lo único que usan las pantallas. Cuando el historial venga del servidor, cambiará este hook y no las pantallas.
- **Gráficas propias en SVG** (`src/components/charts`, sobre `react-native-svg`), sin librería de gráficos, para controlar:
  - las bandas de umbral del perfil (óptimo, advertencia, crítico), explicadas en una leyenda y nunca solo con color;
  - la franja de encendido del equipo relacionado (causa → efecto);
  - el cursor táctil con tooltip;
  - las minigráficas de las tarjetas.
- Reglas de visualización aplicadas:
  - una sola serie por gráfica, con el color `chartLine`, validado a ≥ 3:1 de contraste en modo claro y oscuro;
  - líneas de 2 px y cuadrícula fina;
  - cifras proporcionales en los valores grandes y tabulares en las columnas;
  - una vista de tabla por hora equivalente a cada gráfica.
- **Métricas del periodo:** mínimo, promedio y máximo ponderados por tiempo, y % del tiempo en el rango objetivo (`targetRange` del perfil).

## 8. Gemelo digital 3D (fase 5)

Representación funcional (no un videojuego): todo lo que se ve se deriva del estado real de la granja.

- **Stack:** `three` 0.186 + `@react-three/fiber` 9.8, con estos puntos de entrada:
  - web: `@react-three/fiber` sobre `<canvas>`;
  - iOS/Android: `@react-three/fiber/native` sobre `expo-gl`, incluido en Expo Go;
  - la elección la hacen `Canvas3D.tsx` y `Canvas3D.native.tsx` por extensión de plataforma.
- **`twinState.ts`** (función pura, con pruebas) traduce el store al estado visual (`TwinState`):
  - niveles, equipos activos, actividad y reposo de las aves;
  - día/noche, estado por sensor y severidad de alerta por elemento.
- **Escena procedural** (`src/features/twin/scene`): sin modelos, texturas ni `drei`, para priorizar estabilidad en nativo.
  - **Galpón:** techo translúcido; el aire se tiñe de ámbar o rojo cuando el clima entra en advertencia o crítico.
  - **Aves:** 24 figuras (1 ≈ 50 aves). Caminan y picotean según el índice de actividad, y se echan de noche.
  - **Ventiladores:** arranque y frenado graduales.
  - **Silo:** con nivel visible y grano por el sinfín cuando el alimentador está activo.
  - **Tanque:** con nivel, LED de bomba y gotas en la tubería.
  - **Lámparas:** encendidas según el fotoperiodo.
  - **Nodos de sensores:** con LED de estado, que parpadea en alerta y queda gris si el sensor está desconectado.
  - **Anillos en el suelo:** pulsantes para las alertas y fijos para la selección.
  - **Cielo:** su luz sigue la hora de la granja.
- **Interacción:**
  - vistas predefinidas (General, Interior, Suministros, Ventilación);
  - tocar un elemento acerca la cámara y abre su ficha, con acceso al historial (fase 4);
  - arrastrar gira la cámara y tocar en vacío quita la selección;
  - la distancia de la cámara se ajusta a la proporción de la pantalla para que el galpón quepa en un teléfono vertical.
- **Panel 2D:** equivalente en texto del 3D. Muestra el estado de cada elemento con etiqueta y leyenda; nada depende solo del color.
- **Rendimiento:**
  - las aves comparten geometrías y materiales;
  - sin sombras;
  - el render se pausa (`frameloop: never`) cuando la pestaña no está visible.
- **Compatibilidad nativa:**
  - `metro.config.js` fuerza que `three` use su build ESM. El build CommonJS de three ≥ 0.18x llama a `process.emitWarning` al cargarse, que no existe en Hermes (provocaba "undefined is not a function" al abrir el gemelo en iOS).
  - Una prueba de regresión lo vigila (`__tests__/metro-config.test.js`).
- **Respaldo:** el visor 3D se carga de forma diferida y dentro de un `ErrorBoundary`. Si falla en un dispositivo, la pantalla muestra un aviso y el panel de estado sigue funcionando.
- **Verificación:**
  - ejecución en web;
  - bundles de iOS y Android;
  - simulación en Node de la carga del módulo nativo.
  - La prueba final es en un teléfono con Expo Go, porque los simuladores de iOS no son fiables para OpenGL.

## 9. Modo demo

`src/services/simulation/scenarios.ts` define los escenarios:
- ola de calor
- falta de agua
- falta de alimento
- baja actividad animal
- sensor desconectado

Los escenarios **modifican el modelo físico**, no los números que se muestran. Lo que se ve en pantalla es la respuesta real del motor. La velocidad de la simulación es configurable (tiempo real, 1 min/s o 5 min/s).

**Mientras no haya hardware, todo funciona en simulación**, incluido el gemelo 3D (fase 5) y el módulo de producción (fase 6).

## 10. Preparación para hardware (fase 7, no implementado)

Los IDs ya tienen la forma necesaria para mapearse a tópicos MQTT:

```
vigia/{farmId}/{zoneId}/{deviceId}/telemetry     ESP32 → broker   (lecturas + estado de actuadores)
vigia/{farmId}/{zoneId}/{deviceId}/status        ESP32 → broker   (online/offline, LWT)
vigia/{farmId}/{zoneId}/{deviceId}/command       broker → ESP32   ({ actuatorId, active })
```

Plan:
1. Crear `MqttSource implements TelemetrySource` (MQTT sobre WebSocket).
2. Validar los payloads con `zod` en la frontera.
3. Usar el *Last Will* de MQTT para detectar dispositivos caídos (`SensorStatus.online`).
4. Cambiar la fuente en `services/runtime/index.ts`.

**Decisión clave:** el control crítico (ventilación, agua) no puede depender de que el teléfono esté encendido. El ESP32 o un gateway tendrá un control básico de seguridad con umbrales locales, y el motor completo correrá en el servidor. La app supervisará y dará órdenes. El motor ya es TypeScript puro para poder moverlo sin reescribirlo.

## 11. Backend (fase 8, no implementado)

Supabase o Firebase para:
- autenticación
- granjas y dispositivos por usuario o integrador (vista de varias granjas)
- histórico de lecturas (nueva implementación de `HistoryRepository`)
- persistencia de alertas y decisiones
- notificaciones push de alertas críticas
- ejecución del motor en el servidor

La configuración de la granja que hoy está en `demoFarm.ts` pasará a venir de la base de datos.

## 12. Visión artificial (fase 10, no implementada)

Contrato previsto en `src/domain/vision/types.ts`:
- **Detección de movimiento:** índice de movimiento por zona.
- **Comportamiento anormal:** aglomeración, jadeo por calor, inmovilidad, picaje.
- **Conteo de animales:** conteo frente a población esperada.
- **Análisis por cámara:** eventos con confianza del modelo e imagen asociada.

El análisis de video se hará en un gateway local o en la nube, no en el teléfono. La app recibirá `VisionEvent`/`VisionInsights`, que se añadirán al `ZoneContext`, para que las reglas o la IA combinen visión y sensores (por ejemplo: baja actividad + aglomeración + temperatura alta → estrés térmico). El tipo de alerta `abnormalBehavior` ya está reservado.

## 13. Hoja de ruta

### Bloque A: app completa sin hardware (todo simulado)
| Fase | Contenido | Estado |
|---|---|---|
| 0 | Base del proyecto | ✅ |
| 1 | Dominio + simulación | ✅ |
| 2 | Dashboard | ✅ |
| 3 | Motor de reglas + alertas + modo demo | ✅ |
| 4 | Historial y gráficas (detalle por sensor, bandas, franjas de equipos, minigráficas, tabla por hora) | ✅ |
| 5 | Gemelo digital 3D, representación funcional alimentada por la simulación | ✅ (validar en teléfono) |
| 6 | **Módulo de producción** + configuración (umbrales editables, datos de granja y galpones) | ⏭️ Siguiente |

**Módulo de producción (fase 6):**
- huevos por día y % de postura
- mortalidad
- consumo de alimento y de agua por ave
- conversión alimenticia

Al principio los datos serán simulados, afectados por el estrés térmico, la disponibilidad de agua y alimento y las horas de luz. Después se sumará el registro manual y más adelante el conteo automático.

### Bloque B: granja real (piloto)
| Fase | Contenido | Estado |
|---|---|---|
| 7 | Hardware: ESP32 + sensores + relés vía MQTT; control de seguridad local | Pendiente (sin hardware aún) |
| 8 | Servidor: usuarios, historial persistente, push, multi-granja, motor en servidor | Pendiente |

### Bloque C: inteligencia
| Fase | Contenido | Estado |
|---|---|---|
| 9 | IA de decisiones: predicciones, anomalías de consumo, recomendaciones explicadas | Pendiente |
| 10 | Visión artificial: movimiento, comportamiento anormal, conteo | Pendiente |
