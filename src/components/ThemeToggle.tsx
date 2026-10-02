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
        className={`cx-segmented-control text-xs ${className}`}
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--cx-radius-control)] font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-[var(--cx-selected-bg)] text-action'
                  : 'text-text-sec hover:text-text-main'
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
        <ActiveIcon size={16} aria-hidden="true" className="transition-transform duration-150" />
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 min-w-[140px] rounded-[var(--cx-radius-md)] border border-border bg-surface p-1 shadow-[var(--cx-shadow-elevated)] text-xs animate-in fade-in zoom-in-95 duration-150"
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
                className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-[var(--cx-radius-control)] font-medium transition-colors duration-150 ${
                  isCurrent
                    ? 'bg-[var(--cx-selected-bg)] text-action font-semibold'
                    : 'text-text-main hover:bg-surface-subtle'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={14} aria-hidden="true" />
                  <span>{t.label}</span>
                </div>
                {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-action" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
