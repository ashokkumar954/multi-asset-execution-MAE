# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**BHM (Bulk Health Metrics)** — an Oracle Field Service (OFS/OFSC) plugin for field technicians to record battery health data for multiple customer assets in a single activity. Built on OracleJET 18.1.0 (Knockout.js MVVM, RequireJS AMD), deployed as a hosted ZIP to FFS 25D.

- Package: `@fa/bhm` | Plugin label: `bulk_health_metrics`
- Fusion org: `https://ibfaqy-dev1.fa.ocs.oraclecloud.com:443`

## Build Commands

```bash
npm install          # first-time setup
grunt rebuild        # clean + full production build (default VSCode task: Ctrl+Shift+B)
grunt                # incremental production build (also bumps patch version)
grunt devBuild       # unminified build (for External Plugin dev mode in OFS)
grunt serve          # dev server at http://localhost:8000 with live rebuild
grunt bumpup:minor   # bump minor version manually; run grunt after to regenerate timestamp
```

Build output: `build/hosted/` + `build/bhm-<version>-hosted.zip`
**Never edit `build/` or `web/` — they are overwritten on every build.**

After any build, commit `package.json` to keep version in sync. A `.bumpignore` file disables auto-bumping.

## Running Tests

Tests use Karma + Mocha + Chai + Sinon and require Chrome.

```bash
# Unit tests require libs to be present in web/js/libs first:
grunt test-setup     # copies OracleJET/Knockout/Preact/etc. libs into web/js/libs
# Then run Karma directly:
./node_modules/.bin/karma start test/karma.conf.js
```

Test files live in `test/unit/` (unit) and `test/acceptance/` (acceptance/Puppeteer).
Framework: `tdd` style (`suite` / `test`), not `describe` / `it`.

## Architecture

### Plugin Lifecycle (postMessage)

The plugin runs inside an OFS `<iframe>`. All OFS communication is via `window.postMessage`:

```
Plugin → { method: 'ready', sendInitData: true }
OFS   → { method: 'init', attributeDescription: {...} }   ← enum metadata, saved to localStorage
Plugin → { method: 'initEnd' }
OFS   → { method: 'open', activity: {...}, openParams: {...} }  ← live activity data
Plugin → { method: 'close', activity: {...} }              ← on submit
```

Managed by `src/js/services/ofsc-plugin-api-transport.js`. The `app.loaded` Promise resolves after `open` and unblocks all ViewModels.

### Authentication

Two OAuth app keys, both configured in OFS under Configuration → Forms & Plugins → Applications:

| Constant | Key label | OFS app name | Purpose |
|----------|-----------|-------------|---------|
| `Constants.KEY_EXT` | `'Ext'` | Concentric - Oracle Fusion Applications - User Asserted | Fusion REST API calls (Bearer token) |
| `Constants.KEY_INT` | `'ofsApiApplication'` | App CX Service | Internal OFS API calls |

Tokens are obtained via `ofscConnector.obtainToken(key)` → `callProcedure / getAccessToken` → returned in `data.resultData`. Tokens are **not cached** — fetched fresh per request.

### Data Flow

```
OFS open event
  → ofsc-plugin-api-transport.js  (resolves app.loaded)
  → asset.js                      (reads wo_account_name from openData)
  → ib-assets-service.js          (GET /fscmRestApi/.../installedBaseAssets?q=CustomerSitePartyName=<name>)
  → fusion-rest-api-transport.js  (fetch + Bearer auth)
  → window.__ibAssets = [...]     (mapped asset array)
  → AllAssetDetails.render()      (injects asset-detail.js + all-asset-details.js as <script> tags)
  → AssetDetail.createRows()      (builds DOM rows per asset)
```

Fallback: if `wo_account_name` is missing or the API fails, `window.__ibAssets = null` and the display falls back to the `problem_code` enum from `attributeDescription`.

### Module System Split

- **AMD modules** (`define([...])`) — everything under `src/js/` except viewModels: `appController.js`, `constants.js`, all services, `ofsc-connector.js`
- **Plain-JS IIFEs** (global objects) — `asset-detail.js` and `all-asset-details.js`. These are loaded dynamically via `<script>` injection because they can't use AMD `require()` at that point. They read `window.__ibAssets`, `window.__activityId`, and `window.__problemCodeEnum` set by `asset.js`.

### Key Files

| File | Role |
|------|------|
| `src/js/required-properties.json` | OFS plugin metadata: `plugin.label`, `plugin.val`, `pluginAppsObj` (app keys). **The `plugin.label` must be unique per plugin — this was the root cause of cloned-plugin issues.** |
| `src/js/constants.js` | All app-wide constants. Change `FUSION_BASE_URL`, `KEY_EXT`, `KEY_INT` here only. |
| `src/js/services/ofsc-plugin-api-transport.js` | Plugin lifecycle + `_verifyProperties()` (throws `ApplicationCriticalError` if required properties missing) |
| `src/js/services/ib-assets-service.js` | Fetches IB Assets; maps Fusion API fields to BHM shape; derives `isBat`/`isFlood` from `Description` regex |
| `src/js/viewModels/asset.js` | Root Knockout ViewModel; sets globals; triggers IB fetch; `navigateToAllAssets()` |
| `src/js/viewModels/all-asset-details.js` | IIFE — renders asset table (search + filter tabs: All/Pending/Completed) |
| `src/js/viewModels/asset-detail.js` | IIFE — builds expandable per-asset card; save/restore from localStorage |

### LocalStorage

Key format: `mae_record_<activityId>_<instanceNumber>`

Each record stores: `{ rowIndex, note, checklist, components, readings, needsRepair, complete, savedAt }`.
`attributeDescription` (OFS enum metadata) is cached under `plugin_attributeDescription`.

### IB Asset Shape

```js
{ instanceNumber, assetId, serial, mfr, model, desc, mfgDate, barcode, isBat, isFlood }
```
- `instanceNumber` = `AssetId` from Fusion (used as localStorage key suffix)
- `isBat` → shows Components section + Low SG reading in expanded card
- `isFlood` → additional flood-specific display logic

### Known Issue

The current IB Assets filter `q=CustomerSitePartyName=<wo_account_name>` uses an undocumented Fusion field. The correct approach is to resolve `wo_account_name` → `CustomerAccountId` first, then filter by `q=CustomerAccountId=<id>`.

## OFS Dev Setup

OFS requires HTTPS. For local dev, front the JET server (`grunt serve` → port 8000) with nginx and register the plugin as **External Plugin** pointing to `https://localhost/jet/index.html`. See `README.md` for the nginx config snippet.

## Deployment

1. `grunt rebuild` → produces `build/bhm-<version>-hosted.zip`
2. OFS Admin → Configuration → Forms & Plugins → upload the ZIP
3. Plugin label is locked after first registration (`bulk_health_metrics`) — only the display name can be changed
