import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClient } from '../lib/ClientContext';
import { useFilters } from '../lib/FilterContext';
import { fetchAnalyticsJson } from '../lib/useAnalyticsData';
import { invalidateOffernetCache } from '../lib/offernetClient';
import { Calendar, Filter, RefreshCw, Download, ChevronDown, Check, X, Layers, Tag, Search } from 'lucide-react';

interface OffernetFilterBarProps {
  onRefresh?: () => void;
  onExportCsv?: () => void;
  showVendorFilter?: boolean;
  showSourceFilter?: boolean;
  showGradeFilter?: boolean;
}

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const startOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const startOfQuarter = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1));
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

export function buildPeriodPresets(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = startOfMonth(today);
  const previousMonthEnd = addDays(monthStart, -1);
  const previousMonthStart = startOfMonth(previousMonthEnd);
  const weekday = today.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const weekStart = addDays(today, mondayOffset);
  const quarterStart = startOfQuarter(today);

  return [
    { id: 'all', label: 'All Time (Total - Unfiltered)', start: '', end: '' },
    { id: 'mtd', label: 'Month to Date', start: dateOnly(monthStart), end: dateOnly(today) },
    { id: 'previous_month', label: 'Previous Full Month', start: dateOnly(previousMonthStart), end: dateOnly(previousMonthEnd) },
    { id: 'wtd', label: 'Week to Date', start: dateOnly(weekStart), end: dateOnly(today) },
    { id: 'last7', label: 'Last 7 Days', start: dateOnly(addDays(today, -6)), end: dateOnly(today) },
    { id: 'last30', label: 'Last 30 Days', start: dateOnly(addDays(today, -29)), end: dateOnly(today) },
    { id: 'today', label: 'Today', start: dateOnly(today), end: dateOnly(today) },
    { id: 'qtd', label: 'Quarter to Date', start: dateOnly(quarterStart), end: dateOnly(today) },
  ];
}

export const PERIOD_PRESETS = buildPeriodPresets();

export const VENDOR_OPTIONS = [
  'All Vendors',
  'Ontact - BLC',
  'Mondo',
  'MTN',
  'Ontact - Vodacom (BizVoip)',
  'Real Promotions',
  'RewardsCo - Motor Warranty',
  'One Plan - Health',
  'One Plan - Pet',
  'Hospital - INDo Fix'
];

export const SOURCE_OPTIONS = [
  'All Sources',
  'Facebook',
  'Google Ads',
  'TikTok',
  'Affiliate',
  'SMS Inbound',
  'Organic Web',
  'Email'
];

export const GRADE_OPTIONS = [
  'All Grades',
  'Gold',
  'Silver',
  'Bronze',
  'Standard'
];

export const OffernetFilterBar: React.FC<OffernetFilterBarProps> = ({
  onRefresh,
  onExportCsv,
  showVendorFilter = true,
  showSourceFilter = true,
  showGradeFilter = true
}) => {
  const { clients, selectedClient, setSelectedClient } = useClient();
  const { 
    startDate, 
    endDate, 
    setDateRange, 
    filters, 
    setFilter, 
    clearFilters,
    appliedFilters,
    activeFilterCount 
  } = useFilters();

  const [presetDropdown, setPresetDropdown] = useState(false);
  const [vendorDropdown, setVendorDropdown] = useState(false);
  const [sourceDropdown, setSourceDropdown] = useState(false);
  const [gradeDropdown, setGradeDropdown] = useState(false);
  const [customDates, setCustomDates] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [vendorSearch, setVendorSearch] = useState('');
  const [sourceSearch, setSourceSearch] = useState('');
  const [gradeSearch, setGradeSearch] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch dynamic filter options from warehouse metadata if available
  const filterOptionsQuery = useQuery({
    queryKey: ['filter-options', selectedClient, startDate, endDate],
    queryFn: ({ signal }) => {
      const q = new URLSearchParams({ clientId: selectedClient || 'default_tenant' });
      if (startDate) q.set('startDate', startDate);
      if (endDate) q.set('endDate', endDate);
      return fetchAnalyticsJson(`/api/analytics/filter-options?${q.toString()}`, signal);
    },
    staleTime: 120000,
    retry: false,
  });

  const apiData = filterOptionsQuery.data?.data;

  // Selected values
  const selectedVendor = useMemo(() => {
    const v = filters.vendor;
    if (!v) return 'All Vendors';
    if (v.operator === 'in' && Array.isArray(v.values) && v.values.length > 0) return String(v.values[0]);
    if (v.operator === 'equals' && v.value !== undefined) return String(v.value);
    return 'All Vendors';
  }, [filters.vendor]);

  const selectedSource = useMemo(() => {
    const s = filters.source;
    if (!s) return 'All Sources';
    if (s.operator === 'in' && Array.isArray(s.values) && s.values.length > 0) return String(s.values[0]);
    if (s.operator === 'equals' && s.value !== undefined) return String(s.value);
    return 'All Sources';
  }, [filters.source]);

  const selectedGrade = useMemo(() => {
    const g = filters.grade;
    if (!g) return 'All Grades';
    if (g.operator === 'in' && Array.isArray(g.values) && g.values.length > 0) return String(g.values[0]);
    if (g.operator === 'equals' && g.value !== undefined) return String(g.value);
    return 'All Grades';
  }, [filters.grade]);

  // Combined options lists (default presets + dynamic API options)
  const vendorOptions = useMemo(() => {
    const set = new Set<string>(['All Vendors', ...VENDOR_OPTIONS]);
    if (apiData?.vendors && Array.isArray(apiData.vendors)) {
      apiData.vendors.forEach((item: any) => {
        const val = typeof item === 'string' ? item : item.value || item.label;
        if (val) set.add(String(val));
      });
    }
    if (selectedVendor && selectedVendor !== 'All Vendors') set.add(selectedVendor);
    return Array.from(set);
  }, [apiData?.vendors, selectedVendor]);

  const sourceOptions = useMemo(() => {
    const set = new Set<string>(['All Sources', ...SOURCE_OPTIONS]);
    if (apiData?.sources && Array.isArray(apiData.sources)) {
      apiData.sources.forEach((item: any) => {
        const val = typeof item === 'string' ? item : item.value || item.label;
        if (val) set.add(String(val));
      });
    }
    if (selectedSource && selectedSource !== 'All Sources') set.add(selectedSource);
    return Array.from(set);
  }, [apiData?.sources, selectedSource]);

  const gradeOptions = useMemo(() => {
    const set = new Set<string>(['All Grades', ...GRADE_OPTIONS]);
    if (apiData?.grades && Array.isArray(apiData.grades)) {
      apiData.grades.forEach((item: any) => {
        const val = typeof item === 'string' ? item : item.value || item.label;
        if (val) set.add(String(val));
      });
    }
    if (selectedGrade && selectedGrade !== 'All Grades') set.add(selectedGrade);
    return Array.from(set);
  }, [apiData?.grades, selectedGrade]);

  const currentPreset = (!startDate && !endDate)
    ? PERIOD_PRESETS[0]
    : PERIOD_PRESETS.find(p => p.start === startDate && p.end === endDate);

  // Close dropdowns on outside click or Esc
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPresetDropdown(false);
        setVendorDropdown(false);
        setSourceDropdown(false);
        setGradeDropdown(false);
        setVendorSearch('');
        setSourceSearch('');
        setGradeSearch('');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPresetDropdown(false);
        setVendorDropdown(false);
        setSourceDropdown(false);
        setGradeDropdown(false);
        setVendorSearch('');
        setSourceSearch('');
        setGradeSearch('');
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelectPreset = (preset: typeof PERIOD_PRESETS[0]) => {
    setDateRange(preset.start, preset.end);
    setPresetDropdown(false);
    setCustomDates(false);
  };

  const handleSelectVendor = (v: string) => {
    if (v === 'All Vendors' || !v) {
      setFilter('vendor', null);
    } else {
      setFilter('vendor', { operator: 'in', values: [v] });
    }
    setVendorDropdown(false);
    setVendorSearch('');
  };

  const handleSelectSource = (s: string) => {
    if (s === 'All Sources' || !s) {
      setFilter('source', null);
    } else {
      setFilter('source', { operator: 'in', values: [s] });
    }
    setSourceDropdown(false);
    setSourceSearch('');
  };

  const handleSelectGrade = (g: string) => {
    if (g === 'All Grades' || !g) {
      setFilter('grade', null);
    } else {
      setFilter('grade', { operator: 'in', values: [g] });
    }
    setGradeDropdown(false);
    setGradeSearch('');
  };

  const handleRefreshClick = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    invalidateOffernetCache();
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredVendors = useMemo(() => {
    if (!vendorSearch.trim()) return vendorOptions;
    const q = vendorSearch.toLowerCase();
    return vendorOptions.filter(v => v === 'All Vendors' || v.toLowerCase().includes(q));
  }, [vendorOptions, vendorSearch]);

  const filteredSources = useMemo(() => {
    if (!sourceSearch.trim()) return sourceOptions;
    const q = sourceSearch.toLowerCase();
    return sourceOptions.filter(s => s === 'All Sources' || s.toLowerCase().includes(q));
  }, [sourceOptions, sourceSearch]);

  const filteredGrades = useMemo(() => {
    if (!gradeSearch.trim()) return gradeOptions;
    const q = gradeSearch.toLowerCase();
    return gradeOptions.filter(g => g === 'All Grades' || g.toLowerCase().includes(q));
  }, [gradeOptions, gradeSearch]);

  return (
    <div 
      ref={containerRef} 
      className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5 flex flex-col gap-2 text-xs shadow-2xs sticky top-0 z-40 transition-all duration-150 overflow-visible"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 overflow-visible">
        {/* Filter controls row with full overflow visibility and neat wrapping */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 overflow-visible">
          {/* Workspace / Client Selector */}
          <div className="flex items-center shrink-0 gap-1.5 border border-slate-200/90 rounded-md px-2.5 py-1.5 bg-slate-50/80 text-slate-700 min-h-[34px]">
            <span className="font-mono font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Client:</span>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="bg-transparent font-medium text-slate-900 focus:outline-none cursor-pointer max-w-[130px] sm:max-w-none truncate text-xs"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date Preset Selector */}
          <div className={`relative shrink-0 ${presetDropdown ? 'z-50' : 'z-20'}`}>
            <button
              type="button"
              aria-expanded={presetDropdown}
              aria-haspopup="true"
              onClick={() => {
                setPresetDropdown(o => !o);
                setVendorDropdown(false);
                setSourceDropdown(false);
                setGradeDropdown(false);
              }}
              className="flex items-center gap-1.5 border border-slate-200/90 rounded-md px-3 sm:px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 font-medium transition-colors cursor-pointer min-h-[34px] shadow-2xs"
            >
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <span className="max-w-[140px] sm:max-w-none truncate">
                {currentPreset ? currentPreset.label : (startDate && endDate ? `${startDate} → ${endDate}` : 'All Time (Total - Unfiltered)')}
              </span>
              <ChevronDown size={12} className={`text-slate-400 ml-0.5 sm:ml-1 shrink-0 transition-transform ${presetDropdown ? 'rotate-180' : ''}`} />
            </button>

            {presetDropdown && (
              <div className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1.5 ring-1 ring-black/5 max-h-80 overflow-y-auto max-w-[calc(100vw-24px)]">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Operational Periods
                </div>
                {PERIOD_PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center justify-between text-xs cursor-pointer ${
                      p.start === startDate && p.end === endDate ? 'font-semibold text-blue-700 bg-blue-50/60' : 'text-slate-700'
                    }`}
                  >
                    <span>{p.label}</span>
                    {p.start === startDate && p.end === endDate && <Check size={13} className="text-blue-600 shrink-0" />}
                  </button>
                ))}
                <div className="border-t border-slate-100 my-1"></div>
                <button
                  type="button"
                  onClick={() => { setCustomDates(true); setPresetDropdown(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 text-blue-600 text-xs font-medium cursor-pointer flex items-center gap-1.5"
                >
                  <Calendar size={12} />
                  <span>Custom Date Range…</span>
                </button>
              </div>
            )}
          </div>

          {/* Custom date range inputs */}
          {customDates && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 min-h-[34px]">
              <input
                type="date"
                value={startDate}
                onChange={e => setDateRange(e.target.value, endDate)}
                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setDateRange(startDate, e.target.value)}
                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800"
              />
              <button
                type="button"
                onClick={() => setCustomDates(false)}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer ml-0.5"
                title="Hide custom date range"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Vendor Filter */}
          {showVendorFilter && (
            <div className={`relative shrink-0 ${vendorDropdown ? 'z-50' : 'z-20'}`}>
              <button
                type="button"
                aria-expanded={vendorDropdown}
                aria-haspopup="true"
                onClick={() => {
                  setVendorDropdown(o => !o);
                  setPresetDropdown(false);
                  setSourceDropdown(false);
                  setGradeDropdown(false);
                }}
                className={`flex items-center gap-1.5 border rounded px-3 sm:px-2.5 py-1.5 font-medium transition-colors cursor-pointer min-h-[38px] sm:min-h-[34px] ${
                  selectedVendor !== 'All Vendors' 
                    ? 'border-blue-300 bg-blue-50/70 text-blue-800 shadow-2xs' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                <Filter size={13} className={selectedVendor !== 'All Vendors' ? 'text-blue-600' : 'text-slate-500'} />
                <span className="max-w-[120px] sm:max-w-none truncate">{selectedVendor === 'All Vendors' ? 'Vendor' : selectedVendor}</span>
                <ChevronDown size={12} className={`text-slate-400 ml-0.5 sm:ml-1 transition-transform ${vendorDropdown ? 'rotate-180' : ''}`} />
              </button>

              {vendorDropdown && (
                <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1.5 ring-1 ring-black/5 max-h-80 overflow-y-auto max-w-[calc(100vw-24px)]">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                    <span>Filter Vendor</span>
                    {selectedVendor !== 'All Vendors' && (
                      <button
                        type="button"
                        onClick={() => handleSelectVendor('All Vendors')}
                        className="text-blue-600 hover:underline cursor-pointer lowercase"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  {vendorOptions.length > 7 && (
                    <div className="p-1.5 border-b border-slate-100 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search size={11} className="absolute left-2 top-2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search vendors…"
                          value={vendorSearch}
                          onChange={e => setVendorSearch(e.target.value)}
                          className="w-full pl-6 pr-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500 bg-slate-50"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  )}
                  <div className="py-1">
                    {filteredVendors.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleSelectVendor(v)}
                        className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between text-xs cursor-pointer ${
                          selectedVendor === v ? 'font-semibold text-blue-700 bg-blue-50/60' : 'text-slate-700'
                        }`}
                      >
                        <span className="truncate mr-2">{v}</span>
                        {selectedVendor === v && <Check size={13} className="text-blue-600 shrink-0" />}
                      </button>
                    ))}
                    {filteredVendors.length === 0 && (
                      <div className="px-3 py-3 text-center text-slate-400 text-xs">
                        No matching vendors
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Source Filter */}
          {showSourceFilter && (
            <div className={`relative shrink-0 ${sourceDropdown ? 'z-50' : 'z-20'}`}>
              <button
                type="button"
                aria-expanded={sourceDropdown}
                aria-haspopup="true"
                onClick={() => {
                  setSourceDropdown(o => !o);
                  setPresetDropdown(false);
                  setVendorDropdown(false);
                  setGradeDropdown(false);
                }}
                className={`flex items-center gap-1.5 border rounded px-3 sm:px-2.5 py-1.5 font-medium transition-colors cursor-pointer min-h-[38px] sm:min-h-[34px] ${
                  selectedSource !== 'All Sources' 
                    ? 'border-blue-300 bg-blue-50/70 text-blue-800 shadow-2xs' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                <Layers size={13} className={selectedSource !== 'All Sources' ? 'text-blue-600' : 'text-slate-500'} />
                <span className="max-w-[120px] sm:max-w-none truncate">{selectedSource === 'All Sources' ? 'Source' : selectedSource}</span>
                <ChevronDown size={12} className={`text-slate-400 ml-0.5 sm:ml-1 transition-transform ${sourceDropdown ? 'rotate-180' : ''}`} />
              </button>

              {sourceDropdown && (
                <div className="absolute right-0 sm:right-auto sm:left-0 top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1.5 ring-1 ring-black/5 max-h-80 overflow-y-auto max-w-[calc(100vw-24px)]">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                    <span>Lead Source</span>
                    {selectedSource !== 'All Sources' && (
                      <button
                        type="button"
                        onClick={() => handleSelectSource('All Sources')}
                        className="text-blue-600 hover:underline cursor-pointer lowercase"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  {sourceOptions.length > 7 && (
                    <div className="p-1.5 border-b border-slate-100 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search size={11} className="absolute left-2 top-2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search sources…"
                          value={sourceSearch}
                          onChange={e => setSourceSearch(e.target.value)}
                          className="w-full pl-6 pr-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500 bg-slate-50"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  )}
                  <div className="py-1">
                    {filteredSources.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSelectSource(s)}
                        className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between text-xs cursor-pointer ${
                          selectedSource === s ? 'font-semibold text-blue-700 bg-blue-50/60' : 'text-slate-700'
                        }`}
                      >
                        <span className="truncate mr-2">{s}</span>
                        {selectedSource === s && <Check size={13} className="text-blue-600 shrink-0" />}
                      </button>
                    ))}
                    {filteredSources.length === 0 && (
                      <div className="px-3 py-3 text-center text-slate-400 text-xs">
                        No matching sources
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grade Filter */}
          {showGradeFilter && (
            <div className={`relative shrink-0 ${gradeDropdown ? 'z-50' : 'z-20'}`}>
              <button
                type="button"
                aria-expanded={gradeDropdown}
                aria-haspopup="true"
                onClick={() => {
                  setGradeDropdown(o => !o);
                  setPresetDropdown(false);
                  setVendorDropdown(false);
                  setSourceDropdown(false);
                }}
                className={`flex items-center gap-1.5 border rounded px-3 sm:px-2.5 py-1.5 font-medium transition-colors cursor-pointer min-h-[38px] sm:min-h-[34px] ${
                  selectedGrade !== 'All Grades' 
                    ? 'border-blue-300 bg-blue-50/70 text-blue-800 shadow-2xs' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                <Tag size={13} className={selectedGrade !== 'All Grades' ? 'text-blue-600' : 'text-slate-500'} />
                <span className="max-w-[110px] sm:max-w-none truncate">{selectedGrade === 'All Grades' ? 'Grade' : selectedGrade}</span>
                <ChevronDown size={12} className={`text-slate-400 ml-0.5 sm:ml-1 transition-transform ${gradeDropdown ? 'rotate-180' : ''}`} />
              </button>

              {gradeDropdown && (
                <div className="absolute right-0 sm:right-auto sm:left-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1.5 ring-1 ring-black/5 max-h-80 overflow-y-auto max-w-[calc(100vw-24px)]">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                    <span>Lead Grade</span>
                    {selectedGrade !== 'All Grades' && (
                      <button
                        type="button"
                        onClick={() => handleSelectGrade('All Grades')}
                        className="text-blue-600 hover:underline cursor-pointer lowercase"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  {gradeOptions.length > 7 && (
                    <div className="p-1.5 border-b border-slate-100 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search size={11} className="absolute left-2 top-2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search grades…"
                          value={gradeSearch}
                          onChange={e => setGradeSearch(e.target.value)}
                          className="w-full pl-6 pr-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500 bg-slate-50"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  )}
                  <div className="py-1">
                    {filteredGrades.map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleSelectGrade(g)}
                        className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between text-xs cursor-pointer ${
                          selectedGrade === g ? 'font-semibold text-blue-700 bg-blue-50/60' : 'text-slate-700'
                        }`}
                      >
                        <span className="truncate mr-2">{g}</span>
                        {selectedGrade === g && <Check size={13} className="text-blue-600 shrink-0" />}
                      </button>
                    ))}
                    {filteredGrades.length === 0 && (
                      <div className="px-3 py-3 text-center text-slate-400 text-xs">
                        No matching grades
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Filter Count Badge / Clear All */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-slate-500 hover:text-slate-800 text-xs underline px-1 py-1 transition-colors cursor-pointer shrink-0"
            >
              Reset ({activeFilterCount})
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0 self-end sm:self-auto">
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              title="Refresh analytics data (bypass cache)"
              className="flex items-center gap-1.5 border border-slate-200/90 rounded-md px-3 py-1.5 hover:bg-slate-50 text-slate-700 transition-colors active:scale-95 cursor-pointer disabled:opacity-50 min-h-[34px] text-xs font-medium shadow-2xs"
            >
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-400'} />
              <span>{isRefreshing ? 'Syncing…' : 'Refresh'}</span>
            </button>
          )}

          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              title="Export CSV dataset"
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-98 cursor-pointer min-h-[34px]"
            >
              <Download size={12} className="text-slate-300" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Applied Filter Tags Row */}
      {appliedFilters.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-100 font-mono text-[11px]">
          <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mr-1">Active Filter:</span>
          {appliedFilters.map(({ key, label, value }) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 bg-blue-50/80 text-blue-800 px-2 py-0.5 rounded text-[11px] font-medium border border-blue-200/80"
            >
              <span>{label}: <strong className="font-semibold text-blue-900">{value}</strong></span>
              <button
                type="button"
                onClick={() => setFilter(key, null)}
                aria-label={`Remove filter ${label}: ${value}`}
                className="text-blue-400 hover:text-blue-900 hover:bg-blue-100 rounded p-0.5 transition-colors cursor-pointer"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="text-slate-500 hover:text-slate-900 underline ml-1 cursor-pointer transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

