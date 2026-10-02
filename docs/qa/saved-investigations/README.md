# Saved investigation verification — 2 October 2026

The saved-definition phase follows the investigation workspace merged in PR #48 (`2eeba94`). It adds named personal definitions with exact scope, revision-controlled updates and explicitly configured private storage. It does not persist analytical results or local evidence-tray content.

## Browser verification

Thirteen Chromium checks passed with no page errors or console warnings, using the actual routed React application and clearly marked synthetic QA fixtures. The existing Playwright runtime was used because the Browser plugin was unavailable. No customer warehouse, model or cloud storage service was contacted.

Coverage includes lazy loading; exact creation; fresh-scope opening; rename with original scope/revision; workspace isolation; deletion with the latest revision; unavailable/unconfigured/empty distinctions; private-search rejection; and no document/main overflow at 1440px, 820px and 390px in both themes. The generated desktop and mobile screenshots were visually inspected.

- [Browser results](results.json)
- [Light desktop](saved-light-1440.png)
- [Dark mobile](saved-dark-390.png)

## Regression scope

`npm run verify` passed: TypeScript, 946 tests (945 passed, zero failures and one existing Firestore-emulator skip), generated surface inventory and production build. After adding one final stored-ID corruption regression, the repository suite also passed all nine tests. Production smoke checks passed for all four compiled server entry points, covering startup, assets, SPA routing, authentication and private-file boundaries.

The contract and client suites cover strict nested schema, privacy, current-observation-only release semantics, filters/aliases, complete predicate/narrowing round trips, open date bounds, fresh URLs, request/response scope and revision matching, invalid envelopes and late session responses.

The UI suite covers lazy load, exact save/open, rename/delete, unsupported scope, unavailable/error/empty states, workspace/account switches, pending mutation suppression and conflict recovery. Repository/provider/HTTP suites cover explicit tenant and owner checks before I/O, stored-data revalidation, bounded collections, stale revisions, concurrent conditional writes, persistence across repository instances, GCS privacy/generation checks and R2 configuration/ETag checks.

## Activation boundary

The code includes Node/GCS and Worker/R2 adapters. Durable saves remain unavailable until the intended deployment explicitly configures an approved private backend. This run does not provision storage, configure credentials, deploy an application, or certify a live bucket. The existing investigation workflow remains usable without saved storage. See [configuration and operation](../../SAVED-INVESTIGATIONS.md).
