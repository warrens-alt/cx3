# Consolidation verification — 2 October 2026

The implementation starts from main `bc002ad2912b5aee02688b097323d9b64e9253d4`
(PR #49). This record covers code consolidation and deterministic local verification,
not live warehouse or commercial certification. See the [consumer audit](../../CONSOLIDATION-AUDIT.md).

## Environment and repeatable browser run

Local macOS arm64, Node 24.15.0, npm 11.12.1. The project requires Node >=22;
GitHub CI continues to select Node 22. The Browser plugin was unavailable, so the
existing local Playwright/Chromium runtime exercised the real routed application
through the repository's synthetic `buildAcceptanceFixture` harness. Every analytical
request is intercepted, and the page carries a visible synthetic QA banner.

```sh
npm ci
npm run verify
# Supply an existing Playwright package path/browser if they are not on the local defaults.
CX_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CX_CHROMIUM_EXECUTABLE=/absolute/path/to/chromium \
CX_BROWSER_QA_OUTPUT=/absolute/path/to/qa-output \
node scripts/check-investigation-browser.mjs
```

The browser runner builds a temporary fixture, starts an ephemeral loopback server,
launches Chromium with reduced motion, exercises the controls and downloads, then
closes its browser and server. Its default output is a temporary directory; screenshots
and machine-readable results are not production build assets.

**17 browser scenarios passed**, with **0 page errors and 0 console warnings**:

1. Correct route/title, meaningful UI, no framework overlay and six accessible stages.
2. One queue request, with no unused overview or operating-control request for active investigations.
3. Inbox → descriptive vendor breakdown → narrowed records, followed by browser back/forward.
4. Session-only dossier identity, dossier tabs and keyboard focus return on close.
5. Scoped evidence pin, independent analyst conclusion/unknowns and downloaded evidence CSV.
6. Header/record layout at **1440, 820 and 390px**, in **light and dark** themes, without document/main overflow.
7. Exact record search and clearing dependent population narrowing while retaining reporting scope.
8. Administrator downgrade/regrant clears private selection/pins and suppresses record requests.
9. Workspace change clears selected record and local evidence.
10. Empty records, failed records and unavailable evidence remain distinct.
11. Non-certified historical validation presentation and downloaded reference CSV.
12. Retired `/lead-engine` renders not found with no legacy analytical requests.
13. Unconfigured saved storage renders a neutral deployment state.
14. Saved definition create/reopen/rename/conflict/reload/delete preserves exact definition scope.
15. Current-view refresh updates the active driver once on both pages; unused overview remains idle.
16. Chart catalogue controls cannot manufacture analytical values or request a reporting population.
17. No browser runtime errors or console warnings.

Screenshots were visually inspected at desktop and mobile widths, including dark
mode. The six workflow screenshots and `results.json` are retained in the task's
`consolidation-evidence-2026-10-02` output directory. Their numbers are synthetic
fixtures and must not be used as business evidence.

## Repository and runtime checks

| Command | Final result |
| --- | --- |
| `npm ci` | Passed; 524 installed packages, 525 audited, 0 vulnerabilities. |
| `npm run lint` | Passed, including the final verify chain. |
| `npm test` | Final verify run: **989 tests, 988 passed, 0 failed, 1 skipped**. The skip is the emulator-only suite when its environment is absent. |
| `npm run docs:surfaces:check` | Passed; inventory was regenerated through `npm run docs:surfaces`. |
| `npm run build` | Passed; client, all server entry points, static mirrors and warehouse reference exports built. |
| `node scripts/smoke-production.mjs` | Passed for **4 compiled server entry points**. |
| `npm run test:google-runtime` | Passed for **5 launch modes**. |
| `JAVA_HOME=<existing Java 21 runtime> npm run test:rules` | **10 passed, 0 failed, 0 skipped**. |
| `npm audit --audit-level=high` | Passed; **0 vulnerabilities**. |
| `npm run verify` | Passed its full types → tests → inventory → build chain. |
| `WRANGLER_SEND_METRICS=false npx --yes wrangler@4.142.0 deploy --dry-run --config wrangler.cloudflare.example.jsonc` | Passed, with no deployment. |
| `WRANGLER_SEND_METRICS=false node scripts/check-cloudflare-local.mjs` | Passed local boot/assets/authentication/invalid-token checks; no live storage accessed. |
| `node scripts/check-investigation-browser.mjs` with the documented runtime variables | **17 scenarios passed**, 0 page errors, 0 console warnings. |
| `git diff --check` | Passed. |

The full-suite count includes the new tests; targeted runs are subsets and should
not be added to it. The first broad suite before final refresh/catalogue guards was
980 passing tests. The final 988-passing run covers all source changes. Intermediate
browser-harness title/button/fixture-state assertions and one security-test message
assertion were corrected to match the application, then rerun successfully.

CI files, package dependencies/lockfile and Firestore rules are unchanged. No CI job
was added that needs warehouse credentials. A preliminary build inside the filesystem
sandbox could not run the optional TSX warehouse-export child process; the complete
build was rerun with local subprocess permissions and compiled all export artifacts.
The export is compiled schema/reference documentation, not a query of live warehouse data.

The first Firestore run could not find a system Java installation. The completed
run uses the existing temporary Java 21 runtime through `JAVA_HOME`; no system Java
installation or deployed Firestore configuration was changed.

## Coverage and interpretation

Repository tests exercise actual registered HTTP routes and synthetic identity
resolution for unauthenticated, viewer, analyst, administrator, spoofed UID/email,
workspace/session changes, suspended/pending/expired principals and same-origin
boundaries. The retired user APIs never reach user persistence. Record/timeline
administrator gates and conditional owner/tenant saved-storage writes remain covered.

UI tests cover scope/history, NULL versus observed zero, loading/error/empty states,
source unavailability, pin provenance, conclusion independence, saved unconfigured
and failed storage, stale revisions, role/session clearing, aborting obsolete driver
refreshes and refusing their late responses. Access-control tests verify controlled
mutations and subscription cleanup after authority removal.

## Remaining boundaries

- No live BigQuery query or independent source-owner reconciliation was performed.
- Emulator success does not establish which Firestore rules are deployed.
- No production GCS/R2 saved bucket, credentials, privacy policy or real save/reload was validated.
- Worker dry run and local boot do not prove production GCP/Cloudflare bindings, IAM, secrets or authentication configuration.
- No commercial certification, immutable report execution or evidence-release replay is claimed.
- Browser results are Chromium/synthetic fixture coverage, not live authentication or customer-data acceptance.
