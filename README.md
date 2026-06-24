# AssetX — Image Asset Management System

A Node.js/TypeScript monorepo for uploading, processing, enriching, and publishing image assets. See [docs/PRD.md](./docs/PRD.md) for the full product spec.

## Stack
- **Monorepo:** pnpm workspaces + Turborepo
- **Backend:** Fastify + Prisma (SQLite)
- **Worker:** BullMQ + Redis
- **Frontend:** Next.js (App Router, React 19)
- **Image processing:** sharp · **Auth:** argon2 + JWT
- **Tests:** Vitest (built fully via TDD)
- **Dev runtime:** Docker Compose (api, worker, web, redis) with hot-reload

## Layout
```
apps/
  api/      Fastify REST API (auth, assets, publishing)
  worker/   BullMQ consumers (process-asset, publish-asset)
  web/      Next.js UI (login, gallery, upload, detail, publish)
packages/
  shared-types/      Shared DTOs/enums
  storage/           StorageProvider + DiskStorageProvider (+ contract suite)
  image-processing/  SharpImageProcessor + default renditions
  auth/              Password hashing + JWT TokenService
  publishing/        ChannelPublisher + Local/Webhook channels + registry
  queue/             JobQueue abstraction (BullMQ + in-memory)
```

## Run with Docker (recommended)

The entire stack — **api, worker, web, and redis** — runs in containers with
hot-reload (source is bind-mounted). All environment is consolidated in a single
root `.env`.

```bash
# 1. Create your env file (one file for every service)
cp .env.example .env

# 2. Build and start everything
docker compose up --build
```

- Web → http://localhost:3000
- API → http://localhost:3001
- Redis → localhost:6379

A one-shot `migrate` service prepares the SQLite schema and seeds the super user
(`admin@assetx.local` / `admin12345`) before `api`/`worker` start. The database and
uploaded files live on a shared `app-data` volume (`/data/db`, `/data/storage`).

```bash
docker compose up -d --build        # detached
docker compose logs -f api worker   # follow logs
docker compose down                 # stop (keep data)
docker compose down -v              # stop and wipe volumes (fresh DB)
```

## Run locally without Docker (alternative)
```bash
pnpm install

# 1. Start Redis only
docker compose up -d redis

# 2. Configure & create the database (uses the root .env)
cp .env.example .env   # then adjust DATABASE_URL/STORAGE_ROOT to local paths
cd apps/api
DATABASE_URL="file:./dev.sqlite" pnpm prisma db push
DATABASE_URL="file:./dev.sqlite" pnpm db:seed
cd ../..

# 3. Build workspace packages (apps resolve to dist/)
pnpm --filter "./packages/*" build

# 4. Run each app (3 terminals)
pnpm --filter @assetx/api dev       # http://localhost:3001
pnpm --filter @assetx/worker dev
pnpm --filter @assetx/web dev       # http://localhost:3000
```

## Test
```bash
pnpm -r test          # all packages + apps  (69 tests)
pnpm --filter @assetx/api test
```

## Roadmap (v2)
- S3 storage provider (drop-in `StorageProvider`)
- LLM-generated metadata (`metadataSource: llm`)
- Additional publishing channels
