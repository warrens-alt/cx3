# CX3 product rebuild — 2 October 2026

Starting SHA: `9c7f0ecda7b4142ffd9bbcfdd6dfd6d690965e62` (`main`, fetched and fast-forward checked against `origin/main`).
Final implementation SHA: `811c8b53695424d25e8aa60d08de4a391b8456b7`. A documentation-only commit records this immutable implementation boundary.

## Audit and scope

The audit read README, maturity pass, frontend retirement/design architecture,
implementation status, accuracy history, Audit Evidence, Lead Evidence consolidation,
naming and relevant QA records. It enumerated source, contracts, server modules,
tests, scripts and current route consumers. Parallel reviews traced Command/Journey/
Operations contracts, Investigation/Lead Evidence state, and Commercial/Evidence.

This is a frontend architecture rebuild. No warehouse SQL, source/tenant mapping,
authentication, authorization, metric denominator, qualification, timestamp or
read-only query safeguard is intentionally changed. Operational analytics remain
unverified; arithmetic agreement, execution replay, source reconciliation and
business approval remain independent evidence states.

Important findings constrain the presentation:

- Command has six supplied lifecycle counts. Qualification is null and routing has
  no population contract. Both stay unavailable.
- Matched prior aggregate comparisons exist; a matched daily historical series is
  not returned. No shifted or fabricated previous-period line is drawn.
- Journey transition intersections differ from independently recorded outcome
  populations. Activation/sale ratio is not ordered conversion.
- Aggregate call counters cannot establish per-attempt history. Unrecorded counts
  remain separate from explicit zero calls.
- Commercial platform media, matched attribution outcomes and intake-cohort revenue
  have distinct grains. Billing, collections, commission, telephony and costs remain
  unavailable unless their respective evidence contracts supply them.
- Source observations are tenant-wide. Immutable releases have strict query scope;
  workspace lens selection uses path segments, not invented analytical parameters.
- Lead Evidence retains separate Population/Source APIs and cache identities. Raw
  records remain administrator-only; private lead selections stay session-local.

## Workspace architecture

| Workspace | Canonical entry | Integrated capabilities |
| --- | --- | --- |
| Command | `/command` | Lifecycle, current daily observations, matched movements, attention, concentration |
| Journey | `/journey` | Progression, acquisition, qualification, routing, process, vendors, cohorts, outcomes |
| Operations | `/operations` | Contact effort, response speed, dispositions, temporal, CLI, agents |
| Investigate | `/investigate` | Signals, diagnosis, narrowing, Lead Evidence, dossier, case file, notes, export |
| Commercial | `/commercial` | Evidence bridge, media/attribution, frozen reconciliation |
| Evidence | `/evidence` | Sources, metric registry, reconciliation states, releases/replay, warehouse |

Settings, access control and validation are separate administrative destinations.
The sidebar remains collapsible and keyboard accessible. The mobile navigation
contains Command, Journey, Operations, Investigate and More (Commercial/Evidence/
Settings). The original ConversionX logo and semantic lifecycle tokens remain.

## Compatibility and composition

Every original mounted URL remains usable. `/overview` opens Command; `/funnel`,
`/campaigns`, `/vetting`, `/routing`, `/offershop-flow`, `/vendor-quality`, `/cohorts`
and `/sales-activation` adapt to Journey lenses. Contact/speed/disposition/temporal/
CLI/agent URLs adapt to Operations. `/data-integrity`, `/reports`, `/vendors` and
`/warehouse` adapt to Evidence. `/reconciliation` adapts to Commercial. Canonical
lens URLs use named path segments. `/lead-explorer` remains canonical Lead Evidence;
`/lead-ledger` continues its Source-mode compatibility redirect.

The route manifest owns both primary workspace navigation and compatibility
identities. Existing scope policies still reject private/unsupported state and
preserve repeated scope keys for validation. Active filter chips are visible even
when their editor is closed. Existing ChartFrame, EvidenceBars, InspectorHost and
scope/layout primitives remain shared owners rather than duplicated chart systems.

## Implementation checkpoints

1. Foundation: six-workspace manifest, canonical paths, compatibility adapters,
   light/dark navigation identity, accessible mobile/sidebar, persistent scope chips.
   `npm ci`: passed, 525 audited packages, zero vulnerabilities. Focused navigation,
   colour/accessibility and scope suite: 26 passed. Subsequent phases extend these
   routes through lazy workspace composition.

2. Command: eight lifecycle positions, seven supplied daily series, exact table
   values, metric audit, attention, matched movement handoff and descriptive
   concentration. Movement and primary metric audit have separate click targets.
3. Journey: clickable stages/intersections and supported analytical lenses update
   in place. Delivery→Dial, Dial→RPC and Sale→Activation lazy-load the existing
   response, contact-effort and activation-ageing models beneath the selection.
   Explicit context describes their original eligible populations; no query is
   falsely narrowed to a transition loss. Stage selection persists per client.
4. Operations: shared overview/controls resources supply populations, daily outcomes,
   recorded effort, response bands and vendor outcomes. Specialist lenses mount
   only their active feature. Zero calls and unrecorded counters remain separate.
5. Investigation: left signal/case navigation, central matched comparison and
   signed driver bars, right case file, removable segments, scoped Lead Evidence,
   six-section dossier and optional focus mode. Timeline pins now use milestone
   identifiers so different events on one lead do not overwrite each other.
   Contextual Ask ConversionX consumes existing evidence and limitations.
6. Commercial: the evidence bridge is the primary visual; the approved matched
   outcome rail includes explicit unavailable stages. Supplementary efficiency
   measures, campaign/channel detail, attribution and frozen reconciliation reuse
   their existing contracts and feature owners.
7. Evidence: Overview, Sources, Metrics, Reconciliation, Releases and Warehouse
   lenses plus Vendor Evidence. Clickable declared lineage uses the metric registry;
   five independent evidence states avoid a combined green verification badge.
8. Integration/consolidation: all canonical and legacy adapters mount shared owners;
   optional matched dates appear in scope; readiness/source notices resolve aliases;
   release navigation retains exact dates/filters and drops frozen identity only
   when returning to operations. Main-document titles identify workspace landings.

## Added, replaced and retained presentation owners

| Area | Added or composed owners |
| --- | --- |
| Command | `src/workspaces/command/ConcentrationPanel.tsx`; existing OverviewPage, OutcomeStrip and PerformanceTrend evolved in place |
| Journey | JourneyWorkspace, JourneyWorkbench, JourneyTransitionContext, JourneyMetricEvidence, selection model and scoped CSS |
| Operations | OperationsWorkspace, OperationsOverview, OperationsTrend, bucket presentation adapter and scoped CSS |
| Investigate | InvestigationCaseRail and InvestigationComparison; existing DriverAnalysis, EvidenceTray, LeadDossier, LeadPopulationBrowser and workspace composed in place |
| Commercial | CommercialWorkspace, CommercialOutcomeRail, commercialBridgeModel and scoped CSS; existing bridge/audit extended |
| Evidence | EvidenceWorkspace, EvidenceLineageExplorer, EvidenceStateGuide and scoped CSS; existing feature owners support embedded rendering |

The old primary navigation presentation is replaced by six workspaces, but its
external URLs remain. Twenty unused direct lazy exports were removed from AppRouter
once all runtime imports and tests were traced through workspace adapters. The
unused Command root-cause drawer mount and its model state were removed after the
same metric actions moved to the scoped Investigation case. The reusable drawer
itself remains for other callers. Conflicting old two-column investigation CSS
was removed in favour of the explicit signal/analysis/case-file layout.

No historical feature source file was deleted speculatively. JourneyPage and
unproven historical candidates remain reference/test code. Acquisition,
qualification, routing, process, vendor quality, cohorts, sales, contact, response,
CLI, agents, temporal, source observability, versioned execution and replay retain
their actual feature/query owners. Shared ChartFrame, LifecyclePath, EvidenceBars,
PercentileRail, audit inspectors and scope primitives remain the chart/UI system.

## Evidence and semantic boundaries preserved

The final protected-path diff against the starting SHA contains no changes to
`contracts/`, `server/`, `firestore.rules`, `security_spec.md`, `.env.example`,
`package.json` or `package-lock.json`. No API, source identifier, SQL, metric
formula, denominator, timestamp, qualification or permission is changed.

- Command plots returned daily counts/revenue. It does not calculate new daily
  conversion rates from partially available observations. Matched daily history is
  absent, so Investigation shows exact current/prior aggregate bars, not a fake
  prior trend.
- Journey uses supplied independent stage populations and separately supplied
  qualified transition intersections. Display rates are never reconstructed from
  counts when absent. Returned velocity averages are not relabelled medians. The hero has six measured
  nodes plus explicit unavailable qualification/routing totals and specialist
  lenses. Journey offers aggregate Comparison and supplied segment/time lenses;
  no daily Trend lens is invented for a response without daily observations.
- Operations retains capture-cohort/first-vendor denominator rules. Agent event
  dates, contact aggregates and source dispositions retain their distinct grains.
- Population and Source retain separate APIs, query/cache identities, pagination,
  original records and exact-match relationship semantics. Raw records and exports
  remain administrator-only. Private selections remain session-local.
- Monetary decimals, replay identities, independent reconciliation and business
  approval retain their existing contracts. Budget is not spend, recorded revenue
  is not cash, and analyst conclusions cannot promote validation.
- Definitions and declared lineage can be inspected without a measured query.
  Their mapping does not claim observed production lineage or source reconciliation.

## Verification

| Command | Result |
| --- | --- |
| `npm ci` | Passed; 525 audited packages, zero reported vulnerabilities |
| `npm run lint` | Passed, including final verification |
| `npm test` | Final run: 1,335 tests; 1,334 passed, zero failed, one emulator-only skipped |
| `npm run docs:surfaces:check` | Passed; generated route/API inventory current |
| `npm run build` | Passed; 108 client assets, server bundles and static warehouse-reference exports validated |
| `npm run verify` | Passed end to end on final implementation source |
| `git diff --check` | Passed |
| Protected backend/security/contract diff | Empty against starting SHA |

Final complete verification log:
`/Users/warrenstear/Documents/ChatGPT/CX3/product-rebuild-evidence-2026-10-02/verification/verify-final.log`.
The complete suite includes the new Command daily-audit regressions and contextual
Journey checks. No failing tests remain. The only skip is Firestore access lifecycle
when `FIRESTORE_EMULATOR_HOST` is absent; this is the existing emulator dependency.

Original tests for retired labels or direct route ownership were deliberately
migrated to the equivalent canonical adapter/feature chain. Behavioral checks for
scope, nulls, exact values, query counts, access, pagination, pins, source grains,
exports and replay were retained. New integration tests cover transition context,
canonical/legacy Outcomes parity, eight lifecycle positions, recorded zero,
release scope, independent commercial inputs and declared lineage. Browser QA
found and fixed real click interception, dossier sticky/focus and timeline pin
identity defects. Final review fixed daily-trend audit evidence incorrectly showing
unavailable for observed values and removed an unregistered revenue metric ID;
three regression cases preserve observed zero, unknown rows and revenue meaning.

The original broad convergence harness encodes the superseded seven-area labels.
Its behavioral coverage is retained by the updated routed acceptance tests and
the new six-workspace matrix; focused existing Investigation, Lead Evidence,
reporting and reconciliation browser harnesses were also executed.

## Browser and visual evidence

All runs use labelled synthetic fixtures and the actual router, shell, feature
modules, CSS and request consumers. They do not authenticate to production or read
customer warehouse rows. The browser plugin skill was not available in this
session; the existing Playwright/Chromium runtime was used, without installing a
new browser dependency.

Evidence root on this workstation:
`/Users/warrenstear/Documents/ChatGPT/CX3/product-rebuild-evidence-2026-10-02/`.

| Evidence directory | Coverage |
| --- | --- |
| `workspaces/` | 60 workspace × width × theme scenarios and three scope/runtime checks; 63 passed |
| `journey-operations/` | 28 passed checks: 20 populated width/theme scenarios plus eight transition/lens/query-reuse interaction flows; 32 screenshots |
| `investigation-rpc/` | Final-build RPC case, exact CSV and diagnosis/conclusion screenshots, with five-width overflow checks |
| `investigation/` | 20 passed checks: six-stage case, RPC decline, segment/records, source/audit, pins, notes and export; admin/viewer and recovery paths |
| `lead-evidence/` | 80 passed workflow checks across ten width/theme scenarios: Population/Source separation, dossier, pagination, identity privacy and focus/sticky behavior |
| `case-design/` | Six passed cases: rail geometry and sticky scope, desktop/mobile light/dark |
| `evidence-commercial/canonical-workspaces/` | 90 canonical route/width/theme scenarios with interactions |
| `evidence-commercial/reporting-{legacy,canonical}/` | 20 scenarios; 380 checks of exact result/export/replay and scope |
| `evidence-commercial/reconciliation-{legacy,canonical}/` | 20 scenarios; 200 checks including admin/viewer and unsupported scopes |

`results.json` files contain scenario results, errors and screenshot inventories.
Reproducible supplementary runners are saved alongside the evidence; primary
runners are versioned in `scripts/`. Responsive widths are 1440, 1024, 820, 390 and
320, each in light/dark. No page/main overflow or browser runtime/console failures
remain in passing runs. Exact tables use bounded horizontal scroll where needed.

Two generated visual concepts guided the Command/Investigation hierarchy:

- `/Users/warrenstear/.codex/generated_images/01a0fe64-a1aa-75e0-ba20-ad6ef931503c/exec-08e2ffb4-2a28-4e44-8be2-ce5ed6f71826.png`
- `/Users/warrenstear/.codex/generated_images/01a0fe64-a1aa-75e0-ba20-ad6ef931503c/exec-c8373342-6493-4067-960c-ce352a3ee2c6.png`

Concepts and actual desktop/mobile renders were visually inspected. The result
preserves the original silver logo, graphite sidebar, neutral canvas, compact type,
semantic lifecycle colours, dominant analysis and case rails. Deliberate deviations:
unsupported concept activity content was omitted; unknown values have no bars;
matched comparison uses available aggregates; exact scope and evidence limitations
need more space than the simplified concept. The default Journey/Operations
redundant heading strips were removed and Journey export moved into its header
following screenshot inspection. Commercial's bridge moved before secondary KPIs.

## Remaining limitations and production dependencies

1. Live warehouse totals and source-owner reconciliation were not performed.
   Existing operational `UNVERIFIED`/`NOT_VERIFIED` semantics remain in force.
2. Qualification/routing populations, prior daily observations, RPC timestamps,
   attempt-level histories and unsupported dimensions remain unavailable unless
   the current source contracts explicitly provide them. Supported deterministic
   record order is retained; arbitrary server sorting was not invented.
3. Matched commercial qualification, billing, collections, commission, telephony,
   overhead and contribution need authoritative inputs. Campaign/channel economics
   reuse the scoped acquisition lens; they were not duplicated into a separate
   Commercial analytical model.
4. Immutable release execution requires the approved snapshot, authorised tenant,
   registered definitions and existing signing configuration. This rebuild does
   not provision or publish production reporting snapshots.
5. Saved investigation definitions use existing authorised private storage when
   configured. They do not persist raw records, pins or analyst notes to a newly
   invented service. Case export retains the local evidence/conclusion workflow.
6. Existing Firebase/IAP configuration, deployed rules, tenant/source maps and cloud
   credentials remain deployment responsibilities. The plain test suite skips the
   emulator-only Firestore lifecycle when its emulator is absent; frontend/backend
   access regressions remain covered by the ordinary tests.
7. This delivery is local commits on `main`. No GitHub push, production publication,
   IAM/storage provisioning or financial certification was performed.

Recommended next work is production rollout review using authorised fixture-free
access, source-owner comparison against agreed metric populations, and provisioning
only the explicitly approved reporting/storage dependencies. These are separate
from this frontend rebuild.

## Implementation commits

Each implementation area was verified before its commit. Independent domain work
was completed in parallel; the final adapter commit connects all lazy owners.

| Checkpoint | Commit |
| --- | --- |
| Foundation | `c742f7f` |
| Command and scope-preserving movement | `52e2670` |
| Journey and transition analysis | `cb134d0` |
| Operations | `3bc429e` |
| Investigation case workspace | `fc02de2` |
| Commercial bridge | `0742cbe` |
| Evidence trust workspace | `f62ed00` |
| Final integration, compatibility and audit fixes | `811c8b5` |

A separate documentation-only commit closes this report. Generated `build/`,
`dist/` and `out/` outputs remain untracked; they are not source deliverables.
