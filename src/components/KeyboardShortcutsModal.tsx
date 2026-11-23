import React, { useMemo, useState } from 'react';
import { Keyboard, Search, X, ArrowRight } from 'lucide-react';
import { UserRole } from '../types';
import {
  KeyboardShortcutDef,
  ShortcutCategory,
  getShortcutsForRole
} from '../utils/keyboardShortcuts';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  shortcutsEnabled: boolean;
  onToggleShortcutsEnabled: (enabled: boolean) => void;
  currentTab: string;
  onTriggerShortcut: (shortcut: KeyboardShortcutDef) => void;
}

const CATEGORY_ORDER: { id: ShortcutCategory; title: string }[] = [
  { id: 'navigation', title: 'Primary Tabs' },
  { id: 'tools', title: 'Hands-on Labs & Calculators' },
  { id: 'admin', title: 'Administration' },
  { id: 'workspace', title: 'Workspace Controls' }
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  userRole,
  shortcutsEnabled,
  onToggleShortcutsEnabled,
  currentTab,
  onTriggerShortcut
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const groupedShortcuts = useMemo(() => {
    const allowed = getShortcutsForRole(userRole);
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? allowed.filter(
          item =>
            item.label.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.displayKey.toLowerCase().includes(q)
        )
      : allowed;

    return CATEGORY_ORDER.map(cat => ({
      ...cat,
      items: filtered.filter(item => item.category === cat.id)
    })).filter(group => group.items.length > 0);
  }, [userRole, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-modal-title"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/70 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Keyboard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="keyboard-shortcuts-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white leading-tight"
              >
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Single-key tab switching pauses automatically while typing in inputs or CLI terminals.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Enable Toggle Bar */}
        <div className="px-5 py-3 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter shortcuts by key or destination..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={shortcutsEnabled}
            onClick={() => onToggleShortcutsEnabled(!shortcutsEnabled)}
            className="inline-flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-cyan-500/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Single-Key Navigation</span>
            <span
              className={`inline-flex items-center w-8 h-4.5 rounded-full p-0.5 transition-colors ${
                shortcutsEnabled ? 'bg-blue-600 dark:bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${
                  shortcutsEnabled ? 'translate-x-3.5' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        </div>

        {/* Grouped Shortcut Reference List */}
        <div className="p-5 overflow-y-auto space-y-5">
          {!shortcutsEnabled && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
              Single-key navigation shortcuts are currently paused. Enable the toggle above to switch tabs with keys like <strong>C</strong>, <strong>D</strong>, and <strong>L</strong>.
            </div>
          )}

          {groupedShortcuts.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-500 dark:text-slate-400">
              No shortcuts match &ldquo;{searchQuery}&rdquo;.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {groupedShortcuts.map(group => (
                <div key={group.id} className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wide">
                    {group.title}
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
                    {group.items.map(item => {
                      const isNavigable = item.actionType === 'navigate' && Boolean(item.tabId);
                      const isActive = isNavigable && currentTab === item.tabId;

                      return isNavigable ? (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onTriggerShortcut(item);
                            onClose();
                          }}
                          className={`w-full px-3 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-blue-50/80 dark:bg-blue-950/35'
                              : 'hover:bg-white dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {item.label}
                              </span>
                              {isActive && (
                                <span className="text-[10px] font-mono text-blue-600 dark:text-cyan-400">
                                  · Current
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {item.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <kbd className="min-w-[26px] h-6 px-1.5 inline-flex items-center justify-center rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 shadow-2xs">
                              {item.displayKey}
                            </kbd>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                          </div>
                        </button>
                      ) : (
                        <div
                          key={item.id}
                          className="px-3 py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                              {item.label}
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {item.description}
                            </p>
                          </div>
                          <kbd className="min-w-[26px] h-6 px-1.5 inline-flex items-center justify-center rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 shadow-2xs shrink-0">
                            {item.displayKey}
                          </kbd>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-[#070b14] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span>Press ? anytime to toggle this reference</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};

interface ShortcutFeedbackToastProps {
  shortcut: KeyboardShortcutDef | null;
}

export const ShortcutFeedbackToast: React.FC<ShortcutFeedbackToastProps> = ({ shortcut }) => {
  if (!shortcut) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 pointer-events-none flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 text-white border border-slate-700/80 shadow-xl text-xs"
    >
      <kbd className="min-w-[22px] h-5 px-1.5 inline-flex items-center justify-center rounded bg-slate-800 dark:bg-slate-900 border border-slate-600 font-mono text-[11px] font-bold text-cyan-300">
        {shortcut.displayKey}
      </kbd>
      <span className="font-medium text-slate-200">
        Switched to <strong className="text-white">{shortcut.label}</strong>
      </span>
    </div>
  );
};
