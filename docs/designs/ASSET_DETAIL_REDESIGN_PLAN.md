# Asset Detail Redesign — Implementation Plan

Source: `docs/designs/extracted/design_handoff_asset_detail/` (README + `Vault DAM.dc.html`).
Target: `apps/web/src/app/assets/[id]/page.tsx` (+ supporting components, small API additions).

## Decisions (confirmed)
1. **Rendition rail** wires to the **real** renditions the pipeline produces
   (`original`, `large` 2048, `standard` 1024, `thumb` 480) with their real
   width/height/size. No fake derivation. Clicking a thumbnail swaps the
   preview `<img src>`; default active = `original`; resets when the asset changes.
2. **Version history** (ASS-47) and **Shared with** (ASS-50) have no backend —
   **omit** these sections for now; add when those tickets land.
3. Deliver as **one PR**, fully wired.

## Capability mapping
| Design section | Backend | Plan |
|---|---|---|
| Header: Share / Add to bundle / Download / More(delete) | ✅ existing modals | Restyle to spec (pill buttons, 24px radius, circular icon btns) |
| Preview pane (image/doc) | ✅ | Restyle; bg `#eef0f3`, shadowed image |
| Rendition rail | ✅ `AssetDTO.renditions[]` | Wire real tiers; caption "Showing {label} · {dims} · {size}" |
| Tabs: Details / Activity (+comment count) | ✅ timeline | New tabbed panel |
| Details rows: Kind, Dimensions, Size, Format, Collection, Uploaded by, Modified | Partial | Kind/Dims/Size/Format/Modified ✅; **Uploaded by** → add `AssetDTO.ownerEmail` (small backend); **Collection** → omit (canceled, = bundles) |
| Expiry date (kept from PR #14) | ✅ | Keep as an editable Details field |
| Tags + Add tag | ✅ ASS-45 | Reuse `TagEditor` |
| Shared with | ❌ ASS-50 | **Omit** (depends on ASS-50) |
| Version history | ❌ ASS-47 | **Omit** (depends on ASS-47) |
| Used in bundles | ✅ `listAssetBundles` | Wire (cover thumb from bundle's first asset if available, else neutral) |
| Activity timeline + composer | ✅ `listAssetTimeline` + `createAssetComment` | Wire; rail line, avatars, chat bubbles, event lines, composer |

## Backend changes (small)
- **`AssetDTO.ownerEmail: string | null`** in `packages/shared-types`.
  - `apps/api/src/mappers/asset-mapper.ts` `assetToDTO(..., ownerEmail?)`.
  - `asset-service.ts`: include `owner: { select: { email } }` in `getForUser`
    (and `list` if cheap) and pass through. Keep `list` lean — only detail
    needs it, so include there.
  - Tests: assert `ownerEmail` present on GET `/api/assets/:id`.
- No schema change.

## Frontend structure
- Rewrite `apps/web/src/app/assets/[id]/page.tsx`:
  - Header bar component (reuse existing Share/AddToBundle/Delete modals).
  - Preview + **RenditionRail** (new component `components/vault/RenditionRail.tsx`).
  - Right panel with **tabs** (`details` | `activity`) — local state.
    - DetailsTab: type pill, H2 name, editable Title/Description/Expiry,
      Details rows (incl. Uploaded by), Tags (TagEditor), Used in bundles.
    - ActivityTab: timeline (map `AssetTimelineItemDTO` → comment bubble / event
      line) + composer (textarea + Comment button; prepend on submit;
      newest-first; count badge).
  - State: `assetTab`, `renditionKey` (reset on asset id change), `commentDraft`.
- New CSS in `globals.css` under the Vault section: rendition rail, tab bar,
  detail rows, activity timeline rail/bubbles/composer, type pill.
- Map renditions → tiers by name with friendly labels:
  `original→Original`, `large→High`, `standard→Medium`, `thumb→Low`.
  Caption uses each rendition's real `width×height` and `sizeBytes`.

## Activity timeline mapping
- `AssetTimelineItemDTO` is a union of `{kind:"comment", comment}` and
  `{kind:"activity", activity}`.
  - comment → chat bubble (author email initials avatar, body, relative time).
  - activity (`asset.created`/`asset.updated`) → event line ("{actor} {summary}").
- Composer posts via `createAssetComment`; prepend returned item; bump count.

## Out of scope / follow-ups
- Version history UI → ASS-47.
- Shared-with UI + Manage → ASS-50.
- Collection row → covered by Bundles (ASS-46 canceled); not shown.
- "Uploaded by" avatar uses initials from email (no user avatars in system).

## Tests
- Backend: `ownerEmail` on asset detail (api).
- Web: pure helpers if any (rendition tier labelling) as a unit test; typecheck + build.
