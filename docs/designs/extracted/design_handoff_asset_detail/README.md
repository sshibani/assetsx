# Handoff: Asset Detail Page — Vault DAM

## Overview
The **Asset Detail** page of Vault DAM, a digital-asset-management app built on the **Glean Design System**. It is the full-screen view a user lands on after clicking an asset in the library. It shows a large preview of the asset on the left and a metadata/activity panel on the right, plus a top action bar. Users inspect the asset, switch between auto-generated size renditions, read/write comments, review version history, manage sharing, and see which bundles the asset belongs to.

This document describes **only the Asset Detail page**. The bundled HTML contains the whole app, but everything below the `Asset detail` screen (`data-screen-label="Asset detail"`) is the scope of this handoff.

## About the Design Files
The file in this bundle (`Vault DAM.dc.html`) is a **design reference created in HTML** — a working prototype showing the intended look and behavior, **not** production code to copy directly. It is authored as a "Design Component" with a small custom template runtime; **do not** try to reuse that runtime.

Your task is to **recreate this design in the target codebase's existing environment** (React, Vue, SwiftUI, etc.) using its established patterns, component library, and state management. If no environment exists yet, choose the most appropriate framework and implement there. Glean ships its own component library (Button, Glyph, Input, Modal, Avatar, etc.) under `typescript/elements/` — prefer those primitives over rebuilding raw HTML.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, and interactions are specified. Recreate the UI pixel-perfectly using the codebase's existing libraries and the Glean design tokens. All exact values are listed in **Design Tokens** below.

## How to view the reference
Open `Vault DAM.dc.html` in a browser. It opens on the library grid. Click any image card (e.g. "Summer Campaign Hero" or "Product Lifestyle 03") to reach the Asset Detail page. Use the **Details / Activity** tabs in the right panel and the **rendition thumbnails** under the preview to exercise the interactions.

---

## Screen: Asset Detail

**Purpose:** Inspect a single asset, switch size renditions, comment, review history, manage sharing, navigate to related bundles.

### Page layout
- The whole app sits in a shell: a fixed **left sidebar (256px)** + the main content area. The Asset Detail page fills the main content area.
- Asset Detail is a **vertical flex column**, full height:
  - **Header bar** — `flex: none`, full width.
  - **Body** — `flex: 1`, a **CSS grid** with two columns: `grid-template-columns: minmax(0,1fr) 384px`.
    - Left grid cell = **Preview** (fluid width).
    - Right grid cell = **Metadata/Activity panel** (fixed **384px**).

### 1. Header bar
- Container: `display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 32px;` bottom border `1px solid #e7e8ed`; background `#ffffff`.
- **Left group** (`flex; align-items:center; gap:14px`):
  - **Back button** — 38×38px circle, `border:1px solid #c9cbd2`, white bg, centered Feather `arrow-left` (18px, stroke 2). Hover bg `#eef0f3`. Returns to library.
  - **Breadcrumb + title** stacked:
    - Breadcrumb row: `font-size:12px; color:#565a64`. Text: `All assets` (clickable, returns to library) · `/` · `<collection name>` (in `#1f2024`). Collection value: `Summer 2026 Campaign`.
    - Title: `font-size:18px; font-weight:600; font-family:"SF Pro Display"…`; the asset name (e.g. `Product Lifestyle 03`), truncated with ellipsis.
- **Right group** (`flex; align-items:center; gap:10px`):
  - **Share** button — pill, height 38px, padding `0 16px`, `border:1px solid #c9cbd2`, white bg, `font-size:14px; font-weight:500`, Feather `share-2` icon (16px) + label `Share`. Hover bg `#eef0f3`. Opens the Share modal.
  - **Add to bundle** button — same pill style, Feather `package`/layers icon + label `Add to bundle`. Opens the Add-to-bundle modal.
  - **Download** button — primary pill, height 38px, padding `0 18px`, **no border**, background = brand `#343ced`, text white, download icon + label `Download`.
  - **More actions** button — 38×38px circle (same style as back), horizontal 3-dot icon. Opens the Delete modal.
- All pill buttons use **border-radius: 24px** (Glean's signature button radius). Circular icon buttons use `border-radius: 9999px`.

### 2. Preview (left grid cell)
- Container: `min-width:0; overflow:hidden; background:#eef0f3; display:flex; flex-direction:column; padding:36px 48px 28px 48px;`.
- **Image area:** `flex:1; min-height:0; display:flex; align-items:center; justify-content:center; width:100%;`. Renders one of three forms based on asset type:
  - **Image:** `<img>` with `max-width:100%; max-height:100%; border-radius:12px; box-shadow:0 8px 24px -6px rgba(0,0,0,0.25)`. `src` = the **active rendition URL** (see Renditions).
  - **Logo:** a `min(520px,100%)` 4:3 rounded (14px) tile, tinted background, large display-font letters centered, shadow `0 8px 24px -6px rgba(0,0,0,0.18)`.
  - **Document:** a `min(440px,100%)` 8.5:11 white "page" (`border-radius:8px`, shadow `0 12px 32px -8px rgba(0,0,0,0.28)`, padding `48px 44px`) with skeleton bars representing text lines.
- **Rendition rail** (only for image assets) — `flex:none; width:100%; max-width:720px; margin:20px auto 0 auto;`:
  - **Caption row:** `flex; align-items:baseline; justify-content:space-between; margin-bottom:10px`.
    - Left: `RENDITIONS` — `font-size:11px; font-weight:600; letter-spacing:.05em; text-transform:uppercase; color:#9499a3`.
    - Right: `Showing <b>{label}</b> · {dims} · {size}` — `font-size:12px; color:#565a64`; the bolded label is `#1f2024; font-weight:600`.
  - **Thumbnail row:** `display:flex; gap:10px`. One button per rendition (4 total), each `flex:1`:
    - Button: `display:flex; flex-direction:column; gap:7px; padding:6px; background:#fff; border:1.5px solid <ring>; border-radius:11px; cursor:pointer; text-align:left`. Ring = brand `#343ced` when active, else `#e7e8ed`. Hover: border-color → brand.
    - Thumb image: full-width, `aspect-ratio:3/2; border-radius:6px; object-fit:cover; background:#eef0f3`.
    - Label line: `font-size:12px; font-weight:600`, color = brand when active else `#1f2024`, ellipsis-truncated.
    - Dims line: `font-size:11px; color:#9499a3`, ellipsis-truncated.

### 3. Metadata / Activity panel (right grid cell, 384px)
- Container: `border-left:1px solid #e7e8ed; background:#fff; display:flex; flex-direction:column; min-height:0;`.
- **Fixed header** (`flex:none; padding:24px 24px 0 24px`):
  - **Type pill:** inline-flex, `font-size:12px; font-weight:600; color:#565a64; background:#eef0f3; padding:4px 10px; border-radius:9999px`. Text: `{EXT} · {typeLabel}` e.g. `JPG · Image`.
  - **Asset name H2:** `font-size:22px; line-height:28px; letter-spacing:-0.4px; font-weight:600; margin:12px 0 0 0; font-family:"SF Pro Display"`.
  - **Tab bar:** `display:flex; gap:24px; margin-top:20px; border-bottom:1px solid #e7e8ed`. Two tab buttons:
    - **Details** and **Activity**. Each: `padding:0 1px 12px 1px; margin-bottom:-1px; background:none; border:none; border-bottom:2px solid <border>; font-size:14px`. Active tab: text `#1f2024`, weight 600, border-bottom color = brand `#343ced`. Inactive: text `#565a64`, weight 500, border-bottom transparent.
    - **Activity** also shows a count badge to the right of the word: `font-size:11px; font-weight:600; background:#eef0f3; padding:1px 7px; border-radius:9999px` containing the number of comments.

#### Details tab content
A scrollable column (`flex:1; min-height:0; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:26px`). Sections separated by 1px `#e7e8ed` dividers. Every section header is `font-size:12px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:#9499a3; margin-bottom:12px`.

1. **Details** — a vertical list (`gap:11px`) of label/value rows: `display:flex; justify-content:space-between; gap:16px; font-size:13px`. Label `#565a64`; value `font-weight:500`. Rows: `Kind`, `Dimensions`, `Size`, `Format`, `Collection`, `Uploaded by`, `Modified`. Example values: Image / 2400 × 1600 / 2.8 MB / JPG / Summer 2026 Campaign / Maya Rao / Yesterday.
2. **Tags** — wrapped chip row (`gap:7px`). Each tag chip: `font-size:12px; font-weight:500; color:#565a64; background:#eef0f3; padding:5px 11px; border-radius:9999px`. Plus an **+ Add tag** button: dashed `1px` border `#c9cbd2`, brand text, same radius.
3. **Shared with** — header row has the label + a **Manage** link (brand text, `font-size:12px`, opens Share modal). List of people (`gap:10px`): 30px circular avatar with initials (per-person bg/fg pastel), name (`font-size:13px; font-weight:500`, truncates), role on the right (`font-size:12px; color:#565a64`). Seed people: Maya Rao — Owner; Jon Lee — Editor; Kira Park — Viewer.
4. **Version history** — list (`gap:4px`) of rows; each `display:flex; align-items:center; gap:11px; padding:8px; border-radius:10px` with hover bg `#f7f8fa`. Left: 30×30px `border-radius:8px` chip bg `#eef0f3` with version code (`v3`/`v2`/`v1`) in `#565a64`. Middle: label (`font-size:13px; font-weight:500`) + meta (`font-size:12px; color:#565a64`, e.g. `Maya Rao · 2h ago`). Right: either a **Current** badge (brand text, brand-12%-on-white bg, `padding:3px 9px; border-radius:9999px`) on the current version, or a **Restore** text button (`#565a64`) on older versions. Seed: v3 Current version (current), v2 Recropped for hero, v1 Initial upload.
5. **Used in bundles** — list (`gap:8px`) of clickable rows (hover bg `#f7f8fa`, navigate to that bundle). Each: 34×34px rounded (8px) cover image + name (`font-size:13px; font-weight:500`) + `{n} assets` (`font-size:12px; color:#565a64`) + a chevron-right (Feather, 16px, `#9499a3`). Seed: Summer 2026 Launch (34), Brand Refresh 2026 (47).

#### Activity tab content
A scrollable timeline (`flex:1; min-height:0; overflow-y:auto; padding:22px 24px 24px 24px`) **plus** a pinned composer.

- **Timeline** — `position:relative; display:flex; flex-direction:column; gap:20px`. A continuous **vertical rail** sits behind the avatars: an absolutely-positioned line `left:15px; top:8px; bottom:8px; width:2px; background:#e7e8ed`.
- Each entry: `position:relative; display:flex; gap:13px; align-items:flex-start`. Left node = 32×32px circular avatar with initials (`font-size:12px; font-weight:600`, per-person pastel bg/fg) and `box-shadow:0 0 0 3px #fff` so it masks the rail behind it. Two entry kinds:
  - **Comment:** right side shows a header row (`name` 13px/600 + `time` 12px `#9499a3`) then a **chat bubble**: `background:#f7f8fa; border:1px solid #e7e8ed; border-radius:13px; border-top-left-radius:3px; padding:10px 13px; font-size:13px; line-height:20px; color:#1f2024`.
  - **Event:** right side (`padding-top:6px`) shows one line `font-size:13px; line-height:19px; color:#565a64` with the **actor name bolded** (`font-weight:600; color:#1f2024`) followed by the event text, and a meta line below it `font-size:12px; color:#9499a3` ( `{sub} · {time}` or just `{time}` ).
  - Newest first. Seed timeline (top→bottom): Maya replaced the file (v3 · Current · 2h ago) [event] → Kira comment (3h ago) → Jon uploaded a new version (v2 · Recropped for hero · 3d ago) [event] → Jon comment (3d ago) → Maya shared with Kira Park (4d ago) [event] → Maya comment (Jun 18) → Maya uploaded the initial file (v1 · Initial upload · Jun 18) [event].
- **Composer** (pinned, `flex:none; border-top:1px solid #e7e8ed; padding:14px 20px 16px 20px; background:#fff`):
  - Row: 30px MR avatar (`#ffcfbd`/`#7a3b22`) + an input shell `flex:1; border:1px solid #c9cbd2; border-radius:14px; padding:9px 11px; display:flex; flex-direction:column; gap:8px`.
  - `<textarea>` (2 rows, transparent, no border/outline, `font-size:13px; line-height:19px`), placeholder `Add a comment…`.
  - Below it, right-aligned **Comment** button: `height:32px; padding:0 15px; border-radius:9999px; font-size:13px; font-weight:600`, with a Feather `send` icon (14px). **Disabled/empty state:** bg `#eef0f3`, text `#9499a3`, cursor default. **Enabled state** (draft has non-whitespace text): bg brand `#343ced`, text white, cursor pointer.

---

## Interactions & Behavior
- **Back / breadcrumb "All assets":** navigate to the library grid.
- **Details ⇄ Activity tabs:** toggle which panel body shows; selected tab gets a brand underline and the count badge reflects the comment total.
- **Rendition switching:** clicking a thumbnail sets the active rendition → the preview `<img src>` swaps to that rendition's URL and the "Showing …" caption updates (label, dimensions, size). The active thumbnail gets the brand ring + brand label color. Opening a different asset **resets** the active rendition to "Original".
- **Add comment:** typing enables the Comment button; clicking it **prepends** a new comment to the top of the timeline authored by the current user (`Maya Rao`, avatar MR) with time label `Just now`, increments the Activity count badge, and clears the textarea. Empty/whitespace-only drafts do nothing.
- **Share / Manage:** opens the Share modal. **Add to bundle:** opens the Add-to-bundle modal. **More (⋯):** opens the Delete confirmation modal. **Used-in-bundles row:** navigates to that bundle's detail page.
- **Hover states:** pill/icon buttons → bg `#eef0f3`; version & used-in rows → bg `#f7f8fa`; rendition buttons → border color brand.
- **Transitions:** keep them subtle — Glean uses ~80–250ms, `ease-out` for hover/press. Honor `prefers-reduced-motion`.

## State Management
State needed for this page:
- `currentAssetId` — which asset is shown (drives all asset-derived data).
- `assetTab` — `'details' | 'activity'` (default `details`).
- `renditionIdx` — index `0–3` of the active size rendition (default `0` = Original; **reset to 0 whenever a new asset opens**).
- `commentDraft` — string bound to the composer textarea.
- `userComments` — array of comments the user has posted this session; merged ahead of the seeded/base timeline (newest first).
- `modal` — `null | 'share' | 'addToBundle' | 'delete'` for the action modals.

Derived per render: the asset's renditions (computed from its real dimensions + size — see below), the active rendition URL, the merged activity list, and the comment count.

### Renditions — how they're derived
For an image asset with dimensions `OW × OH` (parsed from the `Dimensions` value) and an `Original` file size, generate 4 tiers:
| Key | Label | Long edge (px, w) |
|---|---|---|
| `orig` | Original | full `OW` |
| `high` | High | `min(1600, OW)` |
| `med` | Medium | `800` |
| `low` | Low | `320` |

For each tier compute `h = round(w * OH/OW)`, display `"{w} × {h}"`. File size = `Original` for the orig tier, else `origBytes * (w*h)/(OW*OH)` formatted (`≥1MB → "X.X MB"`, else `"N KB"`). In production these correspond to the real renditions your asset pipeline generates (thumb + low/medium/high); the prototype fakes them from one source image.

## Design Tokens (Glean Design System — light/default theme)
**Colors**
- Brand / primary: `#343ced` · hover `#131bd4` · selected bg `rgb(245,245,254)` · hover-selected `#eef0ff`
- Text: primary `#1f2024` · secondary `#565a64` · on-primary `#ffffff`
- Backgrounds: base `#ffffff` · light `#f7f8fa` · mid `#eef0f3` · dark `#d9dce2`
- Borders: light `#e7e8ed` · dark `#c9cbd2`
- Muted caption gray used in this page: `#9499a3`
- Feedback: success `#22c55e` · error `#cc0000` · warning `#f2c94c` · info `#343ced`
- Avatar pastels used (bg / fg): MR `#ffcfbd`/`#7a3b22` · JL `#a9e0ff`/`#1f3a52` · KP `#daf181`/`#3a4710`

**Typography** — families: base `"SF Pro Text","SF Pro","DM Sans",system…`; display `"SF Pro Display"…`. Sizes used here: 22/28 (panel H2), 18 (header title), 14/20 (buttons, body default), 13 (detail rows, comments, tabs), 12 (captions/meta/pills), 11 (uppercase section labels, dims, badges). Weights: 400 / 500 / 600.

**Spacing scale:** `0,2,4,8,12,16,20,24,32,36,48,64`. Page paddings here: header `16px 32px`; preview `36px 48px 28px`; panel body `24px`.

**Border radius:** 4 (checkbox) · 8 (small tiles/banners) · 11–13 (rendition buttons / chat bubble) · 12 (inputs/pills-in-forms) · 14 (composer shell) · 16 (cards) · **24 (buttons — signature)** · 9999 (avatars, icon buttons, chips).

**Shadows:** `sm 0 4px 6px -1px rgba(0,0,0,.10)` · `md 0 8px 8px -4px rgba(0,0,0,.15)` · `lg 0 8px 24px -6px rgba(0,0,0,.15)` · `xl 0 32px 32px -8px rgba(0,0,0,.08)`. Preview image uses `0 8px 24px -6px rgba(0,0,0,0.25)`.

## Assets
- **Asset preview & rendition thumbnails:** the prototype uses `picsum.photos` placeholder images keyed by a per-asset seed (e.g. `https://picsum.photos/seed/vault-life3/1280/960`). Replace with real asset renditions from your DAM pipeline.
- **Bundle cover thumbnails** (Used-in-bundles): also picsum placeholders.
- **Icons:** Feather/Lucide stroke icons (arrow-left, share-2, package/layers, download, more-horizontal, chevron-right, send) at 1.5–2px stroke. In Glean's codebase these map to the `Glyph` component. Load Feather from `https://unpkg.com/feather-icons@4.29.2/dist/feather.min.js` if you need a CDN.
- **Avatars:** initials on flat pastel backgrounds (no images).
- No photographic imagery in chrome; backgrounds stay flat/near-white per Glean guidance.

## Files
- `Vault DAM.dc.html` — the full HTML prototype. The Asset Detail page is the section marked `data-screen-label="Asset detail"` (the `isAsset` view). The right-panel preview wrapper carries `data-comment-anchor="c674b8fd40-div"`. All page data (asset list, versions, activity timeline, share people, used-in bundles, rendition logic) is defined in the `Component` logic class near the bottom of the file (look for `currentAsset`, `renditions`, `versions`, `baseActivity`, `sharePeople`, `usedIn`).
