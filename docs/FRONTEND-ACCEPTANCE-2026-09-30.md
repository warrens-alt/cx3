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

## Acceptance follow-up on main 82ef46f

The repeated acceptance brief was checked against freshly fetched main `82ef46f04a7e8dea6aec953c4d7a1997b6affd89` (merged PR #36). Prior local work and generated artifacts were preserved. The follow-up branch is `codex/frontend-acceptance-followup`; its exact submitted/merged SHA and CI results are supplied by its PR and external delivery record. This section supersedes the earlier remaining-work entries only where the following evidence closes them.

### Reproduced repairs

| Severity / evidence | Problem and reproduction | Frontend repair |
|---|---|---|
| P1, source + routed component | Agent/consumer/CLI/diagram/reconciliation/routing/vetting/investigation cards opened generic lead-rate decompositions under labels for different populations or measures. Campaign reach/outbound measures and vendor collection/episode counts also used unrelated proxies. | Remove unsupported explanation actions and their dead drawer state; retain supported Inspect/Analyse paths and existing direct marketing explanations. No replacement metric or API request is introduced. |
| P1, synthetic browser | At 390 px the root-cause contribution and Records cells had `display:none`. | Preserve every evidence column in a labelled keyboard-focusable horizontal region; wrap segment labels and use readable 12 px row text. |
| P1, synthetic browser | In dark theme the drawer's title and current/previous values were near-white on hard-coded white surfaces. | Use existing surface, text, border and semantic tokens inside the drawer's existing rules. No global theme override. |
| P1, routed component | Open Explorer page two's timeline, change Sep 28 to Sep 27–28, then return to Sep 28: old local page/selection revived. | Clear persisted local pagination/selection on scope changes while retaining the immediate scope guards. Assertions also require all new-scope requests to start at offset zero and forbid a stale timeline request. |
| P2, authenticated preview + routed component | Open More views on Response speed, then activate Contact effort with Enter: navigation completed but disclosure remained open. | Close disclosure on pathname changes, including keyboard primary links and router history. |
| P1, synthetic fixture + source | An old OBSERVED source timestamp was counted as a healthy source. | Keep OBSERVED neutral and explain that observation alone does not establish freshness or health. |
| P2, synthetic fixture | Configured catalogue without a release was described as unconfigured; briefing loading asserted Gemini before provenance returned. | Show the returned catalogue reason and neutral briefing loading text. Export definitions remain unchanged, including their pre-existing provenance limitations. |

### Additional repeatable coverage and boundaries

The frontend acceptance suite now has **30 tests**, all passing; nine were added. Source-ledger paging uses 26 synthetic leads and checks the full filtered population on both pages: 26 leads, 27 source rows, 25 lead-only rows, two rows with repeated keys. Submitted search resets to page one. The partial-field fixture supplies identical coverage to the coverage endpoint and report metadata; complete export remains disabled and the existing partial export remains available. Its omitted nonidentity field is genuinely null. Search fixtures match the source ledger's supported lead ID, consumer ID and source fields. No production export code changed.

The final ordinary suite has **769 tests: 768 passed, zero failed, one skipped**. The Firestore lifecycle is separately exercised by **10 passing emulator tests** with Java 21. `npm run verify` passes its lint/test/surface-check/build chain. `node scripts/smoke-production.mjs` passes four compiled entrypoints; `npm run test:google-runtime` passes five local launch modes. `npm audit --audit-level=high` passes with six existing moderate findings. Final PR CI must independently pass on the exact submitted SHA; none of these local harnesses certifies a Google-hosted deployment.

Independent TypeScript AST review against the base found 62 export/download function bodies, 29 export call expressions, 16 ExportAnalysisButton nodes, 16 selected administration/diagnostic handlers and 24 matched fetch/query/auth call expressions unchanged. Nine central export/admin files remain byte-identical. No server/contracts/lib/hooks/auth/dependency/lockfile/configuration/production build or workflow files changed; `CX_OPERATIONAL_RICH_VIEW_APPROVED` is preserved. The fixture-only builder now supports native browser history and direct nested URLs; all identity/data doubles remain confined to tests.

Synthetic browser checks use an already installed Playwright/Chromium 151.0.7922.34 against the isolated fixture, with no dependency installation. Root-cause evidence at **320, 390, 768, 1024, 1440 and 1920 px** has no page-wide overflow, and keyboard focus scrolls the Records link into view. The labelled evidence region is 620 px wide internally on mobile. Reduced-motion emulation returns `matches:true`, document scroll behavior `auto`, and no active animation or transition longer than 0.01 seconds on the tested Speed route. Native back/forward, keyboard tab navigation and deep-link reload retain the selected scope. Doubling computed text sizes at 1440 px keeps the document at 1440 px; this is a **text-resize simulation, not native browser zoom certification**. Existing navigation truncation remains discoverable through its labels/tooltips. No uncaught browser page errors were observed in that synthetic run.

### Google and remaining acceptance

The user-confirmed editor was independently opened again, and its preview interface again supplied the same `ais-dev-a44llv2c2p6lo6yowjplmu-715272883694.europe-west2.run.app` origin. Authenticated Response speed → Contact effort keyboard navigation and native Back/Forward were exercised for `default_tenant`, Sep 28. A menu defect was reproduced there before the follow-up. These observations do not establish the exact runtime commit.

The editor GitHub panel reports `warrens-alt/cx3` → `main` and initially in sync at Sep 30 08:41 local. Safe post-merge pull and its actual result are recorded in the external delivery handover. No production Publish action is authorised or performed. The editor exposes no runtime SHA; the UI source archive download did not complete, and the native developer-tools attempt timed out before current-response inspection was available. Browser restrictions were respected. Exact runtime provenance and displayed-value/current-response comparisons therefore remain unverified; earlier assistant history in the editor is not treated as fresh evidence.

Remaining owners: hosting/editor owner for existing revision attestation and supported response inspection; backend/data owners for temporal SQL qualification, missing CLI/spend/release evidence and real reconciliation/export claims; separately scoped security/dependency owners for pre-existing concerns. No additional broad redesign is proposed. Local evidence lives under `frontend-acceptance-evidence-2026-09-30/followup` outside the application checkout; screenshots contain only synthetic records or editor sync metadata.

CI follow-up: the first submitted head was terminated twice with exit 143 after the same preceding test, without an assertion report. A local reproduction then established a test-fixture focus race: Escape could precede initial dialog focus, while unshimmed JSDOM always returned empty layout boxes and prevented focus restoration once focus had entered the dialog. The harness now models rendered box presence, waits for initial dialog focus, and compares DOM identities as booleans to keep failure diagnostics bounded. The production accessibility hook is unchanged. Node 22 verification and the updated final-head CI result are recorded in the delivery handover; exit 143 alone is not proof of its termination mechanism.

## Lead Ledger quick-navigation acceptance

Additional synthetic browser testing on merged main `6f4f27a520e89eadd7d02fbc88c62484e33d9f6d` reproduced a P2 discoverability defect: the admin command palette returned no matches for “Lead Ledger”, although the route and its search aliases existed. The frontend catalogue omitted `/lead-ledger`. Including that existing route makes the title and alias searchable while preserving the manifest's admin-only visibility and the existing navigation scope policy.

The navigation-model regression failed before the repair. It now checks both title/alias discovery for admins and exclusion for non-admins. A routed interaction test searches the actual command palette, activates Lead Ledger with Enter, checks that the dialog closes, retains client/dates/repeated workspace values, and removes stale search/drill context. The combined focused run passes all 35 tests (31 routed acceptance tests and four navigation-model tests).

Additional browser evidence covers desktop/mobile date drafts, Apply/Cancel, clear dimensions versus reset, analytical pagination/page size/search clear, Records-link activation with preserved request scope, and native alias replacement/history. These fixtures establish interaction and query wiring; they do not model live vendor/date/drill population totals. Source CSV success/cancellation and native browser zoom remain separate unverified checks. Runtime source attribution and current-response comparisons also remain open; the user confirmed that no existing source-commit record is available. Exact final CI, browser results, screenshots and Google/editor state are kept in the external `frontend-acceptance-evidence-2026-09-30/remaining-acceptance` handover.
