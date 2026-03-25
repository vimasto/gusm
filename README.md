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

## Supabase

1. run:

```sh
   cp apps/student/.env.example apps/student/.env.local
   cp apps/readonly/.env.example apps/readonly/.env.local
   cp apps/backoffice/.env.example apps/backoffice/.env.local
```

env values are the same for all apps.

2. **link supabase CLI** (migrations + `pnpm db:types` use `--linked`). Install deps, log in, then link from the package that owns `supabase/config.toml`:

   ```sh
   pnpm install
   pnpm --filter @gusm/database exec supabase login
   pnpm --filter @gusm/database exec supabase link --project-ref "pxqnyizbmmucqlnghqgh"
   ```

3. **generate db types** whenever remote schema changes (this should be committed to the repo):

   ```sh
   pnpm db:types
   ```

### Migrations

Needs `supabase link` above. `pnpm db:push` runs pending SQL in `packages/database/supabase/migrations/` against **the linked project**.

Never add, rename, or drop migration `.sql` files by hand in that folder — only the Supabase CLI (`pnpm db:migration:new`, `migration squash`, etc.) may create or consolidate migration files. Edit the SQL **inside** files the CLI already generated.

**New migration**

```sh
pnpm db:migration:new -- add_course_module_columns
```

That creates a timestamped `.sql` file; fill in DDL (tables, RLS, functions, grants), then review.

**Apply & types**

1. `pnpm db:push`
2. `pnpm db:types` if the schema changed; commit migration(s) + updated `packages/database/src/database.types.ts`.

**Inspect what ran**

```sh
pnpm --filter @gusm/database exec supabase migration list
```

Compares files under `packages/database/supabase/migrations/` with the linked (remote) project.

**Not applied to linked DB yet** (`db:push` never run for that file, or PR still open): edit that file’s SQL, or delete the file only if it was never pushed — then use `pnpm db:migration:new -- …` again for a new stub. Treat rewrites as a normal git amend / revert: anyone who already pulled the old file should reset or merge your fix.

**Already applied** (`db:push` succeeded on shared env): do not change that migration’s content to “replay” a different story — remote stores versions/checksums; edits confuse CI and teammates. Ship a **new** migration that corrects the schema (`ALTER`, backfill, `DROP`, new RLS, etc.). Removing the file from git does not roll back Postgres.

**Rare**: `pnpm --filter @gusm/database exec supabase migration repair` adjusts the remote `schema_migrations` history when it diverges from reality (ops incident). Read `supabase migration repair --help`; wrong flags can strand a database.

**Cleanup many files**: `pnpm --filter @gusm/database exec supabase migration squash` merges older migrations into one; only when those versions are not depended on everywhere — see `supabase migration squash --help`.
