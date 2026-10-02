# Investigation workspace verification — 2 October 2026

For the subsequent consolidation, active workspace stages, current-view refresh,
access-change selection clearing and new responsive evidence, see
[the consolidation QA record](../consolidation/README.md). Counts below describe the
original Investigation rebuild before that follow-up.

The implementation was built on `main` at `5bf8637` in `codex/investigation-workspace`. It connects Signal → Diagnose → Segment → Records → Evidence → Conclusion while retaining existing reporting contracts, source controls and administrator restrictions.

## Browser verification

The actual routed React application was exercised in Chromium using the repository's isolated `buildAcceptanceFixture` harness. Fixtures are explicitly synthetic, have a visible QA banner, and are never imported by the production application. The Browser plugin was unavailable, so the existing local Playwright/Chromium runtime was used. No customer warehouse or live model calls were made by this browser run.

**17 checks passed**, with no page errors or console warnings. See [machine-readable results](results.json).

- Inbox → exception → vendor → records preserves reporting scope and additive narrowing.
- Selected lead stays out of the URL; dossier tabs, pinning and close-focus return work.
- Desktop 1440px, tablet 820px and mobile 390px pass in light and dark themes without document or main-content overflow.
- Source evidence is embedded for administrators; non-administrators make no record/timeline/source requests.
- Empty populations, `NOT_VERIFIED`, failed requests, and a paginated 101-record fixture retain distinct states.
- Workspace changes reset selection and pagination; browser back/forward restores analytical context.
- Active investigations do not issue unused overview or operating-control requests.
- AI without an exact echoed scope is withheld; an exact scope response renders its references and limitations, then disappears when the scope changes.
- Evidence CSV retains scope, the lead's inclusion reason, validation, analyst conclusion and open questions.

The saved screenshots were visually reviewed:

| View | Screenshot |
| --- | --- |
| Inbox, context and comparison, light desktop | [1440px inbox](inbox-light-1440.png) |
| Records beside the persistent dossier, dark desktop | [1440px records and dossier](records-dark-1440.png) |
| Responsive records/dossier layout, light tablet | [820px layout](records-light-820.png) |
| Reused journey in the stacked dossier, dark mobile | [390px journey](journey-dark-390.png) |
| Pinned observations, conclusion and unknowns | [Evidence tray](evidence-tray-light.png) |

## Repository verification

`npm run verify` passed after the final code changes. Its constituent `npm run lint`, `npm test`, `npm run docs:surfaces:check` and `npm run build` all passed. The full suite reports **898 tests: 897 passed, 0 failed, 1 skipped**. The skipped test is the existing Firestore access lifecycle integration test, which requires its emulator environment. Production client/server and warehouse-export build artifacts were generated successfully. `git diff --check` also passed.

## Regression coverage

New suites cover investigation workspace state, driver semantics, URL validation, backend population qualification, AI grounding and export scope. Existing HTTP, security, frontend acceptance, Ledger presentation/export, navigation, metric workflow and UI contracts were updated to assert the new supported behavior. Tests include actual provider/query request suppression for ambiguous scope, stale selection and response isolation, shared predicate-derived reasons, exact timeline membership, source-vendor normalization, all 63 source fields, keyboard focus and local evidence boundary resets.

## Implementation inventory

| Area | Main files |
| --- | --- |
| Shared contracts and scope | `contracts/investigation.ts`, `src/features/investigation/investigationModel.ts`, `src/lib/FilterContext.tsx`, `src/lib/ClientContext.tsx` |
| Context and local conclusion | `InvestigationContextBar.tsx`, `EvidenceTray.tsx`, `EvidenceConfidence.tsx`, `InvestigationAI.tsx` under `src/features/investigation/` |
| Descriptive drivers | `DriverAnalysis.tsx`, `driverAnalysisModel.ts`, reused `src/components/RootCauseDrawer.tsx` |
| Record investigation | `InvestigationRecordList.tsx`, `LeadDossier.tsx`, `src/pages/LeadExplorerIntelligence.tsx` |
| Reused evidence | `src/features/leadLedger/LeadJourney.tsx`, extracted `LeadSourceEvidence.tsx`, `LeadLedgerWorkspace.tsx`, existing CSV utility |
| Entry and navigation | `src/pages/Exceptions.tsx`, `src/app/routeManifest.tsx`, `src/app/AppRouter.tsx`, sidebar/area/mobile navigation and scope-preserving redirects |
| Backend | Existing investigation `records`, `exceptions`, `exceptionPredicates`, `rootCause`, `timeline`, `aiInsights`; `server/api.ts`, `server/offernetScope.ts`, Gemini client |
| Documentation | Analytics map, frontend inventory, surface coverage, generated surface inventory and implementation status |

## Analytical and operational boundaries

The release preserves distinct-lead grain, matched capture-cohort windows, operational metric definitions, deterministic `LIMIT`/`OFFSET` ordering, source provenance and unavailable/`NOT_VERIFIED` semantics. Segment narrowing intersects existing predicates and filters. A descriptive decomposition is not a causal explanation, and a prior capture-cohort backlog is not a historical queue snapshot.

Exception vendor/source breakdowns describe current concentration; prior segment counts and exception grade/age breakdowns are unavailable. Driver comparison requires explicit dates and does not support record-text search. Aggregate call evidence cannot establish individual attempts. Source-health checks disclose their broader observation boundary and cannot certify the exact cohort. The AI aggregate evidence excludes warehouse record rows/identifiers, while explicitly supplied user search/question text remains part of the requested context; the metric context does not imply that a metric value or comparison was supplied.

Evidence pins and conclusion notes are local to a workspace/role/session. `savedAnalysis` was inspected but intentionally not expanded to store record data. Keyset pagination, persisted/collaborative investigations, unbounded exports, new source contracts and production source certification remain separate future work. This QA does not deploy the application or validate live warehouse reconciliation.
