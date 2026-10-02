# CX3 product rebuild — 2 October 2026

Starting SHA: `9c7f0ecda7b4142ffd9bbcfdd6dfd6d690965e62` (`main`, fetched and fast-forward checked against `origin/main`).
Final implementation SHA: recorded after implementation and verification below.

## Audit and scope

The audit read README, maturity pass, frontend retirement/design architecture,
implementation status, accuracy history, Audit Evidence, Lead Evidence consolidation,
naming and relevant QA records. It enumerated source, contracts, server modules,
tests, scripts and current route consumers. Parallel reviews traced Command/Journey/
Operations contracts, Investigation/Lead Evidence state, and Commercial/Evidence.

This is a frontend architecture rebuild. No warehouse SQL, source/tenant mapping,
authentication, authorization, metric denominator, qualification, timestamp or
read-only query safeguard is intentionally changed. Operational analytics remain
unverified; arithmetic agreement, execution replay, source reconciliation and
business approval remain independent evidence states.

Important findings constrain the presentation:

- Command has six supplied lifecycle counts. Qualification is null and routing has
  no population contract. Both stay unavailable.
- Matched prior aggregate comparisons exist; a matched daily historical series is
  not returned. No shifted or fabricated previous-period line is drawn.
- Journey transition intersections differ from independently recorded outcome
  populations. Activation/sale ratio is not ordered conversion.
- Aggregate call counters cannot establish per-attempt history. Unrecorded counts
  remain separate from explicit zero calls.
- Commercial platform media, matched attribution outcomes and intake-cohort revenue
  have distinct grains. Billing, collections, commission, telephony and costs remain
  unavailable unless their respective evidence contracts supply them.
- Source observations are tenant-wide. Immutable releases have strict query scope;
  workspace lens selection uses path segments, not invented analytical parameters.
- Lead Evidence retains separate Population/Source APIs and cache identities. Raw
  records remain administrator-only; private lead selections stay session-local.

## Workspace architecture

| Workspace | Canonical entry | Integrated capabilities |
| --- | --- | --- |
| Command | `/command` | Lifecycle, current daily observations, matched movements, attention, concentration |
| Journey | `/journey` | Progression, acquisition, qualification, routing, process, vendors, cohorts, outcomes |
| Operations | `/operations` | Contact effort, response speed, dispositions, temporal, CLI, agents |
| Investigate | `/investigate` | Signals, diagnosis, narrowing, Lead Evidence, dossier, case file, notes, export |
| Commercial | `/commercial` | Evidence bridge, media/attribution, frozen reconciliation |
| Evidence | `/evidence` | Sources, metric registry, reconciliation states, releases/replay, warehouse |

Settings, access control and validation are separate administrative destinations.
The sidebar remains collapsible and keyboard accessible. The mobile navigation
contains Command, Journey, Operations, Investigate and More (Commercial/Evidence/
Settings). The original ConversionX logo and semantic lifecycle tokens remain.

## Compatibility and composition

Every original mounted URL remains usable. `/overview` opens Command; `/funnel`,
`/campaigns`, `/vetting`, `/routing`, `/offershop-flow`, `/vendor-quality`, `/cohorts`
and `/sales-activation` adapt to Journey lenses. Contact/speed/disposition/temporal/
CLI/agent URLs adapt to Operations. `/data-integrity`, `/reports`, `/vendors` and
`/warehouse` adapt to Evidence. `/reconciliation` adapts to Commercial. Canonical
lens URLs use named path segments. `/lead-explorer` remains canonical Lead Evidence;
`/lead-ledger` continues its Source-mode compatibility redirect.

The route manifest owns both primary workspace navigation and compatibility
identities. Existing scope policies still reject private/unsupported state and
preserve repeated scope keys for validation. Active filter chips are visible even
when their editor is closed. Existing ChartFrame, EvidenceBars, InspectorHost and
scope/layout primitives remain shared owners rather than duplicated chart systems.

## Implementation checkpoints

1. Foundation: six-workspace manifest, canonical paths, compatibility adapters,
   light/dark navigation identity, accessible mobile/sidebar, persistent scope chips.
   `npm ci`: passed, 525 audited packages, zero vulnerabilities. Focused navigation,
   colour/accessibility and scope suite: 26 passed. Subsequent phases extend these
   routes through lazy workspace composition.

## Verification and delivery boundary

Final test counts, browser evidence, implementation commits and remaining
limitations will be recorded after the complete verification pass. No production
publish, live source reconciliation, IAM/storage provisioning or financial
certification is implied by this rebuild.
