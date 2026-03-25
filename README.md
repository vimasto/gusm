# gusm

pnpm + Turborepo monorepo. Node ≥24, `pnpm@9`.

## Apps (`apps/*`)

| Package      | Description | Dev port |
|-------------|-------------|----------|
| `student`   | Next.js 16  | 3000     |
| `readonly`  | Next.js 16  | 3001     |
| `backoffice`| Next.js 16  | 3002     |

## Packages (`packages/*`)

- `@gusm/typescript-config` — shared `tsconfig` presets (`base`, `nextjs`, `react-library`)
- `@gusm/oxc-config` — shared [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) / [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) config

## Root scripts

```sh
pnpm install
pnpm dev              # all apps via turbo
pnpm build
pnpm lint
pnpm format
pnpm format:check
pnpm check-types
```

Single app (examples):

```sh
pnpm exec turbo dev --filter=student
pnpm exec turbo build --filter=backoffice
```

## Tooling

- TypeScript, Oxlint, Oxfmt (apps extend `@gusm/oxc-config`), Tailwind 4 in apps.

## Remote cache

Optional: [Turborepo remote caching](https://turborepo.dev/docs/core-concepts/remote-caching) — `turbo login` / `turbo link` (or `pnpm exec turbo …`).
