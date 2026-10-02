# Frontend consumer audit and retirement — 2 October 2026

Starting revision: `fa9a93d3d14ef3164f4bc45b29a0dbec95fed24d` (fetched `origin/main`).
This is a consumer and capability audit, not live source reconciliation.
Canonical parity was committed first in `8438649` before the approved deletions.

The audit enumerated the tracked application, features, pages, shared components,
libraries, contracts, server, tests, fixture builders, scripts and workflows.
It checked direct imports, literal lazy/dynamic imports, source-reading tests,
fixture entry points, script/build entry points, CSS imports, documentation and
actual route elements. No glob-based page loader or alternate application router
was found. Browser fixtures mount the same `AppRouter`. Generated bundles are not
source consumers and are rebuilt after retirement.

## Canonical ownership and retirement gate

| Candidate | Starting consumers | Final classification / decision | Capability evidence |
| --- | --- | --- | --- |
| `pages/SpeedToLeadIntelligence.tsx` | Unmounted lazy router export; source-reading UI tests | `UNUSED` after parity/test migration; remove | `/speed-to-lead` mounts `features/contact/SpeedPage`. Timing means/percentiles, cohorts, operating controls, scope links and CSV already reside there and in `useSpeedModel`; completed dial breaches restored to the existing methodology disclosure. |
| `pages/ContactStrategyIntelligence.tsx` | Unmounted lazy router export; source-reading UI/formatter tests | `UNUSED` after parity/test migration; remove | `/contact-strategy` mounts `ContactPage`, `CallEffortReport`, `VendorDispositionReport`, `VendorOutcomeInspector`, `useContactModel`. Both grains, raw-code inspection, filters, scope and result-bound exports remain. Missing vendor-summary coverage columns, outcome-comparison CSV and exact call-effort ratio/no-RPC/unknown fields restored before removal. |
| `pages/SalesActivationIntelligence.tsx` | Unmounted lazy router export; source-reading tests | `COMPATIBILITY` wrapper with no downstream consumer, then `UNUSED` after tests migrate; remove | Wrapper only rendered `SalesActivationPage`; comments repeated old test signatures without implementing them. Tests now inspect the mounted page, adapter, exact segment presentation and public `/outcomes` alias. |
| `pages/FunnelIntelligence.tsx` | Unmounted lazy router export; source-reading UI tests | `REFERENCE_ONLY`; retain source, remove router import and migrate tests | Canonical `JourneyPage` retains supplied lifecycle totals/intersections, timing, vendor/source/grade evidence, matched periods, operating controls, CSV and scoped drilldowns. The old vendor table additionally computes `sales / contacted` in the browser. No supplied canonical vendor rate declares that independent ratio. It is not introduced or substituted for qualified RPC→sale conversion. Retention avoids claiming complete semantic parity. |
| `components/users/AccessInvitesTab.tsx` | No source, test, fixture, script or route consumer | `UNUSED`; remove | `features/access/AccessInvites` retains invitation list/create/revoke with explicit subscription states and correct pending-approval semantics. |
| `components/users/AccessPoliciesTab.tsx` | No consumer | `UNUSED`; remove | `features/access/AccessPolicies` retains approval/default-role/domain fields and save action, with draft-policy disclosure. |
| `components/users/AuditLogTab.tsx` | No consumer | `UNUSED`; remove | `features/access/AccessAuditLog` retains audit entries and subscription state. |
| `components/users/PreAuthorizeModal.tsx` | No consumer | `UNUSED`; remove | `features/access/UserAccessEditor` exports the mounted `AccessInviteEditor`, retaining email/role/tenant input and shared focus-managed modal behavior. |
| `components/users/TenantScopeModal.tsx` | No consumer | `UNUSED`; remove | Mounted `UserAccessEditor` retains tenant scope editing; subscriptions and mutations remain centralized in `UserManagement`. |
| `components/users/UsersDirectoryTab.tsx` | No consumer | `UNUSED`; remove | Mounted `features/access/UserDirectory` retains search/status/role filters, approve/suspend/activate/delete/role changes and tenant editing; existing authorization remains upstream. |
| `pages/DemoWorkspace.tsx` | No source, test, fixture, script or route consumer | `UNUSED`; remove | Static promotional links contained no demo producer or analytical implementation. `applicationMode()` has no runtime caller. The misleading `View demo data` link in the workspace access error is removed; it led back into the same application, not an isolated synthetic workspace. Test fixtures remain explicitly synthetic and separate. |

The four named lazy exports were never route elements. Removing them does not
change public URLs. Existing scope-preserving redirects, Lead Evidence modes,
route error boundaries, Suspense fallback and chunk-recovery behavior remain.
`routeManifest.tsx` stays authoritative for seven business areas and role visibility.

Contact outcome chart and CSV now share one presentation function. It preserves
the existing canonical denominator: dialled leads for lead-status mode, total
events for call-record mode. Zero denominator remains unavailable. The old page's
fallback from dialled leads to total population is not migrated. Full exports
include every returned vendor rather than the chart's optional Top-N subset.
Missing optional coverage counts remain null. Independent activation/sale ratios
are labelled as ratios rather than chronological conversions.

No legacy-page-specific stylesheet is deleted. Shared classes and helpers still
have active consumers. No backend query, tenant/source mapping, lifecycle
qualification, analytical numerator/denominator or business definition changes
are part of this retirement.

## Intentionally retained code

| Classification | Files / family | Reason |
| --- | --- | --- |
| `ACTIVE` | `features/journey`, `features/contact`, `features/sales`; all other mounted `pages/*`; `LeadExplorerIntelligence` entry → `LeadEvidenceWorkspace` | Traced route or component ownership. Naming age is not retirement evidence. |
| `COMPATIBILITY` | `app/navigation/ScopePreservingRedirect.tsx`, `/lead-ledger`, `/explore`, `/explorer`, `/leads`, `/outcomes` and existing URL aliases | Public links preserve scope and canonical modes. |
| `ACTIVE` | `lib/operationalQueries.ts` and legacy-named query keys in canonical models | Query-family/cache identifiers are real consumers; they are not old page imports. |
| `ACTIVE` | `LeadJourney`, `LeadSourceEvidence`, `LedgerFieldCoverage`, evidence export/preflight helpers | Canonical dossier/source mode use them with distinct analytical/source grains. |
| `TEST_ONLY` | `components/AnalyseDrawer.tsx`, `components/LeadTimelineModal.tsx` | Source-reading accessibility/scope regressions still consume these historical surfaces; unique analytical/event behavior has not passed a retirement parity gate. |
| `REFERENCE_ONLY` | `components/ChartPanel.tsx`, `DeferredOverviewTrend.tsx`, `features/overview/components/ChangeContributionPanel.tsx` | No mounted importer found. Retained pending separate parity review of optional chart/export/contribution behavior. |
| `REFERENCE_ONLY` | `components/charts/{ComboChart,DiminishingReturnsChart,DistributionBar,HorizontalBarChart,MetricCompositionDonut,ScatterPlot,TrendChart}.tsx` | No direct source import found; historical inventory references reusable charts. No claim that every specialized chart interaction/export has a canonical replacement. |
| `REFERENCE_ONLY` | `components/explore/ExploreResults.tsx`, `components/warehouse/BuildWarehouseExportModal.tsx` | Older aggregate visual/export workflows contain substantive behavior. Import absence alone does not establish capability parity. |
| `REFERENCE_ONLY` | `components/{EmptyState,SectionHeader,GlobalFilter}.tsx`, `lib/{connectionHealth,legacyScope,metrics}.ts`, `lib/offernet/index.ts`, `lib/visuals/datasets.ts`, `lib/applicationMode.ts` | No current inbound code import found except the removed demo-link constant. Kept outside this approved retirement set; consumer discovery does not certify complete semantic or export parity. Historical/reference-only code is not current runtime evidence. |
| `REFERENCE_ONLY` | Unsupported historical publishing/ingestion scripts already described in implementation status | Their missing-module behavior is unrelated to frontend retirement; they are not promoted to deployment commands. |

This table records the actual scope of review. Reference-only retention is not a
claim that those modules are supported product surfaces or that a complete
capability audit has been performed for each. It prevents broad deletion merely
from a filename/import-count heuristic.

## Repository security/configuration review

The current tracked-tree scan covered 767 files at the starting revision. It
checked private-key blocks, common GitHub/AWS/OpenAI/Slack credential formats,
Google API keys, credential assignments and credential-bearing URLs while
reporting only file/line/category. No private-key or private-token pattern was
identified. The Google-key pattern at `firebase-applet-config.json:4` is consumed
as Firebase browser application configuration by `src/lib/firebase.ts`; it is
not an administrative service-account credential. Additional assignment/URL
matches were synthetic test inputs. No credential values are reproduced here.
This bounded pattern review does not prove the absence of every possible secret
and did not inspect Git history, remote secret stores or deployed configuration.

The only tracked environment file is `.env.example`, whose secret fields are
empty. Vite's server environment loader does not widen the browser environment
prefix or inject server settings into `define`. Saved-investigation storage uses
an explicitly selected private backend; no persistence or credential fallback is
added. Production authentication remains fail-closed; the development bypass is
non-production only. API mounting continues to apply authentication, mutation
origin validation, private/no-store response policy and concurrency ceilings.
Record endpoints retain administrator and tenant gates; arbitrary `/api/bq`
browsing remains retired. BigQuery's read-only boundary retains single SELECT,
forbidden destination/write options and the minimum configured billed-byte ceiling.

Review repository visibility deliberately with its owner because the tree
contains internal operational architecture and source contracts. No visibility,
cloud configuration, access grant, secret, IAM policy or deployment is changed.
Existing production CSP still permits `unsafe-inline` and `unsafe-eval`; this
review does not claim CSP hardening or deployed identity/rules verification.

## Verification boundary

Parity tests were migrated to canonical components/models before retirement.
New tests exercise complete vendor exports, mode-specific denominators, exact
zero/null values, unchanged input populations and mounted evidence fields.
The targeted parity chain passed **80 tests, zero failures**; a broader preceding
Journey/Contact run passed **25 tests, zero failures**. These overlapping tests
use synthetic data. The cleanup chain (retirement, parity, canonical UI contracts,
navigation, Lead Evidence navigation and chunk recovery) passed **88 tests, zero
failures**, and TypeScript completed without diagnostics. Full repository and browser results are
recorded in the maturity-pass verification document, not inferred from this audit.
