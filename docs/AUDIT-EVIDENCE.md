# Visual Audit Evidence

Recorded 2 October 2026. Baseline and fetched `origin/main` are
`e335ad582cd62cce0b57ee92de2b666a97ea5a41`; no intervening commits existed.

The canonical panel answers where a returned number came from, its declared
fields/grain/date basis, supplied numerator and denominator, available coverage,
qualification gaps, independent comparison status and supporting-record access.

| Dimension | What establishes it | What it does not establish |
| --- | --- | --- |
| Observed | A value/observation was returned | Physical-source completeness or business approval |
| Mapped | A declared analytical source/field mapping exists | Source-owner approval or independent totals |
| Scoped | The supplied result context is shown | That a source-wide observation used the capture cohort |
| Reproduced for scope | Signed immutable result replay matches for the exact descriptor | Independent source reconciliation or business approval |
| Reconciled | Actual independent comparison for the labelled exact scope | Business approval or other scopes |
| Business verified | Explicit source/business approval | Other metrics, periods or sources |
| Partial / mismatch | Supplied incomplete evidence / measured disagreement | A combined confidence score |
| Not verified / unavailable | Independent validation absent / required evidence absent | Measured zero |

These states are independent. Source observation, correctly declared mapping and
structural tests can all exist while business meaning and production source
reconciliation remain **not verified**. Generic `NOT_VERIFIED` metadata cannot
become a green approval or a source reconciliation result.

`EvidenceTrace` renders only supplied nodes in order. Default traces use declared
contract source/fields, normalisation/qualification rules, metric and displayed
result. They omit unknown API endpoints. A contract source reference is labelled
as declared lineage and does not imply a physical source was independently read.

`MetricAnatomy` keeps zero, missing denominator and independent-population wording.
Financial completeness has no artificial denominator. `EvidenceCoverage` stacks
only explicitly disjoint complete category counts; missing counts or overlapping
populations remain separate. `EvidenceExclusions` displays supplied exact counts,
never calculates residuals from unrelated totals, and offers actions only for
supported authorized predicates. `ReconciliationView` preserves supplied kind and
state independently of exact signed observed-minus-expected differences.
Decimal strings keep their supplied precision. Finite numeric values retain their
supplied representation when locale formatting would round them, including tiny
nonzero values; unsafe integer numbers cannot establish an exact delta.

Data Confidence source observation rows retain tenant-wide semantics. Metric
mapping/dependency views use declared source contracts. Field availability from
Lead Ledger metadata is not field population completeness; a returned sample
cannot establish a population completeness percentage. Commercial required-input
availability is literal input evidence, never profit confidence.

No persisted reconciliation history is exposed by the inspected operational
contracts, so this change does not manufacture a trend. Existing real chronology
continues in `LeadJourney`; no render-time audit events are invented.

Audit Mode changes presentation only. Opening a panel adds no requests. An
administrator can explicitly preview up to five supporting records through the
existing `raw-leads` endpoint and drill semantics. Tenant, dates, complete filters
and Investigation narrowing are retained. Selected identifiers stay local and
private search/identifier filters cannot produce shareable links. Full records
retain existing administrative authorization.
The endpoint's existing minimum page size is ten; the preview renders at most
five rows, masks identities, and resets on close. This bounded preview does not
prove completeness or reconcile the aggregate population.

The backend, SQL, source mappings, lifecycle qualification, analytical formulas,
numerator/denominator definitions and API contracts are unchanged. Browser QA uses
synthetic fixtures and does not certify live production reconciliation.

See [the audit acceptance record](qa/audit-evidence/README.md) for executed commands,
browser coverage, reproducible runner instructions and remaining evidence gaps.

## Immutable reporting and readiness extension — 2 October 2026

The maturity pass reuses this visual model for immutable reports and the local
reconciliation operator workflow. `immutable_reproduction` has a distinct
`reproduced` state and never becomes `reconciled`. Per-metric Observed/Mapping
states derive from that selected metric, not another available report metric.
Original/replayed values, numerator, denominator, nulls and hashes remain exact;
release timestamp strings retain supplied sub-millisecond identity.

Immutable report inspectors do not offer a scoped-link action that drops execution
scope; users export the signed descriptor for replay. No frozen record reader is
approved, so a report's supporting-record limitation is explicit. Operational
record previews retain their separate existing admin boundary.

The admin readiness panel labels imported CLI results operator-supplied and
unattested, tied to exact scope/version/grain/time, with persistence unavailable.
Its matched arithmetic cannot update global evidence status. Implementation and
current verification are in [the maturity record](CX3-MATURITY-PASS-2026-10-02.md).
