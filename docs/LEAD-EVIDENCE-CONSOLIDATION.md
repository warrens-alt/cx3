# Lead Evidence consolidation map — 2 October 2026

Fetched `origin/main` and confirmed HEAD at
`24c1a11e3ba48e4fa24e49f8d51e73d7363fa3ae`; no subsequent remote commits existed.
This map precedes implementation and retirement of the duplicate record UI.

Lead Evidence consolidates the prior Record Explorer, analytical Lead Ledger and
source Lead Ledger user experiences. Analytical lead grain and original
source-record grain remain separate evidence models.

| Current owner / capability | Decision | Destination and preserved boundary |
| --- | --- | --- |
| Record Explorer reporting/Investigation scope, drill and additive narrowing | Keep / compose | Population mode; existing analytical predicates and request semantics |
| Record Explorer `fetchRawLeads`, search, count, page export | Reuse | Population browser; analytical page only |
| InvestigationRecordList factual inclusion reason and presets | Reuse / extend | Investigation, Journey, Contact, Outcomes and Full analytical presets; already-returned rows |
| Record Explorer workflow, drivers, confidence, AI and evidence pins | Keep | Population mode; existing request, access and scope boundaries |
| Analytical Ledger 17-column table | Migrate | Full analytical preset; source fields remain separate |
| Analytical Ledger 25/50/100 page sizes and first/previous/next/last controls | Migrate | One Population pagination implementation |
| Analytical Ledger copy lead ID | Migrate | Population list control; selected identity stays session-local |
| Analytical Ledger page CSV | Reuse existing stronger page export | `buildLeadEvidenceExport` with current-page audit/provenance preflight |
| Analytical Ledger separate timeline inspector | Retire after parity | Canonical LeadDossier reusing LeadJourney |
| Source Ledger replica/coverage queries, configured/rich source modes | Keep / extract | Source Evidence mode; approved tenant source only |
| Source Ledger original rows and multiple records per lead | Keep | LedgerReplicaReport / LedgerLead models remain separate from RawLeadsData |
| Source Ledger source search and pagination | Keep | Separate source search semantics, query identity and population |
| Source Ledger 63-field compatibility, field coverage and provenance | Keep | LedgerFieldCoverage and returned source query metadata |
| Source Ledger compatible / partial complete-query CSV | Reuse | EvidenceExportPreflight + receiveLedgerCsv; separate full query snapshot |
| SourceLeadBrowser desktop/mobile competing inspectors | Generalize browser / retire inspectors | Both layouts select one canonical dossier |
| LeadDossier Summary, Journey, Calls, Outcomes, Evidence, Source | Reuse / generalize | Summary, Journey, Calls, Outcomes, Audit, Source; missing normalized match explicit |
| LeadJourney chronology, source milestones, audit and evidence selection | Reuse | One timeline; cumulative call counts never become attempt histories |
| DossierSource lazy exact lead matching | Reuse | Source tab loads only on explicit opening in Population; Source mode reuses its returned source lead |
| LeadSourceEvidence field groups/raw records | Reuse | Original source-compatible names and values; no normalized universal row |
| `/lead-explorer` and Explorer aliases | Keep canonical / compatibility | Lead Evidence Population default; durable mode and preset URL state |
| `/lead-ledger` | Compatibility-only | Scope-preserving canonical Source Evidence destination |
| Separate Lead Ledger navigation/palette destination | Retire after Source parity | One Lead Evidence destination with legacy search terms |
| Record Explorer / analytical Ledger / source workspace styling | Consolidate active owners | Shared Lead Evidence layout plus reused source field/timeline primitives |

## Composition and selection plan

The canonical workspace owns mode tabs and a session-local selection. Population
and Source Evidence mount only their active population browser. Preset changes
reuse rows. Source-only selection does not automatically load an analytical
population; an explicit exact-match lookup can establish a normalized row before
an analytical handoff is offered. Source identity alone does not claim analytical
reconciliation. Mode changes preserve a valid selection; tenant, permission,
reporting-scope and population changes fence stale data.

Population selections use the existing timeline endpoint only when selected.
Population dossier source queries remain lazy and exact. Source mode passes its
already-returned source lead/report into the same dossier to avoid duplicate
replica reads. A selected identity or field focus is never added to shareable URL
state merely to switch modes. Manual analytical and source searches stay distinct.

An Investigation predicate qualifies the analytical lead. Original records do not
independently establish that every source transaction satisfies that predicate.
The Source mode retains this boundary in context and exports. Unique leads and
source rows are labelled separately and never added together.

## Retirement gate

First migrate list fields, pagination, exports and dossier behavior, and verify
parity. Commit migration separately from retirement. Only then remove mounted use
and imports of the duplicate analytical Ledger and its old workspace wrapper,
update specific tests to canonical behavior, and remove selectors with no remaining
consumers. Contracts, SQL, metrics, source mappings and permissions are untouched.
