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

## 9. Mundo real (fase 6)

La granja demo está en **Valledupar, Cesar** (`demoFarm.ts`: coordenadas, altitud y zona horaria).

- **Sol real, sin red:** `domain/solar.ts` implementa las ecuaciones de la NOAA (posición del sol, salida y puesta, crepúsculo civil). Coincide con Open-Meteo con un margen de ±2 min.
- **Programa de luz** (`domain/lighting.ts`), por galpón:
  - `natural` (por defecto): las aves duermen al oscurecer;
  - `extended`: lámparas que completan la luz que falta dentro de una ventana horaria.
  - `lightState()` da el periodo de luz de las aves, lo usan el motor, la simulación, la UI y el gemelo, y reemplaza al fotoperiodo fijo.
- **Clima real** (`services/weather`):
  - `WeatherService` descarga de Open-Meteo la observación actual, las últimas 24 h y 48 h de pronóstico. Se refresca cada 15 min y se interpola entre horas.
  - Sin conexión, o fuera del rango de datos, usa un clima sintético de respaldo sin romper la app.
- **Modelo del galpón alimentado por el exterior real.**
  - Interior = temperatura exterior + calor de las aves + sol sobre el techo − ventilación.
  - Humedad = la exterior corregida por temperatura, más la respiración de las aves.
  - Luz = radiación solar real + lámparas.
  - **Lo real es el exterior; el interior sigue siendo un modelo hasta tener sensores.**
- **Humedad con criterio agronómico:** solo se alerta de humedad alta cuando coincide con calor (≥ 28 °C), porque es entonces cuando agrava el estrés térmico. Así las noches húmedas de Valledupar no generan falsas alarmas.
- **Modos de simulación** (Más → Modo demo):
  - **En vivo:** reloj y clima reales.
  - **Acelerado:** para presentaciones, recorre el pronóstico real a 1, 5 o 15 min/s.
  - Cambiar de modo reinicia la simulación con 24 h de historia generada con el clima real.
- **Comportamiento de las aves** (`domain/behavior`, puro y con pruebas):
  - **Técnica:** IA de NPC de videojuegos. La **IA de utilidad** puntúa acciones según las necesidades (hambre, sed, energía), el ambiente (luz, estrés térmico con agravante de humedad, frío, disponibilidad de agua y alimento) y el decaimiento. Los **comportamientos de dirección** (llegada suave y separación entre aves) mueven a cada una.
  - **Acciones:** dormir en la percha, reposar, explorar, comer, beber, acicalarse, baño de tierra, jadear, amontonarse, agitarse y decaer.
  - **En el gemelo:** cada acción tiene su postura (pico abierto y alas separadas con calor, aleteo con agitación, plumas esponjadas con frío, cabeza recogida al dormir). El panel "Qué están haciendo las aves" lo resume en texto.
  - **Visión futura:** estos patrones son los mismos que definió el contrato de visión artificial (aglomeración, jadeo, inmovilidad), así que la cámara podrá validarlos con datos reales.
- **Gemelo 3D:**
  - el sol ilumina desde su posición real;
  - el cielo se tiñe al amanecer y al atardecer;
  - las nubes oscurecen la escena;
  - la lluvia real se dibuja;
  - un recuadro muestra ciudad, clima, hora y la próxima salida o puesta del sol.
- **Licencia de Open-Meteo:** el plan gratuito es **solo no comercial** y exige atribución (CC BY 4.0, visible en la app). Antes de comercializar hay que contratar su plan pago o consultar desde el servidor propio (fase 9).

## 10. Producción y configuración (fase 7)

**Producción** (`domain/production`, puro y con pruebas; `services/production/ProductionService.ts`):
- **Modelo:** la postura esperada sale de la curva por edad del lote (pico de ~95 % a las 30 semanas). Sobre ella se multiplican factores:
  - luz: −2 % por cada hora que falte para 16 h;
  - calor: grados-hora sobre 30 °C efectivos (la humedad alta suma), con pérdida exponencial;
  - cortes de agua y de alimento;
  - salud: baja actividad sin causa aparente.
- **El huevo tarda ~25 h en formarse:** la postura de hoy depende de las condiciones de ayer. La mortalidad y el consumo dependen del propio día.
- **Además calcula:**
  - peso del huevo (más pequeño con calor);
  - mortalidad: base + calor extremo (sobre 36,5 °C) + sed prolongada;
  - alimento y agua por ave: con calor comen menos y beben más;
  - conversión alimenticia (kg de alimento / kg de huevo).
- **Historial:** los 30 días previos se estiman hora a hora con el clima real de Open-Meteo (`past_days=31`). Las aves configuradas son las vivas hoy; hacia atrás se suman las muertes de cada día.
- **Día en curso:** `FarmRuntime` pasa cada lote de telemetría al servicio (temperatura, humedad, niveles de agua y alimento, actividad). Los huevos del día se reparten durante la mañana (la mayoría, 4–5 h después del amanecer). Al cerrar el día queda su registro con el consumo real.
- **Pantalla Producción:**
  - huevos de hoy, postura, mortalidad, alimento y conversión;
  - "¿Qué está afectando la postura hoy?": la pérdida de cada factor, en huevos, con un consejo;
  - barras de huevos por día, postura frente a la esperada por edad y tabla de los últimos 7 días.
  - El inicio muestra un resumen.
- **Calibración:** los coeficientes son estimaciones de referencia para una demo realista. En Valledupar dan una postura de ~75–81 % y una conversión de ~2,0–2,2. Se ajustarán con datos reales del galpón.

**Configuración** (`services/config`, Más → Configuración):
- **Qué se configura:**
  - nombre de la granja;
  - ubicación, con búsqueda en Open-Meteo Geocoding (muestra el municipio para distinguir lugares homónimos);
  - galpón: nombre, aves vivas y edad del lote;
  - programa de luz: natural o con lámparas, y su horario;
  - umbrales de ventilación, alertas de calor, bomba de agua y alimentador.
- **Validación:** `validateConfig` revisa la coherencia con mensajes en español. Por ejemplo, la ventilación debe apagarse por debajo de la temperatura de encendido.
- **Persistencia:** se guarda en el teléfono con AsyncStorage (`vigia.farmConfig.v1`). `startFarm` la carga al abrir la app. `applyFarmConfig` la guarda y reinicia la simulación con ella.
- **Lectura desde la UI:** la UI lee la configuración del store (`config`), nunca del runtime durante el render.

**Navegación:** pestañas Inicio, Gemelo, Producción, Alertas y Más. Control de equipos, Configuración y Modo demo están en Más.

## 11. Cuentas y suscripción (fase 9a)

Supabase: Postgres, Auth y reglas de acceso por fila (RLS). El esquema vive en `supabase/migrations/`.

**Roles:**
- **Administrador:** ve y gestiona todo: clientes, instaladores y pagos.
- **Instalador:** al terminar la instalación crea la cuenta del cliente con su granja y su galpón. Ve y da soporte a las granjas que instaló.
- **Cliente:** el dueño de la granja. Ve y configura solo lo suyo, y solo con la suscripción al día.

**Tablas:**
- `profiles`: usuario (nombre, cédula, celular, correo, municipio, rol, pagado hasta).
- `farms`: dueño, instalador y ubicación.
- `zones`: galpones (aves, nacimiento del lote, programa de luz, umbrales).

**Ingreso:**
- El usuario es la cédula. La contraseña inicial es la misma cédula y se cambia obligatoriamente en el primer ingreso, porque la cédula no es secreta.
- Supabase Auth trabaja con correo, así que cada usuario tiene un alias interno `<cédula>@vigia.local`. El correo real va en el perfil.
- El registro público está desactivado: las cuentas solo se crean desde la app, por el administrador o un instalador.

**Seguridad en la base de datos (RLS), no solo en la app:**
- Sin sesión no se ve nada.
- El cliente ve su perfil y su granja. Con la suscripción vencida, la base de datos deja de entregarle la granja.
- El instalador ve los clientes que creó y sus granjas.
- Rol, cédula, pagos y dueños solo cambian por funciones controladas. Por ejemplo, `set_paid_until` verifica que quien llama sea el administrador.
- Las funciones de apoyo de las políticas viven en el esquema `private`, que la API no expone.

**Crear cuentas:**
- Necesita la clave secreta del proyecto, que nunca va en la app. Por eso lo hace la Edge Function `manage-users`, que verifica el rol de quien la llama.
- Acciones: crear cliente con granja, crear instalador (solo el administrador), restablecer contraseña y eliminar (solo el administrador).
- Perfil, granja y galpón se crean en una sola transacción (`provision_client`).

**Suscripción:**
- Cada cliente tiene `paid_until`. La cuenta nueva trae 30 días.
- El administrador registra pagos (+1 mes) o bloquea. Las fechas se cuentan en hora de Colombia.

**En la app:**
- `src/lib/supabase.ts`: el cliente de Supabase. Guarda la sesión con AsyncStorage y se crea en el primer uso, porque el render estático de la web corre en Node.
- `src/services/account/`: la lógica pura y probada (identidad, suscripción, acceso, conversión entre filas y configuración). También `api.ts`, con las operaciones y los mensajes de error en español.
- `src/features/account/session.ts`: la sesión y qué granja corre en la simulación.
  - El cliente ve su granja, cargada desde Supabase.
  - "Ver demo" y el administrador o instalador usan la granja demo del teléfono, hasta abrir la de un cliente desde Clientes.
- La navegación usa `Stack.Protected`: cada grupo de pantallas existe solo en su estado (ingreso, cambio de contraseña, suscripción vencida o app). Clientes solo existe para el administrador y los instaladores.
- Sin señal, la app abre con la última copia del perfil y la granja guardada en el teléfono. Al volver la señal, se sincroniza.
- Mientras no haya sensores, la granja del cliente sigue simulada, con la etiqueta "Simulación", pero con su configuración real.

**Operación** (con `.env` creado desde `.env.example`, fuera del repositorio):

| Comando | Qué hace |
|---|---|
| `npm run db:push` | Aplica las migraciones pendientes (por el pooler) |
| `npm run functions:deploy` | Publica las Edge Functions |
| `npm run db:types` | Regenera los tipos de TypeScript de la base de datos |
| `npm run db:seed-admin` | Crea el primer administrador |
| `npm run test:live` | Pruebas de integración contra Supabase con usuarios temporales, que se borran al final |

## 12. Modo demo

`src/services/simulation/scenarios.ts` define los escenarios:
- ola de calor
- falta de agua
- falta de alimento
- baja actividad animal
- sensor desconectado

Los escenarios **modifican el modelo físico**, no los números que se muestran. Lo que se ve en pantalla es la respuesta real del motor. La simulación corre en vivo o acelerada (1, 5 o 15 min/s). Un escenario también afecta la producción: una ola de calor hoy baja la postura de mañana.

**Mientras no haya hardware**, el interior del galpón se simula, pero con el clima y el sol reales de la ubicación (fase 6).

## 13. Preparación para hardware (fase 8, no implementado)

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

## 14. Backend (fase 9: 9a hecha, el resto pendiente)

Supabase. Ya está hecho (9a, sección 11):
- autenticación
- granjas por cliente, instalador y administrador
- configuración de la granja en la base de datos
- suscripción

Pendiente:
- registro diario de producción real (9b)
- histórico de lecturas (nueva implementación de `HistoryRepository`)
- persistencia de alertas y decisiones
- notificaciones push de alertas críticas
- ejecución del motor en el servidor y dispositivos (con el hardware)

## 15. Visión artificial (fase 11, no implementada)

Contrato previsto en `src/domain/vision/types.ts`:
- **Detección de movimiento:** índice de movimiento por zona.
- **Comportamiento anormal:** aglomeración, jadeo por calor, inmovilidad, picaje.
- **Conteo de animales:** conteo frente a población esperada.
- **Análisis por cámara:** eventos con confianza del modelo e imagen asociada.

El análisis de video se hará en un gateway local o en la nube, no en el teléfono. La app recibirá `VisionEvent`/`VisionInsights`, que se añadirán al `ZoneContext`, para que las reglas o la IA combinen visión y sensores (por ejemplo: baja actividad + aglomeración + temperatura alta → estrés térmico). El tipo de alerta `abnormalBehavior` ya está reservado.

## 16. Hoja de ruta

### Bloque A: app completa sin hardware (todo simulado)
| Fase | Contenido | Estado |
|---|---|---|
| 0 | Base del proyecto | ✅ |
| 1 | Dominio + simulación | ✅ |
| 2 | Dashboard | ✅ |
| 3 | Motor de reglas + alertas + modo demo | ✅ |
| 4 | Historial y gráficas (detalle por sensor, bandas, franjas de equipos, minigráficas, tabla por hora) | ✅ |
| 5 | Gemelo digital 3D, representación funcional alimentada por la simulación | ✅ |
| 6 | **Mundo real**: ubicación (Valledupar), sol y clima reales (Open-Meteo), gallinas con IA de NPC | ✅ |
| 7 | **Producción** (postura, mortalidad, consumo, conversión y sus causas) + **configuración** persistente (ubicación, galpón, programa de luz, umbrales) | ✅ (validar en teléfono) |

**Pendiente de producción:** registro manual de huevos recogidos y muertes, para comparar con lo estimado y calibrar el modelo. Más adelante, conteo automático (visión, fase 11).

### Bloque B: granja real (piloto)
| Fase | Contenido | Estado |
|---|---|---|
| 8 | Hardware: ESP32 + sensores + relés vía MQTT; control de seguridad local | Pendiente (sin hardware aún) |
| 9a | Cuentas: ingreso con cédula, roles (administrador, instalador, cliente), granjas en Supabase, suscripción con bloqueo en la base de datos | ✅ (validar en teléfono) |
| 9b | Registro diario de producción real (lo esperado por el modelo pasa a ser la referencia) | ⏭️ Siguiente |
| 9c | Historial persistente, push, panel de la empresa, motor en servidor, proxy de clima con licencia comercial | Pendiente |

### Bloque C: inteligencia
| Fase | Contenido | Estado |
|---|---|---|
| 10 | IA de decisiones: predicciones (p. ej. pre-ventilar según el pronóstico real), anomalías de consumo, recomendaciones explicadas | Pendiente |
| 11 | Visión artificial: movimiento, comportamiento anormal, conteo | Pendiente |
