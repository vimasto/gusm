# GYMU

PWA única para gestión y reserva de la Sala de Musculación UTFSM Concepción.

## Desarrollo

Requiere Node.js 24 o superior y `pnpm@9`.

```sh
pnpm install
pnpm exec turbo dev --filter=@gusm/weightroom
```

La aplicación vive en `apps/weightroom` y usa las rutas `/login`, `/reserva`, `/en-vivo`, `/perfil`, `/qr` y `/qr/escanear`. Las antiguas aplicaciones `readonly`, `backoffice` y `booking` fueron consolidadas como route groups de `weightroom`.

## Variables de entorno

Crear `apps/weightroom/.env.local` con:

```sh
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SANSANO_AUTH_BASE_URL=https://sansano-auth.fly.dev
SANSANO_AUTH_API_KEY=
GUSM_IDENTITY_HMAC_KEY=
```

`SUPABASE_SECRET_KEY`, `SANSANO_AUTH_API_KEY` y `GUSM_IDENTITY_HMAC_KEY` son exclusivas de código server-side. `GUSM_IDENTITY_HMAC_KEY` debe ser un secreto aleatorio, estable y distinto de las demás claves.

### Modo presentación local

Por defecto `/login` usa SIGA. Para una presentación local controlada, agregar
`NEXT_PUBLIC_GYMU_PRESENTATION_LOGIN_BYPASS=enabled` a `apps/weightroom/.env.local`, reconstruir
y reiniciar la aplicación. Mientras esté habilitado, cualquier formulario de login, incluso vacío, abre la
sesión del usuario de demostración `ivan.gallardo`. Nunca configurar esa variable en Cloudflare,
Vercel ni otro deployment remoto.

## Verificación

```sh
pnpm lint
pnpm check-types
pnpm format:check
```

## Despliegue en Vercel

GYMU se despliega como un proyecto Vercel asociado a este monorepo. La detección nativa de
Turborepo y pnpm resuelve las dependencias `workspace:*`; no agregar `vercel.json` ni copiar
los paquetes compartidos al directorio de la aplicación.

En la importación inicial del repositorio configurar:

- Framework Preset: `Next.js`.
- Root Directory: `apps/weightroom`.
- Include source files outside of the Root Directory in the Build Step: habilitado.
- Node.js Version: `24.x`.
- Install Command y Build Command: los valores detectados por Vercel para pnpm y Turborepo.

El único proyecto Supabase actual es productivo. Hasta crear un proyecto separado de staging,
configurar estas variables solo en **Production**. Los previews no deben recibir secretos de
producción ni deben usarse para validar mutaciones reales:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
SANSANO_AUTH_BASE_URL
SANSANO_AUTH_API_KEY
GUSM_IDENTITY_HMAC_KEY
```

`SUPABASE_SECRET_KEY`, `SANSANO_AUTH_API_KEY` y `GUSM_IDENTITY_HMAC_KEY` se agregan como
secretos sensibles. Una modificación de variables requiere un nuevo deployment. Vercel Hobby
está restringido por Vercel a uso personal y no comercial; usarlo inicialmente como piloto y
confirmar su adecuación institucional antes de declarar el servicio como producción permanente.

Para evitar la pausa por inactividad de Supabase Free, GitHub Actions ejecuta
`.github/workflows/supabase-keepalive.yml` todos los días. En el repositorio, crear estos
Actions secrets antes de fusionar el workflow a la rama predeterminada:

```text
SUPABASE_PROJECT_URL     # URL del proyecto, sin necesidad de barra final
SUPABASE_KEEPALIVE_KEY   # SUPABASE_SECRET_KEY, nunca la publishable key
```

Tras el primer deployment productivo verificar manualmente `/login`, aceptación de términos,
`/reserva`, `/perfil`, emisión QR y una lectura controlada de `/qr/escanear`.

## Supabase

```sh
pnpm --filter @gusm/database exec supabase login
pnpm --filter @gusm/database exec supabase link --project-ref "pxqnyizbmmucqlnghqgh"
pnpm db:migration:new -- nombre-descriptivo
pnpm db:push
pnpm db:types
```

Las migraciones se crean exclusivamente por CLI y, una vez aplicadas al proyecto compartido, no se modifican. Para una corrección se agrega una nueva migración.

Las reglas de producto, seguridad, repositorio y estilo están en [AGENTS.md](AGENTS.md).

## Estación QR de asistencia

`/qr` muestra al usuario un token opaco de un uso, asociado al bloque vigente y válido
solo durante sus primeros 15 minutos. `/qr/escanear` debe quedar abierto en el computador de
la sala con una sesión de `gym_staff` o `admin`.

El escáner Zebra se configura como teclado USB (HID Keyboard) con sufijo Enter. No requiere
cámara, Bluetooth, Web Serial ni SDK del dispositivo. El control de permisos y el consumo de
un solo uso ocurren en el backend, no en el navegador.

## Pendientes de producto

- Perfil: permitir compartir en redes un sticker de imagen con calendario mensual de asistencias y racha. La implementación debe capturar o componer solo datos ya visibles al usuario; no usar cámara ni subir imágenes hasta definir el flujo nativo.
- Términos: la versión vigente es la `2`. Al actualizar el texto institucional de `/terminos`, incrementar `system_settings.current_terms_version` en la misma entrega.
