# CX3 precision refinement — 2026-10-03

## Revision and scope

Starting revision: `95e630e57a5e587d298b82823ba9eb2dc5ee9b56`, fetched from `origin/main` before this pass. The brief referenced `e393254602995356b17a8b71f32be8918b194079`; main already included the subsequent CI repair. The audit compared the current tree with `811c8b5`, `9f24c97`, and `e393254` rather than using an earlier checkout.

Final implementation revision: `8ca71ab69ab4717bb54fe247528e8abde6ed8535`, incorporating the main refinement in `64fa173528c7fb736f1cd49fc9692e6e942b80e3` and the final Evidence description/date clearance fix. The final delivery SHA, including this documentation-only commit, is recorded in the accompanying `precision-refinement-evidence-2026-10-03/completion.json` and completion report. A document cannot contain the hash of its own commit. The final local verification and GitHub validation are run on that delivery revision; application source is identical to the implementation revision.

This pass retains Command, Journey, Operations, Investigate, Commercial, and Evidence, with Settings, Access, and Validation outside the primary six workspaces. The route manifest, analytical query owners, authorization boundaries, and reporting contracts remain unchanged.

## Visual refinement

- Shared page padding now follows the existing 16–24px rhythm. Page headings, descriptions, panel padding, chart padding, metric cards, scope metadata, and mobile spacing align across the six workspaces.
- Journey, Operations, and Commercial receive the existing Data status control in their header action area. This removes a spare status row without creating another status query or changing its lifetime. The embedded Evidence overview no longer repeats the workspace heading.
- Existing ConversionX blue, graphite navigation, neutral canvas, lifecycle tokens, categorical colors, and evidence status meanings are retained. Selected analytical rows use the established selected-surface token. The Evidence description/date overlap found in actual mobile screenshots is fixed with a 24px heading relationship; rendered clearance is 16px on mobile and 31px on desktop, with a permanent browser assertion.
- Lead Evidence uses a desktop master/detail layout where there is enough actual analysis width. A container query stacks it in narrower investigation layouts, including layouts constrained by the signal and evidence rails. The dossier's sticky offset follows the live scope-height variable and measured context rail. It uses the main scroll area's height, and narrows its own scrollport at the end of the containing grid so the heading remains below the retained rails. Stacked desktop dossiers have bounded internal scrolling; tablet/mobile dossiers retain their natural below-list flow.
- Focused dossier mode temporarily releases the analysis size container so its fixed overlay fills the viewport. It keeps the same mounted dossier, selected tab, evidence, and query owners. Escape closes focus mode and returns focus to the initiating control.

## Complete analytical parameters

`src/features/investigation/analyticalParameters.ts` is the shared presentation model. It discovers the union of **own keys actually returned in the loaded analytical rows**. Known fields have a canonical order and group; unknown returned fields appear under Additional returned fields. Fields absent from every loaded row are not fabricated.

The groups are Identity, Acquisition, Qualification, Delivery / routing, Contact, Outcomes, Commercial, Timing, Investigation, Audit / metadata, and Additional returned fields.

The Investigation, Journey, Contact, and Outcomes presets remain compact. Full analytical now represents the complete discovered schema rather than a fixed subset. The column manager searches names/groups, shows and hides fields, restores the selected preset, selects all fields, and clears optional fields while retaining returned lead identity. Column selection is local presentation state; changing presets does not alter API queries or expose private identities in URLs.

All parameters in the dossier uses the same model, with grouped disclosures and parameter-name search. Null keys remain represented. A key missing from an individual row says Not supplied; a supplied null/empty or invalid value says Unavailable; known outcome flags use the existing Recorded / Not recorded semantics. Explicit zero and false remain distinguishable from unavailable evidence.

Structured values use a readable secondary disclosure with escaped field/value content and raw JSON beneath it. Exact identifier and decimal strings are preserved. Full analytical and the new Summary revenue display use only an explicitly returned currency. The existing curated Outcomes formatter and audited 17-column CSV contract retain their established behavior; a reusable complete raw projection is available for future export consumers without changing that contract.

The table has bounded internal scrolling, numeric alignment, sticky header/identity intersections, and a selected-row state. Curated presets retain the existing compact record cards on narrow layouts.

## Dossier and Timeline

The visible dossier tabs are Summary, Timeline, Calls, Outcomes, Audit, and Source. Existing internal `journey` state and the `Journey` alias remain compatible; `Timeline` is accepted as an initial-tab alias. No route or private selection contract changed.

Summary is grouped into Identity, Current state, Qualification, Contact, Outcomes, and Timing. The furthest recorded stage remains a lifecycle position, and recorded revenue remains distinct from collected cash.

Timeline uses Chronology and Event log labels. Chronology renders the existing sorted timed events and supported elapsed durations. Untimed milestones have a separate, explicitly labeled lifecycle-position section; RPC, Sale, or Activation without timestamps are never placed in timestamp order. Event log retains both dated and undated evidence. Existing chronology anomalies, source-field navigation, audit actions, copy evidence, and event-specific pins remain available.

The original `timeline.ts` calculations and timestamp rules were not modified. Timeline refinement consumes its existing timed/untimed events, transitions, and anomalies.

Source retains all 63 raw Lead Ledger fields and distinguishes each original source record with its own record header. Repeated records remain separate evidence, never a synthesized row or additive outcome. Population remains the normalized analytical grain. An identity match remains distinct from reconciliation.

## Brand, dependencies, and build decisions

The canonical supplied asset is `public/brand/conversionx-grey.png`, served at `/brand/conversionx-grey.png`. Three unused duplicate PNGs were removed from the repository root, `.aistudio` asset directory, and public brand directory. All four original copies had identical SHA-256 `f1fee4b874c3db4541bb48bc09adbb2a3d58f7f01d03c02e8a027e8a011bf645`. The component's crop geometry, symbol/wordmark/full variants, and tone rules remain unchanged. New brand tests cover the canonical path, variant geometry, accessible names, and image identity. Production brand mirrors from the preceding CI repair remain intact.

`package.json` and `package-lock.json` already matched the previously verified `9f24c97` state because `95e630e` restored the accidental branding lock drift. This pass leaves both byte-identical. No dependency was added or upgraded. Installation uses the repository's pinned npm 10.9.8.

The special Vite Exceptions manual chunk and output-name replacement were removed. The route already has the existing lazy import and safe import recovery; the special grouping also pulled shared application code into the initial preload. Vendor grouping, Vite's content-hashed names, build mirrors, and chunk recovery remain in place. Final compiled browser checks verify route loading and the absence of the old manually named investigation-workbench preload.

## Verification and evidence

The baseline and final evidence are kept outside the repository at `../precision-refinement-evidence-2026-10-03/`. Browser plugin tools were unavailable, so browser QA uses the existing Playwright runtime and existing Chromium executable; no browser dependency was installed.

The clean install used `npx --yes npm@10.9.8 ci --ignore-scripts --no-audit`, matching the locked-dependency workflow. `npm run verify` runs lint, the full regression suite, the surface inventory check, and the production build. The final full suite has 1,349 tests: 1,348 pass, zero fail, and one local Firestore emulator skip. `npm audit --audit-level=high` reports zero vulnerabilities. The delivery pipeline separately runs the Firestore emulator.

| Browser suite | Final result | Evidence folder |
| --- | --- | --- |
| Compiled workspace matrix | 63/63: six workspaces × five widths × two themes, plus three compiled boot/navigation checks | `final/` |
| Product rebuild | 63/63, including permanent Evidence vertical-clearance assertions | `product-final/` |
| Investigation | 20/20, including exact RPC case, distinct pins, notes, source scope, and export | `investigation-final/` |
| Lead Evidence | 120/120 checks across 10 scenarios; 90 screenshots | `lead-evidence/` |
| Ledger visual | 10/10 scenarios; 60 screenshots | `ledger-visual/` |
| Reporting, canonical routes | 190/190 checks across 10 scenarios | `reporting-final/` |
| Reconciliation, canonical route | 100/100 checks across 10 scenarios | `reconciliation-final/` |
| Audit evidence | 92/92 checks | `audit-final/` |

Responsive matrices cover 1440, 1024, 820, 390, and 320 pixels in light and dark themes. Final results have no document overflow, runtime errors, or relevant console warnings. The compiled matrix also checks 40 status-control placements, 16 dialog/focus/scope interactions, 24 mobile chip alignments, 10 Evidence panel alignments, and 10 vertical-clearance cases. Actual screenshots were inspected for desktop/mobile layout, dark mode, table scrolling, parameter search, timelines, raw source records, empty states, and focus mode.

The complete acceptance flow exercises record search, all presets, the column manager, all returned analytical keys, Summary, timed and untimed milestones, event evidence, source handoff, two separate records with all 63 fields each, audit, pin/copy/export actions, and return to the same scoped population. Preset, column, parameter, audit, and focus presentation actions preserve request ownership. Scope/permission changes continue to fence private selection.

Production HTTP smoke tests pass all six compiled launch variants, including canonical brand PNG signature/byte comparison, assets, SPA fallback, authentication rejection, and private-file boundaries. Google runtime smoke tests pass all five development/preview/bundle launch modes. The final build retains all production asset mirrors.

`final/protected-check.json` verifies zero changes among 177 protected files, including contracts, server, auth/security, SQL/metric registries, and existing timeline/value logic. The package files match the verified rebuild. `final/results.json` records served compiled asset fingerprints; they are checked against the final build. Verification logs and delivery CI links are preserved in the companion completion record.

## Limits

Browser acceptance uses explicit synthetic analytical/source responses. The compiled matrix serves the actual production Vite chunks and CSS with a synthetic Firebase module boundary and synthetic API responses; it verifies compiled routing/rendering, not real Firebase authentication or customer warehouse contents. No production deployment, production-data certification, or live source reconciliation is claimed.

Full analytical describes the fields returned in the **currently loaded population page**, not an unreturned warehouse schema. Column choices are local to the current view and reset on preset changes. The existing audited CSV remains its established 17-column export.
