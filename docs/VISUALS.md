# Application-wide interactive visual views

The visual layer reads the same API arrays used by the original tables. It never scrapes formatted HTML, re-queries a broader population, joins source tables, or recalculates a warehouse metric. Existing metric contracts, warehouse queries, permissions and API field identifiers are unchanged.

## Available controls

Every existing data-table declaration now uses `VisualTable`, offering Chart + table, Chart only, and Table only. `DataVisual` defers chart rendering until near the viewport. Existing reusable chart toolbars also provide Adjust visual, and `/visuals` lets users select an API report or any of the five configured source diagnostics, then select a returned dataset.

Chart types are horizontal bars, columns, lines, areas, scatter, heatmaps and doughnuts. Available fields depend on the response. Controls include measure, dimension, compatible comparison, search, ordering, 10/25/50/100/250-point windows, chart height, previous/next or sliding window, reset, full screen, SVG export and exact displayed-point CSV. Charts retain the original tables and their existing exports/drill-downs.

Line and area charts require an ordered/date dimension and retain missing gaps. They do not infer missing calendar rows or smooth new values. Scatter allows independently labelled X/Y measures; overlaid series require compatible units. Doughnuts are limited to explicit returned-record category counts and do not treat arbitrary overlapping metric totals as shares.

## What a point means

Ordinary value mode plots one API row per point. Duplicate category names remain separate rows; rates are never summed or averaged. The explicit returned-record distribution mode counts the loaded rows in each selected category. That is not a claim about unique people, unique calls or all warehouse records.

Versioned report metrics are separate datasets with their approved numerator/denominator labels. Media/source diagnostic metrics stay separate instead of mixing unlike units. Cohorts preserve the API observation rules. Inventory tables show schema metadata or category counts—not a fabricated timeline or certified business metric. Unknown columns can be explored as separately labelled fields; inference does not make their semantics authoritative.

Charts are limited to the rows returned by the API. A 100-row sample, a truncated export, or a missing upstream feed does not become a full population simply because it is charted. Chart search, sorting and windowing affect only the visual view; the original report and its complete export retain their scope. The displayed-point CSV is deliberately a separate scoped export.

## Precision and availability

Blank, null, malformed and unavailable values do not become zero. Exact decimal strings are retained for point details, tooltips, ordering and CSV exports. Graphics necessarily use numeric display coordinates; close large values may occupy the same pixels. The interface warns for long/excessively large values. Inspect the exact value rather than inferring equality from pixel positions.

Identifier and personal-contact columns are not inferred as numeric measures. Record validity flags may be categorical. No source row contents are saved to local storage. Query failures, missing sources and missing approved releases retain their error/unavailable state; no demo figures are substituted.

## Coverage and validation

The automated source inventory test prevents new raw table declarations outside the shared wrapper without an explicit visual adapter. The current pass covers the 37 pre-existing declarations, including dormant historical model components without re-enabling their routes. Shared call-table helpers cover each rendered report tab. The overview/funnel summaries, all returned versioned evidence rows and source diagnostics have additional visual entry points.

Unit tests exercise precision, missing values, zero, invalid input, units, duplicate labels, row distributions, time-chart restrictions, comparison and CSV safety. Browser tests use synthetic responses at desktop and mobile widths and cover rendered controls, chart changes, retained tables, source selection, pagination/search and exact exports. These tests do not execute live warehouse SQL or certify every legacy metric. Use the normal CI result for the exact committed revision; this document itself is not a test-pass record.
