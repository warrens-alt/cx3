import React, { useState, useEffect, useMemo } from 'react';
import {
  CircleDollarSign,
  TrendingUp,
  Sliders,
  Building,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Zap,
  Info,
  DollarSign,
} from 'lucide-react';

interface GradePricing {
  gradeA: number;
  gradeB: number;
  gradeC: number;
  gradeD: number;
  gradeE: number;
  gradeF: number;
}

interface VendorYieldItem {
  vendor: string;
  cpl: number;
  cpa: number;
  rpcRate: number;
  deliveryRate: number;
  netYieldMargin: number;
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  activeVolume: number;
  contractStatus: 'CAP_MAX' | 'ACTIVE' | 'UNDER_REVIEW';
}

const DEFAULT_RATES: GradePricing = {
  gradeA: 35.00,
  gradeB: 24.00,
  gradeC: 16.50,
  gradeD: 8.00,
  gradeE: 6.00,
  gradeF: 4.50,
};

const GRADE_VOLUMES = [
  { grade: 'Grade A', label: 'Prime Bureau Verified (700+ Score)', count: 31968, key: 'gradeA' as const },
  { grade: 'Grade B', label: 'Near Prime Validated (620-699 Score)', count: 50740, key: 'gradeB' as const },
  { grade: 'Grade C', label: 'Mid-Tier Performing (540-619 Score)', count: 104395, key: 'gradeC' as const },
  { grade: 'Grade D', label: 'Subprime Dialler Fit (Debt Review Safe)', count: 23622, key: 'gradeD' as const },
  { grade: 'Grade E', label: 'Retail Value Mass Funnel', count: 81434, key: 'gradeE' as const },
  { grade: 'Grade F', label: 'Low Propensity Cohort', count: 19881, key: 'gradeF' as const },
  { grade: 'Unassigned', label: 'Imputed Post-Intake Records', count: 38533, key: null },
];

export default function RateCardModule() {
  const [rates, setRates] = useState<GradePricing>(DEFAULT_RATES);
  const [shiftPercentage, setShiftPercentage] = useState<number>(25);
  const [vendors, setVendors] = useState<VendorYieldItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/commercial/simulator')
      .then(res => res.json())
      .then(json => {
        if (!active) return;
        if (json.success) {
          if (json.vendorYieldRanking) setVendors(json.vendorYieldRanking);
        }
      })
      .catch(err => console.warn('Failed to load commercial simulator:', err))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Recalculate financial model in real time
  const financial = useMemo(() => {
    const totalLeads = 350573;
    let totalGross = 0;

    const breakdown = GRADE_VOLUMES.map(item => {
      const price = item.key ? rates[item.key] : 12.00;
      const subtotal = item.count * price;
      totalGross += subtotal;
      return {
        ...item,
        price,
        subtotal,
        share: Number(((item.count / totalLeads) * 100).toFixed(1)),
      };
    });

    const mediaCost = Math.round(totalLeads * 5.25);
    const netMargin = totalGross - mediaCost;
    const marginPct = Number(((netMargin / totalGross) * 100).toFixed(1));
    const avgYield = Number((totalGross / totalLeads).toFixed(2));

    return {
      breakdown,
      totalLeads,
      totalGross,
      mediaCost,
      netMargin,
      marginPct,
      avgYield,
    };
  }, [rates]);

  // Traffic reallocation calculations
  const reallocation = useMemo(() => {
    const shift = Math.max(0, Math.min(50, shiftPercentage));
    const reallocatedVolume = Math.round((shift / 100) * 38400);
    const incrementalProfit = shift * 14300; // R 14,300 per 1% shifted
    const blendedYieldBefore = 13.95;
    const blendedYieldAfter = Number((13.95 + shift * 0.082).toFixed(2));

    const recs: string[] = [];
    if (shift <= 15) {
      recs.push(
        'Initial test reallocation: divert 10% Facebook Grade C traffic from generic dialers to Lewis Group high-touch queue.',
        'Benchmark contact frequency and verify telecom dialer pickup rates across peak 10:00-14:00 hours.'
      );
    } else if (shift <= 35) {
      recs.push(
        'Scale Grade B routing: enforce cap-and-collar contracts on MTN / Mondo routes to guarantee 65%+ Right Party Contact thresholds.',
        'Divert unallocated affiliate lead flows into Rewardsco motor warranty campaign (+R 357,500/month incremental yield).'
      );
    } else {
      recs.push(
        'Aggressive commercial yield pivot: maximize Grade A allocation to Rewardsco and Lewis Group; deprioritize unvetted Grade D affiliates to capture +R 715,000/mo incremental margin.',
        `Net blended lead yield scales to R ${blendedYieldAfter.toFixed(2)} / lead (+${((blendedYieldAfter - blendedYieldBefore) / blendedYieldBefore * 100).toFixed(1)}% yield expansion).`,
        'Enforce automated API webhook throttling on vendors failing the 91.4% delivery SLA.'
      );
    }

    return {
      shift,
      reallocatedVolume,
      incrementalProfit,
      blendedYieldBefore,
      blendedYieldAfter,
      recs,
    };
  }, [shiftPercentage]);

  const handleRateChange = (key: keyof GradePricing, val: string) => {
    const num = parseFloat(val) || 0;
    setRates(prev => ({ ...prev, [key]: num }));
  };

  const handleReset = () => {
    setRates(DEFAULT_RATES);
    setShiftPercentage(25);
  };

  const handlePreset = (preset: 'aggressive' | 'standard' | 'volume') => {
    if (preset === 'aggressive') {
      setRates({
        gradeA: 42.00,
        gradeB: 28.50,
        gradeC: 19.00,
        gradeD: 10.00,
        gradeE: 7.50,
        gradeF: 5.00,
      });
      setShiftPercentage(45);
    } else if (preset === 'volume') {
      setRates({
        gradeA: 32.00,
        gradeB: 22.00,
        gradeC: 15.00,
        gradeD: 7.00,
        gradeE: 5.50,
        gradeF: 4.00,
      });
      setShiftPercentage(15);
    } else {
      setRates(DEFAULT_RATES);
      setShiftPercentage(25);
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-600 bg-neutral-100 border border-neutral-300 px-2 py-0.5 rounded">
              Module 03
            </span>
            <span className="text-xs text-neutral-500 font-mono">· Commercial Monetization</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 mt-1">
            Illustrative Rate Card Scenario
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Illustrative scenario using fixed populations and cost assumptions, including R5.25 media cost. Calculated outputs are not observed spend, revenue or verified profitability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-neutral-300 text-xs font-medium text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reset to Standard</span>
          </button>
        </div>
      </div>

      {/* TOP SECTION: LIVE FINANCIAL SIMULATOR CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-neutral-200 space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 font-medium">
            Scenario Gross Value
          </span>
          <strong className="text-2xl font-bold font-mono text-neutral-900 block mt-1">
            R {financial.totalGross.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
          </strong>
          <span className="text-[11px] text-neutral-500 block">Avg R {financial.avgYield} / lead</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-neutral-200 space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 font-medium">
            Estimated Media Cost
          </span>
          <strong className="text-2xl font-bold font-mono text-neutral-800 block mt-1">
            R {financial.mediaCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
          </strong>
          <span className="text-[11px] text-neutral-500 block">R 5.25 avg acquisition CPA</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-neutral-200 space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
            Net Commercial Margin
          </span>
          <strong className="text-2xl font-bold font-mono text-neutral-900 block mt-1">
            R {financial.netMargin.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
          </strong>
          <span className="text-[11px] text-neutral-500 block">Gross revenue spread</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-neutral-200 space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 font-medium">
            Commercial Yield Margin %
          </span>
          <strong className="text-2xl font-bold font-mono text-neutral-900 block mt-1">
            {financial.marginPct}%
          </strong>
          <span className="text-[11px] text-neutral-500 block">Return on gross media</span>
        </div>
      </div>

      {/* CONFIGURABLE GRADE PRICING MATRIX & BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pricing Matrix Inputs */}
        <div className="bg-white p-5 rounded-lg border border-neutral-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 tracking-tight">Grade Pricing Matrix (ZAR)</h3>
              <p className="text-xs text-neutral-500">Example payout assumption per delivered lead</p>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-neutral-500">Presets:</span>
            <button
              type="button"
              onClick={() => handlePreset('standard')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 transition-colors"
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => handlePreset('aggressive')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-900 text-white transition-colors"
            >
              Aggressive
            </button>
            <button
              type="button"
              onClick={() => handlePreset('volume')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 transition-colors"
            >
              Volume
            </button>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-800">
                <label htmlFor="rate-input-gradeA">Grade A (Prime 700+)</label>
                <span className="font-mono text-neutral-900 font-bold">R {rates.gradeA.toFixed(2)}</span>
              </div>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-400">R</span>
                <input
                  id="rate-input-gradeA"
                  type="number"
                  step="0.50"
                  value={rates.gradeA}
                  onChange={e => handleRateChange('gradeA', e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs font-mono bg-white border border-neutral-300 rounded text-neutral-900 focus:outline-neutral-900"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-800">
                <label htmlFor="rate-input-gradeB">Grade B (Near Prime)</label>
                <span className="font-mono text-neutral-900 font-bold">R {rates.gradeB.toFixed(2)}</span>
              </div>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-400">R</span>
                <input
                  id="rate-input-gradeB"
                  type="number"
                  step="0.50"
                  value={rates.gradeB}
                  onChange={e => handleRateChange('gradeB', e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs font-mono bg-white border border-neutral-300 rounded text-neutral-900 focus:outline-neutral-900"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-800">
                <label htmlFor="rate-input-gradeC">Grade C (Subprime)</label>
                <span className="font-mono text-neutral-900 font-bold">R {rates.gradeC.toFixed(2)}</span>
              </div>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-400">R</span>
                <input
                  id="rate-input-gradeC"
                  type="number"
                  step="0.50"
                  value={rates.gradeC}
                  onChange={e => handleRateChange('gradeC', e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs font-mono bg-white border border-neutral-300 rounded text-neutral-900 focus:outline-neutral-900"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-800">
                <label htmlFor="rate-input-gradeD">Grade D (Floor Fit)</label>
                <span className="font-mono text-neutral-900 font-bold">R {rates.gradeD.toFixed(2)}</span>
              </div>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-400">R</span>
                <input
                  id="rate-input-gradeD"
                  type="number"
                  step="0.50"
                  value={rates.gradeD}
                  onChange={e => handleRateChange('gradeD', e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs font-mono bg-white border border-neutral-300 rounded text-neutral-900 focus:outline-neutral-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Grade Breakdown Table */}
        <div className="lg:col-span-2 bg-white p-5 rounded-lg border border-neutral-200 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 tracking-tight">Grade Tier Revenue Breakdown</h3>
            <p className="text-xs text-neutral-500">Volume and projected gross yield by commercial grade</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="border-b border-neutral-200 text-neutral-500 font-mono text-[10.5px] uppercase">
                <tr>
                  <th className="py-2 pr-3">Commercial Grade</th>
                  <th className="py-2 px-3 text-right">Volume</th>
                  <th className="py-2 px-3 text-right">Share %</th>
                  <th className="py-2 px-3 text-right">Unit Rate</th>
                  <th className="py-2 pl-3 text-right">Gross Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {financial.breakdown.map(item => (
                  <tr key={item.grade} className="hover:bg-neutral-50">
                    <td className="py-2.5 pr-3">
                      <strong className="font-semibold text-neutral-900 block font-mono">{item.grade}</strong>
                      <span className="text-[11px] text-neutral-500 block">{item.label}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-neutral-800">
                      {item.count.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-neutral-500">
                      {item.share}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-neutral-900">
                      R {item.price.toFixed(2)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono font-bold text-neutral-900">
                      R {item.subtotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* YIELD & ROUTE OPTIMIZATION ENGINE */}
      <div className="bg-white p-6 rounded-lg border border-neutral-200 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-neutral-700" />
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-600 font-semibold">
              Route Optimization Engine
            </span>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 mt-1">
            Lead Traffic Reallocation & Vendor Yield Simulation
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Shift underperforming Grade C/D volume to top-tier partners (Lewis Group, Rewardsco, MTN) to unlock up to +R 715,000/month
          </p>
        </div>

        {/* Interactive Slider & Profit Callout */}
        <div className="bg-neutral-950 text-white p-6 rounded-xl border border-neutral-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono uppercase text-neutral-400 font-semibold tracking-wider">
                Traffic Reallocation Lever (0% to 50%)
              </span>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {shiftPercentage}% Shift to Top-Tier Routes
              </div>
            </div>

            <div className="text-right sm:text-right">
              <span className="text-xs font-mono uppercase text-neutral-400 font-semibold tracking-wider">
                Illustrative Incremental Value
              </span>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                +R {reallocation.incrementalProfit.toLocaleString('en-ZA')}/month
              </div>
            </div>
          </div>

          {/* Slider Control */}
          <div className="space-y-2 pt-2">
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={shiftPercentage}
              onChange={e => setShiftPercentage(Number(e.target.value))}
              className="w-full h-2 bg-neutral-800 rounded appearance-none cursor-pointer accent-white"
            />
            <div className="flex justify-between text-[11px] font-mono text-neutral-400">
              <span>0% Baseline (R 0)</span>
              <span>25% Moderate (+R 357,500/mo)</span>
              <span>50% Max Yield (+R 715,000/mo)</span>
            </div>
          </div>

          {/* Dynamic Reallocation Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-800 text-xs">
            <div>
              <span className="text-neutral-400 text-[11px]">Reallocated Volume:</span>
              <strong className="block font-mono text-white mt-0.5">
                {reallocation.reallocatedVolume.toLocaleString()} leads/mo
              </strong>
            </div>
            <div>
              <span className="text-neutral-400 text-[11px]">Blended Yield Before:</span>
              <strong className="block font-mono text-neutral-300 mt-0.5">
                R {reallocation.blendedYieldBefore.toFixed(2)} / lead
              </strong>
            </div>
            <div>
              <span className="text-neutral-400 text-[11px]">Blended Yield After:</span>
              <strong className="block font-mono text-white mt-0.5">
                R {reallocation.blendedYieldAfter.toFixed(2)} / lead
              </strong>
            </div>
            <div>
              <span className="text-neutral-400 text-[11px]">Yield Lift:</span>
              <strong className="block font-mono text-white mt-0.5">
                +{((reallocation.blendedYieldAfter - reallocation.blendedYieldBefore) / reallocation.blendedYieldBefore * 100).toFixed(1)}% Expansion
              </strong>
            </div>
          </div>
        </div>

        {/* Dynamic Scenario Notes */}
        <div className="p-4 rounded-lg bg-neutral-100 border border-neutral-200 space-y-2">
          <span className="text-xs font-bold text-neutral-900 tracking-tight flex items-center gap-1.5">
            <Zap size={14} className="text-neutral-700" />
            Tactical Media Buyer & Routing Recommendations:
          </span>
          <ul className="space-y-1.5 pl-2">
            {reallocation.recs.map((rec, i) => (
              <li key={i} className="text-xs text-neutral-700 flex items-start gap-2">
                <span className="text-neutral-900 font-bold shrink-0">·</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Per-Vendor Yield Ranking Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 tracking-tight">Per-Vendor Yield Ranking & Efficiency</h3>
            <span className="text-xs text-neutral-500 font-mono">Contract SLA Benchmarks</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-neutral-50 border-y border-neutral-200 text-neutral-600 font-mono text-[10.5px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Partner Vendor</th>
                  <th className="py-2.5 px-3">Tier</th>
                  <th className="py-2.5 px-3 text-right">Agreed CPL</th>
                  <th className="py-2.5 px-3 text-right">Scenario CPA</th>
                  <th className="py-2.5 px-3 text-right">RPC Rate %</th>
                  <th className="py-2.5 px-3 text-right">Delivery %</th>
                  <th className="py-2.5 px-3 text-right">Net Yield Margin</th>
                  <th className="py-2.5 pl-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {vendors.map(v => (
                  <tr key={v.vendor} className="hover:bg-neutral-50">
                    <td className="py-2.5 px-3 font-semibold text-neutral-900 flex items-center gap-1.5">
                      <Building size={13} className="text-neutral-500" />
                      {v.vendor}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded font-semibold bg-neutral-100 text-neutral-800 border border-neutral-300">
                        {v.tier}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-neutral-800">
                      R {v.cpl.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-neutral-800">
                      R {v.cpa.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900">
                      {v.rpcRate}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-neutral-900 font-semibold">
                      {v.deliveryRate}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900">
                      {v.netYieldMargin}%
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono text-[10.5px]">
                      <span className="font-semibold px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-300">
                        {v.contractStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
