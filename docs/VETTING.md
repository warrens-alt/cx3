# Vetting: class and colour analysis

Route: `/vetting`. API: `GET /api/analytics/vetting`. Contract: `cx.vetting.1.0.0`.

## Analysis

The dedicated tab contains Overview, Class Leads, Colour Leads, Class × Colour, Sources & Vendors, and Timing & Coverage. Pie/doughnut distributions, adjustable bars/columns/line/area charts, exact-value inspection, a clickable class/colour matrix, current-versus-previous counts, complete scorecards and CSV/JSON exports all use one returned API result. Global date/source/vendor/medium filters and supported validation filters remain in force. Class and colour selectors add explicit server-side predicates. Unsupported filters are rejected, not silently omitted.

Daily, Monday-start weekly and monthly charts group by capture date. The previous comparison is the immediately preceding, equal-length capture window. It is not necessarily the previous calendar month; the dates are exposed in the interface and exports. Changing the chart measure changes presentation only; classifications and period changes re-query the source.

## Source interpretation

Default fields are `offershop_grade`, `offershop_color_vetting`, `offershop_grade_date`, and `offershop_color_vetting_date` in the tenant's configured Lead Ledger table. Compatible optional overrides can be specified through `semanticMappings.fields.leadClass`, `leadColour`, `leadClassDate`, and `leadColourDate`. Schema availability is checked before queries are compiled. No arbitrary table or field identifiers come from API callers.

Class A–F and U accept an optional literal `Class` prefix and whitespace/case normalisation. U remains U, not missing, failed or qualified. Other non-empty class strings remain visible rather than being guessed into A/B. Missing class results have an explicit category.

A named colour requires the first comma-delimited token to be Green, Blue, Orange, Charcoal, Purple or Red, case-insensitively. Multiple distinct standalone colour tokens are flagged as ambiguous. A non-colour status such as `Contract failed vetting` remains a result without a recognised colour; it is not a colour or an inferred score. Full raw class and colour-result strings are available in scorecards. Class and colour are independent axes, not equivalent scores or billability rules.

## Populations and evidence

One included record is one Lead Ledger lead ID with an unambiguous normalised reporting projection within the two inspected capture windows. Identical reporting projections collapse. Conflicting projections and missing IDs are excluded rather than resolved through an arbitrary latest-value choice. Source diagnostics disclose excluded rows and collapsed duplicates before classification/vendor filters. Invalid capture dates cannot be assigned to a reporting window and are outside this date-bound report.

Class, colour, source, raw-result, cross-tab and trend groups must independently reconcile every returned count to their corresponding current/previous summary or the API fails. Diagnostic exclusions must reconcile to inspected source rows. Vendor groups are explicitly non-additive across vendors because a lead can visit several vendors.

Downstream evidence uses the HLC records attached to the same included lead. Delivery, first dial, sale and activation require valid source timestamps between capture and query time. RPC requires a positive recorded RPC flag; sales do not invent RPCs or calls. Vendor selections apply to nested records before outcome evaluation; vendor breakdowns then re-evaluate each outcome for the individual vendor. Each lead counts once per applicable group, not once per nested transaction.

This tab does not join external dialler or BLC activation sources through unverified identifiers, sum cumulative call snapshots, infer qualified/billable leads, or invent financial values. A missing HLC outcome is absence of this source evidence, not proof of a failed lead. Unavailable source columns remain unavailable. Outcome percentages explicitly use included leads as denominator; incomplete follow-up is not represented as a certified conversion rate.

## Timing and dates

Class/colour delay uses elapsed whole seconds from capture to the respective source timestamp, excluding negative chronology, sentinel/malformed values and future timestamps. Count, mean, exact interpolated median and 90th percentile describe the usable timing sample, not all leads. Missing samples remain unavailable. No operating-hours adjustment is applied. Timezone-free source strings retain the existing UTC interpretation; source timezone still requires independent validation.

Current classifications may have been recorded after a call or sale. Historical class transitions, temporal precedence and causal effects are not inferred from the current source snapshot. Comparisons use equal capture windows but can have different outcome follow-up. Query time is not the warehouse ingestion watermark. The report is not a pinned or commercially approved release.

## Security and exports

The API uses the existing authenticated tenant boundary and a configured read-only SourceAccess connection with per-query byte/time ceilings. One query returns all current/previous aggregates, timing and diagnostics. Group-count overflow and malformed/missing/duplicate aggregate results fail explicitly. Counts remain exact decimal strings; percentage formatting uses integer arithmetic. Chart positions are display approximations; exact exports retain the values. Pie remainder groups aggregate only disjoint integer lead counts, never ratios or overlapping vendor populations.

JSON contains the complete response, field mappings, period/filter scope and query job identity. Scorecard CSV contains all rows of that scorecard and source job context, irrespective of local table search/pagination. Plotted CSV is labelled separately as the displayed chart dataset. Failed or pending report requests hide prior results and disable exports.

## Verification boundaries

Unit/API tests use controlled schema and query-result fixtures; SQL-generation tests are not execution in BigQuery. Browser tests use synthetic source observations at desktop and mobile widths and exercise chart types, filters, tabs, heatmap selection, period changes, exports, errors/retry, keyboard navigation and overflow. Use the CI run for the final commit as the execution record. Live SQL execution, source completeness, source identity uniqueness, vendor coverage and commercial reconciliation still require an authorised warehouse validation run. No warehouse data or existing metric definitions are altered by this tab.
