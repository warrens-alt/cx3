import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Minus, Info, Search, ArrowRight } from 'lucide-react';
import { Link, type To } from 'react-router-dom';

export interface MetricRailItem {
  id: string;
  label: string;
  value: string;
  change?: string | {
    direction: 'up' | 'down' | 'flat';
    delta: string;
    pctChange?: string;
  } | null;
  comparison?: string;
  note?: string;
  status?: string;
  onWhyChanged?: () => void;
  onInspect?: () => void;
  to?: To;
}

export interface MetricRailProps {
  items: MetricRailItem[];
}

export default function MetricRail({ items }: MetricRailProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-5 sm:mb-6">
      {items.map((item, index) => {
        let changeContent: React.ReactNode = null;
        if (typeof item.change === 'string') {
          const isNeg = item.change.startsWith('-');
          const isZero = item.change === '0.0' || item.change === '0';
          const text = isNeg ? `${item.change}%` : isZero ? '0.0%' : `+${item.change}%`;
          changeContent = (
            <span className={`inline-flex items-center gap-1 font-semibold text-[11px] px-1.5 py-0.5 rounded border ${
              isNeg 
                ? 'bg-rose-50 text-rose-700 border-rose-200/70' 
                : isZero 
                  ? 'bg-slate-100 text-slate-600 border-slate-200' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
            }`}>
              {!isZero && (isNeg ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
              {isZero && <Minus className="w-3 h-3" />}
              <span>{text}</span>
            </span>
          );
        } else if (item.change && typeof item.change === 'object') {
          const isNeg = item.change.direction === 'down';
          const isFlat = item.change.direction === 'flat';
          changeContent = (
            <span className={`inline-flex items-center gap-1 font-semibold text-[11px] px-1.5 py-0.5 rounded border ${
              isNeg 
                ? 'bg-rose-50 text-rose-700 border-rose-200/70' 
                : isFlat 
                  ? 'bg-slate-100 text-slate-600 border-slate-200' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
            }`}>
              {item.change.direction === 'up' && <ArrowUp className="w-3 h-3" />}
              {item.change.direction === 'down' && <ArrowDown className="w-3 h-3" />}
              {item.change.direction === 'flat' && <Minus className="w-3 h-3" />}
              <span>{item.change.pctChange || item.change.delta}</span>
            </span>
          );
        }

        const isLastOdd = items.length % 2 !== 0 && index === items.length - 1;
        const hasFooter = Boolean(item.onWhyChanged || item.onInspect || item.to);

        return (
          <div 
            key={item.id} 
            className={`enterprise-card p-3.5 sm:p-4 flex flex-col justify-between relative group hover:border-action/40 transition-all ${
              isLastOdd ? 'col-span-2 sm:col-span-1' : ''
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider line-clamp-1">
                  {item.label}
                </span>
                {item.note && (
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={`About ${item.label}`}
                      onClick={() => setActiveTooltip(old => old === item.id ? null : item.id)}
                      onMouseEnter={() => setActiveTooltip(item.id)}
                      onMouseLeave={() => setActiveTooltip(null)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    {activeTooltip === item.id && (
                      <div className="absolute right-0 top-6 z-30 w-52 p-2 bg-slate-900 text-white text-[11px] leading-relaxed rounded-md shadow-lg pointer-events-none fade-in">
                        {item.note}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="text-2xl sm:text-[26px] font-bold text-slate-900 mt-1 font-sans tabular-nums tracking-tight tabular-nums">
                {item.value}
              </div>
            </div>

            {(changeContent || item.comparison) && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
                {changeContent || <span />}
                {item.comparison && (
                  <span className="text-slate-400 text-[10px] truncate max-w-[120px] text-right font-medium" title={item.comparison}>
                    {item.comparison}
                  </span>
                )}
              </div>
            )}

            {hasFooter && (
              <div className="mt-2.5 pt-2 border-t border-border-subtle flex items-center gap-2 text-[11px] flex-wrap">
                {item.onWhyChanged && (
                  <button
                    type="button"
                    onClick={item.onWhyChanged}
                    className="cx-why-btn"
                    title={`Why ${item.label.toLowerCase()} changed`}
                  >
                    <span>Why changed?</span>
                    <Search className="w-2.5 h-2.5" />
                  </button>
                )}
                {item.onWhyChanged && (item.to || item.onInspect) && (
                  <span className="text-border-strong text-[10px]">·</span>
                )}
                {item.to ? (
                  <Link
                    to={item.to}
                    className="cx-inspect-btn"
                    title={`Inspect ${item.label}`}
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                ) : item.onInspect ? (
                  <button
                    type="button"
                    onClick={item.onInspect}
                    className="cx-inspect-btn"
                    title={`Inspect ${item.label}`}
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
