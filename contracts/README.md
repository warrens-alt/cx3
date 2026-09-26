# Measurement contracts

`reporting.ts` is the versioned definition of every metric supported by the new reporting path. It is shared by the API and UI. The warehouse contract is in `warehouse/includes/schema.js`.

Dates in v2 are explicitly UTC. Local-time reporting must be added as a separately tested, versioned mode; the UI must not claim UTC dates are Johannesburg local dates. An observation cutoff filters event timestamps; the release cutoff fixes what the system knew. To reproduce an earlier knowledge state, reopen its earlier immutable release, not today's release with an earlier event filter.

Each lead submission, delivery episode, call attempt, sale, activation and commercial delta has its own identity. Source adapters must provide resolved parent keys and must be signed off by source owners. Summaries are not event records. Repeated versions of an entity are revisions, not additional events. Immutable commercial events represent signed deltas to a single stage; changes and reversals require another event, never rewriting a payment.

A PUBLISHED release means its structural checks ran against pinned warehouse facts and its source contracts were approved. Source coverage may still be PARTIAL. A ratio with incomplete evidence is withheld. An exact recorded count can be shown as partial, never as a measured zero for an unavailable feed. Each report has both calculation and completeness status.

Rate cards, media allocation, call operating calendars, RPC disposition mappings and vendor-specific acceptance rules require approved contracts before their metrics are added. No inherited numerical defaults or fuzzy vendor mappings are authoritative contracts.
