import React, { useId, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

/** Focus promotes the same mounted subtree. It never duplicates charts, evidence or queries. */
export default function ChartFrame({ title, subtitle, controls, actions, footer, scope, children, className = '', focusable = true, header }: {
  title: string; subtitle?: React.ReactNode; controls?: React.ReactNode; actions?: React.ReactNode;
  footer?: React.ReactNode; scope?: React.ReactNode; children: React.ReactNode; className?: string;
  focusable?: boolean; header?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const id = useId();
  const ref = useDialogAccessibility<HTMLElement>(focused, () => setFocused(false));
  return <section ref={ref} className={`cx-chart-frame ${className}${focused ? ' is-focused' : ''}`}
    role={focused ? 'dialog' : 'region'} aria-modal={focused || undefined} aria-label={title} tabIndex={focused ? -1 : undefined}>
    <header className="cx-chart-frame-header">
      {header || <div className="cx-chart-frame-copy"><h3 id={id}>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>}
      <div className="cx-chart-frame-actions">{controls}{actions}{focusable && <button type="button" className="cx-button-quiet cx-chart-focus-toggle"
        aria-label={focused ? `Close focus: ${title}` : `Focus: ${title}`} aria-pressed={focused}
        onClick={() => setFocused(value => !value)}>
        {focused ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}<span>{focused ? 'Close focus' : 'Focus'}</span>
      </button>}</div>
    </header>
    {focused && scope && <div className="cx-chart-focus-scope">{scope}</div>}
    <div className="cx-chart-frame-region">{children}</div>
    {footer && <footer className="cx-chart-frame-footer">{footer}</footer>}
  </section>;
}
