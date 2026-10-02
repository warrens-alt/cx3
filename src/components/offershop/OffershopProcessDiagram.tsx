import React from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  CornerDownRight,
  Database,
  ExternalLink,
  Flame,
  GitBranch,
  GitFork,
  HelpCircle,
  Layers,
  PhoneCall,
  Repeat,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  UserCheck,
  UserX,
} from 'lucide-react';
import type { StageObservabilityData } from '../../../server/analytics/process/offershopProcess';
import type { OffershopProcessFamily } from '../../../contracts/offershopProcess';
import { formatTableNumber } from '../../lib/formatters';

interface Props {
  stages: Record<OffershopProcessFamily, StageObservabilityData>;
  selectedStage: OffershopProcessFamily | null;
  onSelectStage: (family: OffershopProcessFamily) => void;
}

export function OffershopProcessDiagram({ stages, selectedStage, onSelectStage }: Props) {
  const getBadge = (readiness: string) => {
    switch (readiness) {
      case 'MAPPED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-semantic-pos-bg text-semantic-pos border border-semantic-pos/30">
            <CheckCircle2 size={12} />
            <span>Mapped</span>
          </span>
        );
      case 'DEPENDENCY_BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-semantic-warn-bg text-semantic-warn border border-semantic-warn/30">
            <ShieldAlert size={12} />
            <span>Blocked</span>
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-selected-bg text-[var(--cx-action)] border border-action/30">
            <span>Partial</span>
          </span>
        );
      case 'MAPPING_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-selected-bg text-action border border-action/30">
            <span>Needs Map</span>
          </span>
        );
      case 'NOT_INSTRUMENTED':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-sec text-text-sec border border-border-subtle">
            <span>Not Inst.</span>
          </span>
        );
    }
  };

  const isSel = (f: OffershopProcessFamily) => selectedStage === f;

  return (
    <div className="space-y-6">
      {/* Legend & Pipeline Meta */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface rounded-md border border-border-subtle text-xs text-text-sec ">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          <GitBranch size={16} className="text-[var(--cx-action)]" />
          <span className="font-semibold text-text-main">Connected Process Logic Graph:</span>
          <span>Click any stage node to inspect its architectural invariants, rules, and mapped tables.</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-semantic-pos"></span> Mapped</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-semantic-warn"></span> Dependency Blocked</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-action"></span> Partial / Mapped</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-text-muted"></span> Not Instrumented</span>
        </div>
      </div>

      {/* Main Directed Process Flow Canvas */}
      <div 
        tabIndex={0}
        role="region"
        aria-label="Offershop process flow canvas"
        className="p-4 sm:p-6 bg-surface-sec rounded-md border border-border-subtle overflow-x-auto focus-visible:outline-2 focus-visible:outline-[var(--cx-action)]"
      >
        <div className="min-w-[760px] lg:min-w-[920px] space-y-8">

          {/* Row 1: Intake & Ingestion */}
          <div className="grid grid-cols-12 gap-4 items-center">
            {/* Stage 1: Acquisition */}
            <button
              type="button"
              onClick={() => onSelectStage('acquisition')}
              aria-pressed={isSel('acquisition')}
              className={`col-span-5 p-4 rounded-md border text-left cursor-pointer transition-all ${
                isSel('acquisition')
                  ? 'bg-surface border-[var(--cx-action)]  ring-2 ring-[var(--cx-action)]/20'
                  : 'bg-surface border-border-subtle hover:border-border '
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <span>01</span> · <span>Acquisition</span>
                </span>
                {getBadge(stages.acquisition?.readiness || 'PARTIAL')}
              </div>
              <h4 className="text-sm font-bold text-text-main mb-1">Acquisition & Channel Provenance</h4>
              <p className="text-xs text-text-sec line-clamp-2 leading-relaxed">
                Captures OnChannel (Web/Chatbot), OffChannel (Meta/Google), and Offline cold lists.
              </p>
              <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between text-xs font-sans">
                <span className="text-text-muted">Submissions:</span>
                <span className="font-semibold text-text-main">
                  {stages.acquisition?.observedMetrics?.totalSubmissions != null
                    ? formatTableNumber(Number(stages.acquisition.observedMetrics.totalSubmissions))
                    : '—'}
                </span>
              </div>
            </button>

            {/* Directed Connector: Acquisition -> Ingestion */}
            <div className="col-span-2 flex flex-col items-center justify-center">
              <span className="text-[11px] font-semibold font-sans text-text-muted uppercase tracking-wider mb-1">
                HTTP Submit
              </span>
              <div className="w-full flex items-center justify-center">
                <div className="h-0.5 w-full bg-border-strong"></div>
                <ArrowRight size={18} className="text-text-muted shrink-0 -ml-1" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">offer_shop_lead_submit</span>
            </div>

            {/* Stage 2: Pipeline Ingestion */}
            <button
              type="button"
              onClick={() => onSelectStage('ingestion')}
              aria-pressed={isSel('ingestion')}
              className={`col-span-5 p-4 rounded-md border text-left cursor-pointer transition-all ${
                isSel('ingestion')
                  ? 'bg-surface border-[var(--cx-action)]  ring-2 ring-[var(--cx-action)]/20'
                  : 'bg-surface border-border-subtle hover:border-border '
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <span>02</span> · <span>Ingestion</span>
                </span>
                {getBadge(stages.ingestion?.readiness || 'MAPPED')}
              </div>
              <h4 className="text-sm font-bold text-text-main mb-1">Central Pipeline Ingestion</h4>
              <p className="text-xs text-text-sec line-clamp-2 leading-relaxed">
                Atomic intake into central warehouse lead ledger with timestamping, client, and source tags.
              </p>
              <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between text-xs font-sans">
                <span className="text-text-muted">Ingested Leads:</span>
                <span className="font-semibold text-text-main">
                  {stages.ingestion?.observedMetrics?.ingestedLeads != null
                    ? formatTableNumber(Number(stages.ingestion.observedMetrics.ingestedLeads))
                    : '—'}
                </span>
              </div>
            </button>
          </div>

          {/* Vertical Transition to Validation */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-border-strong"></div>
              <ArrowDown size={18} className="text-text-muted -mt-1" />
              <span className="text-[11px] font-sans text-text-muted mt-0.5">Validation Gate</span>
            </div>
          </div>

          {/* Row 2: Validation Gate with Decision Fork */}
          <div className="grid grid-cols-12 gap-4 items-start">
            {/* Stage 3: Preparation & Validation */}
            <button
              type="button"
              onClick={() => onSelectStage('preparation_validation')}
              aria-pressed={isSel('preparation_validation')}
              className={`col-span-5 p-4 rounded-md border text-left cursor-pointer transition-all ${
                isSel('preparation_validation')
                  ? 'bg-surface border-[var(--cx-action)]  ring-2 ring-[var(--cx-action)]/20'
                  : 'bg-surface border-border-subtle hover:border-border '
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <span>03</span> · <span>Validation Gate</span>
                </span>
                {getBadge(stages.preparation_validation?.readiness || 'MAPPED')}
              </div>
              <h4 className="text-sm font-bold text-text-main mb-1">Standardisation & Validation</h4>
              <p className="text-xs text-text-sec line-clamp-2 leading-relaxed">
                National ID Luhn check, mobile validity, placeholder email detection, Mondo grade & BLC colour.
              </p>
              <div className="mt-3 pt-2.5 border-t border-border-subtle grid grid-cols-2 gap-2 text-xs font-sans">
                <div>
                  <span className="text-text-muted block text-[11px]">ID Valid (1):</span>
                  <span className="font-semibold text-semantic-pos">
                    {stages.preparation_validation?.observedMetrics?.idValidationValidCode1 != null
                      ? formatTableNumber(Number(stages.preparation_validation.observedMetrics.idValidationValidCode1))
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[11px]">ID Invalid (2):</span>
                  <span className="font-semibold text-semantic-warn">
                    {stages.preparation_validation?.observedMetrics?.idValidationInvalidCode2 != null
                      ? formatTableNumber(Number(stages.preparation_validation.observedMetrics.idValidationInvalidCode2))
                      : '—'}
                  </span>
                </div>
              </div>
            </button>

            {/* Decision Fork Connectors */}
            <div className="col-span-2 flex flex-col items-center justify-center space-y-4 pt-4">
              <div className="flex items-center gap-1 text-[11px] font-bold text-semantic-pos bg-semantic-pos-bg px-2 py-0.5 rounded border border-semantic-pos/30">
                <span>Code 1 (Valid)</span>
                <ArrowRight size={12} />
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-semantic-warn bg-semantic-warn-bg px-2 py-0.5 rounded border border-semantic-warn/30">
                <span>Code 2 (Invalid)</span>
                <ArrowDown size={12} />
              </div>
            </div>

            {/* Stage 4: Consumer Hospital Recovery (Fork Branch) */}
            <button
              type="button"
              onClick={() => onSelectStage('consumer_hospital')}
              aria-pressed={isSel('consumer_hospital')}
              className={`col-span-5 p-4 rounded-md border text-left cursor-pointer transition-all ${
                isSel('consumer_hospital')
                  ? 'bg-surface border-[var(--cx-action)]  ring-2 ring-[var(--cx-action)]/20'
                  : 'bg-surface border-semantic-warn/30 bg-semantic-warn-bg hover:border-semantic-warn/30 '
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-semantic-warn flex items-center gap-1">
                  <span>04</span> · <span>Recovery Branch</span>
                </span>
                {getBadge(stages.consumer_hospital?.readiness || 'PARTIAL')}
              </div>
              <h4 className="text-sm font-bold text-text-main mb-1">Consumer Hospital & Recovery</h4>
              <p className="text-xs text-text-sec line-clamp-2 leading-relaxed">
                Phone-to-ID, ID-to-phone, and name matching. Successfully revetted records loop back; unrecoverable go to morgue.
              </p>
              <div className="mt-3 pt-2.5 border-t border-semantic-warn/30 flex items-center justify-between text-xs font-sans">
                <div>
                  <span className="text-text-muted block text-[11px]">Hospital Entries:</span>
                  <span className="font-semibold text-semantic-warn">
                    {stages.consumer_hospital?.observedMetrics?.hospitalEntries != null
                      ? formatTableNumber(Number(stages.consumer_hospital.observedMetrics.hospitalEntries))
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[11px]">Recovered (Revet):</span>
                  <span className="font-semibold text-semantic-pos">
                    {stages.consumer_hospital?.observedMetrics?.recoveredIdentities != null
                      ? formatTableNumber(Number(stages.consumer_hospital.observedMetrics.recoveredIdentities))
                      : '—'}
                  </span>
                </div>
              </div>
            </button>
          </div>

          {/* Recovery Loop-back note */}
          <div className="p-2.5 rounded-md border border-dashed border-semantic-warn/30 bg-semantic-warn-bg flex items-center justify-between text-xs text-semantic-warn">
            <div className="flex items-center gap-2">
              <RotateCcw size={14} className="text-semantic-warn" />
              <span><strong>Hospital Re-entry:</strong> Successfully revetted identities re-enter partner qualification; unresolved records terminate in mortuary/morgue.</span>
            </div>
            <span className="font-sans text-[11px] text-semantic-warn">Tags: EXACT · SMALL_DIFF · DIFFERENT</span>
          </div>

          {/* Vertical Transition to Partner Qualification */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-border-strong"></div>
              <ArrowDown size={18} className="text-text-muted -mt-1" />
              <span className="text-[11px] font-sans text-text-muted mt-0.5">ROR Qualification</span>
            </div>
          </div>

          {/* Row 3: Partner ROR Qualification & HLC Delivery */}
          <div className="grid grid-cols-12 gap-4 items-center">
            {/* Stage 5: Partner Qualification */}
            <button
              type="button"
              onClick={() => onSelectStage('partner_qualification')}
              aria-pressed={isSel('partner_qualification')}
              className={`col-span-5 p-4 rounded-md border text-left cursor-pointer transition-all ${
                isSel('partner_qualification')
                  ? 'bg-surface border-[var(--cx-action)]  ring-2 ring-[var(--cx-action)]/20'
                  : 'bg-surface border-border-subtle hover:border-border '
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <span>05</span> · <span>Qualification</span>
                </span>
                {getBadge(stages.partner_qualification?.readiness || 'DEPENDENCY_BLOCKED')}
              </div>
              <h4 className="text-sm font-bold text-text-main mb-1">ROR & Partner Qualification</h4>
              <p className="text-xs text-text-sec line-clamp-2 leading-relaxed">
                Non-exclusive partner branches (BLC, Mondo, MTN, Real Promotions, BizVoIP, RewardsCo, Invalid-ID) with duplicate windows.
              </p>
              <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between text-xs font-sans">
                <span className="text-text-muted">7 Partner Branches:</span>
                <span className="font-semibold text-text-main">48h – 10d Duplicate Windows</span>
              </div>
            </button>

            {/* Directed Connector: Qualification -> Delivery */}
            <div className="col-span-2 flex flex-col items-center justify-center">
              <span className="text-[11px] font-semibold font-sans text-text-muted uppercase tracking-wider mb-1">
                Queue & Dispatch
              </span>
              <div className="w-full flex items-center justify-center">
                <div className="h-0.5 w-full bg-border-strong"></div>
                <ArrowRight size={18} className="text-text-muted shrink-0 -ml-1" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">Deduplication Guard</span>
            </div>

            {/* Stage 6: HLC Delivery */}
            <button
              type="button"
              onClick={() => onSelectStage('hlc_delivery')}
              aria-pressed={isSel('hlc_delivery')}
              className={`col-span-5 p-4 rounded-md border text-left cursor-pointer transition-all ${
                isSel('hlc_delivery')
                  ? 'bg-surface border-[var(--cx-action)]  ring-2 ring-[var(--cx-action)]/20'
                  : 'bg-surface border-border-subtle hover:border-border '
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <span>06</span> · <span>Delivery</span>
                </span>
                {getBadge(stages.hlc_delivery?.readiness || 'MAPPED')}
              </div>
              <h4 className="text-sm font-bold text-text-main mb-1">Hot Lead Connect (HLC) & Delivery</h4>
              <p className="text-xs text-text-sec line-clamp-2 leading-relaxed">
                Partner API delivery, HTTP response verification, list assignment and duplicate action enforcement.
              </p>
              <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between text-xs font-sans">
                <span className="text-text-muted">Delivered Episodes:</span>
                <span className="font-semibold text-text-main">
                  {stages.hlc_delivery?.observedMetrics?.deliveredEpisodes != null
                    ? formatTableNumber(Number(stages.hlc_delivery.observedMetrics.deliveredEpisodes))
                    : '—'}
                </span>
              </div>
            </button>
          </div>

          {/* Vertical Transition to Dialler & Commercial */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-border-strong"></div>
              <ArrowDown size={18} className="text-text-muted -mt-1" />
              <span className="text-[11px] font-sans text-text-muted mt-0.5">Dialler & Commercial</span>
            </div>
          </div>

          {/* Row 4: Dialler Activity & Commercial Outcomes */}
          <div className="grid grid-cols-12 gap-4 items-center">
            {/* Stage 7: Dialler Activity */}
            <button
              type="button"
              onClick={() => onSelectStage('dialler_activity')}
              aria-pressed={isSel('dialler_activity')}
              className={`col-span-5 p-4 rounded-md border text-left cursor-pointer transition-all ${
                isSel('dialler_activity')
                  ? 'bg-surface border-[var(--cx-action)]  ring-2 ring-[var(--cx-action)]/20'
                  : 'bg-surface border-border-subtle hover:border-border '
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <span>07</span> · <span>Dialler Operations</span>
                </span>
                {getBadge(stages.dialler_activity?.readiness || 'MAPPED')}
              </div>
              <h4 className="text-sm font-bold text-text-main mb-1">Dialler Activity & Contact (RPC)</h4>
              <p className="text-xs text-text-sec line-clamp-2 leading-relaxed">
                Vicidial outbound attempts, right-party contacts (RPC), dispositions, and call attempt counters.
              </p>
              <div className="mt-3 pt-2.5 border-t border-border-subtle grid grid-cols-2 gap-2 text-xs font-sans">
                <div>
                  <span className="text-text-muted block text-[11px]">Dialled Leads:</span>
                  <span className="font-semibold text-text-main">
                    {stages.dialler_activity?.observedMetrics?.leadsDialled != null
                      ? formatTableNumber(Number(stages.dialler_activity.observedMetrics.leadsDialled))
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[11px]">Right-Party Contact:</span>
                  <span className="font-semibold text-semantic-pos">
                    {stages.dialler_activity?.observedMetrics?.rightPartyContacts != null
                      ? formatTableNumber(Number(stages.dialler_activity.observedMetrics.rightPartyContacts))
                      : '—'}
                  </span>
                </div>
              </div>
            </button>

            {/* Directed Connector: Dialler -> Commercial */}
            <div className="col-span-2 flex flex-col items-center justify-center">
              <span className="text-[11px] font-semibold font-sans text-text-muted uppercase tracking-wider mb-1">
                Conversion
              </span>
              <div className="w-full flex items-center justify-center">
                <div className="h-0.5 w-full bg-border-strong"></div>
                <ArrowRight size={18} className="text-text-muted shrink-0 -ml-1" />
              </div>
              <span className="text-[11px] text-text-muted mt-1">Sale & Activation</span>
            </div>

            {/* Stage 8: Commercial Sales & Activations */}
            <button
              type="button"
              onClick={() => onSelectStage('commercial_activation')}
              aria-pressed={isSel('commercial_activation')}
              className={`col-span-5 p-4 rounded-md border text-left cursor-pointer transition-all ${
                isSel('commercial_activation')
                  ? 'bg-surface border-[var(--cx-action)]  ring-2 ring-[var(--cx-action)]/20'
                  : 'bg-surface border-border-subtle hover:border-border '
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <span>08</span> · <span>Commercial</span>
                </span>
                {getBadge(stages.commercial_activation?.readiness || 'MAPPED')}
              </div>
              <h4 className="text-sm font-bold text-text-main mb-1">Commercial Sales & Activations</h4>
              <p className="text-xs text-text-sec line-clamp-2 leading-relaxed">
                Recorded partner sales and activation timestamps. Billing, collection, SIM status and commercial completion are not inferred.
              </p>
              <div className="mt-3 pt-2.5 border-t border-border-subtle grid grid-cols-2 gap-2 text-xs font-sans">
                <div>
                  <span className="text-text-muted block text-[11px]">Reported Sales:</span>
                  <span className="font-semibold text-action">
                    {stages.commercial_activation?.observedMetrics?.reportedSales != null
                      ? formatTableNumber(Number(stages.commercial_activation.observedMetrics.reportedSales))
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[11px]">Verified Active:</span>
                  <span className="font-semibold text-semantic-pos">
                    {stages.commercial_activation?.observedMetrics?.verifiedActivations != null
                      ? formatTableNumber(Number(stages.commercial_activation.observedMetrics.verifiedActivations))
                      : '—'}
                  </span>
                </div>
              </div>
            </button>
          </div>

          {/* Row 5: Reconciliation & External Feeds */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Stage 9: TEDI Feedback */}
            <button
              type="button"
              onClick={() => onSelectStage('tedi_feedback')}
              aria-pressed={isSel('tedi_feedback')}
              className={`p-4 rounded-md border text-left cursor-pointer transition-all ${
                isSel('tedi_feedback')
                  ? 'bg-surface border-[var(--cx-action)]  ring-2 ring-[var(--cx-action)]/20'
                  : 'bg-surface border-border-subtle hover:border-border '
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <span>09</span> · <span>Feedback Reconciliation</span>
                </span>
                {getBadge(stages.tedi_feedback?.readiness || 'DEPENDENCY_BLOCKED')}
              </div>
              <h4 className="text-sm font-bold text-text-main mb-1">TEDI & External Feedback Reconciliation</h4>
              <p className="text-xs text-text-sec line-clamp-2 leading-relaxed">
                Scheduled echo file ingestion, deduplication, storage, table load, and reconciliation monitoring for MTN, Mondo, Real Promotions.
              </p>
              <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between text-xs font-sans text-text-muted">
                <span>Reference Schedules:</span>
                <span className="font-semibold text-text-main">MTN · Mondo · Real Promotions</span>
              </div>
            </button>

            {/* Stage 10: Advertising Feedback (Separate Process) */}
            <button
              type="button"
              onClick={() => onSelectStage('advertising_feedback')}
              aria-pressed={isSel('advertising_feedback')}
              className={`p-4 rounded-md border text-left cursor-pointer transition-all ${
                isSel('advertising_feedback')
                  ? 'bg-surface border-[var(--cx-action)]  ring-2 ring-[var(--cx-action)]/20'
                  : 'bg-surface-sec border-border-subtle hover:border-border '
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <span>10</span> · <span>Separate Related Process</span>
                </span>
                {getBadge(stages.advertising_feedback?.readiness || 'NOT_INSTRUMENTED')}
              </div>
              <h4 className="text-sm font-bold text-text-main mb-1">Advertising Feedback (CAPI & Web Events)</h4>
              <p className="text-xs text-text-sec line-clamp-2 leading-relaxed">
                Conversion event feedback (CAPI / web-events) is tracked independently from contact centre dialler outcomes. Never conflated.
              </p>
              <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between text-xs font-sans text-text-muted">
                <span>Conflation with Dialler:</span>
                <span className="font-semibold text-semantic-pos">Strictly Separated (False)</span>
              </div>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
