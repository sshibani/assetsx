# Asset Comments & Activity PRD and Implementation Plan

## Summary

Add real asset comments and asset activity to AssetX. Users will be able to add plain-text comments to an asset, and the system will automatically log asset creation and metadata updates. Comments and activities will be displayed together on the asset Detail page in the existing full-width `Comments & activity` panel.

The feature is account-scoped for the current multi-tenant model. Comments and activity belong to the same account as the asset, and access follows the same account membership and asset permission rules already used by asset detail.

## Product Goals

- Let permitted account users add a comment to an asset from the Detail page.
- Show comments and asset activity in one readable timeline on the Detail page.
- Automatically log asset creation.
- Automatically log asset metadata updates.
- Keep comments and activity scoped to the asset's account.
- Support future identity provider integrations by storing actor references through the existing `User` model.
- Replace the current hardcoded placeholder content with persisted data.

## Non-Goals

- No threaded comments.
- No comment editing or deletion in v1.
- No mentions, notifications, or email alerts.
- No rich text, attachments, reactions, or emoji picker.
- No activity export, audit-reporting UI, or admin audit dashboard.
- No enforcement behavior based on activity.
- No logging for downloads, views, publish events, or deletes in v1 unless added later.

## User Stories

- As an account user with access to an asset, I can view its comments and activity.
- As an asset manager, admin, or owner, I can add a plain-text comment to an asset.
- As a viewer, I can read comments and activity but cannot add comments in v1.
- As an account admin, I can see who created or updated an asset.
- As a future auditor, I have a durable record of key asset create and update events.

## Permissions

Add comment-specific permissions to the shared permission model:

- `comments:read`
- `comments:create`

Recommended role mapping:

| Role | comments:read | comments:create |
| --- | --- | --- |
| `account_owner` | Yes | Yes |
| `account_admin` | Yes | Yes |
| `asset_manager` | Yes | Yes |
| `asset_viewer` | Yes | No |

Super users keep their existing broad account access behavior. When operating within an account context, a super user can read and create comments for assets in that account.

## Data Model

Add two Prisma models: one for comments and one for system activity.

### AssetComment

Fields:

- `id String @id @default(uuid())`
- `accountId String`
- `assetId String`
- `authorId String`
- `body String`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`

Relations:

- `account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)`
- `asset Asset @relation(fields: [assetId], references: [id], onDelete: Cascade)`
- `author User @relation(fields: [authorId], references: [id], onDelete: Restrict)`

Indexes:

- `@@index([accountId])`
- `@@index([assetId, createdAt])`
- `@@index([authorId])`

### AssetActivity

Fields:

- `id String @id @default(uuid())`
- `accountId String`
- `assetId String`
- `actorId String?`
- `type String`
- `summary String`
- `detailsJson String?`
- `createdAt DateTime @default(now())`

Relations:

- `account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)`
- `asset Asset @relation(fields: [assetId], references: [id], onDelete: Cascade)`
- `actor User? @relation(fields: [actorId], references: [id], onDelete: SetNull)`

Indexes:

- `@@index([accountId])`
- `@@index([assetId, createdAt])`
- `@@index([actorId])`
- `@@index([type])`

Recommended activity `type` values for v1:

- `asset.created`
- `asset.updated`

`detailsJson` should contain a compact JSON payload for structured details. For metadata updates, include only changed fields.

Example:

```json
{
  "changedFields": ["title", "expiresAt"],
  "before": {
    "title": "Old title",
    "expiresAt": null
  },
  "after": {
    "title": "New title",
    "expiresAt": "2026-06-30T23:59:59.999Z"
  }
}
```

## API Contract

### Shared DTOs

Add shared DTOs in `packages/shared-types`.

```ts
export type AssetCommentDTO = {
  id: string;
  accountId: string;
  assetId: string;
  authorId: string;
  authorEmail: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type AssetActivityDTO = {
  id: string;
  accountId: string;
  assetId: string;
  actorId: string | null;
  actorEmail: string | null;
  type: "asset.created" | "asset.updated";
  summary: string;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type AssetTimelineItemDTO =
  | {
      kind: "comment";
      id: string;
      createdAt: string;
      comment: AssetCommentDTO;
    }
  | {
      kind: "activity";
      id: string;
      createdAt: string;
      activity: AssetActivityDTO;
    };
```

### GET `/api/assets/:id/timeline`

Returns comments and activities for an asset.

Authorization:

- Requires authenticated user.
- Requires access to the asset's account.
- Requires `comments:read`.
- Must not expose comments or activity across account boundaries.

Response:

```json
{
  "items": [
    {
      "kind": "activity",
      "id": "activity-id",
      "createdAt": "2026-06-23T10:15:00.000Z",
      "activity": {
        "id": "activity-id",
        "accountId": "account-id",
        "assetId": "asset-id",
        "actorId": "user-id",
        "actorEmail": "admin@assetx.local",
        "type": "asset.created",
        "summary": "Asset created",
        "details": null,
        "createdAt": "2026-06-23T10:15:00.000Z"
      }
    }
  ]
}
```

Sort order:

- Newest first by `createdAt`.
- For equal timestamps, activity/comment `id` can be used as a stable secondary sort.

Pagination:

- v1 can return the latest 50 timeline items.
- Add optional `limit` and `cursor` only if needed during implementation.

### POST `/api/assets/:id/comments`

Creates a comment for an asset.

Authorization:

- Requires authenticated user.
- Requires access to the asset's account.
- Requires `comments:create`.

Request body:

```json
{
  "body": "Plain-text comment"
}
```

Validation:

- `body` is required.
- Trim leading/trailing whitespace before storage.
- Reject empty comments with `400`.
- Reject comments longer than 2,000 characters with `400`.
- Store as plain text only.

Response:

- Return the created `AssetCommentDTO` or a `kind: "comment"` timeline item.

## Activity Logging Behavior

### Asset Creation

Log an `asset.created` activity after a successful `Asset` database create in `AssetService.upload`.

Activity values:

- `accountId`: asset account.
- `assetId`: created asset ID.
- `actorId`: upload owner ID.
- `type`: `asset.created`.
- `summary`: `Asset created`.
- `detailsJson`: optional payload with original filename, format, and size.
- `createdAt`: use the asset creation time if practical, otherwise the activity row creation time.

### Asset Metadata Update

Log an `asset.updated` activity in `AssetService.updateMetadata` only when one or more tracked fields actually change.

Tracked fields for v1:

- `title`
- `description`
- `expiresAt`

Do not log an activity if the PATCH request results in no effective change.

Activity values:

- `accountId`: asset account.
- `assetId`: updated asset ID.
- `actorId`: authenticated user ID.
- `type`: `asset.updated`.
- `summary`: `Asset metadata updated`.
- `detailsJson`: JSON with changed field names and before/after values.

## UI Requirements

Update `apps/web/src/app/assets/[id]/page.tsx`.

- Keep `Comments & activity` as a full-width panel below the detail grid.
- Remove the current hardcoded placeholder content.
- Fetch timeline data for the current asset.
- Render comments and activity in one list.
- Show newest items first.
- Display actor email, action label, timestamp, and body/summary.
- Render comment bodies as plain text with preserved line breaks.
- Show a compact empty state when there are no comments or activities.
- Show loading and error states consistent with the existing page style.
- Add a comment form for users with `comments:create`.
- Hide or disable the comment form for users without `comments:create`.
- On successful comment submit, clear the input and refresh or prepend the new timeline item.

Do not add comments/activity UI to the gallery page.

## Implementation Plan

### Phase 1: Shared Types and Permissions

1. Add `comments:read` and `comments:create` to shared permissions.
2. Add the recommended role mappings.
3. Add `AssetCommentDTO`, `AssetActivityDTO`, and `AssetTimelineItemDTO`.
4. Run shared package type checks/builds.

### Phase 2: Database Schema

1. Add `AssetComment` and `AssetActivity` Prisma models.
2. Add reverse relations on `Account`, `Asset`, and `User`.
3. Run Prisma generate.
4. Apply the local schema using the project's current Prisma `db push` workflow.
5. Consider a one-time local/dev backfill that creates `asset.created` activity rows for existing assets using each asset's `ownerId` and `createdAt`.

### Phase 3: API Services

1. Add an activity service or helper to create activity rows.
2. Add a comments service for creating and listing comments.
3. Add a timeline service that merges comments and activities into `AssetTimelineItemDTO[]`.
4. Reuse existing asset access checks where possible.
5. Ensure all queries are scoped by `accountId`.

### Phase 4: API Routes

1. Add `GET /api/assets/:id/timeline`.
2. Add `POST /api/assets/:id/comments`.
3. Validate comment body shape and length.
4. Return consistent `401`, `403`, `404`, and `400` responses using existing route patterns.

### Phase 5: Activity Instrumentation

1. Log `asset.created` in asset upload flow.
2. Log `asset.updated` in metadata update flow when tracked fields change.
3. Keep update activity creation in the same request flow as the asset update.
4. Avoid logging activity for failed validation or forbidden requests.

### Phase 6: Detail Page UI

1. Replace placeholder comments/activity content with fetched timeline data.
2. Add a plain-text comment composer.
3. Gate the composer by `comments:create`.
4. Render comment and activity rows with existing panel/list visual conventions.
5. Keep the section full width.
6. Confirm the gallery page remains unchanged.

### Phase 7: Tests and Verification

Run and update:

- `corepack pnpm --filter @assetx/api test`
- `corepack pnpm --filter @assetx/web typecheck`
- shared-types typecheck/build command used by the repo

Add API tests for:

- Asset upload creates an `asset.created` activity.
- Metadata PATCH creates an `asset.updated` activity when fields change.
- Metadata PATCH does not create activity when nothing changes.
- Timeline returns comments and activity for authorized users.
- Comment creation succeeds for `account_owner`, `account_admin`, and `asset_manager`.
- Comment creation is forbidden for `asset_viewer`.
- Empty comment body returns `400`.
- Overlong comment body returns `400`.
- Cross-account users cannot view or create comments.
- Super user behavior remains consistent with account context rules.

Add web verification for:

- Detail page compiles with timeline and comment form.
- Comment form is visible only with `comments:create`.
- Empty/loading/error states render without layout issues.

## Acceptance Criteria

- A permitted user can add a comment to an asset from the Detail page.
- The comment persists and appears after reload.
- Asset creation logs an activity row.
- Asset metadata updates log activity rows when tracked fields change.
- Comments and activity appear together in the Detail page `Comments & activity` panel.
- Comments and activity are scoped to the asset account.
- Unauthorized account users cannot see or create comments for assets outside their account.
- The existing hardcoded placeholder content is removed.
- No comments or activity data appears on the gallery page.

## Open Questions

- Should `asset_viewer` users be allowed to add comments, or should they remain read-only?
- Should publish, delete, download, and rendition-generation events be logged in a later version?
- Should existing assets receive backfilled `asset.created` activity in all environments or only local/dev?
- Should comments support soft delete or edit history in a future version?

## Assumptions

- Comments are plain text.
- Comments are immutable in v1.
- Activity is append-only in v1.
- Asset activity in v1 means create and metadata update only.
- Timeline data is account-scoped and asset-scoped.
- Detail page is the only UI surface for comments and activity in v1.
