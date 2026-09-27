# Offershop Deal Flow Architecture & Process Observability

**Process Version:** `cx.offershop.process.3.0.0`  
**Reference Basis:** `Offershop Deal Flow V3-Page-1.drawio (1)(1).svg`  
**Application:** CX3 / ConversionX (Offernet)

---

## 1. Objective & Evidence Boundaries

CX3 is a process-aware analytics and observability platform that explains how lead submissions move through the Offershop pipeline:

$$\text{Acquisition} \longrightarrow \text{Ingestion} \longrightarrow \text{Preparation \& Validation} \longrightarrow \text{Enrichment \& Scoring} \longrightarrow \text{Consumer Hospital Recovery} \longrightarrow \text{Partner Qualification (ROR)} \longrightarrow \text{HLC Delivery} \longrightarrow \text{Dialler Activity} \longrightarrow \text{Sales \& Activations} \longrightarrow \text{TEDI Feedback Reconciliation}$$

Advertising-event feedback (CAPI / web-events) is tracked as a separate related process, never conflated with call centre dialler outcomes.

### Strict Non-Intervention & Read-Only Boundaries

This implementation is strictly an **analytics and observability layer**. It does not:
- Recreate or alter production lead-routing services or contact consumers.
- Resend leads, update dialler records, or trigger hospital recovery.
- Transmit advertising events, schedule jobs, or alter cloud permissions.
- Deploy automated writes to live routing databases.

Any rule simulation is explicitly **read-only**, visibly labelled, and completely excluded from observed operational metrics.

### Five Distinct Evidence Sources

Contradictions between evidence sources are preserved and surfaced explicitly; they are never silently reconciled:

1. **Diagram (`Offershop Deal Flow V3-Page-1.drawio (1)(1).svg`)**: Documents intended processes, terminology, branches, and example business rules.
2. **Current Code (`warrens-alt/cx3`)**: Demonstrates implemented analytical behavior, not proof of upstream cloud deployment.
3. **Warehouse Schemas (`dashboards-422710` & `vibe-code-warren-stear`)**: Show declared table/view structure, not verified data completeness or semantics.
4. **Exported Samples (`EXPORT_MANIFEST_EVIDENCE`)**: Provide bounded historical observations (capped at 50 rows per object), not production totals.
5. **Authorized Runtime Queries**: Supply scoped observations for specific client scopes, not automatic system certification.

---

## 2. Process Stages & Business Logic

### Stage 1: Acquisition & Ingestion
- **Classifications:** `OnChannel`, `OffChannel`, and `Offline` are preserved as documented classifications. They are distinct from raw ad platform medium fields.
- **Channels:** Website submissions, Messenger/WhatsApp chatbot conversations, direct platform lead ads, and offline cold-list files.
- **Prequalification vs Ingestion:** Website prequalification responses (referencing `onvest_global_lp_ingestion_settings`) are kept separate from ingestion into the central pipeline (`offer_shop_lead_submit`).
- **Chatbot Conversation Recovery:** Completed conversations and abandoned conversations are modeled separately. The diagram's "last message older than two hours" check is documented as an intended recovery condition awaiting logging certification.
- **Cold-List Supply:** Offline cold lists preserve origin and batch provenance.

### Stage 2: Preparation & Validation
- **Distinct Stages:** Field standardisation, validity checks, alternative-phone handling, placeholder email detection, enrichment, and scoring are tracked independently.
- **Explicit Encoding:**
  - `1` = Valid / Successful
  - `2` = Invalid / Unsuccessful
  - **Never use JavaScript truthiness** (`true`/`false`), which corrupts integer flag semantics.
- **Validation Semantics:**
  - Standardised does not mean format-valid.
  - A format-valid phone number does not prove right-party contact (RPC).
  - Placeholder email (`none@offershop.co.za`, dummy domains) does not indicate a verified customer email.
- **Independent Classifications:** Mondo grade (credit/eligibility) and BLC colour vetting (Green, Amber, Red) are independent classifications with distinct timestamps; they are never combined into a synthetic composite quality score.

### Stage 3: Consumer Hospital
- **Entry & Pipeline Return:** Submissions failing initial format or Luhn checks enter the Consumer Hospital. Successfully recovered identities re-enter the standard qualification waterfall; unresolved records terminate in the mortuary/morgue.
- **Recovery Directions:**
  1. *Phone-to-ID Recovery:* Lookup verified national ID from historical verified records matching a valid mobile number.
  2. *ID-to-Phone Recovery:* Query active bureau contact records using a format-valid national ID.
  3. *Name/Surname Reference Matching:* Discrepancy reconciliation for typographical and surname transpositions.
- **Outcome Tags:**
  - `EXACT`
  - `INVALID_ID_ZERO`
  - `SMALL_DIFF_1_DIGIT`
  - `SMALL_DIFF_2_DIGIT`
  - `SMALL_DIFF_3_DIGIT`
  - `DIFFERENT`
  *Tags represent upstream source outcomes, not confidence probabilities. A possible-fraud tag is not proof of fraud.*
- **Zero Client PII Rule:** CX3 observes upstream recovery evidence without performing client-side fuzzy matching or exposing consumer personal data.

### Stage 4: ROR & Partner Qualification
- **Terminology:** Retains ROR without inventing expansions.
- **Non-Exclusivity:** Partner paths are not mutually exclusive or a fixed waterfall. A single lead can qualify for multiple partners simultaneously; counts must not be summed as additive unique leads.
- **Depicted Branches:**
  - BLC / ONtact
  - Mondo
  - MTN
  - Real Promotions
  - BizVoIP
  - Invalid-ID Campaign
  - RewardsCo

### Stage 5: Hot Lead Connect (HLC) & Delivery
- **Separation of Concerns:** Lead qualification, duplicate checks, outbound queueing, transmission attempts, partner API acceptance, destination list assignment, and feedback reconciliation are independent observable events.
- **Documented Duplicate Windows:**
  - **BLC / ONtact:** 48 hours (Action: `UPDATE_EXISTING`)
  - **Mondo:** 10 days / 240 hours (Action: `SUPPRESS`)
  - **MTN:** 48 hours (Action: `UPDATE_EXISTING`)
  - **Real Promotions:** 7 days / 168 hours (Action: `SUPPRESS`)
  - **BizVoIP:** 48 hours (Action: `SUPPRESS`)
  - **Invalid-ID Campaign:** 48 hours (Action: `RECLASSIFY`)
  - **RewardsCo:** 48 hours (Action: `SUPPRESS`)
- **Transport vs Business Acceptance:** An HTTP 200 response from a partner endpoint does not constitute business acceptance without an approved partner response contract. Returned vendor transaction IDs and partner lead IDs must be verified.

### Stage 6: Dialler Activity & Commercial Outcomes
- **Separation of Metrics:**
  - Raw dialler observations
  - Unique call events
  - Leads dialled
  - Cumulative call counters (e.g. from HLC repeated attempts)
  - Call dispositions
  - Right-Party Contact (RPC)
  - Reported commercial sales
  - Delivered sales
  - Verified service activations
- **Key Distinctions:**
  - A cumulative call counter is not an individual call event.
  - Expected first dial is not recorded first dial.
  - A partner reported sale is not automatically an activation or recognised revenue.

### Stage 7: TEDI & External Feedback Reconciliation
- **Observable Lifecycle:** Connection check $\to$ Expected file $\to$ File receipt $\to$ File deduplication $\to$ Secure storage $\to$ Ingestion session $\to$ Table load $\to$ Monitoring $\to$ Notification.
- **Independent Feeds:**
  - MTN activation echo master
  - MTN calls echo master
  - MTN disposition echo master
  - Mondo daily exclusion & fraud check file
  - Real Promotions weekly calls master
  - BLC remote activations
- **Status Classification:**
  - `NOT_YET_EXPECTED`
  - `OVERDUE` (under approved schedule)
  - `RECEIVED_NOT_LOADED`
  - `LOADED_UNMATCHED`
  - `OBSERVED_SOURCE_FAILURE`
  - `UNKNOWN` (when monitoring evidence is absent; never assumed failed)

### Stage 8: Advertising Feedback (Separate Process)
- **Scope:** CAPI event eligibility, transmission attempt, platform acknowledgement, and media attribution.
- **Boundary:** Modeled as a separate related process, never conflated with contact centre dialler outcomes.

---

## 3. Source-to-Process Architecture Matrix

| Node ID | Diagram Label | Family | Readiness | Mapped Table / Object | Entity Grain | Intended Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ACQ-01** | Website Prequalification Form | Acquisition | `MAPPING_REQUIRED` | `onvest_global_lp_ingestion_settings` | `prequal_response` | Landing page prequalification before pipeline entry |
| **ACQ-02** | OffChannel Conversations | Acquisition | `NOT_INSTRUMENTED` | `offchannel_conversations` | `conversation_thread` | Chatbot 2-hour idle recovery SLA |
| **ACQ-03** | Platform Leads | Acquisition | `DEPENDENCY_BLOCKED` | `view_lead_ledger_platform_insights` | `platform_lead_action` | Direct media forms (underlying waterfall view blocked) |
| **ACQ-04** | Offline Cold-List Supply | Acquisition | `NOT_INSTRUMENTED` | `cold_list_batch` | `batch_file_record` | Cold-list batch provenance |
| **ING-01** | Pipeline Ingestion | Ingestion | `MAPPED` | `clustered_lead_ledger` | `lead_id` | Central ingestion into `offer_shop_lead_submit` |
| **PREP-01** | Field Standardisation | Prep & Validation | `MAPPED` | `clustered_lead_ledger` | `lead_id` | Canonical format for ID, mobile, alt phone, email |
| **VAL-01** | National ID Validity Check | Prep & Validation | `MAPPED` | `clustered_lead_ledger.valid_idno` | `lead_id` | Luhn check; encoded 1=valid, 2=invalid |
| **VAL-02** | Phone Validity Check | Prep & Validation | `MAPPED` | `clustered_lead_ledger.phone_valid` | `lead_id` | E.164 parsing; encoded 1=valid, 2=invalid |
| **VAL-03** | Alternative Phone Handling | Prep & Validation | `MAPPED` | `clustered_lead_ledger.standardised_alt_phone` | `lead_id` | Secondary contact promotion |
| **VAL-04** | Placeholder Email Detection | Prep & Validation | `MAPPED` | `clustered_lead_ledger.standardised_email` | `lead_id` | Detection of synthetic placeholder addresses |
| **SCR-01** | Mondo Grade Classification | Prep & Validation | `MAPPED` | `clustered_lead_ledger.offershop_grade` | `lead_id` | Independent Mondo eligibility tier |
| **SCR-02** | BLC Colour Vetting | Prep & Validation | `MAPPED` | `clustered_lead_ledger.offershop_color_vetting` | `lead_id` | Independent BLC colour classification |
| **HOSP-01** | Consumer Hospital Routing | Consumer Hospital | `MAPPED` | `clustered_lead_ledger.hospital_applied_date` | `lead_id` | Routing format-invalid records to recovery |
| **HOSP-02** | Phone-to-ID Recovery | Consumer Hospital | `NOT_INSTRUMENTED` | `hospital_identity_register` | `recovery_attempt` | Lookup verified ID from historical phone |
| **HOSP-03** | ID-to-Phone Recovery | Consumer Hospital | `NOT_INSTRUMENTED` | `hospital_contact_register` | `recovery_attempt` | Lookup phone from national ID register |
| **HOSP-04** | Name/Surname Matching | Consumer Hospital | `NOT_INSTRUMENTED` | `upstream_match_engine` | `recovery_attempt` | Typographical reconciliation without PII exposure |
| **HOSP-05** | Pipeline Return & Re-entry | Consumer Hospital | `MAPPED` | `clustered_lead_ledger.offershop_source` | `lead_id` | Revet / recovered identities return to ROR |
| **HOSP-06** | Terminal Morgue Outcome | Consumer Hospital | `NOT_INSTRUMENTED` | `hospital_mortuary_log` | `lead_id` | Terminal state after recovery retries exhausted |
| **ROR-01** | Partner ROR Evaluation | Partner Qual | `MAPPED` | `clustered_lead_ledger.hlc_details` | `lead_id` | Rules of engagement & partner eligibility |
| **PART-BLC** | BLC / ONtact Branch | Partner Qual | `DEPENDENCY_BLOCKED` | `view_lead_ledger_blc_lead_submit_open` | `lead_id` | 48h duplicate window; external echo blocked |
| **PART-MONDO**| Mondo Branch | Partner Qual | `DEPENDENCY_BLOCKED` | `view_lead_ledger_mondo_lead_submit_open` | `lead_id` | 10d duplicate window; hot_lead_connect blocked |
| **PART-MTN** | MTN Branch | Partner Qual | `DEPENDENCY_BLOCKED` | `view_lead_ledger_mtn_lead_submit_open` | `lead_id` | 48h duplicate window; mtn_activation blocked |
| **PART-REAL**| Real Promotions Branch | Partner Qual | `DEPENDENCY_BLOCKED` | `view_lead_ledger_real_promotions_lead_submit_open` | `lead_id` | 7d duplicate window; calls_master blocked |
| **PART-BIZ** | BizVoIP Branch | Partner Qual | `DEPENDENCY_BLOCKED` | `view_lead_ledger_bizvoip_lead_submit_open` | `lead_id` | 48h duplicate window; vicidial_log blocked |
| **PART-INVID**| Invalid-ID Campaign | Partner Qual | `NOT_INSTRUMENTED` | `invalid_id_campaign_log` | `lead_id` | 48h duplicate window; reclassification path |
| **PART-RC**  | RewardsCo Branch | Partner Qual | `DEPENDENCY_BLOCKED` | `view_lead_ledger_rewardsco_lead_submit_open` | `lead_id` | 48h duplicate window; rewardsco blocked |
| **HLC-01**   | HLC Outbound Transmission | HLC Delivery | `MAPPED` | `clustered_lead_ledger.hlc_details` | `delivery_episode` | Outbound HTTP delivery episode creation |
| **HLC-02**   | Partner Response Contract | HLC Delivery | `NOT_INSTRUMENTED` | `hlc_response_echo` | `delivery_response` | Business acceptance vs HTTP 200 transport |
| **HLC-03**   | Dialler List Assignment | HLC Delivery | `MAPPED` | `lead_ledger_all_vicidial_insights.list_id` | `list_assignment` | Assignment into dialler campaign list |
| **DIAL-01**  | Dialler Call Events | Dialler Activity | `MAPPED` | `lead_ledger_all_vicidial_insights` | `call_event` | Discrete attempt events from dialler |
| **DIAL-02**  | Right-Party Contact (RPC) | Dialler Activity | `MAPPED` | `lead_ledger_all_vicidial_insights.status` | `call_event` | Human verified conversation disposition |
| **COMM-01**  | Reported Commercial Sales | Commercial & Act | `MAPPED` | `lead_ledger_all_vicidial_insights.status` | `sale_transaction` | Reported sale transaction |
| **COMM-02**  | Verified Activations | Commercial & Act | `MAPPED` | `blc_remote_activations` | `activation_record` | Downstream telco activation echo |
| **TEDI-01**  | TEDI Feedback Schedule | TEDI Feedback | `MAPPING_REQUIRED` | `tedi_schedule_manifest` | `schedule_batch` | Expected file cadence and arrival monitoring |
| **TEDI-02**  | Partner Feedback Ingestion| TEDI Feedback | `DEPENDENCY_BLOCKED` | `external_data_echos` | `file_ingest_event` | Ingestion session & echo load |
| **ADV-01**   | Advertising Feedback (CAPI)| Advertising Feed | `NOT_INSTRUMENTED` | `capi_event_stream` | `capi_event` | CAPI conversion events (separate process) |

---

## 4. Read-Only Rule Simulation Engine

The rule simulation engine allows business stakeholders and analysts to model hypothetical rule modifications (such as changing Mondo's duplicate window from 10 days to 5 days, or testing strict green-only colour vetting) against historical populations.

### Safety Guarantee
- All simulation queries run in **memory / analytical evaluation mode**.
- Results are prominently marked with:
  > `THIS IS A READ-ONLY RULE SIMULATION. RESULTS DO NOT REPRESENT OBSERVED PRODUCTION TRAFFIC AND ARE EXCLUDED FROM ACTUAL REPORTED METRICS.`
- Simulations never alter routing rules, never write to warehouse tables, and are permanently excluded from operational totals.
