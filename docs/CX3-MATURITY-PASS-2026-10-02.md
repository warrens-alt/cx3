# CX3 maturity pass — 2 October 2026

## Baseline and audit gate

Starting SHA: `fa9a93d3d14ef3164f4bc45b29a0dbec95fed24d`.
`git fetch origin main` confirmed that local `main` and `origin/main` match.
Tracked files were clean; existing untracked `build/`, `dist/` and `out/` are
generated artifacts and are not part of this change.

Before implementation, the audit read README, implementation status, frontend
design/inventory, generated surface inventory, numerical audit matrix, Audit
Evidence, Lead Evidence consolidation, saved investigations, security specification
and the example environment. Consumer tracing covered `src/app`, features, pages,
shared components, libraries, contracts, server, tests, scripts and workflows.

Findings:

- One canonical `/lead-explorer` already owns Population, Source Evidence and
  the shared six-tab Dossier. Separate grains, caches and private selection are
  intentional and retained.
- Reporting has release validation and read-only bounded snapshot checks, but its
  executor and replay return 501. The repository has no approved warehouse fact
  schema/joins or supported publication pipeline. Execution must require an
  explicitly registered immutable aggregate snapshot; no fact mapping is guessed.
- Operational reconciliation already has an independent, bounded, opt-in CLI.
  It has no approved evidence-persistence backend. A UI must disclose this boundary.
- Four historical router lazy exports are unmounted. Source-test consumers and
  exact export/diagnostic parity must be resolved before retirement.
- Authentication, tenant authority, administrator record gates, same-origin
  mutations, query ceilings and private saved-definition storage remain mandatory.

## Final implementation boundary

Final implementation SHA: `9a1c961223a276a1e4304fcaea4ad9dcc3bb596b` on local `main`.
The documentation commit follows that source revision; use `git rev-parse HEAD`
for the complete delivered checkout, also reported in the completion message.
Changes are local commits; no push, deployment, cloud provisioning or repository
visibility change was performed. Existing untracked generated build directories
remain outside the commits.

## Implemented capabilities

| Area | Result |
| --- | --- |
| Reporting | `cx.report-request.1` / `cx.report-result.1` executes only registered metrics from a release's explicitly approved `cx.reporting.aggregate-snapshot.1`. Authentication, tenant authority, manifest/definition checks, configured-dataset containment, immutable metadata, fixed parameterized SQL, billed-byte guard and 100-row ceiling are enforced. Missing evidence stays null/PARTIAL; unsupported releases return `NOT_SUPPORTED`. |
| Replay | `cx.report-replay.1` uses the existing server-only signing-key boundary with HMAC-SHA256, bounded payload, 30-day expiry, tenant reauthorization, release/revocation/manifest/snapshot validation and exact result hashes. Original/replayed results show MATCH, MISMATCH or explicit unavailable/invalid states. Replay never establishes independent reconciliation. |
| Reports UI | Existing `/reports` now provides release identity, source/snapshot coverage, explicit supported metric/scope controls, exact metric anatomy, independent evidence states, canonical Audit inspection, signed replay/comparison and JSON evidence export. No approved frozen record reader exists, so that limitation is explicit. |
| Existing evidence consumers | Vendor Evidence and Commercial Reconciliation honor explicit historical releases, reject repeated releases and unsupported/private URL scope, preserve exact strings in summaries, tables and graph tooltips, and never substitute totals for a missing group. Matched-period presentation uses the declared prior equal-length period, not a duplicate current query. |
| Reconciliation readiness | Existing admin `/validation` prepares safely quoted dry-run, warehouse and service-comparison commands for the existing harness. Local JSON import validates exact scope, definition, grain, timestamp and seven metric comparisons. Imports are operator-supplied and unattested; production stays NOT_VERIFIED and persistence is UNAVAILABLE. |
| Investigation | Overview attention and significant changes open the existing Investigation workflow with permitted tenant/dates/filter/driver context. Missing attention is unknown. Private identities are excluded from shareable handoff URLs. |
| Lead Evidence | Population adds six literal lifecycle positions, supplied qualification, anomalies and aggregate call evidence while retaining the full 17-column analytical preset. The single Dossier retains all six tabs, exact recorded outcomes and source-row/field/identity/analytical-relationship trace. No attempt chronology is reconstructed from counters. |
| Audit | Existing InspectorHost and evidence primitives own report inspection. A distinct Reproduced state is separate from Reconciled. Per-metric observation/mapping, exact components and timestamp precision remain visible. Immutable report inspectors use signed replay instead of offering an incomplete scoped link. |
| Navigation and cleanup | Seven business areas, canonical route manifest, Lead Evidence aliases, route errors and chunk recovery retained. Consumer-tested capability parity preceded legacy deletion. |
| Responsive/accessibility | Existing tokens, bounded table regions, wrapping exact values/hashes, mobile controls, semantic states, focus trapping, Escape and focus return retained and exercised in light/dark browser QA. |

## Important implementation files

- `contracts/reporting.ts`, `server/reporting/{scope,query,service,repository,release,fingerprint,replay,router}.ts`:
  versioned validation, snapshot execution and signed replay on the existing registry.
- `src/pages/VersionedReports.tsx`,
  `src/features/evidenceWorkspace/{ReportExecutionWorkspace,ReportReplay,ReleaseEvidence}.tsx`
  and `reportEvidenceModel.ts`: report controls, exact display, release provenance and replay.
- `src/lib/{reportingClient,reportingScope,useEvidenceWorkspace,reportPreflight,evidenceWorkspace}.ts`:
  shared response/scope validation, release-aware query identity and exact formatting.
- `contracts/reconciliationEvidence.ts`,
  `src/features/trust/components/ReconciliationReadiness.tsx`, `src/pages/AdminValidation.tsx`:
  existing-harness operator contract and admin UI.
- `src/features/investigation/{LeadEvidenceSummary,LeadDossier,InvestigationRecordList}.tsx`,
  `leadEvidenceSummaryModel.ts`, `dossierAuditEvidence.ts`, and Overview components:
  literal record evidence and connected investigation actions.
- `src/shared/evidence/{InspectorHost,ReconciliationView}.tsx`, `auditVisualModel.ts`,
  `auditPanelModel.ts`, `src/components/operations/EvidenceInspector.tsx`:
  canonical audit model and compatibility adapter.
- Canonical Contact/Speed presentation, exports and tests preserve capabilities
  before removing old pages. The full consumer map is in
  [FRONTEND-RETIREMENT-2026-10-02.md](FRONTEND-RETIREMENT-2026-10-02.md).
- `tests/versioned-reporting.test.ts`, `reporting-replay.test.ts`,
  `reporting-workspace.test.ts`, `reconciliation-readiness*.test.ts`, lifecycle,
  audit, retirement and navigation tests; browser scripts listed below.

The exact tracked change list is reproducible with
`git diff --name-status fa9a93d3d14ef3164f4bc45b29a0dbec95fed24d HEAD` in the delivered checkout.

## Retirement decisions

| Decision | Files / reason |
| --- | --- |
| REMOVED | `SpeedToLeadIntelligence.tsx`, `ContactStrategyIntelligence.tsx`, `SalesActivationIntelligence.tsx`: unmounted consumers and source-reading tests migrated only after canonical diagnostics and export parity. |
| REMOVED | `AccessInvitesTab`, `AccessPoliciesTab`, `AuditLogTab`, `PreAuthorizeModal`, `TenantScopeModal`, `UsersDirectoryTab`: no source/test/fixture/script/route consumers; active access features retain ownership. |
| REMOVED | Unmounted `DemoWorkspace.tsx`, its misleading error-state link, and four unused router lazy imports. No isolated demo producer existed. |
| RETAINED | `FunnelIntelligence.tsx`, REFERENCE_ONLY: its old browser-derived vendor Sale/RPC ratio has no approved equivalent in the canonical returned contract. It was not transplanted for deletion convenience. |
| RETAINED | Public compatibility aliases; active source/journey/export helpers; TEST_ONLY historical modal/drawer code; reference chart/export families without proven capability parity. Full classifications and limitations are in the retirement document. |

## Data semantics and security

No existing analytical formula, denominator, source/tenant mapping, lifecycle
qualification, registered metric definition or business meaning was changed.
The executor checks aggregate values/components against the existing versioned
registry; it does not compile guessed joins over operational facts. Source coverage
required by vendor membership follows the existing fetched-lead delivery contract.
Formatting and change displays preserve exact decimals; no unknown value becomes zero.

Same-source agreement, checked arithmetic, approved publication, identity matching
and replay remain separate from independent source reconciliation and business
approval. Operational validation stays NOT_VERIFIED. Recorded sale/activation is
not promoted to billing, collections, revenue recognition or profitability.

Authentication, tenant isolation, admin record boundaries, same-origin mutations,
query ceilings, fail-closed production identity and private saved-investigation
storage remain intact. Regression and production HTTP tests exercise those code
boundaries. The tracked-tree secret/configuration review found no private-key or
private-token patterns; public Firebase browser configuration and synthetic test
credentials are documented without reproducing values. This does not cover Git
history, remote secret stores or deployed configuration. Review repository
visibility deliberately because the tree contains internal operational architecture;
no visibility change was made. Existing CSP limitations are recorded in the
retirement/security audit.

## Verification results

Environment: Node **v24.15.0**, npm **11.12.1**, macOS local checkout; package engines
permit Node >=22. CI remains configured for Node22. Firestore uses the existing
Java21 runtime at `/private/tmp/cx3-java-final/jdk-21.0.12.1+1-jre/Contents/Home`.
No dependency or lockfile change was made.

| Required command | Executed result |
| --- | --- |
| `npm ci` | Passed: 524 packages installed, 525 audited, zero vulnerabilities. |
| `npm run lint` | Passed, no TypeScript diagnostics. |
| `npm test` | Passed: final rerun through `verify` has 1,309 tests, 1,308 passed, zero failed, one emulator-gated skip. The earlier standalone integration run also passed (1,307 passed of 1,308 before the added timestamp-display regression). |
| `npm run docs:surfaces:check` | Passed; generated inventory includes current versioned contract constants and unchanged public route map. |
| `npm run build` | Passed: nonempty client/server bundles, compatibility outputs and static warehouse catalogue exports. These exports are catalogue artifacts, not live source reconciliation. |
| `npm run verify` | Passed on the final implementation: TypeScript, 1,309 tests (1,308 passed, zero failed, one emulator-gated skip), current generated surfaces and complete production build. |
| `npm run test:rules` | Passed: 10/10, no failures or skips. Expected permission-denied emulator diagnostics occur in denial tests. |
| `npm audit --audit-level=high` | Passed: zero vulnerabilities. |
| `npm run test:google-runtime` | Passed all five launch modes: Express development, direct Vite, built Vite preview, Cloud Run bundle without NODE_ENV and default IAP boundary. |
| `node scripts/smoke-production.mjs` | Passed all four generated server entrypoints: nested/compatibility ESM and CJS; startup, assets, SPA, authentication and private-file boundaries. |

Local logs live beside this checkout under `../maturity-*.log`. The final `verify`
log is `../maturity-verify-final.log`; standalone tests, npm install, lint, surfaces,
build, dependency audit, rules, production smoke and Google runtime have named
`maturity-…-final.log` / `maturity-…-smoke.log` evidence. Initial sandbox IPC
restrictions were resolved using the permitted host execution path; no test or
assertion was removed to avoid that environment restriction.

### Browser QA

Browser plugin was unavailable; existing Playwright and Chromium were used.
Suites mount current source with current production CSS and synthetic service data.
Reporting fixtures execute the actual backend/replay functions against a synthetic
repository; readiness imports actual harness output with synthetic warehouse/service
dependencies. They do not query a production warehouse or certify deployed auth.

| Suite | Result / scope | Final evidence directory |
| --- | --- | --- |
| Frontend convergence | 249/249 checks; 23 routes at all five widths, light/dark plus workflow checks; 296 screenshots | `/private/tmp/cx3-maturity-final-frontend-convergence-qa` |
| Lead Evidence | 10/10 scenarios, 80/80 checks; all five widths, light/dark; 50 screenshots | `/private/tmp/cx3-maturity-final-lead-evidence-rerun-qa` |
| Investigation | 18/18 checks; 1440/820/390, light/dark | `/private/tmp/cx3-maturity-final-investigation-qa` |
| Case design | 6/6 scenarios; 1440/820/390, light/dark | `/private/tmp/cx3-maturity-final-case-design-qa` |
| Ledger/Journey visuals | 6/6 scenarios; 1440/820/390, light/dark | `/private/tmp/cx3-maturity-final-ledger-visual-qa` |
| Audit Evidence | 92/92 checks; all five widths, light/dark plus viewer gates | `/private/tmp/cx3-maturity-audit-final` |
| Reporting/replay | 10/10 scenarios, 190/190 checks; all five widths, light/dark including populated graphs and exact tooltips | `/private/tmp/cx3-maturity-reporting-final-v6` |
| Reconciliation readiness | 10/10 scenarios, 100 checks; all five widths, light/dark | `/tmp/cx3-reconciliation-browser-verified` |

All-five-width matrices use **1440, 1024, 820, 390 and 320**. Suites overlap;
counts must not be added into a purported unique acceptance total. Exact numbers,
nulls, private scope, historical release selection, execution/replay, export,
admin states, table scroll, focus/Escape/return and no page overflow were exercised.
Representative desktop/mobile screenshots in both themes were visually inspected.

QA found and fixed mobile long-hash overflow, populated Vendor/Commercial report
layout constraints, rounded legacy graph tooltip values and mobile tooltip overflow,
unsupported record/contract copy and truncated reconciliation mode labels. Initial Lead Evidence
screenshot capture timed out under parallel browser load; final isolated rerun is
recorded above. Final reports retain earlier evidence rather than conceal failed
iterations. These checks are not manual assistive-technology certification or
production performance measurements.

Reproduce with the existing runtime by setting `CX_PLAYWRIGHT_MODULE` and
`CX_BROWSER_QA_OUTPUT`, then running the corresponding
`scripts/check-*-browser.mjs` (reporting and reconciliation use `node --import tsx`). Use production
CSS from a successful `npm run build` and the runner-specific documented variables.

## Remaining production dependencies and unverified work

- Approve, materialize and publish immutable aggregate rows for intended tenant,
  date, filter, grouping and metric scopes. Legacy releases without the descriptor
  remain unsupported. No supported ingestion/publication pipeline was fabricated;
  the historical unfinished scripts remain unsupported.
- Configure the reporting dataset, read-only BigQuery IAM/credentials, snapshot
  retention and server-only signing key in the actual deployment. Key rotation
  invalidates tokens signed with the previous key. No cloud setup was performed.
- Execute the opt-in independent reconciliation harness under approved live
  credentials and retain exact-scope evidence through an approved persistence
  backend. Local imported JSON is not cryptographically attested and is not saved.
- Obtain source-owner approval for source meanings, event-time/timezone semantics,
  repeated HLC/call/activation identities, coverage and financial interpretations.
- Approve tenant marketing mappings and attribution join keys; source observed spend,
  billing/collections, commission, telephony and other costs from approved contracts
  before enabling withheld financial measures. Budget does not stand in for spend.
- Deploy and verify selected production Firebase/IAP identity, Firestore rules,
  tenant isolation and network/edge configuration. No production URL was tested,
  no application or rules deployment occurred, and no live data was certified.
- Frozen aggregate supporting-record inspection is unavailable until a separate
  approved record-level contract and admin access path exist. Aggregate replay
  cannot prove individual records, business approval or independent reconciliation.

## Local commit sequence

| Commit | Message |
| --- | --- |
| `46051a4` | chore: establish CX3 maturity pass baseline |
| `7d99a70` | feat: implement versioned evidence report execution |
| `95b44e8` | feat: add immutable evidence report replay |
| `67217cc` | feat: mature evidence reports workspace |
| `fe6b3eb` | feat: refine investigation and lead evidence workflow |
| `f46ab54` | feat: strengthen visual audit evidence |
| `8438649` | fix: preserve canonical diagnostic and export capabilities |
| `3e6fe68` | refactor: retire proven unused legacy frontend surfaces |
| `c252612` | feat: add scoped reconciliation readiness workflow |
| `0bfa501` | fix: harden responsive and accessible evidence workflows |
| `9a1c961` | fix: preserve exact values and evidence boundaries in reporting graphs |
| Documentation commit | `docs: record CX3 maturity implementation and verification` (follows the tested implementation SHA; final checkout SHA is in the completion report). |
