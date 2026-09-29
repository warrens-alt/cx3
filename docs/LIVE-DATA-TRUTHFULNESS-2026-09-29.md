# Live-data truthfulness and metric consistency — 29 September 2026

Baseline: `eaecd8916a08597d1ae0b28f7c730ce778e07aa1`. This is a corrective implementation, not certification of production warehouse data.

## Implemented boundaries

- The Warehouse overview is a **saved schema catalogue**, not a live business-performance report. Registered object/schema counts remain available; unmeasured business rows, volumes, retention, spend and telemetry are null. Project access is not inferred from registration. Fabricated waterfall/media/disposition values and recent-looking generated records have been removed.
- Generic raw inspection requires a server-authenticated master administrator with explicit `default_tenant` entitlement. A vendor administrator cannot select a master table or use a body parameter to elevate authority. Existing vendor-scoped operational reports remain separate.
- Raw inspection uses an exact registered source, live schema checks, scalar non-sensitive projections, an explicit source date field and UTC window (seven calendar days by default; at most 366). A single read-only BigQuery job supplies the window count, latest event and a bounded, newest-first page. It does not issue `SELECT *` or fall back to sample rows. Identifiers are strings; a missing count, malformed page or query failure is not a successful export. Identical rows are retained, and separate pages remain separate query snapshots.
- Attached Google identities are attempted through the regular SDK path; the presence of a JSON-key environment variable is not required to attempt an authorised read. No new credentials, IAM grants or source mappings are supplied by this change.
- Failed reads report errors; a measured empty window reports zero. Query completion time and latest event time are separate from upstream ingestion freshness, which remains `NOT_VERIFIED` when not evidenced. Reads are explicit, without a new automatic polling loop.
- Copying generic warehouse rows to Cloud SQL is rejected. The legacy synced-record endpoint is quarantined (HTTP 410 for authorised administrators) because previous copies may contain generated evidence. Stored records are **not deleted or altered**. Review them separately before reuse.

## Metric policy

`contracts/validation.ts` defines OfferShop validity independently of outcome counters: `1` is valid, `2` is invalid, native/string true and false retain their boolean meanings, and `0`/missing/unrecognised validity codes remain unknown. Operational, process, integrity, vetting and lead-value consumers use this interpretation; `valid_lead` and call/sale outcome flags retain their separate domains.

Operational revenue policy **2026-09-29.1** uses BigQuery NUMERIC amounts at lead + vendor + transaction grain. Repeated identical amount/currency evidence collapses once. Different financial values for the same key, missing identifiers/amounts/currencies or a currency incompatible with the configured reporting currency withhold that lead's complete total. A known subtotal and affected-key counts are separate evidence, not a complete financial value. Zero is not substituted for missing money.

Overview, Contact Strategy, vendor, sales/activation, lifecycle and approved marketing attribution use this shared operational policy instead of mixing SUM and MAX lead amounts. Parent-lead totals are not summed across vendor rows. This is **recorded financial evidence**, not confirmation of invoices, receipts, contractual rates or causal attribution.

The source-compatible 63-column LeadLedger/export remains unchanged and preserves source multiplicity. Legacy enriched semantic endpoints are still a separate reporting model: this patch does not certify their call/activation joins or claim equality with the raw export. Source conflicts, identity ownership and financial completeness still require live reconciliation. Existing cumulative call counters are not reconstructed call events.

The OfferShop process query no longer double-quotes an already quoted source relation. Valid, invalid and unknown populations are separate, and placeholder dates are excluded from observed process events. Repeated source-snapshot conflicts still need reconciliation. The simulator no longer invents a 4,200-lead baseline or output multipliers: results remain unavailable until a reconciled baseline and approved model exist.

## Rubix/BLC

The Power BI adapter is opt-in (`RUBIX_POWERBI_ENABLED=true`) and requires its separately configured resource key. The deprecated offline-evidence setting cannot enable fallback records. An upstream error returns unavailable values, not fabricated outcomes. Malformed or incomplete upstream counts fail closed. Key presence indicates configuration, not a successful service read.

The hard-coded banking/mandate comparison is removed. Warehouse reconciliation counts remain unknown until a supported warehouse comparison is implemented; no 91-versus-85 narrative or invented explanation is returned. Live source totals, when actually obtained, retain their report-grain and privacy/completeness constraints.

## Frontend and deployment checks

The Warehouse surface distinguishes catalogue, bounded live preview, empty, denied and failed states. Previous rows/exports are hidden while refreshing, after failure, and when identity or workspace changes. Page CSVs identify the query, source, scope and page limitation; they are not full-source exports. Synthetic UI fixtures are not shipped as production data.

`npm run deployment:check -- https://your-exact-app-host` performs unauthenticated, read-only JSON fetch checks of `/api/health` and `/api/analytics/clients`. The former must return ConversionX liveness; the latter must reject anonymous analytical access. It requests no customer records and does not verify BigQuery. JSON request handlers reject an HTML SPA response with an actionable routing error.

**Browser navigation alone is not an API test.** Cloudflare SPA asset handling can deliberately return the app shell for a navigation request while a JavaScript/API fetch reaches the Worker. Use the fetch-based check on the exact deployed origin. This patch does not configure a Cloudflare route or prove that the previously inspected Pages hostname lacks a backend.

## Verification and remaining work

Regression coverage includes explicit source authorization, bounded query generation, current-page ordering, attached-identity attempts through a fake SDK, exact large identifiers, missing/empty/error distinctions, no fallback writes, validation codes, shared financial-policy SQL, deployment response handling, live Rubix decoding and failure handling. Process/network tests use explicit isolated mocks, not incidental ADC failures. Tests inspect and exercise generated queries but do **not** execute them against production BigQuery.

Chromium component QA used the actual Warehouse components, React Query, request/session helpers and isolated synthetic contexts/network responses at 1440×1000 and 390×844. Seventeen checks passed, including scope changes during requests, stale-result suppression, empty/failure/HTML states, page CSV export, exact identifiers, mobile overflow and console health. The Browser plugin was absent; installed Chromium was driven by Playwright in an offline test document. This is not full-app authentication, the Rubix frontend, a deployed Cloudflare test or customer-data reconciliation.

Run the repository verification and production HTTP smoke checks, then the existing CI/Cloudflare validations before merge. Final CI state is recorded in the pull request, not inferred from these notes. Production settings, deployment, upstream ingestion, live query execution and source/API/chart reconciliation remain outstanding external checks. No production secrets, customer data or raw mismatch records belong in this repository.
