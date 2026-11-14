import React, { useState, useEffect, useRef } from 'react';
import {
  Network,
  Moon,
  Sun,
  Bell,
  WifiOff,
  CreditCard,
  ShieldCheck,
  ChevronDown,
  ArrowRight,
  Menu,
  X,
  LogOut
} from 'lucide-react';
import { useAcademy } from '../context/AcademyContext';
import { UserRole } from '../types';

interface TopBarProps {
  onOpenLogin: () => void;
  onOpenNotifications: () => void;
  onOpenPricing: () => void;
  isSidebarPinned: boolean;
  isSidebarOpen: boolean;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onNavigateHome: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenLogin,
  onOpenNotifications,
  onOpenPricing,
  isSidebarPinned,
  isSidebarOpen,
  mobileMenuOpen,
  setMobileMenuOpen,
  onNavigateHome
}) => {
  const {
    currentUser,
    switchRole,
    darkMode,
    toggleDarkMode,
    isOffline,
    toggleManualOfflineSim,
    unreadNotifsCount,
    logoutUser
  } = useAcademy();

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setRoleMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRoleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const isSidebarShown = isSidebarPinned || isSidebarOpen;

  return (
    <header className="sticky top-0 z-30 w-full backdrop-blur-2xl bg-white/85 dark:bg-[#070b14]/85 border-b border-slate-200/90 dark:border-slate-800/90 transition-colors">
      <div className={`w-full h-14 flex items-center justify-between gap-2 transition-all duration-300 ${
        isSidebarShown
          ? 'max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-7'
          : 'max-w-none px-3 sm:px-4 lg:px-5'
      }`}>
        
        {/* Top-Left: Mobile Menu + Brand (small screens) OR Sidebar Reveal Controls when unpinned/hidden */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0c1220] transition-colors"
            aria-label="Toggle navigation sidebar"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Mobile Brand */}
          <div
            className="lg:hidden flex items-center gap-2 cursor-pointer select-none"
            onClick={onNavigateHome}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-md">
              <Network className="w-4 h-4" />
            </div>
            <span className="text-base font-black tracking-tight bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 bg-clip-text text-transparent">
              Netplus
            </span>
          </div>

          {/* Desktop Compact Workspace Title when Sidebar is in Icon Rail mode */}
          {!isSidebarShown && (
            <div className="hidden lg:flex items-center gap-2.5 select-none">
              <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Netplus Academy
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                • Enterprise Networking LMS
              </span>
            </div>
          )}
        </div>

        {/* Top-Right: Fabric Status, Dark/Light Mode Toggle, Notifications, User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-auto">
          
          {/* Fabric Status / Offline Toggle */}
          <button
            onClick={toggleManualOfflineSim}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-medium border transition-colors ${
              isOffline
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            }`}
            title={isOffline ? 'Offline mode active (Click to connect)' : 'Fabric connection active (Click to simulate offline)'}
          >
            {isOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Offline</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline">Fabric 1G</span>
              </>
            )}
          </button>

          {/* Toggle Mode (Dark / Light) */}
          <button
            onClick={toggleDarkMode}
            className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-[#0c1220] text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-cyan-500/50 transition-colors"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden md:inline text-[11px] font-medium text-slate-300">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-slate-600" />
                <span className="hidden md:inline text-[11px] font-medium text-slate-700">Dark</span>
              </>
            )}
          </button>

          {/* Notification Bell */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-[#0c1220] text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-cyan-500/50 transition-colors"
            title="System Notifications"
            aria-label="System Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-red-500 text-[9px] font-mono font-bold text-white ring-2 ring-white dark:ring-[#070b14]">
                {unreadNotifsCount}
              </span>
            )}
          </button>

          {/* User Profile & RBAC Switcher */}
          <div className="relative" ref={roleMenuRef}>
            <button
              onClick={() => setRoleMenuOpen(prev => !prev)}
              className="flex items-center gap-2 p-1 pr-2 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-blue-400 dark:hover:border-cyan-500/50 bg-slate-50 dark:bg-[#0c1220] transition-colors text-left"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-lg object-cover ring-1 ring-blue-500/30 shrink-0"
              />
              <div className="hidden sm:block leading-tight">
                <p className="text-xs font-bold text-slate-900 dark:text-white max-w-[110px] truncate">
                  {currentUser.name}
                </p>
                <p className="text-[9px] uppercase font-mono font-bold text-blue-600 dark:text-cyan-400">
                  {currentUser.role}
                </p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${roleMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {roleMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl p-2.5 bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 z-50 space-y-2">
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-9 h-9 rounded-lg object-cover ring-1 ring-blue-500/40"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                    <p className="text-[10px] text-slate-400 truncate font-mono">{currentUser.email}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] font-mono font-bold uppercase px-1 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-cyan-950 dark:text-cyan-300">
                        {currentUser.subscription.tier}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-500 font-bold">
                        {currentUser.reputationPoints} pts
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[9px] font-mono font-bold uppercase text-slate-400 mb-1.5 px-1">
                    Switch Role (RBAC):
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {(['student', 'instructor', 'admin'] as UserRole[]).map(r => (
                      <button
                        key={r}
                        onClick={() => {
                          switchRole(r);
                          setRoleMenuOpen(false);
                        }}
                        className={`py-1.5 rounded-lg text-[11px] font-semibold capitalize text-center transition-colors ${
                          currentUser.role === r
                            ? 'bg-blue-600 text-white shadow-xs font-bold'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 space-y-1">
                  <button
                    onClick={() => {
                      setRoleMenuOpen(false);
                      onOpenPricing();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                      <span>Subscription</span>
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={() => {
                      setRoleMenuOpen(false);
                      onOpenLogin();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Switch Account</span>
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={async () => {
                      setRoleMenuOpen(false);
                      await logoutUser();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <span className="flex items-center gap-2">
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </span>
                    <ArrowRight className="w-3 h-3 opacity-60" />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
