import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { OverviewData } from '../lib/offernetClient';
import { formatChartAxis } from '../lib/formatters';

export default function OverviewTrendChart({ data }: { data: OverviewData['dailyTrends'] }) {
  return <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} accessibilityLayer margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
      <defs><linearGradient id="commandLeads" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563EB" stopOpacity={0.18} /><stop offset="95%" stopColor="#2563EB" stopOpacity={0.01} /></linearGradient></defs>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EDF3" />
      <XAxis dataKey="date" tickFormatter={value => String(value).slice(5)} minTickGap={26} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
      <YAxis tickFormatter={formatChartAxis} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} width={46} />
      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #DDE4ED', fontSize: 12 }} />
      <Area type="monotone" dataKey="leads" name="Fetched leads" stroke="#2563EB" strokeWidth={2} fill="url(#commandLeads)" isAnimationActive={false} />
      <Area type="monotone" dataKey="sales" name="Sales" stroke="#0F766E" strokeWidth={2} fillOpacity={0} isAnimationActive={false} />
    </AreaChart>
  </ResponsiveContainer>;
}
