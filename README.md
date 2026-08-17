# gusm

PWA única para gestión y reserva del gimnasio UTFSM Concepción.

## Desarrollo

Requiere Node.js 24 o superior y `pnpm@9`.

```sh
pnpm install
pnpm exec turbo dev --filter=@gusm/weightroom
```

La aplicación vive en `apps/weightroom` y usa las rutas `/login`, `/reserva` y `/en-vivo`. Las antiguas aplicaciones `readonly`, `backoffice` y `booking` fueron consolidadas como route groups de `weightroom`.

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

## Verificación

```sh
pnpm lint
pnpm check-types
pnpm format:check
```

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
