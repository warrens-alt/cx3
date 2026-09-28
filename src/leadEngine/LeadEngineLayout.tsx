import React, { useState } from 'react';
import {
  Database,
  ShieldCheck,
  CircleDollarSign,
  Settings,
  Layers,
  Activity,
  HardDrive,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Menu,
  X,
  Sparkles,
  Search,
} from 'lucide-react';
import LeadLedgerModule from './LeadLedgerModule';
import DataQualityModule from './DataQualityModule';
import RateCardModule from './RateCardModule';
import SettingsModule from './SettingsModule';

export type ActiveModuleId = 'ledger' | 'quality' | 'rate-card' | 'settings';

interface LeadEngineLayoutProps {
  initialModule?: ActiveModuleId;
}

export default function LeadEngineLayout({ initialModule = 'ledger' }: LeadEngineLayoutProps) {
  const [activeModule, setActiveModule] = useState<ActiveModuleId>(initialModule);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState('dashboards-422710');
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  const modules = [
    {
      id: 'ledger' as const,
      index: '01',
      title: 'Lead Ledger',
      subtitle: 'Table Preview & 350k+ Deep Search',
      icon: Database,
    },
    {
      id: 'quality' as const,
      index: '02',
      title: 'Data Quality',
      subtitle: 'Compliance Scorecard & Cleansing Engine',
      icon: ShieldCheck,
    },
    {
      id: 'rate-card' as const,
      index: '03',
      title: 'Rate Card',
      subtitle: 'Commercial Yield & Financial Margin Model',
      icon: CircleDollarSign,
    },
    {
      id: 'settings' as const,
      index: '04',
      title: 'Settings',
      subtitle: 'Cache Manager & BigQuery Connection',
      icon: Settings,
    },
  ];

  const handleQuickPurge = async () => {
    try {
      const res = await fetch('/api/cache/clear', { method: 'POST' });
      const json = await res.json();
      setCacheNotice(`Cache purged (${json.purgedEntries || 0} entries)`);
      setTimeout(() => setCacheNotice(null), 3000);
    } catch {
      setCacheNotice('Cache purge failed');
      setTimeout(() => setCacheNotice(null), 3000);
    }
  };

  return (
    <div className="min-h-screen flex bg-neutral-50 text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white">
      {/* Sleek Minimalist Dark Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-neutral-950 text-neutral-300 flex flex-col justify-between border-r border-neutral-800 transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Lockup */}
        <div className="p-5 border-b border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-neutral-800 text-white flex items-center justify-center font-bold border border-neutral-700">
                <Database size={16} />
              </div>
              <div>
                <strong className="block text-sm font-bold tracking-tight text-white font-mono uppercase">
                  LEAD ENGINE
                </strong>
                <span className="block text-[11px] text-neutral-400 font-normal">
                  Commercial Data Platform
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded text-neutral-400 hover:text-white lg:hidden"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Four Core Modules Navigation */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
            Core Modules
          </div>

          {modules.map(mod => {
            const Icon = mod.icon;
            const isActive = activeModule === mod.id;

            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => {
                  setActiveModule(mod.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 cursor-pointer group ${
                  isActive
                    ? 'bg-neutral-800 text-white border border-neutral-700'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-transparent'
                }`}
              >
                <div
                  className={`mt-0.5 w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? 'bg-white text-neutral-900'
                      : 'bg-neutral-900 text-neutral-400 group-hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold tracking-tight text-white block">
                    [{mod.index.replace(/^0/, '')}] {mod.title}
                  </span>
                  <span className="text-[11px] text-neutral-400 leading-tight block mt-0.5 truncate">
                    {mod.subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer with BigQuery Status */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400 text-[11px]">BigQuery Engine:</span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-200 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              Connected
            </span>
          </div>

          <div className="p-2.5 rounded-md bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-400 space-y-0.5">
            <div className="text-neutral-200 truncate">dashboards-422710</div>
            <div className="text-[10px] text-neutral-400 truncate">lead_ledger.clustered_lead_ledger</div>
            <div className="text-[10px] text-neutral-400">350,573 leads · 18 columns</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        {/* Sleek Enterprise Topbar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-neutral-200 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded text-neutral-600 hover:bg-neutral-100 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs" aria-label="Breadcrumb">
              <span className="font-semibold text-neutral-900 font-mono">LEAD ENGINE</span>
              <span className="text-neutral-400">/</span>
              <span className="text-neutral-600 font-medium">
                {modules.find(m => m.id === activeModule)?.title}
              </span>
            </nav>
          </div>

          {/* Right Topbar Actions */}
          <div className="flex items-center gap-3">
            {cacheNotice && (
              <span className="text-xs font-mono text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300">
                {cacheNotice}
              </span>
            )}

            {/* Quick Purge Cache Button */}
            <button
              type="button"
              onClick={handleQuickPurge}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 transition-colors cursor-pointer"
              title="Purge query cache"
            >
              <Trash2 size={12} className="text-neutral-600" />
              <span>Purge Cache</span>
            </button>

            {/* Warehouse Workspace Client Switcher */}
            <div className="flex items-center gap-1 text-xs">
              <label htmlFor="cx-workspace-client-select" className="sr-only">Active client</label>
              <select
                id="cx-workspace-client-select"
                aria-label="Active client"
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
                className="cx-workspace-select text-xs font-mono bg-white border border-neutral-300 rounded px-2.5 py-1 text-neutral-800 focus:outline-neutral-900 font-medium"
              >
                <option value="dashboards-422710">dashboards-422710 (Production)</option>
                <option value="vibe-code-warren-stear">vibe-code-warren-stear</option>
              </select>
            </div>
          </div>
        </header>

        {/* Main Work Surface */}
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1720px] w-full mx-auto outline-hidden">
          {activeModule === 'ledger' && <LeadLedgerModule />}
          {activeModule === 'quality' && <DataQualityModule />}
          {activeModule === 'rate-card' && <RateCardModule />}
          {activeModule === 'settings' && <SettingsModule />}
        </main>
      </div>
    </div>
  );
}
