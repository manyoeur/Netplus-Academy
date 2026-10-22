import React, { useState } from 'react';
import { 
  Network, 
  Moon, 
  Sun, 
  Bell, 
  Wifi, 
  WifiOff, 
  UserCheck, 
  Layers, 
  Award, 
  MessageSquare, 
  BarChart3, 
  Settings, 
  CreditCard, 
  Terminal, 
  Calculator, 
  LogOut, 
  ShieldCheck, 
  Menu, 
  X,
  ExternalLink
} from 'lucide-react';
import { useAcademy } from '../context/AcademyContext';
import { UserRole } from '../types';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenLogin: () => void;
  onOpenNotifications: () => void;
  onOpenAITutor: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenLogin,
  onOpenNotifications,
  onOpenAITutor
}) => {
  const { 
    currentUser, 
    switchRole, 
    darkMode, 
    toggleDarkMode, 
    isOffline, 
    toggleManualOfflineSim,
    unreadNotifsCount 
  } = useAcademy();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const navLinks = [
    { id: 'courses', label: 'Courses', icon: Layers },
    { id: 'dashboard', label: 'My Learning', icon: UserCheck },
    { id: 'lab-sandbox', label: 'Cisco CLI Lab', icon: Terminal },
    { id: 'subnet-calc', label: 'Subnet Calc', icon: Calculator },
    { id: 'forum', label: 'Forum', icon: MessageSquare },
    { id: 'certificates', label: 'Certificates', icon: Award },
    // Admin & Instructor tabs
    ...(currentUser.role === 'admin' || currentUser.role === 'instructor' ? [
      { id: 'management', label: 'Course Manager', icon: Settings },
      { id: 'analytics', label: 'Real-Time Analytics', icon: BarChart3 },
      { id: 'lms', label: 'LMS API', icon: ExternalLink }
    ] : []),
    { id: 'pricing', label: 'Subscription', icon: CreditCard }
  ];

  const handleNavClick = (tabId: string) => {
    setCurrentTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors bg-white/90 border-slate-200 dark:bg-slate-900/90 dark:border-slate-800 text-slate-800 dark:text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavClick('courses')}>
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white shadow-md shadow-blue-500/20">
              <Network className="w-5 h-5 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500 bg-clip-text text-transparent">
                  Netplus
                </span>
                <span className="text-xs uppercase font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  Academy
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono -mt-0.5">
                CCNA • CCNP • Security • SD-WAN
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navLinks.map(link => {
              const Icon = link.icon;
              const isActive = currentTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Icons: AI Tutor, Offline Badge, Dark Mode, Notifications, User Profile */}
          <div className="flex items-center space-x-2">
            
            {/* NetGenius AI Tutor Trigger Button */}
            <button
              onClick={onOpenAITutor}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 shadow-sm transition-all shadow-cyan-500/20"
              title="Open NetGenius AI Tutor"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-300 animate-ping" />
              <span>AI Tutor</span>
            </button>

            {/* Offline Simulation Toggle Badge */}
            <button
              onClick={toggleManualOfflineSim}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-medium transition-colors border ${
                isOffline
                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50'
              }`}
              title={isOffline ? 'Offline mode active (Click to simulate online)' : 'Online connected (Click to simulate offline connectivity)'}
            >
              {isOffline ? <WifiOff className="w-3 h-3 text-amber-600 dark:text-amber-400" /> : <Wifi className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
              <span className="hidden sm:inline">{isOffline ? 'Offline' : 'Online'}</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode (Late-night study mode)'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Notifications Button */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="System Notifications & Email Logs"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {/* User Profile & Role Switcher */}
            <div className="relative">
              <button
                onClick={() => setRoleDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all text-left"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-blue-500"
                />
                <div className="hidden md:block text-left pr-1">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                    {currentUser.name.split(' ')[0]}
                  </div>
                  <div className="text-[10px] uppercase font-mono font-bold text-blue-600 dark:text-cyan-400">
                    {currentUser.role}
                  </div>
                </div>
              </button>

              {/* Role Switcher Dropdown */}
              {roleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl shadow-2xl py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</p>
                    <div className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                      Tier: {currentUser.subscription.tier.toUpperCase()}
                    </div>
                  </div>

                  <div className="px-3 py-1.5">
                    <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 px-1 mb-1">
                      Quick Role Switch (RBAC)
                    </p>
                    <div className="grid grid-cols-3 gap-1">
                      {(['student', 'instructor', 'admin'] as UserRole[]).map(r => (
                        <button
                          key={r}
                          onClick={() => {
                            switchRole(r);
                            setRoleDropdownOpen(false);
                          }}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium capitalize text-center transition-all ${
                            currentUser.role === r
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1 px-2">
                    <button
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        onOpenLogin();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                      <span>Switch Account / Sign In</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden px-4 pt-2 pb-4 space-y-1 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          {navLinks.map(link => {
            const Icon = link.icon;
            const isActive = currentTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
