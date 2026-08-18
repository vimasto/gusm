# @gusm/weightroom

Aplicación principal de GYMU para la Sala de Musculación UTFSM Concepción. Su desarrollo se ejecuta desde la raíz del monorepo:

```bash
pnpm exec turbo dev --filter=@gusm/weightroom
```

Rutas activas: `/login`, `/reserva`, `/en-vivo`, `/perfil`, `/qr` y `/qr/escanear`.

La configuración, los comandos de Supabase y las convenciones compartidas están en
[`../../AGENTS.md`](../../AGENTS.md) y en el [README raíz](../../README.md). Antes de
escribir código de Next.js 16, leer la guía pertinente en `node_modules/next/dist/docs/`.
