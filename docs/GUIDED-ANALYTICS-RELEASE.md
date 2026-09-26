# Guided analytics and API efficiency

## User workflow

The six primary destinations are Overview, Lead journey, Contact centre, Sales & activation, Commercial and Investigate. Existing URLs, charts and evidence pages remain available. Each navigation area has an explicit disclosure button, so users can inspect its pages without first navigating into the area. Existing mobile shortcuts remain direct links to frequently used analyses; More exposes the complete journey.

Start a review opens a lazy-loaded management workspace from navigation or a shared operational page header. It reuses the current client, dates and all filters, and requires an explicit valid date pair before requesting a review. Last complete week deliberately updates the existing date scope, using the workspace timezone. The review uses the same Overview API and React Query resource key rather than querying every tab.

The review presents recorded counts and explicit denominators, API-provided comparison dates, browser receipt time (not a warehouse cutoff), first-dial backlog, and links for five business questions. Copy review summary is user-initiated and includes filters, definitions and evidence limitations; it is not an automatically scheduled or certified report. No raw lead data or new persistent review storage is introduced.

How to read this view explains source population, date basis and follow-up limitations. Marketing rows, lead cohorts, call events, routes and contracts remain distinct. Metadata and financial definitions are not silently changed.

## API work

- Identical concurrent analytical GETs with the same full identity headers and request scope share network work. Each consumer receives a separate readable response.
- Cancelling one consumer does not cancel others; the underlying browser request is cancelled when all consumers leave. Backend BigQuery-job cancellation is not claimed.
- No completed response is retained in the transport. React Query remains the browser freshness owner, with bounded inactive-query lifetime.
- HTML returned with HTTP 200, unsuccessful JSON payloads and HTTP errors produce typed failures. HTTP 401 remains visible to the existing workspace-authentication handler.
- Mutations, CSV exports and third-party traffic are not coalesced. Authentication credentials are attached only to same-origin API requests.
- Response-cache keys canonically order object properties while retaining principal, role, tenant grants, complete scope and query. No filter is dropped and array order is retained.
- Server LRU retention is bounded; expiration is inclusive; synchronous errors clean up; invalidation fences old in-flight work from restoring stale entries.
- Cache age/expiry headers expose response-cache retention without labelling it source freshness.
- Concurrent table-metadata/list requests are coalesced per configured tenant/source without retaining schema, row counts or freshness metadata.
- Navigation no longer runs a warehouse MAX(timestamp) health query. Source status is an explicit destination.

## Boundaries and next data dependencies

This release does not create or alter BigQuery tables, billing rules, metric numerators/denominators, IAP/Firebase policy or Cloudflare secrets. Actual spend still requires an approved observed-spend feed. Full post-sale stage analysis needs validated lead/consumer/contract identifiers and retained event history. Live dialler states and retry-policy adherence need their own source contracts. A cumulative counter is not proof of event-level retries. Matched calendar periods do not equalise outcome maturity.

Tests exercise request deduplication, cancellation isolation, typed response failures, cache invalidation/expiry, permission-separated keys, calendar windows, null/zero semantics, navigation visibility and reuse of existing resources. Passing repository CI is not live warehouse reconciliation or an authenticated production-browser test.
