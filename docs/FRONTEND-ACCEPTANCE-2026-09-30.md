# Frontend acceptance record — 30 September 2026

## Outcome and evidence boundaries

Source fixes and repeatable isolated acceptance tests are delivered on `codex/frontend-acceptance`. Exact submitted/merged SHA and final CI are recorded by the PR and delivery handover. This document does not certify a Google runtime.

Fetched base: `7da6dc193a821aacec2b996b49a19c9f2b583fb3`, `warrens-alt/cx3` main. Existing local `cx3-audit` commit `6bc8fa2afc42ab27feea19d297023c0af821af36` was preserved. The managed worktree operation could not resolve the empty parent repository; this checkout was created from the verified clone as an isolated Git worktree. PRs 28–35 and their route/style changes were inspected. Three read-only audit agents advised one editing owner.

Evidence levels: source inspection; routed component tests; local Chrome synthetic browser checks; authenticated Google **baseline** route observations. Published production was neither changed nor certified. Google source identity must be established before final live acceptance.

## Active-route inventory

Every row uses `AppShell` → `AppRouter`, existing auth/readiness/filter providers and the global CSS chain in `src/main.tsx`: index, product, analyticsVisuals, journeyContactVisuals, visualRefinement, salesCommercialVisuals, timeAgentCampaignVisuals, crossAppConvergence. Source ledger additionally imports `features/leadLedger/ledger.css`; analytical ledger is its lazy panel. Route-local imports and existing model files remain authoritative.

The actual `/speed-to-lead` route is `features/contact/SpeedPage.tsx`. `pages/SpeedToLeadIntelligence.tsx` remains an unused router export and was not remounted. The active page now supplies `.cx-speed-page`; shared EvidenceBars styling is eagerly imported so direct agent/campaign visits do not depend on visiting Journey first. The ledger selectors were verified against rendered DOM. Only ledger tokens/responsive rules were consolidated; no speculative global CSS rewrite.

All baseline URLs use the confirmed Google preview origin plus the path below and `clientId=default_tenant&startDate=2026-09-28&endDate=2026-09-28`. Overview additionally used 26–28 September. Diagnostics/release routes retain their existing policy; a URL date is not proof that their backend report is date-scoped. Heading/table observations establish reachability, not response reconciliation or full control acceptance.

| Route | Active component under `src/` | Existing data path | Existing interaction path | Authenticated baseline observation |
|---|---|---|---|---|
| `/overview` | `features/overview/OverviewPage.tsx` | useOverviewModel | Summary, trend and scoped analysis links | Loaded single-day and 26–28 September trend views |
| `/funnel` | `features/journey/JourneyPage.tsx` | useJourneyModel | Stage/transition/segment inspection | Rendered headings; 2 tables; no sampled alert |
| `/contact-strategy` | `features/contact/ContactPage.tsx` | useContactModel | Call buckets, vendor selection and disposition tabs | Rendered headings; 1 tables; no sampled alert |
| `/speed-to-lead` | `features/contact/SpeedPage.tsx` | useSpeedModel | Existing backlog drill, contact links and operating-controls disclosure | Loaded; missing active speed class, dormant Why changed action reproduced |
| `/vendor-quality` | `pages/VendorLeadQuality.tsx` | useOperationalData / fetchVendorQuality | Local metric/segment selection; existing scoped drill | Rendered headings; 7 tables; no sampled alert |
| `/sales-activation` | `features/sales/SalesActivationPage.tsx` | useSalesActivationModel | Summary, ageing and segment inspection | Rendered headings; 2 tables; no sampled alert |
| `/commercial` | `pages/CommercialIntelligence.tsx` | useOperationalData / fetchCommercial | Metric inspection and scoped links | Explicit unavailable commercial/profitability evidence |
| `/exceptions` | `pages/Exceptions.tsx` | useOperationalData / fetchOverview + fetchExceptions | Exception and vendor backlog recordLink | Rendered headings; 0 tables; no sampled alert |
| `/lead-ledger` | `features/leadLedger/LeadLedgerWorkspace.tsx` | useQuery (source); useOperationalData / fetchRawLeads (analytical) | Distinct source/analytical panels; submitted search, pagination, timeline | Rendered headings; 0 tables; no sampled alert |
| `/lead-explorer` | `pages/LeadExplorerIntelligence.tsx` | useOperationalData / fetchRawLeads | Submitted search, existing drill parameters and timeline | Rendered headings; 1 tables; no sampled alert |
| `/campaigns` | `pages/CampaignIntelligence.tsx` | useOperationalData / fetchCampaigns | Local measure selection and campaign drill | Rendered headings; 1 tables; no sampled alert |
| `/temporal` | `pages/TemporalIntelligence.tsx` | useOperationalData / fetchTemporal | Local metric, day/hour heatmap selection | Backend error: operational_leads must be dataset-qualified |
| `/agent-performance` | `pages/AgentPerformanceIntelligence.tsx` | useOperationalData / fetchAgentPerformance | Local search/metric and exact agent selection | Rendered headings; 3 tables; no sampled alert |
| `/cli-performance` | `pages/CliPerformance.tsx` | useOperationalData / fetchCliPerformance | Local ranking/sort and existing import controls | Explicit outbound CLI column gap |
| `/vetting` | `pages/Vetting.tsx` | useAnalyticsData | Existing evidence selection and local search | Heading rendered; complete state/control acceptance not established |
| `/routing` | `pages/RoutingIntelligence.tsx` | useAnalyticsData | Local evidence selection and scoped links | Rendered headings; 2 tables; no sampled alert |
| `/cohorts` | `pages/Cohorts.tsx` | useAnalyticsData | Existing cohort chart/table and scoped links | Rendered headings; 2 tables; no sampled alert |
| `/consumers` | `pages/ConsumerReentry.tsx` | useAnalyticsData | Tier/sequence/sample panels; existing admin sample guard | Heading rendered; complete live state/control acceptance not established |
| `/offershop-flow` | `pages/OffershopProcessObservability.tsx` | useOperationalData / fetchOffershopFlow | Local tabs/search, existing read-only rule simulation | Rendered headings; 1 tables; no sampled alert |
| `/reconciliation` | `pages/CommercialReconciliation.tsx` | useEvidenceWorkspace / useQuery | Local evidence filters/sort/inspection | Heading rendered; complete live state/control acceptance not established |
| `/warehouse` | `pages/WarehouseAnalytics.tsx` | useOperationalData / warehouse clients | Catalogue filters, refresh and scoped links | Rendered headings; 1 tables; no sampled alert |
| `/reports` | `pages/VersionedReports.tsx` | useQuery / fetchReportingCatalogue | Release selection and evidence scope | No published releases for selected tenant |
| `/ai-insights` | `pages/AiOperationalInsights.tsx` | useOperationalData / fetchAiInsights | Local severity and existing question action | Rendered headings; 0 tables; no sampled alert |
| `/admin` | `pages/Settings.tsx` | useOperationalData / workspace diagnostics | Appearance controls and diagnostic disclosures | Rendered headings; 0 tables; no sampled alert |
| `/validation` | `pages/AdminValidation.tsx` | useAnalyticsData + fetchWarehouseTables | Reference panels and local catalogue filters | Loaded fixed VERIFIED comparisons and render-time reconciliation claim |
| `/access-control` | `pages/UserManagement.tsx` | existing Firestore onSnapshot subscriptions | Local tabs/filter; mutation handlers unchanged and not used live | Rendered headings; 1 tables; no sampled alert |
| `/vendors` | `pages/VendorPerformance.tsx` | useEvidenceWorkspace / useQuery | Local exact-decimal sort, metric and vendor selection | Telemetry audit boundary; release metrics not certified |
| `/lead-engine` | `leadEngine/LeadEngineLayout.tsx` | Existing module effects and legacy API clients | Reachable local module navigation; legacy boundary displayed | Rendered headings; 1 tables; no sampled alert |
| `/data-integrity` | `pages/DataIntegrityIntelligence.tsx` | useOperationalData / fetchDataIntegrity | Existing integrity panels and controls | Rendered headings; 4 tables; no sampled alert |

Aliases in `AppRouter` and `ScopePreservingRedirect` are unchanged. Navigation reuses their destination policy, including repeated workspace values and explicit destination precedence. Operational filters do not leak to settings/releases. Consumer re-entry remains under Lead Journey.

## Confirmed findings and dispositions

| Severity / evidence | Reproduction and impact | Resolution / remaining owner |
|---|---|---|
| P0, live + source: validation certification | Open Validation: fixed backend reference values labelled VERIFIED; client-generated reconciliation time and static successful checks imply live validation. | Frontend removes invented checks/time, labels returned claims unverified, keeps catalogue/reference evidence. Backend must provide real scoped reconciliation in separately approved work. CSV contents deliberately unchanged; visible warning says the file retains unsupported endpoint claims. |
| P0, source + isolated failure: directory identity | Fail Firestore directory subscription: baseline fabricated a current active administrator with wildcard tenants. | Render unavailable directory/invite/audit state; never synthesize an account. Permission checks, writes and subscriptions unchanged. |
| P1, live + routed test: active speed | Active Speed lacked the class/style integration, controls were hidden, Why changed was a no-op; zero cohort had a minimum bar. | Active component uses numeric medianSec with supplied exact labels; zero remains zero, real links/disclosure replace unsupported actions. |
| P1, source + routed tests: scope and stale state | Navigate between scope policies; page analytical ledger before changing tenant/date; let an AI answer finish after scope changes. | Preserve allowed scope, reset local pagination/selection, hide obsolete AI/simulation results without altering requests. AI race and A–B–A scope tests pass. |
| P1, local browser: ledger identity and theme | Long synthetic lead/source values clip summary; analytical sticky ID crowds mobile; dark mode combines light fallback surfaces with light text. | Wrap identity/source, bound sticky column, full-width mobile coverage, canonical ledger theme tokens and contained table scrolling. Mobile bottom navigation now uses compiled layout utilities and canonical theme tokens; its old layout classes were in an unimported stylesheet. |
| P1, source + dialog/browser test: invented timeline | Recorded sale/RPC flag without event timestamp inherited another event timestamp; absent total calls rendered undefined. | Use only each event timestamp, explicit missing timestamp/count and snapshot limitations, readable long-ID heading, focus return. |
| P1, source + failed-request tests | Failed/absent requests could look like empty ledger/vendor backlog, released evidence or zero consumer outcomes. | Explicit unavailable/error states and missing-vs-zero presentation; no fabricated fallback totals. |
| P1, source + chart/component tests | Null became zero, negative exact bars vanished, unsupported average rates/median of medians and unrelated Why changed targets suggested unsupported conclusions. | Preserve supplied field labels, signed geometry, gaps, missing-last sort; remove unsupported summary aggregations/actions without changing metric contracts or exports. |
| P1, source + routed test: legacy Lead Engine | Reachable route displayed static population/revenue/connection claims; module backend router is not mounted in reviewed source. | Persistent legacy boundary, source-ledger links, no static portfolio cards, scenario/reference labels and missing evidence. Legacy module operation remains blocked, backend owner. |
| P1, authenticated Google backend | `/temporal` reports unqualified `operational_leads`. | Backend/SQL owner; unchanged under frontend-only scope. |
| P1, authenticated Google evidence prerequisites | CLI source lacks outbound caller ID; commercial inputs unavailable; no immutable published reporting release for selected tenant. | Data/source/release owners; do not invent metrics or change approvals. |
| P2, component + browser | Invalid menu semantics, unlabelled search, inaccessible local choices. | Native buttons/links with pressed/group state, labels and keyboard Escape/focus behavior. |
| P2, Google shell | Vite websocket fails to connect; editor sync label supplies no commit hash. | Hosting/editor owner; separately establish exact preview revision. Page access itself succeeded. |

## Verification and reproducibility

Use the existing lockfile and Node >=22/npm 10.9.8. Local runtime was Node 24.15.0 and npm 10.9.8; CI pins Node 22.

```sh
npm ci --ignore-scripts --no-audit
npm run verify
node scripts/smoke-production.mjs
npm run test:google-runtime
npm run test:rules
npm audit --audit-level=high
node --import tsx --test tests/frontend-acceptance.test.ts
git diff --check
```

`verify` is the existing lint → test → surface inventory → build chain. The ordinary suite has 760 tests: 759 pass, one Firestore integration skip, zero failures; the separate emulator suite exercises that lifecycle (10 pass, zero skipped). The new acceptance suite has 21 passing tests. Compiled production HTTP smoke covers four entrypoints; Google launch harness covers five modes. Audit threshold passes with six existing moderate findings and no high findings; dependencies are unchanged. Final delivery records the exact tested commit and required CI result.

The isolated fixture bundles actual AppShell/AppRouter/AuthGate/pages with test-only identity, Firestore and fetch doubles. Every fetch terminates inside the harness. No production QA/auth bypass, provider change or new dependency. Build it with `node scripts/build-frontend-acceptance-fixture.mjs /private/tmp/cx3-frontend-acceptance-after` after `npm run build`; serve that directory with an SPA fallback. Test outputs and screenshots remain outside source.

Interaction coverage: source/analytical switching, server-search request parameters and returned rows, scope reset, timeline Escape/focus, denied identity/no data requests, missing outcomes, failed requests, aliases, access tabs/errors, validation reference panels, consumer missing values, exact export column order/precision, local agent selection without another request, More views Escape, AI asynchronous scope race, signed exact bars and legacy boundary. Speed initial analytical request count remains one. No source/API/hook/query-key/cache/polling or export implementation changes. TypeScript AST comparison confirmed 17 existing export/access-mutation handler bodies unchanged. Isolated request counts do not establish live network parity.

Local browser: source and analytical ledger at 320, 390, 768, 1024, 1440, 1920 px; intentional table scroll remains internal. Synthetic long IDs/sources, duplicate-key and missing-vendor evidence retained. Mobile timeline and navigation drawer, More views Escape/focus, dark mode and active Speed/Validation inspected. No live customer timelines/exports or account mutations were used. Text-only zoom and OS reduced-motion emulation were not exercised; existing reduced-motion CSS remains in place and scoped transition overrides respect it. No measured performance bottleneck justified request/render optimization.

## Google state at baseline

- Editor: user-confirmed project `f7d614b6-fdee-45a2-9c50-a68da0d98dc9`, connected to `warrens-alt/cx3` → main. Settings reported in sync, last synced 30 September 06:57, but did not expose a commit SHA.
- Preview: origin obtained from that project interface, `https://ais-dev-a44llv2c2p6lo6yowjplmu-715272883694.europe-west2.run.app`. Existing account sign-in succeeded without changing credentials, IAM, user access or source approvals.
- Runtime: all requested paths opened for the bounded scope, with limits stated in the table. The reviewed source SHA was not proven by those observations. Raw current responses were not collected; current metric totals were not independently reconciled.
- Published: editor reported existing `https://conversionxt.ai.studio` publication. No publish action or production certification performed.
- Post-merge safe sync/result: see final handover; preserve any unpushed editor work and never force sync.

## Remaining work by impact

1. Establish the reviewed merged SHA in AI Studio and preview, then rerun authenticated controls and selected-response comparisons. Source merge alone does not finish live acceptance.
2. Separately approve/backend-own real validation reconciliation and its exported claims, temporal SQL qualification, missing CLI/financial evidence and release availability.
3. Review the existing access-policy editor defaults and wildcard editing fallback in a separately scoped security review; this change labels unloaded policy defaults and preserves permission logic.
4. The legacy Lead Engine remains a clearly labelled, unverified reference; mounting or repairing its APIs requires separate scope.
5. Broader secondary-page dark/zoom/motion and remaining generic Why changed mappings were not comprehensively certified. Narrow follow-up should reproduce a specific issue before changing it. Existing moderate dependency findings require separate dependency approval.

Evidence directory (local, transient): `/private/tmp/cx3-frontend-acceptance-evidence`. All screenshots use synthetic records and a visible synthetic banner. Browser baseline notes retain only headings, route URLs, table counts and explicit errors; no raw customer rows, cookies or credentials.
