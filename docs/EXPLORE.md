# Explore workspace refinement

The `/explore` route remains the legacy live-source query endpoint, not a certified Evidence Report. This change does not alter SQL, authentication, metric contracts, dependencies or warehouse data.

## Query and scope

The builder exposes supported measures and a primary/optional secondary dimension. Vendor is available as a report filter, not as a falsely first-vendor-attributed grouping. Presets request supply, capture trends, sale efficiency and class breakdowns. Class and colour-vetting dimensions reflect existing recorded source results; use Vetting for its explicit class/colour interpretation.

Metric, dimensions and chart selection are validated in `exMetric`, `exDimension`, `exSecondary`, `exChart`. View links fix the currently displayed capture dates and preserve filters; they are not pinned result snapshots. Invalid or repeated values block requests. Browser navigation restores those selections. Query cache identity includes tenant, dates, filters, metric and both dimensions; presentation selections do not issue new warehouse queries. Pending, cancelled and failed requests hide prior results and export actions. Browser cancellation does not guarantee cancellation of a warehouse job.

## Presentation and interpretation

Search, minimum reported sample, sorting and table pagination operate on already received groups. The table initially renders 25 rows and supports 10/25/50/100. Charts show an explicit point window, while the summary remains based on all received groups. No unweighted group average is represented as an overall rate. Null and malformed values remain unavailable; incomplete sums are withheld. Received decimal strings are sorted and summed without floating-point conversion. Legacy API numbers may already be approximate; this UI cannot recover lost source precision.

Line/area plots require a capture-ordered dimension and permit up to six secondary-dimension series. Missing category/time values are not imputed. Categorical pairs remain separate API groups, not an implicit sum. Doughnuts are limited to non-negative, available, integer count distributions with one categorical dimension; a labelled Other group contains the explicit remaining received count groups. Ratios, money, temporal populations and overlapping comparison series are not shown as pie composition. Chart coordinates still use approximate doubles; inspect exact values rather than inferring equality from pixels.

The sample minimum is a visibility control, not a statistical confidence threshold. A non-truncated API response does not by itself prove complete source coverage. The API limit and truncation status remain visible. View changes and refreshes can change observations; generated/received time is not a warehouse ingestion watermark.

## Exports and inspection

Export loaded CSV and Response JSON include every received group irrespective of local search/pagination, plus dates, filters, metric definition, response metadata and extraction context. Export matching CSV is deliberately labelled as a filtered subset. None of these exports implies access to records beyond an API truncation boundary. Group details reuse the same API row and expose the supplied additional legacy measures without a new query. CSV cells are protected against spreadsheet formula execution.

## Verification scope

Pure-module tests cover URL validation, response identity, group uniqueness, limits, zero/null, precision, sorting, pies, secondary pivots and export context. Browser checks use handwritten API fixtures at desktop and mobile sizes to verify builder controls, local-only operations, chart types, details, downloads, back-compatible labels, error recovery, cancellation and layout. A passing code/build/browser run is not execution of warehouse SQL or a production performance benchmark.

The previously prepared Vetting refinement patch is separate and is not included in this Explore-specific change.
