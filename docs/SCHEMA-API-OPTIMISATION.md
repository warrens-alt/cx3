# Schema-aware API and data presentation

## Evidence

This change uses the user-supplied `dashboards-422710_all_datasets_columns_data_dictionary_2026-09-26(1).csv`, SHA-256 `4ecf244b51a8f718f3a6ecd24a650f60bf41a05f67813a5138e993ecc5ed918d`. The dictionary contains 1,840 column entries across 63 tables/views and three datasets. It is schema evidence dated 26 September 2026, not a live data-quality, freshness, partitioning or join-key validation.

Only the eight already configured tenant lead views, the three contracted shared sources and the existing activation-source schema are represented in the checked-in snapshot. The full dictionary and unrelated dataset schemas are not published or enabled.

## Corrected source shape

The configured tenant lead views contain 24 flat vendor-transaction columns. They do not contain the master ledger's `hlc_details` array, grade, medium, validation flags or routing-history fields. Previously shared compilers expected those fields on every tenant source.

`leadSourceRelation` now projects only supplied columns from the exact configured tenant view and wraps each physical transaction for the existing downstream lead aggregation. Missing canonical dimensions are typed nulls; no master-table fallback or enrichment join is added. Source-row inspection continues to query the physical flat view directly and uses its scalar vendor column.

Unsupported dimension filters are rejected before query submission rather than ignored or evaluated against invented values. Existing master-ledger paths retain their nested shape. On the flat legacy path, unrelated dialler/activation scans are removed because the dictionary does not prove cross-source identity equivalence. Recorded source transaction outcomes remain usable; undated RPC evidence is not turned into an event timestamp.

## Query efficiency and inspection

Native DATE, TIMESTAMP and DATETIME source-metric fields use native range predicates. String timestamps retain safe parsing. UTC source-metric interpretation, inclusive end dates and sentinel exclusions are preserved. No partitioning or production speedup is claimed from the dictionary alone.

The source catalogue starts independent configured dataset and table-metadata requests concurrently, with individual failure handling and deterministic result ordering. It performs no data scan. Existing permission boundaries and single-flight metadata coalescing remain.

Case-insensitive column lookup matches BigQuery field-name semantics while preserving original names and repeated-field ancestry. Missing view `numRows` metadata is returned as unknown, not zero. Actual metadata counts are explicitly labelled metadata estimates.

## Display changes

Shared analytical guidance now explains flat-source limitations without making another API request. A user who selected an unavailable grade or medium receives explicit removal controls; scope is never silently broadened. Schema-reference date is labelled separately from the source-feed cutoff. API metadata also describes source shape and missing dimensions.

Shared physical contracts no longer claim `id` or `created_at` columns absent from the dictionary. Marketing `entity` and `multiplier`, call `expected_first_dial`, and timing campaign/list names are recorded as available columns, not newly approved financial or identity semantics. Budget and multiplier are never used to manufacture spend.

## Validation boundaries

Regression tests cover all eight flat adapters, allowed column references, independent source-row filtering, missing dimensions, native and string date predicates, case-insensitive nested schema lookup, concurrent catalogue reads and unknown row counts. Local generated-column checks were compared with the supplied CSV. Repository CI provides type, contract, unit-test and build verification.

This is not a live BigQuery dry run, source-owner reconciliation, authenticated Cloudflare acceptance test or rendered desktop/mobile QA. The user-supplied dictionary does not establish arbitrary joins, campaign cost allocation or actual spend. Other sources containing spend-like fields require a separate approved ownership, grain and reconciliation contract before use.
