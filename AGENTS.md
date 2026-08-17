# gusm: contexto y convenciones para agentes

Este archivo es la referencia persistente del repositorio. Las instrucciones directas posteriores del responsable tienen prioridad.

## Producto y arquitectura

- gusm es una PWA única de gestión y reserva del gimnasio UTFSM Concepción.
- La única aplicación vigente es `apps/weightroom`, paquete `@gusm/weightroom`, Next.js 16 App Router, sin `src/` y alias `@/* -> ./*`.
- Los grupos `(user)`, `(staff)` y `(admin)` son route groups de la misma app, no aplicaciones independientes.
- Rutas públicas de producto: `/login`, `/reserva`, `/en-vivo`, `/qr`, `/perfil`, `/sobrecupo` y `/configuracion`.
- Roles acumulativos: `admin` incluye `gym_staff`; `gym_staff` incluye las capacidades de usuario; `student` y `u_staff` usan las rutas de usuario. `student` es el default; `u_staff` queda limitado a un bloque.
- Los bloques horarios fijos son: 1) 08:50-09:40, 2) 09:40-11:05, 3) 11:05-12:15, 4) 12:15-13:40, 5) 14:40-15:50, 6) 15:50-17:15, 7) 17:15-18:40, 8) 18:40-19:40 y 9) 19:40-21:05.
- El bloque 7 es exclusivo para `u_staff` y los roles acumulativos `gym_staff` y `admin`. Un `u_staff` solo puede reservar su bloque asignado; los roles superiores pueden reservar el bloque 7 aunque no tengan `allowed_time_block_id`.
- Los cierres se modelan como reglas semanales o excepciones por fecha. La excepción aislada es `time_block_closure`, creada o removida solo por `admin` mediante RPC. No cancela ni altera reservas existentes: se rechaza si el bloque/fecha aún tiene reservas activas, que deben resolverse primero.

## Reserva y asistencia

- `is_overcapacity` es un booleano persistente de `booking`, decidido por `gym_staff`; nunca se calcula por posición ni por una view.
- Bajo la capacidad normal, el usuario reserva directamente. Al alcanzarla, staff autoriza excepcionalmente y el usuario ejecuta el mismo submit/UI de reserva; la reserva queda flageada como sobrecupo.
- Staff autoriza, el estudiante ejecuta. Staff nunca reserva en nombre de otro usuario.
- `UNIQUE(user_id, time_block_id, booking_date)` evita duplicados. La reserva usa lock transaccional por fecha y bloque para evitar carreras.
- Estados: `reserved`, `confirmed`, `present`, `absent`, `cancelled`.
- `cancelled -> reserved` está permitido antes del inicio, reactivando la misma fila y revalidando reglas y capacidad.
- La reconfirmación abre cuatro horas antes del inicio y cierra al iniciar el bloque. Al inicio, el sistema lleva `reserved -> absent` y crea warning.
- Check visual: staff reconcilia durante los primeros 15 minutos desde el inicio; esa información permite autorizar sobrecupos a tiempo.
- `fin_del_bloque + 15 min` es solo finalizador de respaldo para reservas aún `confirmed`.
- Warnings son eventos inmutables separados de `booking`: `missed_confirmation`, `missed_qr`, `unbooked_attendance`.

## Seguridad, SIGA y Realtime

- `proxy` controla navegación; RLS y RPCs controlan acceso y mutaciones reales.
- El navegador no escribe directamente en reservas, autorizaciones, warnings, eventos ni QR. Las operaciones pasan por RPCs transaccionales.
- Roles de autorización se consultan desde `app_user`; un JWT puede ayudar a la UI, pero no es autoridad definitiva.
- La API SIGA propia tiene autorización institucional. Credenciales solo viajan por backend, no se guardan ni aparecen en logs. La sesión interna se emite desde el backend.
- Login: el navegador hace `POST /api/auth/login` con `username`, `domain` y `password`. El Route Handler llama a `SANSANO_AUTH_BASE_URL/auth/profile` con `X-Api-Key` server-only y solicita únicamente `nombre` y `rut`; el RUT se normaliza y HMAC-SHA-256 antes de crear o resolver `app_user`. Nunca se devuelve ni persiste ese perfil.
- La caché de sesión SIGA de sansano-auth es interna y no autoriza GUSM. El backend emite una sesión Supabase por OTP interno de un solo uso, ligado a un correo sintético HMAC, para que `auth.uid()` y RLS funcionen. No se manda correo ni token al cliente.
- No persistir RUT ni correo institucional en tablas de negocio: usar solo HMAC de identidad.
- Pendiente de migración e integración en login: persistir únicamente el último `username` institucional exitoso, es decir, el texto antes de `@`, en una relación privada 1:1 con `app_user`. No guardar dominio, correo completo, RUT ni historial de identificadores. El dato es para métricas y exportación futuras de `admin`; nunca tendrá acceso directo desde navegador ni estará en `app_user`, porque `gym_staff` puede consultar esa tabla.
- QR: token opaco, aleatorio, de un uso y vida corta; persistir solo su hash.
- `live_occupancy` expone solo nombre, bloque, fecha y posición. Nunca RUT, correo, IDs, warnings, autorizaciones ni ausencias.
- Realtime emite invalidaciones privadas por fecha/bloque, no cambios crudos de `booking`.
- Fechas y bloques se interpretan con `America/Santiago`, nunca con la zona del navegador.

## Monorepo y herramientas

- Usar `pnpm@9`, Turborepo y Node.js 24 o superior.
- Paquetes compartidos: `@gusm/database`, `@gusm/utils`, `@gusm/oxc-config`, `@gusm/typescript-config`. Crear paquetes desde `packages/_template`.
- Las utilidades reutilizables viven en `packages/utils/src/` y usan subpaths de `@gusm/utils`.
- Turbo filtra por nombre de paquete completo: `pnpm exec turbo dev --filter=@gusm/weightroom`.
- Antes de modificar código Next.js, leer la guía local pertinente en `node_modules/next/dist/docs/`; la versión instalada tiene cambios incompatibles con versiones anteriores.
- `.agents` es la fuente canónica de skills. `.opencode` es un symlink intencional hacia `.agents`; mantener ambos. No recrear `.claude/skills` duplicado.

## Supabase y migraciones

- Ejecutar Supabase CLI mediante `pnpm --filter @gusm/database exec supabase ...`.
- Crear migraciones solo con `pnpm db:migration:new -- nombre`; no agregar, renombrar ni borrar archivos de migración manualmente.
- `pnpm db:push` modifica el proyecto compartido. Una migración aplicada es inmutable; las correcciones posteriores requieren una nueva migración.
- Tras un cambio de schema ejecutado, correr `pnpm db:types`. `packages/database/src/database.types.ts` es generado: no editarlo manualmente ni ocultar errores con casts.
- Variables de app: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; el backend privilegiado requiere `SUPABASE_SECRET_KEY`, que nunca llega al navegador.
- Los SQL de diseño fuera de `packages/database/supabase/migrations/` son drafts. Antes de usarlos, crear la migración CLI correspondiente y copiar el contenido revisado.

## Desarrollo y verificación

- Construir verticales completas: migración/RPC, prueba repetida contra Supabase y luego UI conectada. No construir interfaces completas con mocks antes del flujo real.
- No hay tests ni CI. Al cerrar una vertical ejecutar `pnpm lint`, `pnpm check-types` y `pnpm format:check`, además de probar la ruta contra Supabase.
- `@gusm/utils` tiene una ruta errónea a `oxfmtrc.json`; si `format` falla solo ahí, reportarlo como breakage conocido antes de atribuirlo al cambio actual.
- La dependencia `eslint-plugin-react-quirks` de weightroom usa un `link:` absoluto y puede romper un `pnpm install` limpio. Diagnosticarlo antes de cambiar funcionalidad.

## Convenciones de código

- TypeScript estricto: usar `type`, tipar entradas y prohibir `any`.
- Usar `unknown` en fronteras externas, como JSON, API SIGA, QR y errores; validarlo con narrowing o type guards.
- No usar casts `as` para ocultar errores de dominio o discrepancias de Supabase. Se permiten excepciones justificadas como `as const` o interoperabilidad que TypeScript no pueda expresar.
- Usar `UPPER_SNAKE_CASE` para constantes, `camelCase` para funciones y utilidades, y `PascalCase` para componentes.
- Preferir funciones nombradas e inferencia de retornos; usar `if/else if` para ramas excluyentes y `for-of` para loops complejos.
- No crear abstracciones de uso único ni `useCallback` salvo dependencia de efecto o prop de componente memoizado.
- Evitar IIFE en JSX; calcular valores antes de `return`.
- Tailwind y `clsx` para UI. Evitar `style={{}}` salvo valores dinámicos que no puedan expresarse con clases o variables CSS. Definir colores propios en `@theme` de `globals.css`.
- Escala PWA global: controles interactivos y su texto usan como mínimo 16 px (`text-base`); etiquetas, validaciones y mensajes operativos usan como mínimo 14 px (`text-sm`). `text-xs` queda reservado para metadatos secundarios, como pies o texto auxiliar no interactivo.
- Usar `React.ComponentProps<"tag"> & Props` al extender elementos HTML; componentes simples usan `Props` acotado.
- Usar `Intl.PluralRules` para pluralización y `hooks/use-intl.tsx` para formato i18n.
