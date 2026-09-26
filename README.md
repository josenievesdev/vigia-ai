# VigíaAI (nombre provisional)

Plataforma móvil de monitoreo y automatización inteligente de granjas.

**Para quién:**
- **Propietarios de granjas**: ven el estado de su instalación, reciben alertas y controlan equipos desde el móvil.
- **Empresas integradoras de automatización agropecuaria**: instalan sensores y controladores (ESP32, etc.) y usan VigíaAI como plataforma de supervisión para sus clientes.

**Enfoque inicial:** gallinas ponedoras. La arquitectura admite otras especies y cultivos mediante *perfiles productivos*.

## Estado actual (fases 0–4)

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
| Gemelo digital 3D (simulado) | Fase 5 — siguiente |
| Módulo de producción + configuración | Fase 6 |
| Hardware (MQTT/ESP32), servidor, IA, visión artificial | Fases 7–10 |

Sin hardware todavía: toda la app funciona sobre la simulación, que arranca con 24 h de historia previa.

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
├── domain/           # Tipos, perfiles de especie, catálogo, visión (futuro). TS puro
├── engine/           # Motor de reglas, alertas, contexto. TS puro
├── services/
│   ├── telemetry/    # Interfaz TelemetrySource (frontera con el hardware)
│   ├── simulation/   # SimulatedSource + modelo físico + escenarios demo
│   ├── history/      # HistoryRepository (historial) + analítica del periodo
│   └── runtime/      # FarmRuntime: orquesta fuente → motor → store
├── store/            # Estado global (Zustand) y selectores
├── features/         # Pantallas por módulo (dashboard, sensors, alerts, automation, demo)
├── components/ui/    # Sistema de componentes reutilizables
├── components/charts/# Gráficas SVG (serie temporal, minigráfica)
├── theme/            # Tokens de color (claro/oscuro), espaciado
├── hooks/, utils/
```

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para el detalle.
