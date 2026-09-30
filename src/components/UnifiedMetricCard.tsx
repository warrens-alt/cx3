import React, { useState } from 'react';
import InspectorHost, { type InspectorContent } from '../shared/evidence/InspectorHost';
import { AuditMetadata } from '../shared/evidence/AuditMode';
import { Link, type To } from 'react-router-dom';
import { Info, Search, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface UnifiedMetricCardProps {
  auditContent?: InspectorContent;
  label: string;
  value: string | number | null | undefined;
  note?: string;
  change?: number | null;
  changeUnit?: string;
  isPositiveGood?: boolean;
  prefix?: string;
  suffix?: string;
  onWhyChanged?: () => void;
  whyLabel?: string;
  onAbout?: () => void;
  aboutLabel?: string;
  to?: To;
  onInspect?: () => void;
  inspectLabel?: string;
  denominatorLink?: To;
  denominatorLabel?: string;
  onDenominatorClick?: () => void;
  className?: string;
  loading?: boolean;
  unavailable?: boolean;
}

export default function UnifiedMetricCard({
  auditContent,
  label,
  value,
  note,
  change,
  changeUnit = '%',
  isPositiveGood = true,
  prefix = '',
  suffix = '',
  onWhyChanged,
  whyLabel = 'Why changed?',
  onAbout,
  aboutLabel,
  to,
  onInspect,
  inspectLabel = 'Inspect',
  denominatorLink,
  denominatorLabel,
  onDenominatorClick,
  className = '',
  loading = false,
  unavailable = false,
}: UnifiedMetricCardProps) {
  const [auditOpen, setAuditOpen] = useState(false);
  if (loading) {
    return (
      <article
        className={`cx-unified-metric enterprise-card bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col justify-between animate-pulse ${className}`}
        role="status"
        aria-label={`Loading ${label}`}
      >
        <div>
          <div className="h-3.5 bg-surface-subtle border border-border-subtle rounded w-24 mb-3" />
          <div className="h-8 bg-surface-subtle border border-border-subtle rounded w-36 mb-2" />
          <div className="h-3 bg-surface-subtle border border-border-subtle rounded w-20" />
        </div>
        <div className="h-6 bg-surface-subtle border border-border-subtle rounded mt-4 pt-2" />
      </article>
    );
  }

  const isMissing = unavailable || value === null || value === undefined || value === '—' || value === 'Unavailable';
  const displayValue = isMissing ? '—' : `${prefix}${value}${suffix}`;

  const hasChange = change !== undefined && change !== null && Number.isFinite(change);
  const isZero = hasChange && change === 0;
  const isPos = hasChange && change! > 0;
  const positive = hasChange && (isPos ? isPositiveGood : !isPositiveGood);
  const DeltaIcon = isZero ? Minus : isPos ? TrendingUp : TrendingDown;

  const hasFooter = Boolean(
    auditContent || onWhyChanged ||
    to ||
    onInspect ||
    (denominatorLink && denominatorLabel) ||
    (onDenominatorClick && denominatorLabel)
  );

  return (
    <article
      className={`cx-unified-metric enterprise-card bg-surface border border-border hover:border-action/40 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-150 hover:shadow-xs group ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-xs sm:text-[12px] font-semibold text-text-sec uppercase tracking-wider cx-metric-label">
            {label}
          </span>
          {onAbout && !auditContent && (
            <button
              type="button"
              className="text-text-mute hover:text-brand-primary p-0.5 rounded transition-colors cursor-pointer shrink-0"
              onClick={onAbout}
              title={aboutLabel || `About ${label} definition`}
              aria-label={aboutLabel || `About ${label} definition`}
            >
              <Info size={13} aria-hidden="true" />
            </button>
          )}
        </div>

        {auditContent ? <button type="button" className="block text-left my-1.5 w-full" onClick={() => setAuditOpen(true)} aria-label={`Inspect evidence: ${label}`}><strong className="cx-metric-value text-2xl lg:text-[28px] font-bold font-mono tracking-tight text-text-main tabular-nums leading-tight">{displayValue}</strong></button> : to ? (
          <Link
            to={to}
            className="block hover:underline hover:text-action transition-colors my-1.5"
            title={inspectLabel ? `${inspectLabel} records for ${label}` : `Inspect ${label}`}
          >
            <strong className="cx-metric-value text-2xl lg:text-[28px] font-bold font-mono tracking-tight text-text-main tabular-nums leading-tight">
              {displayValue}
            </strong>
          </Link>
        ) : onInspect ? (
          <button
            type="button"
            onClick={onInspect}
            className="block text-left hover:text-action transition-colors my-1.5 cursor-pointer w-full"
            title={inspectLabel ? `${inspectLabel} ${label}` : `Inspect ${label}`}
          >
            <strong className="cx-metric-value text-2xl lg:text-[28px] font-bold font-mono tracking-tight text-text-main tabular-nums leading-tight">
              {displayValue}
            </strong>
          </button>
        ) : (
          <strong className="cx-metric-value text-2xl lg:text-[28px] font-bold font-mono tracking-tight text-text-main block my-1.5 tabular-nums leading-tight">
            {displayValue}
          </strong>
        )}

        {(note || hasChange) && (
          <div className="flex items-center gap-2 flex-wrap text-xs mt-1">
            {note && <small className="text-text-sec font-medium">{note}</small>}
            {hasChange && (
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold font-mono tabular-nums leading-none ${
                  isZero
                    ? 'text-text-mute bg-surface-subtle border border-border-subtle'
                    : positive
                    ? 'text-semantic-pos bg-semantic-pos/10'
                    : 'text-semantic-neg bg-semantic-neg/10'
                }`}
              >
                <DeltaIcon size={11} aria-hidden="true" />
                <span>
                  {isPos ? '+' : ''}
                  {change}
                  {changeUnit}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {auditContent && <AuditMetadata metricId={auditContent.metricId} grain={auditContent.definition?.grain || auditContent.provenance?.countingGrain} dateBasis={auditContent.definition?.dateBasis || auditContent.provenance?.dateBasis} validationStatus={auditContent.provenance?.validationStatus} />}
      {hasFooter ? (
        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-border-subtle text-[11px] min-h-[29px] flex-wrap">
          {onWhyChanged && (
            <button
              type="button"
              className="cx-why-btn"
              onClick={onWhyChanged}
              title={`Investigate why ${label.toLowerCase()} changed`}
            >
              <span>{whyLabel}</span>
              <Search size={10} aria-hidden="true" />
            </button>
          )}

          {onWhyChanged && (to || onInspect) && (
            <span className="text-border-strong text-[10px]" aria-hidden="true">·</span>
          )}

          {auditContent && <button type="button" className="cx-inspect-btn" onClick={() => setAuditOpen(true)}>Inspect evidence <ArrowRight size={10} aria-hidden="true" /></button>}
          {to && !auditContent && (
            <Link
              to={to}
              className="cx-inspect-btn"
              title={inspectLabel || `Inspect ${label} records`}
            >
              <span>{inspectLabel}</span>
              <ArrowRight size={10} aria-hidden="true" />
            </Link>
          )}

          {!auditContent && !to && onInspect && (
            <button
              type="button"
              onClick={onInspect}
              className="cx-inspect-btn"
              title={inspectLabel || `Inspect ${label}`}
            >
              <span>{inspectLabel}</span>
              <ArrowRight size={10} aria-hidden="true" />
            </button>
          )}

          {denominatorLabel && (
            <>
              {(onWhyChanged || to || onInspect) && (
                <span className="text-border-strong text-[10px]" aria-hidden="true">·</span>
              )}
              {denominatorLink ? (
                <Link
                  to={denominatorLink}
                  className="inline-flex items-center gap-1 text-text-mute hover:text-text-sec font-medium transition-colors"
                  title="Inspect denominator records"
                >
                  <span>{denominatorLabel}</span>
                </Link>
              ) : onDenominatorClick ? (
                <button
                  type="button"
                  onClick={onDenominatorClick}
                  className="inline-flex items-center gap-1 text-text-mute hover:text-text-sec font-medium transition-colors cursor-pointer"
                  title="Inspect denominator records"
                >
                  <span>{denominatorLabel}</span>
                </button>
              ) : (
                <span className="text-text-mute font-medium">{denominatorLabel}</span>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 pt-2.5 border-t border-transparent min-h-[29px]" aria-hidden="true" />
      )}
      {auditContent && auditOpen && <InspectorHost open={auditOpen} onClose={() => setAuditOpen(false)} content={auditContent} />}
    </article>
  );
}
