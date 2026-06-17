# AssetX — Image Asset Management System

A Node.js/TypeScript monorepo for uploading, processing, enriching, and publishing image assets. See [PRD.md](./PRD.md) for the full product spec.

## Stack
- **Monorepo:** pnpm workspaces + Turborepo
- **Backend:** Fastify + Prisma (SQLite)
- **Worker:** BullMQ + Redis
- **Frontend:** Next.js (App Router, React 19)
- **Image processing:** sharp · **Auth:** argon2 + JWT
- **Tests:** Vitest (built fully via TDD)

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

## Setup
```bash
pnpm install

# 1. Start Redis
docker compose up -d redis

# 2. Configure & create the database
cp apps/api/.env.example apps/api/.env
cd apps/api
DATABASE_URL="file:./dev.sqlite" pnpm prisma db push
DATABASE_URL="file:./dev.sqlite" pnpm db:seed   # creates admin@assetx.local / admin12345
cd ../..

# 3. Build workspace packages (apps resolve to dist/)
pnpm --filter "./packages/*" build
```

## Run (3 terminals)
```bash
# API  (http://localhost:3001)
pnpm --filter @assetx/api dev

# Worker
pnpm --filter @assetx/worker dev

# Web  (http://localhost:3000)
pnpm --filter @assetx/web dev
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
