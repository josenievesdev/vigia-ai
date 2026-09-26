# VigíaAI (nombre provisional)

Plataforma móvil de monitoreo y automatización inteligente de granjas.

**Para quién:**
- **Propietarios de granjas**: ven el estado de su instalación, reciben alertas y controlan equipos desde el móvil.
- **Empresas integradoras de automatización agropecuaria**: instalan sensores y controladores (ESP32, etc.) y usan VigíaAI como plataforma de supervisión para sus clientes.

**Enfoque inicial:** gallinas ponedoras. La arquitectura admite otras especies y cultivos mediante *perfiles productivos*.

## Estado actual (fases 0–7, 9a y 9b)

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
| Producción: huevos, % de postura, mortalidad, alimento y agua por ave, conversión, y qué la está afectando (calor, luz, agua…) | ✅ |
| Configuración de la granja: ubicación, galpón, edad del lote, programa de luz y umbrales | ✅ |
| Cuentas (Supabase): ingreso con cédula, administrador / instalador / cliente, suscripción con bloqueo en la base de datos, demo sin cuenta | ✅ |
| Registro diario de producción real: registrado frente a estimado, ajuste del modelo a la granja y aviso de caída de postura | ✅ |
| Varios galpones por granja y autorización de tratamiento de datos (Ley 1581) | ✅ |
| App instalable, notificaciones, panel de la empresa | Fase 9c — siguiente |
| Hardware (MQTT/ESP32), IA, visión artificial | Fases 8, 10 y 11 |

Sin hardware todavía: el interior del galpón se simula, alimentado por el **clima y el sol reales** de la ubicación (Valledupar por defecto; Open-Meteo, uso no comercial). La simulación arranca con 24 h de historia; la producción, con 30 días estimados con el clima real del último mes. Para presentar la app se usa **"Ver demo sin cuenta"**.

> **¿Retomas el proyecto?** Empieza por [docs/ESTADO.md](docs/ESTADO.md): dónde quedó todo, pendientes y próximos pasos.

## Comandos

```bash
npm install
npx expo start        # abre en Expo Go (escanear QR) o pulsa w para web
npm test              # pruebas (sin red)
npm run typecheck     # TypeScript
npm run lint          # ESLint
```

### Servidor (Supabase)

Sin `.env` la app funciona solo con "Ver demo sin cuenta". Para las cuentas:

1. Copiar `.env.example` como `.env` y completarlo. `.env` nunca se sube: el repositorio es público.
2. Preparar el servidor:

```bash
npm run db:push            # crea las tablas y las reglas de acceso (supabase/migrations)
npm run functions:deploy   # publica la función que crea las cuentas (manage-users)
npm run db:seed-admin      # crea el primer administrador (ADMIN_CEDULA de .env)
npm run test:live          # opcional: prueba permisos y flujos contra Supabase con usuarios temporales
```

3. Ingresar con la cédula del administrador (la contraseña inicial es la misma cédula; la app pide cambiarla).
4. Desde **Más → Clientes e instaladores** se crean las cuentas de clientes (con su granja) e instaladores.

## Estructura

```
src/
├── app/              # Rutas (Expo Router): solo re-exportan pantallas
├── domain/           # Tipos, perfiles, sol, luz, comportamiento animal, modelo de producción, visión (futuro). TS puro
├── engine/           # Motor de reglas, alertas, contexto. TS puro
├── services/
│   ├── telemetry/    # Interfaz TelemetrySource (frontera con el hardware)
│   ├── simulation/   # SimulatedSource + modelo físico + escenarios demo
│   ├── history/      # HistoryRepository (historial) + analítica del periodo
│   ├── weather/      # Clima real (Open-Meteo) + respaldo sintético + búsqueda de lugares
│   ├── production/   # ProductionService: historial de 30 días + día en curso
│   ├── config/       # Configuración de la granja: validación y guardado en el teléfono
│   ├── account/      # Cuentas: identidad por cédula, suscripción, acceso, política de datos, operaciones con Supabase
│   ├── records/      # Registro diario de producción: Supabase, teléfono (demo) y pendientes sin señal
│   └── runtime/      # FarmRuntime: orquesta fuente → motor → producción → store
├── lib/              # Cliente de Supabase
├── store/            # Estado global (Zustand): granja, sesión y registros
├── features/         # Pantallas por módulo (dashboard, twin, production, zones, alerts, more, settings, account, accounts…)
├── components/ui/    # Sistema de componentes reutilizables
├── components/charts/# Gráficas SVG (serie temporal, barras, minigráfica)
├── theme/            # Tokens de color (claro/oscuro), espaciado
├── hooks/, utils/
supabase/
├── migrations/       # Esquema de la base de datos y reglas de acceso (RLS), en orden
└── functions/        # Edge Functions (Deno): manage-users crea y gestiona cuentas
scripts/              # Comandos del servidor (migraciones, funciones, primer administrador)
```

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para el detalle y [docs/ESTADO.md](docs/ESTADO.md) para el estado actual y los próximos pasos.
