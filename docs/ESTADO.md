# Estado del proyecto: punto de retorno

> **Última actualización:** 26 de septiembre de 2026 · **último commit de código:** `217f4e2` (Fase 9b).
>
> Si retomas el proyecto (persona o Claude Code), lee en este orden:
> 1. este archivo: dónde quedó todo y por dónde seguir;
> 2. [`AGENTS.md`](../AGENTS.md): reglas de trabajo y convenciones del código;
> 3. [`docs/ARCHITECTURE.md`](ARCHITECTURE.md): diseño completo, módulo por módulo.

## 1. En una frase

VigíaAI es una app (Expo/React Native + Supabase) para vigilar y automatizar granjas de gallinas ponedoras. Es el proyecto académico ADSO (SENA) del usuario. Funciona completa con la granja simulada, con el clima y el sol reales de Valledupar. Para presentarla se usa **"Ver demo sin cuenta"**. Falta el hardware (ESP32), que el usuario todavía no tiene.

## 2. Qué está hecho

| Fase | Contenido | Commit |
|---|---|---|
| 0–4 | Base, simulación en circuito cerrado, inicio, motor de reglas, alertas, modo demo, historial y gráficas | `fa2a480` |
| 5 | Gemelo digital 3D del galpón | `c1aaa3c` |
| 6 | Mundo real: clima de Open-Meteo, sol con ecuaciones NOAA, gallinas con IA de videojuegos | `5c5e3ae` |
| 7 | Producción (modelo) y configuración de la granja | `bfdef92` |
| 9a | Cuentas con Supabase: ingreso con cédula, roles, suscripción, RLS; el teclado ya no tapa los formularios | `3a8f73a` |
| 9b | Registro diario de producción real, varios galpones, autorización de datos (Ley 1581) | `217f4e2` |

El usuario probó y aprobó cada fase en su celular (Expo Go).

**Verificación al cierre:** 125 pruebas automáticas y 9 en vivo contra Supabase, sin fallas. TypeScript, ESLint y expo-doctor (21/21) sin errores. Las exportaciones para Android, iOS y web funcionan, y se revisó que ningún secreto de `.env` quedara dentro de la app.

## 3. Cómo retomar

1. Requisitos: Node 20 o superior (se trabajó con Node 24), npm y Expo Go en el celular.
2. `npm install`
3. Crear `.env` a partir de `.env.example`. **`.env` nunca se sube: el repositorio es público.** Sin `.env`, la app funciona solo con "Ver demo sin cuenta".
4. `npx expo start -c`, y escanear el QR con Expo Go (`w` abre la versión web).
5. Comprobar que todo sigue bien:
   - `npm test`: pruebas sin red.
   - `npm run typecheck`.
   - `npm run lint`.
   - `npm run test:live`: opcional, con `.env`; prueba contra Supabase con usuarios temporales que se borran al final.

## 4. Estado del servidor (Supabase)

Es el proyecto de Supabase configurado en `.env` (PostgreSQL 17).

- **Migraciones aplicadas** (`supabase/migrations/`, en orden):
  1. `20260926170000_accounts.sql`: usuarios, granjas, galpones, RLS y funciones de pagos y contraseña.
  2. `20260926171000_private_helpers.sql`: las funciones de apoyo de las políticas pasan al esquema `private`.
  3. `20260926180000_records_zones_consents.sql`: registro diario, varios galpones y autorización de datos.
- **Edge Function** `manage-users` publicada: crea clientes e instaladores, restablece contraseñas y elimina cuentas.
- **Auth:** el registro público está desactivado. La contraseña mínima en el servidor es de 6 caracteres, porque la inicial es la cédula; la app exige 8 o más para la nueva.
- **Administrador:** creado con `npm run db:seed-admin` (usa la `ADMIN_CEDULA` de `.env`).
- **Datos de prueba:** el usuario creó un instalador y un cliente con su granja. Se pueden borrar desde la app, como administrador.
- **Asesor de seguridad de Supabase:** 3 avisos intencionales (las funciones que la app llama; cada una valida a quien la llama) y 1 recomendación que requiere el plan pago (contraseñas filtradas).

## 5. Decisiones importantes y por qué

- **Simulación con clima real:** todo entra por `TelemetrySource`. Cuando llegue el ESP32 se cambia solo la fuente, en `src/services/runtime/index.ts`.
- **Ingreso con cédula:**
  - Supabase Auth usa un alias interno `<cédula>@vigia.local`.
  - La contraseña inicial es la cédula y se cambia obligatoriamente, porque la cédula no es secreta.
- **La seguridad está en la base de datos (RLS), no en la app.** La clave secreta solo existe en la Edge Function y en los scripts, nunca en la app.
- **Suscripción:** cada cliente tiene `paid_until` (30 días al crear la cuenta). Vencida, la base de datos deja de entregarle la granja.
- **Producción:** lo registrado es el dato y el modelo es la referencia. Cada número dice si es "Registrado" o "Estimado". Las muertes descuentan las aves del galpón por un disparador en la base de datos.
- **Galpones:** la app muestra un galpón a la vez (el activo). Registros, configuración y simulación son de cada galpón.
- **Ley 1581:** clientes e instaladores aceptan la política una vez. El administrador es el responsable del tratamiento y no la acepta.
- **Teclado:** se usa una solución propia (`KeyboardAwareScroll`), porque `react-native-keyboard-controller` no funciona en Expo Go.
- **3D en Hermes:** `metro.config.js` redirige `three` a su versión ESM. No quitarlo, o la app falla en el celular.

## 6. Pendientes conocidos

Los puntos 1 a 3 son pulido que el usuario decidió dejar para después.

1. **Administrador e instalador entran a la granja demo al iniciar sesión**, y eso confunde. Propuesta ya conversada:
   - abrir la última granja de cliente que vieron (o la del primer cliente de su lista);
   - si no tienen clientes, mostrar la demo con el aviso "Granja de ejemplo";
   - el aviso "Granja de X · Cambiar" lleva a la lista de clientes;
   - marcar siempre la demo como "Granja de ejemplo".
2. **Reasignar el instalador de un cliente.** Hoy el instalador es siempre quien creó la cuenta.
3. **En la versión web,** el botón "atrás" del navegador puede volver a una pantalla de un estado anterior (por ejemplo, el ingreso estando en la demo). En el celular no pasa.
4. **Política de datos** (`src/services/account/dataPolicy.ts`): es un texto base. Falta la razón social, el NIT, la dirección y el correo de la empresa, y una revisión legal. Si cambia de fondo, hay que subir `DATA_POLICY_VERSION`.
5. **`supabase/config.toml`** conserva los valores por defecto de la CLI. Solo importa para un Supabase local; el proyecto remoto se configuró por la API de administración.
6. **Antes de cobrarle a clientes reales:**
   - plan comercial de Open-Meteo, o un proxy propio;
   - plan pago de Supabase, porque el gratis se pausa tras unos 7 días sin uso (abrirlo antes de cada presentación).

## 7. Próximos pasos recomendados

1. **Fase 9c** (no necesita hardware):
   - **App instalable (APK) con EAS Build.** Además habilita las notificaciones push y `react-native-keyboard-controller`.
   - **Notificaciones** de alertas críticas y de suscripción por vencer.
   - **Panel del administrador:** todas las granjas, clientes al día o vencidos y alertas activas.
   - **Documentación para el SENA:** diagrama de la base de datos, casos de uso y manuales. Ya existe una guía de estudio para la presentación, publicada como página privada en la cuenta de claude.ai del usuario.
2. **Fase 8, cuando haya ESP32:** `MqttSource` que implemente `TelemetrySource`, validación de datos, detección de equipos desconectados y control de seguridad local (ver `docs/ARCHITECTURE.md`, sección 14).
3. **Fases 10 y 11:** IA de decisiones (por ejemplo, ventilar antes del calor según el pronóstico) y visión artificial (conteo de huevos con cámara).

## 8. Cómo trabaja el usuario

- Escribe en español. **Todo mensaje y reporte va en español, con frases cortas y simples.**
- El flujo de cada fase:
  1. se propone el plan;
  2. el usuario lo aprueba;
  3. se implementa;
  4. se verifica (pruebas, tipos, lint, exportaciones y revisión en la web);
  5. se reporta;
  6. el usuario prueba en su celular;
  7. **commit y push cuando lo valida o lo pide.**
- No avanzar al hardware ni a la IA avanzada sin su aprobación. Todavía no tiene el ESP32.
- Los commits van en español. Ver el historial para el formato, que incluye la línea `Co-Authored-By`.

## 9. Advertencias para quien retome (y para agentes)

- **Nunca subir `.env`:** el repositorio es público. Antes de cada commit, revisar `git diff --cached`.
- **No escribir contraseñas reales en el navegador,** porque viajan a Supabase.
  - Los flujos con sesión se prueban con `npm run test:live`.
  - Para ver una pantalla que necesita sesión, usar una ruta temporal de vista previa con un usuario ficticio y **borrarla** después.
- **Cambios en la base de datos:**
  1. crear una migración **nueva** (no editar una ya aplicada);
  2. `npm run db:push`;
  3. `npm run db:types`;
  4. `npm run test:live`.
- **Tipos de rutas:** crear archivos con `expo start` corriendo ensucia `.expo/types/router.d.ts`. Si `tsc` se queja de rutas, reiniciar el servidor.
- **Chrome en este equipo:** está al 80 % de zoom y la ventana suele quedar oculta. Usar clics por JavaScript. Con la ventana oculta, el 3D no se anima y el botón "atrás" de la barra no responde.
- **Antes de terminar un cambio:** `npm test`, `npx tsc --noEmit` y `npx expo lint`. Si se agregan dependencias nativas, además `npx expo export --platform ios --no-bytecode` y buscar APIs de Node en el paquete.

## 10. Mapa rápido de archivos clave

| Archivo | Qué hace |
|---|---|
| `src/app/_layout.tsx` | Rutas protegidas según el estado de la sesión (ingreso, contraseña, autorización, bloqueo, app) |
| `src/features/account/session.ts` | Sesión, granja abierta, galpones, registro de muertes |
| `src/services/runtime/index.ts` | Arma la granja: fuente de datos, clima, producción y dónde se guarda la configuración |
| `src/domain/behavior/flock.ts` | IA de las gallinas (utilidad + steering) |
| `src/domain/production/model.ts` · `records.ts` | Modelo de producción · registro real, ajuste y aviso de caída |
| `src/engine/` | Motor de reglas y alertas |
| `src/domain/solar.ts` · `src/services/weather/` | Sol calculado · clima de Open-Meteo |
| `supabase/migrations/` · `supabase/functions/manage-users/` | Esquema y RLS · creación y gestión de cuentas |
| `scripts/` | Comandos del servidor: migraciones, funciones, primer administrador |
