import React from 'react';
import { Eye, MousePointer2, MousePointerClick, FileCheck2 } from 'lucide-react';
import type { CampaignData } from '../../lib/offernetClient';
import { formatPercent, formatTableNumber } from '../../lib/formatters';
import AttributionBoundary from '../commercial/AttributionBoundary';

export default function AcquisitionFlow({ data }: { data: CampaignData }) {
  const { summary } = data;
  if (!summary) return null;
  const hasOutbound = summary.outboundClicks != null;
  const nodes = [
    { label: 'Impressions', value: summary.impressions, Icon: Eye, ratio: summary.ctr, ratioLabel: 'CTR · clicks / impressions' },
    { label: 'Clicks', value: summary.clicks, Icon: MousePointer2, ratio: hasOutbound ? undefined : summary.clickToLeadRate, ratioLabel: 'Platform events / clicks' },
    ...(hasOutbound ? [{ label: 'Outbound clicks', value: summary.outboundClicks, Icon: MousePointerClick, ratio: summary.clickToLeadRate, ratioLabel: 'Platform events / outbound clicks' }] : []),
    { label: 'Platform lead events', value: summary.leads, Icon: FileCheck2, ratio: undefined, ratioLabel: '' },
  ];
  return <section className="cx-acquisition-flow enterprise-card" aria-label="Marketing platform conversion strip">
    <header><span className="cx-command-section-kicker">Platform engagement</span><h2>From impressions to platform lead events</h2><p>Returned platform counts and ratios. Platform lead events are separate from operational fetched leads.</p></header>
    <ol className="cx-platform-flow">{nodes.map((node, index) => <li key={node.label} data-state={node.value == null ? 'unavailable' : 'observed'}>
      <node.Icon size={21} aria-hidden="true" /><span>{node.label}</span><strong>{formatTableNumber(node.value)}</strong>
      {node.value == null && <small>Unavailable</small>}
      {index < nodes.length - 1 && <div className="cx-platform-transition"><span aria-hidden="true">→</span>
        {node.ratio !== undefined && <span><b>{node.ratio == null ? 'Unavailable' : formatPercent(node.ratio)}</b><small>{node.ratioLabel}</small></span>}
      </div>}
    </li>)}</ol>
    <AttributionBoundary state={data.funnelStatus?.status === 'UNAVAILABLE' || data.attribution?.status !== 'ACTIVE' ? 'unavailable' : 'unverified'}
      label={data.funnelStatus?.status === 'UNAVAILABLE' || data.attribution?.status !== 'ACTIVE' ? 'Campaign attribution unavailable' : 'Attribution configured · matches unverified'}
      detail={data.funnelStatus?.reason || data.attribution?.reason || 'No matched operational population is returned at campaign/adset grain.'} />
  </section>;
}
