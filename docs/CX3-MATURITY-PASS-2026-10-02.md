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

## Verification record

`npm ci` passed (524 packages). The initial sandboxed `npm test` could not create
the existing tsx IPC socket (`EPERM`); the unchanged command was rerun outside the
sandbox. Final command results, implementation commits, browser evidence and
remaining production dependencies will be recorded after implementation.

No live warehouse reconciliation, source-owner approval, cloud provisioning,
deployment, billing/collection or financial certification is established by this
baseline. Browser and service fixtures are synthetic evidence of code behavior.
