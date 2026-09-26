# VigíaAI (nombre provisional)

Plataforma móvil de monitoreo y automatización inteligente de granjas.

**Para quién:**
- **Propietarios de granjas**: ven el estado de su instalación, reciben alertas y controlan equipos desde el móvil.
- **Empresas integradoras de automatización agropecuaria**: instalan sensores y controladores (ESP32, etc.) y usan VigíaAI como plataforma de supervisión para sus clientes.

**Enfoque inicial:** gallinas ponedoras. La arquitectura admite otras especies y cultivos mediante *perfiles productivos*.

## Estado actual (fases 0–6)

| Módulo | Estado |
|---|---|
| Base del proyecto (Expo SDK 57, TypeScript estricto, Expo Router) | ✅ |
| Modelo de dominio y perfil "gallinas ponedoras" | ✅ |
| Simulación IoT con modelo físico en circuito cerrado | ✅ |
| Dashboard | ✅ |
| Motor de reglas con registro de decisiones | ✅ |
| Alertas (deduplicación, severidad, antiparpadeo, historial) | ✅ |
| Modo demo (ola de calor, falta de agua o alimento, baja actividad, sensor caído) | ✅ |
| Historial y gráficas por sensor (bandas de umbral, franjas de equipos, cursor, tabla por hora, minigráficas) | ✅ |
| Gemelo digital 3D funcional (galpón, aves, equipos y sensores reaccionan a los datos) | ✅ |
| Mundo real: Valledupar, sol calculado localmente, clima real de Open-Meteo, modos en vivo/acelerado | ✅ |
| Gallinas con IA de NPC (utilidad + steering): duermen al ocultarse el sol, jadean con calor, se agolpan sin agua… | ✅ |
| Módulo de producción + configuración | Fase 7 — siguiente |
| Hardware (MQTT/ESP32), servidor, IA, visión artificial | Fases 8–11 |

Sin hardware todavía: el interior del galpón se simula, alimentado por el **clima y el sol reales** de Valledupar (Open-Meteo, uso no comercial). La simulación arranca con 24 h de historia generada con el clima real de ayer.

## Comandos

```bash
npm install
npx expo start        # abre en Expo Go (escanear QR) o pulsa w para web
npm test              # pruebas del motor y la simulación
npm run typecheck     # TypeScript
npm run lint          # ESLint
```

## Estructura

```
src/
├── app/              # Rutas (Expo Router): solo re-exportan pantallas
├── domain/           # Tipos, perfiles, sol, programas de luz, comportamiento animal, visión (futuro). TS puro
├── engine/           # Motor de reglas, alertas, contexto. TS puro
├── services/
│   ├── telemetry/    # Interfaz TelemetrySource (frontera con el hardware)
│   ├── simulation/   # SimulatedSource + modelo físico + escenarios demo
│   ├── history/      # HistoryRepository (historial) + analítica del periodo
│   ├── weather/      # Clima real (Open-Meteo) + respaldo sintético
│   └── runtime/      # FarmRuntime: orquesta fuente → motor → store
├── store/            # Estado global (Zustand) y selectores
├── features/         # Pantallas por módulo (dashboard, twin, sensors, alerts, automation, demo)
├── components/ui/    # Sistema de componentes reutilizables
├── components/charts/# Gráficas SVG (serie temporal, minigráfica)
├── theme/            # Tokens de color (claro/oscuro), espaciado
├── hooks/, utils/
```

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para el detalle.
