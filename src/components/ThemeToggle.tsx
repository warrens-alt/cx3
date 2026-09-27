import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { useTheme, type Theme } from '../lib/ThemeContext';

export default function ThemeToggle({
  variant = 'compact',
  className = '',
}: {
  variant?: 'compact' | 'segmented' | 'dropdown';
  className?: string;
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const themes: Array<{ id: Theme; label: string; icon: typeof Sun }> = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 text-xs ${className}`}
        role="group"
        aria-label="Theme selector"
      >
        {themes.map(t => {
          const Icon = t.icon;
          const isActive = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              aria-pressed={isActive}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
                isActive
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={13} aria-hidden="true" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Compact one-click cycle toggle or popover menu
  const ActiveIcon = resolvedTheme === 'dark' ? Moon : Sun;
  const nextTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={containerRef}>
      <button
        type="button"
        className="cx-icon-button cx-theme-toggle"
        onClick={() => setTheme(nextTheme)}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(o => !o);
        }}
        aria-label={`Current theme: ${theme} (${resolvedTheme}). Switch to ${nextTheme} theme.`}
        title={`Theme: ${theme === 'system' ? 'System (' + resolvedTheme + ')' : theme}. Click to switch to ${nextTheme}, right-click for options.`}
      >
        <ActiveIcon size={16} aria-hidden="true" className="transition-transform duration-200" />
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 min-w-[140px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-lg text-xs animate-in fade-in zoom-in-95 duration-100"
          role="menu"
          aria-label="Theme options"
        >
          {themes.map(t => {
            const Icon = t.icon;
            const isCurrent = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                onClick={() => {
                  setTheme(t.id);
                  setMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                  isCurrent
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={14} aria-hidden="true" />
                  <span>{t.label}</span>
                </div>
                {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
