# Product Requirements Document (PRD)
## AssetX — Image Asset Management System

| | |
|---|---|
| **Product Name** | AssetX |
| **Version** | 1.0 (v1) |
| **Status** | Draft |
| **Last Updated** | 2026-06-17 |
| **Owner** | Engineering |

---

## 1. Overview

### 1.1 Summary
AssetX is a self-hosted image asset management system that lets users upload images, automatically processes them into multiple sizes (thumbnail, standard, etc.), enriches them with metadata, and publishes them to one or more external channels. The system is delivered as a Node.js monorepo containing a backend API and a frontend web application.

### 1.2 Problem Statement
Teams that work with image assets lack a single place to upload, normalize (resize/optimize), describe (metadata), and distribute images to multiple destinations. Manual handling is slow, inconsistent, and error-prone.

### 1.3 Goals
- Provide a simple UI to upload and manage images.
- Automatically generate multiple image renditions on upload.
- Capture and store metadata per asset (manual in v1, LLM-assisted later).
- Publish assets to configurable channels.
- Be fully built in Node.js, TypeScript, as a monorepo, following TDD.

### 1.4 Non-Goals (v1)
- S3 / cloud object storage (planned v2 — disk storage only in v1).
- LLM-generated metadata (planned later — manual metadata in v1).
- Multi-tenant organizations / billing.
- Video or non-image asset types.
- Advanced DAM features (versioning history, approval workflows).

---

## 2. Users & Use Cases

### 2.1 Personas
- **Content Manager** — uploads images, edits metadata, publishes to channels.
- **Developer / Integrator** — consumes the API to automate uploads and publishing.

### 2.2 Key Use Cases
1. As a user, I upload an image and it is stored and processed into multiple sizes.
2. As a user, I view a gallery of all uploaded assets with their renditions.
3. As a user, I add/edit metadata (title, description, tags, alt text) for an asset.
4. As a user, I publish an asset to one or more channels.
5. As a user, I delete an asset and all its renditions.

---

## 3. Functional Requirements

### 3.1 Image Upload
- **FR-1.1** Support uploading image files via the frontend and via the API.
- **FR-1.2** Accept formats: JPEG, PNG, WebP, GIF (static).
- **FR-1.3** Enforce a configurable max file size (default 25 MB).
- **FR-1.4** Validate MIME type and file signature (magic bytes), not just extension.
- **FR-1.5** Reject invalid/corrupt files with a clear error.
- **FR-1.6** Store the original file unmodified on disk.

### 3.2 Image Processing (Renditions)
- **FR-2.1** On successful upload, generate the following renditions using `sharp`:
  | Rendition | Max dimension (longest edge) | Format | Notes |
  |---|---|---|---|
  | `thumb` | 200px | WebP | Square-ish crop optional, fit=cover |
  | `standard` | 1024px | WebP | fit=inside, preserve aspect ratio |
  | `large` | 2048px | WebP | fit=inside, preserve aspect ratio |
  | `original` | — | source | Untouched original |
- **FR-2.2** Rendition set must be configurable (sizes/formats defined in config).
- **FR-2.3** Processing is dispatched to a background **job queue** (BullMQ); the API enqueues a `process-asset` job on upload. Asset status reflects progress (`pending` → `processing` → `ready` / `failed`).
- **FR-2.4** Extract intrinsic image metadata on upload: width, height, format, file size, EXIF (where available).
- **FR-2.5** Processing failures must be retryable (queue-level retries with backoff) and must not lose the original.

### 3.3 Metadata
- **FR-3.1** Each asset stores editable metadata: `title`, `description`, `altText`, `tags[]`.
- **FR-3.2** Each asset stores system metadata: dimensions, format, size, checksum (SHA-256), createdAt, updatedAt.
- **FR-3.3** Metadata is editable via API and UI.
- **FR-3.4** (Future) An LLM integration auto-suggests `title`, `description`, `altText`, and `tags`. The metadata model and API must be designed so this can be added without breaking changes (e.g., `metadataSource` field: `manual` | `llm`).

### 3.4 Storage
- **FR-4.1** v1: All files stored on the local filesystem under a configurable root directory.
- **FR-4.2** Storage layer must be abstracted behind a `StorageProvider` interface so a future `S3StorageProvider` (v2) can be dropped in without changing business logic.
- **FR-4.3** File paths/keys are derived from asset ID + rendition name; never trust client filenames for paths.

### 3.5 Publishing
- **FR-5.1** Users can publish an asset to one or more **channels**.
- **FR-5.2** Channels are pluggable via a `ChannelPublisher` interface.
- **FR-5.3** v1 ships with at least:
  - `LocalPublicChannel` — exposes the asset at a stable public URL.
  - `WebhookChannel` — POSTs a **JSON** payload (asset URLs + metadata) to a configured endpoint.
- **FR-5.4** Publishing runs as a background **job queue** task (`publish-asset`) with retries; each publish action records: channel, status (`success`/`failed`), timestamp, target reference/URL.
- **FR-5.5** Users can view publish history per asset and unpublish.

### 3.6 Asset Management
- **FR-6.1** List assets with pagination, search (by title/tag), and filter (by status).
- **FR-6.2** View a single asset with all renditions and metadata.
- **FR-6.3** Delete an asset (removes all renditions and storage objects).

### 3.7 Authentication & Authorization
- **FR-7.1** All asset, publishing, and channel endpoints require authentication.
- **FR-7.2** Users register / log in with email + password; passwords hashed with **argon2**.
- **FR-7.3** Auth uses **JWT** access tokens (short-lived) + refresh tokens (rotating).
- **FR-7.4** Role-based access: `admin` (manage users + all assets) and `user` (manage own assets). v1 may ship with a single `admin` seeded user; the model supports multiple users/roles.
- **FR-7.5** Assets are owned by the creating user; users only see/modify their own assets unless `admin`.
- **FR-7.6** Public/published asset URLs (`LocalPublicChannel`) are accessible without auth by design.
- **FR-7.7** Auth-sensitive endpoints (login, register) are rate-limited.

---

## 4. Non-Functional Requirements

- **NFR-1 (Performance)** Thumbnail generation should complete within a few seconds for typical images (<10 MB).
- **NFR-2 (Reliability)** Original is always persisted before processing begins; processing is idempotent.
- **NFR-3 (Security)** Validate file types, sanitize filenames, prevent path traversal, limit upload size, rate-limit upload endpoints.
- **NFR-4 (Testability)** TDD throughout; minimum 80% coverage on backend domain/service layers.
- **NFR-5 (Portability)** Storage and publishing are interface-driven to enable v2 (S3) and new channels.
- **NFR-6 (Observability)** Structured logging for upload, processing, and publish events.

---

## 5. Architecture

### 5.1 Monorepo Structure
```
assetx/
├── apps/
│   ├── api/                 # Fastify backend (TypeScript)
│   ├── worker/              # BullMQ worker (processes & publishes jobs)
│   └── web/                 # Next.js frontend (TypeScript)
├── packages/
│   ├── shared-types/        # Shared DTOs / types between FE & BE
│   ├── auth/                # JWT + argon2 auth utilities, guards
│   ├── queue/               # BullMQ queue/worker abstractions + job defs
│   ├── image-processing/    # sharp-based rendition pipeline
│   ├── storage/             # StorageProvider interface + DiskStorageProvider
│   └── publishing/          # ChannelPublisher interface + channels
├── docker-compose.yml       # Redis (and dev services)
├── package.json             # pnpm workspaces root
├── pnpm-workspace.yaml
├── turbo.json               # Turborepo pipeline
└── PRD.md
```

### 5.2 Technology Stack
| Layer | Choice |
|---|---|
| Language | TypeScript |
| Monorepo | pnpm workspaces + Turborepo |
| Backend | Fastify |
| Frontend | Next.js (React) |
| Database | SQLite via **Prisma ORM** |
| Job queue | **BullMQ + Redis** (async processing & publishing) |
| Auth | JWT (access + refresh), password hashing via argon2 |
| Image processing | sharp |
| Validation | zod |
| Testing | Vitest (unit/integration), Supertest (API), Playwright (E2E - optional) |
| Storage (v1) | Local disk (`DiskStorageProvider`) |
| Storage (v2) | AWS S3 (`S3StorageProvider`) |

### 5.3 Core Abstractions
```ts
interface StorageProvider {
  put(key: string, data: Buffer | Readable, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Readable>;
  getUrl(key: string): string;
  delete(key: string): Promise<void>;
}

interface ChannelPublisher {
  readonly id: string;
  publish(asset: PublishableAsset): Promise<PublishResult>;
  unpublish(reference: string): Promise<void>;
}

interface ImageProcessor {
  process(input: Buffer, renditions: RenditionSpec[]): Promise<ProcessedRendition[]>;
}
```

### 5.5 Background Jobs (BullMQ + Redis)
- The API stays thin: on upload it persists the original + an `Asset` row (`pending`), then **enqueues** a job. It never blocks on processing.
- A dedicated **worker** app (`apps/worker`) consumes jobs from Redis-backed queues.
- Queues / jobs:
  | Queue | Job | Trigger | Action |
  |---|---|---|---|
  | `assets` | `process-asset` | After upload | Generate renditions, extract metadata, set status `ready`/`failed`. |
  | `publishing` | `publish-asset` | Publish request | Run the target `ChannelPublisher`, record `Publication`. |
- Jobs use bounded **retries with exponential backoff**; permanent failures land on a dead-letter state and set asset/publication status to `failed`.
- Jobs are **idempotent** (safe to re-run on retry).

### 5.6 Data Model (SQLite via Prisma)
```
User
  id           (uuid, pk)
  email        (string, unique)
  passwordHash (string)            # argon2
  role         (admin|user, default user)
  createdAt    (datetime)
  updatedAt    (datetime)

RefreshToken
  id        (uuid, pk)
  userId    (fk -> User)
  tokenHash (string)
  expiresAt (datetime)
  revokedAt (datetime, nullable)

Asset
  id            (uuid, pk)
  ownerId       (fk -> User)
  originalName  (string)
  status        (pending|processing|ready|failed)
  checksum      (string, sha256)
  width         (int, nullable)
  height        (int, nullable)
  format        (string)
  sizeBytes     (int)
  title         (string, nullable)
  description   (text, nullable)
  altText       (string, nullable)
  tags          (json array)
  metadataSource(manual|llm, default manual)
  createdAt     (datetime)
  updatedAt     (datetime)

Rendition
  id        (uuid, pk)
  assetId   (fk -> Asset)
  name      (thumb|standard|large|original)
  storageKey(string)
  width     (int)
  height    (int)
  format    (string)
  sizeBytes (int)

Publication
  id         (uuid, pk)
  assetId    (fk -> Asset)
  channelId  (string)
  status     (success|failed)
  reference  (string, nullable)  # public URL or external id
  error      (text, nullable)
  createdAt  (datetime)
```

---

## 6. API Surface (v1)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | public* | Register a user (*admin-only after seed, configurable). |
| `POST` | `/api/auth/login` | public | Log in, returns access + refresh tokens. |
| `POST` | `/api/auth/refresh` | refresh token | Rotate tokens. |
| `POST` | `/api/auth/logout` | yes | Revoke refresh token. |
| `GET` | `/api/auth/me` | yes | Current user profile. |
| `POST` | `/api/assets` | yes | Upload an image (multipart). Returns asset with `pending` status; enqueues `process-asset`. |
| `GET` | `/api/assets` | yes | List own assets (pagination, search, filter). |
| `GET` | `/api/assets/:id` | yes | Get one asset with renditions + metadata. |
| `PATCH` | `/api/assets/:id` | yes | Update editable metadata. |
| `DELETE` | `/api/assets/:id` | yes | Delete asset and all renditions. |
| `GET` | `/api/assets/:id/renditions/:name` | yes | Stream/redirect to a rendition. |
| `POST` | `/api/assets/:id/publish` | yes | Publish to one or more channels (enqueues `publish-asset`). |
| `GET` | `/api/assets/:id/publications` | yes | List publish history. |
| `DELETE`| `/api/publications/:id` | yes | Unpublish. |
| `GET` | `/api/channels` | yes | List available channels. |
| `GET` | `/public/:id/:name` | public | Public rendition URL (via `LocalPublicChannel`). |
| `GET` | `/api/health` | public | Health check. |

All request/response bodies validated with zod; shared types exported from `packages/shared-types`. Authenticated routes require a `Bearer` access token; ownership is enforced per-asset (admins bypass).

### 6.3 Webhook Channel JSON Payload
`WebhookChannel` POSTs the following JSON to the configured endpoint:
```json
{
  "event": "asset.published",
  "asset": {
    "id": "uuid",
    "title": "string|null",
    "description": "string|null",
    "altText": "string|null",
    "tags": ["string"],
    "width": 1920,
    "height": 1080,
    "format": "webp",
    "renditions": {
      "thumb": "https://host/public/<id>/thumb",
      "standard": "https://host/public/<id>/standard",
      "large": "https://host/public/<id>/large",
      "original": "https://host/public/<id>/original"
    }
  },
  "publishedAt": "ISO-8601"
}
```

---

## 7. Frontend (Next.js)

### 7.1 Pages / Views
- **Login / Register** — authenticate; stores tokens, refreshes silently.
- **Gallery** — grid of the user's asset thumbnails, search/filter, upload button.
- **Upload** — drag-and-drop uploader with progress and validation feedback.
- **Asset Detail** — preview (all renditions), metadata editor, publish panel, publish history, delete.
- **Channels** — view configured channels.

### 7.2 UX Requirements
- Authenticated routes; unauthenticated users are redirected to login.
- Show processing status (pending/processing/ready/failed) with live updates (poll or websocket) — reflects queue progress.
- Inline validation for unsupported file types / oversized files before upload.
- Copy-to-clipboard for public/published URLs.

---

## 8. TDD Approach

Development follows the **Red → Green → Validate** cycle for every unit of behavior.

### 8.1 Test Layers
| Layer | Tooling | What it covers |
|---|---|---|
| Unit | Vitest | Domain logic, auth (token/hash), image-processing specs, storage/publisher implementations (with fakes) |
| Integration | Vitest + Supertest | API endpoints (incl. auth guards) against a real SQLite test DB, temp disk storage, and an in-memory/Redis test queue |
| E2E (optional) | Playwright | Login → upload → process → publish happy path through the UI |

### 8.2 Testing Rules
- No production code without a failing test first.
- Storage and publishing tested via in-memory/fake providers for isolation; a contract test suite verifies every `StorageProvider`/`ChannelPublisher` implementation.
- Image processing tested against fixture images asserting output dimensions/format.
- Target ≥80% coverage on `packages/*` and `apps/api` service layers.

### 8.3 Example Test Targets (RED first)
- `ImageProcessor` produces `thumb` ≤200px longest edge, WebP format.
- Upload rejects a `.txt` file disguised as `.jpg` (magic-byte check).
- `DiskStorageProvider.put` then `.get` round-trips bytes; `.delete` removes file.
- Password hashing: `verify(hash(pw)) === true`, wrong password === false.
- `POST /api/auth/login` returns access + refresh tokens; bad creds → 401.
- Protected route without/with invalid token → 401; valid token → 200.
- A user cannot read/modify another user's asset (403), admin can.
- `POST /api/assets` returns 201 with `status: pending` and **enqueues** a `process-asset` job.
- Worker `process-asset` handler transitions asset `pending → ready` and creates renditions; on failure → `failed` and retried.
- Publishing enqueues `publish-asset`; handler records a `Publication` row with correct status.

---

## 9. Roadmap

### v1 (this PRD)
- Monorepo scaffold (pnpm + Turborepo, TS).
- **Authentication & authorization** (JWT + argon2, roles, per-asset ownership).
- **Background job queue** (BullMQ + Redis) with a dedicated worker app.
- Upload + disk storage + sharp renditions (thumb/standard/large) via the queue.
- Manual metadata CRUD (Prisma + SQLite).
- Local public + webhook (JSON) publishing channels.
- Next.js login, gallery, upload, detail, publish UI.
- Full TDD coverage.

### v2
- **S3 storage provider** (swap `DiskStorageProvider` → `S3StorageProvider`).
- **LLM metadata integration** (auto title/description/altText/tags; `metadataSource: llm`).
- Additional channels (e.g., CDN, social).
- Multi-tenant orgs, finer-grained roles/permissions.

---

## 10. Resolved Decisions
1. **Authentication — INCLUDED in v1.** The system requires authenticated access (see §3.7 and §12).
2. **Webhook payload — JSON.** `WebhookChannel` POSTs a JSON body with asset URLs + metadata (see §6.3).
3. **Background job queue — INCLUDED in v1.** Image processing and publishing run via a queue (BullMQ + Redis), not in-process (see §5.5).
4. **ORM — Prisma** over SQLite.

---

## 11. Success Metrics
- 100% of valid uploads produce all configured renditions.
- Median time from upload to `ready` < 5s for images ≤10 MB.
- Publishing success rate > 99% for reachable channels.
- Backend service-layer test coverage ≥ 80%.
- Zero unauthorized cross-user asset access (enforced + tested).

---

## 12. Authentication & Security Design
- **Tokens:** Short-lived JWT access token (e.g., 15 min) + rotating refresh token (e.g., 7 days) stored hashed in `RefreshToken`. Refresh rotation revokes the prior token (reuse detection).
- **Passwords:** Hashed with **argon2id**; never stored or logged in plaintext.
- **Authorization:** Route guards enforce authentication; resource guards enforce per-asset ownership (`asset.ownerId === user.id` or `role === admin`).
- **Seeding:** A single `admin` user is seeded on first run via env vars; further registration is admin-gated by default (configurable to open registration).
- **Transport/Hardening:** HTTPS in production, security headers (helmet), rate limiting on auth + upload endpoints, CORS restricted to the web app origin.
- **Public assets:** Only renditions explicitly published via `LocalPublicChannel` are reachable at `/public/...`; unpublished assets are never publicly accessible.
- **Secrets:** JWT signing keys and DB/Redis credentials supplied via environment, not committed.
