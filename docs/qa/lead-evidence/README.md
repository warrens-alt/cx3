# Lead Evidence consolidation verification — 2 October 2026

The consolidation starts at `24c1a11e3ba48e4fa24e49f8d51e73d7363fa3ae` on
`warrens-alt/cx3` main. The consolidation map was committed before implementation.
Migration and mounted parity were committed in `4fd4703`; duplicate UI retirement
followed separately in `9a8b2d5`. The final commit history records subsequent
privacy, layout and verification changes.

## Product and contract boundaries

`/lead-explorer` displays Lead Evidence with URL-backed Population and Source
Evidence modes. `/lead-ledger` is a scope-preserving Source compatibility redirect;
`/explore`, `/explorer` and `/leads` open Population. Navigation and command search
have one record destination. The canonical Lead Dossier has Summary, Journey,
Calls, Outcomes, Audit and Source tabs.

Population retains analytical reporting/Investigation predicates, exact drill and
additive narrowing, private analytical search, factual inclusion reasons and the
existing workflow/drivers/confidence/AI. Five column presets reuse loaded rows.
Full analytical has the migrated 17 columns; page sizes are 25/50/100, with
first/previous/next/last controls and copy-ID feedback.

Source retains configured/approved rich sources, original multiple records, all
63 compatible fields, partial coverage, distinct lead/source-row counts, query
provenance, source search/paging and complete-query CSV. Its source row model is
not merged with the normalized analytical row model. An Investigation qualifies
the analytical lead, not every attached source transaction. Source identity alone
does not establish analytical qualification or independent reconciliation.

Analytical export is the current returned page using `buildLeadEvidenceExport`.
Source export is a separate full-query snapshot, independent of displayed page
limits; compatible and partial available-field choices retain preflight and
streaming failure/cancellation handling. Export feedback is scoped to its
originating visit; late old transfers cannot save a file or alter a newer one.

## Automated verification

The final `npm run verify` passes lint, all tests, surface-inventory checking and
the production build. The unit/component run has **1,235 tests: 1,234 passed,
zero failed and one skipped**. The skip is the existing Firestore Emulator-gated
suite. `npm ci`, standalone lint/build, `docs:surfaces` regeneration and
`docs:surfaces:check` also pass. Build output includes frontend/server artifacts
and the warehouse inventory export.

| Synthetic browser suite | Passed |
| --- | ---: |
| Broad frontend routes and interactions | 147 / 147 |
| Visual Audit Evidence, including overlay hit-testing | 56 / 56 |
| Investigation workflow | 17 / 17 |
| Ledger Journey viewport/theme scenarios | 6 / 6 |
| Canonical Lead Evidence viewport/theme scenarios | 10 / 10, with 80 workflow checks |

Lead Evidence was exercised in light and dark at **1440×1000, 1024×1000,
820×1180, 390×844 and 320×844**. The broader suites retain their 1440/820/390
matrix. The actual resolved theme is asserted, rather than inferred from browser
colour preferences. Document/main overflow checks pass; the full analytical and
source tables scroll internally. Desktop split-pane and mobile stacked layouts,
long identities/source labels, source fields and export reviews remain readable.
The sticky desktop dossier is aligned below the retained Investigation strip.

Mode and Dossier tabs support arrow/Home/End navigation and selected-tab focus.
Mode/preset history follows the URL without creating global filters. Closing the
dossier restores a visible record trigger, export review traps/restores focus,
and the canonical Audit modal portals outside sticky/size containers. Drawer
hit-testing proves it remains above workspace layers. No browser runtime errors
or console warnings were recorded in these suites.

## Request and privacy assertions

| Action | Record-layer request boundary |
| --- | --- |
| Initial Population | One raw-leads request; no source replica or selected timeline |
| Select Population lead | One selected scoped timeline; source remains lazy |
| Presets, Audit and local Journey interactions | No additional analytical request |
| Explicit Dossier Source tab | Exact scoped replica lookup; reused on reopening |
| Initial Source Evidence | Replica plus coverage; no analytical population/timeline |
| Select Source lead | Reuse its already-returned records in the canonical dossier |
| Load analytical evidence from Source | Explicit scoped raw lookup; only exact identity enables handoff |
| Export review | No request until confirmation; existing export semantics retained |

Mounted tests cover total/unknown-total paging, raw-field precision, null versus
false/zero, vendor narrowing, missing analytical/source matches, invalid mode and
preset normalization, source/analytical population membership and delayed
responses. Tenant, dates, filters, searches, source mode and effective permission
fence selected evidence. A cleared analytical lookup cannot restart during a mode
round trip. Selected lead IDs and source field focus stay in memory during
handoffs. Private manual searches and identity filters continue withholding
shareable/saved definitions. Viewer restrictions do not broaden.

## Reproduction and evidence location

The Browser plugin was unavailable, so the existing local Playwright/Chromium
runtime was used with the repository's isolated routed fixture. No dependency or
production authentication bypass was added. All fetches terminate in explicitly
synthetic fixtures; screenshots have a synthetic QA banner.

After `npm run build`, run each script with `CX_PLAYWRIGHT_MODULE`,
`CX_CHROMIUM_EXECUTABLE` and an external `CX_BROWSER_QA_OUTPUT`:

- `scripts/check-frontend-convergence-browser.mjs`
- `scripts/check-audit-evidence-browser.mjs`
- `scripts/check-investigation-browser.mjs`
- `scripts/check-ledger-visual-browser.mjs`
- `scripts/check-lead-evidence-browser.mjs`

Full results, logs and screenshots remain outside the checkout in the workspace's
`lead-evidence-qa-2026-10-02/{broad,audit,investigation,journey,workspace}` folders.
The checked-in [results summary](results-summary.json) records exact suite counts.
Historical QA reports retain their original revision scope and counts.

No SQL, metric calculation, analytical definition, denominator, source mapping,
API semantic, permission or revenue contract was changed. This verification does
not establish live warehouse reconciliation or source freshness. Internal reusable
source/Journey primitives retain their `leadLedger` directory/API names; that is
implementation naming, not another mounted product experience.
