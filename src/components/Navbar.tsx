import React, { useState, useEffect, useRef } from 'react';
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
  ShieldCheck, 
  Menu, 
  X,
  ChevronDown,
  Search,
  Command,
  ArrowRight,
  Globe
} from 'lucide-react';
import { useAcademy } from '../context/AcademyContext';
import { UserRole } from '../types';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenLogin: () => void;
  onOpenNotifications: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenLogin,
  onOpenNotifications
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
  const [labsDropdownOpen, setLabsDropdownOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');

  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const labsDropdownRef = useRef<HTMLDivElement>(null);
  const adminDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setRoleDropdownOpen(false);
      }
      if (labsDropdownRef.current && !labsDropdownRef.current.contains(event.target as Node)) {
        setLabsDropdownOpen(false);
      }
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setAdminDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavClick = (tabId: string) => {
    setCurrentTab(tabId);
    setMobileMenuOpen(false);
    setLabsDropdownOpen(false);
    setAdminDropdownOpen(false);
  };

  const isLabTabActive = currentTab === 'lab-sandbox' || currentTab === 'subnet-calc';
  const isAdminTabActive = currentTab === 'management' || currentTab === 'analytics' || currentTab === 'lms';

  const quickJumpItems = [
    { id: 'courses', label: 'Course Catalog & Syllabus', category: 'Curriculum', icon: Layers },
    { id: 'dashboard', label: 'My Enrolled Courses & Progress', category: 'Learning', icon: UserCheck },
    { id: 'lab-sandbox', label: 'Cisco IOS CLI Terminal Simulator', category: 'Hands-on Labs', icon: Terminal },
    { id: 'subnet-calc', label: 'Subnetting & VLSM Architecture Calculator', category: 'Hands-on Labs', icon: Calculator },
    { id: 'certificates', label: 'Verifiable Digital Credentials & Registry', category: 'Certificates', icon: Award },
    { id: 'forum', label: 'Network Engineers Discussion Forum', category: 'Community', icon: MessageSquare },
    { id: 'pricing', label: 'Subscription Tiers & Pro Checkout', category: 'Account', icon: CreditCard },
    ...(currentUser.role === 'admin' || currentUser.role === 'instructor' ? [
      { id: 'management', label: 'Admin Course Manager & Enrollment Telemetry', category: 'Administration', icon: Settings },
      { id: 'analytics', label: 'Real-Time Learner Activity Stream', category: 'Administration', icon: BarChart3 },
      { id: 'lms', label: 'External LMS (Canvas / Blackboard / SCORM)', category: 'Administration', icon: Globe }
    ] : [])
  ];

  const filteredQuickJumps = quickJumpItems.filter(item => 
    item.label.toLowerCase().includes(commandSearch.toLowerCase()) ||
    item.category.toLowerCase().includes(commandSearch.toLowerCase())
  );

  return (
    <>
      {/* Sleek Modern Single-Line Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-2xl bg-white/90 dark:bg-[#070b14]/90 border-b border-slate-200/90 dark:border-slate-800/90 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-14 gap-2 sm:gap-4 flex-nowrap">
            
            {/* Left: Brand Identity */}
            <div 
              className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0" 
              onClick={() => handleNavClick('courses')}
            >
              <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white shadow-md shadow-blue-500/20 ring-1 ring-white/20 group-hover:scale-105 transition-transform">
                <Network className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-2 ring-white dark:ring-[#070b14]" />
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-black tracking-tight bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 bg-clip-text text-transparent">
                  Netplus
                </span>
                <span className="hidden sm:inline-block text-[9px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-blue-200/80 dark:border-cyan-800/50">
                  Academy
                </span>
              </div>
            </div>

            {/* Center: Single-Line Segmented Navigation Bar */}
            <nav className="hidden lg:flex items-center p-1 rounded-xl bg-slate-100/90 dark:bg-[#0c1220]/90 border border-slate-200/80 dark:border-slate-800/80 space-x-0.5 shrink-0">
              
              {/* Courses */}
              <button
                onClick={() => handleNavClick('courses')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  currentTab === 'courses'
                    ? 'bg-white dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 shadow-xs dark:border dark:border-cyan-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Courses</span>
              </button>

              {/* My Learning */}
              <button
                onClick={() => handleNavClick('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  currentTab === 'dashboard'
                    ? 'bg-white dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 shadow-xs dark:border dark:border-cyan-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>My Learning</span>
              </button>

              {/* Hands-on Labs Dropdown */}
              <div className="relative" ref={labsDropdownRef}>
                <button
                  onClick={() => setLabsDropdownOpen(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isLabTabActive
                      ? 'bg-white dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 shadow-xs dark:border dark:border-cyan-500/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
                  <span>Labs</span>
                  <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 font-bold">
                    CLI
                  </span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${labsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {labsDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-64 rounded-2xl shadow-2xl p-1.5 bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 z-50">
                    <button
                      onClick={() => handleNavClick('lab-sandbox')}
                      className={`w-full p-2 rounded-xl text-left flex items-center gap-2.5 transition-colors ${
                        currentTab === 'lab-sandbox' ? 'bg-blue-50 dark:bg-cyan-950/40 text-blue-600 dark:text-cyan-300 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Terminal className="w-4 h-4 text-cyan-500" />
                      <div>
                        <div className="text-xs font-bold">Cisco IOS CLI Sandbox</div>
                        <div className="text-[10px] text-slate-400">Virtual router & OSPF lab</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNavClick('subnet-calc')}
                      className={`w-full p-2 rounded-xl text-left flex items-center gap-2.5 transition-colors mt-0.5 ${
                        currentTab === 'subnet-calc' ? 'bg-blue-50 dark:bg-cyan-950/40 text-blue-600 dark:text-cyan-300 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Calculator className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="text-xs font-bold">Subnetting & VLSM Engine</div>
                        <div className="text-[10px] text-slate-400">CIDR math & speed drills</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Certificates */}
              <button
                onClick={() => handleNavClick('certificates')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  currentTab === 'certificates'
                    ? 'bg-white dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 shadow-xs dark:border dark:border-cyan-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>Certificates</span>
              </button>

              {/* Forum */}
              <button
                onClick={() => handleNavClick('forum')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  currentTab === 'forum'
                    ? 'bg-white dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 shadow-xs dark:border dark:border-cyan-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Forum</span>
              </button>

              {/* Management Dropdown (Instructor & Admin) */}
              {(currentUser.role === 'admin' || currentUser.role === 'instructor') && (
                <div className="relative" ref={adminDropdownRef}>
                  <button
                    onClick={() => setAdminDropdownOpen(prev => !prev)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      isAdminTabActive
                        ? 'bg-white dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 shadow-xs dark:border dark:border-cyan-500/30'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500 dark:text-cyan-400" />
                    <span>Admin</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${adminDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {adminDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-60 rounded-2xl shadow-2xl p-1.5 bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 z-50">
                      <button
                        onClick={() => handleNavClick('management')}
                        className={`w-full p-2 rounded-xl text-left flex items-center gap-2.5 transition-colors ${
                          currentTab === 'management' ? 'bg-blue-50 dark:bg-cyan-950/40 text-blue-600 dark:text-cyan-300 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <Settings className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="text-xs font-bold">Course Manager</div>
                          <div className="text-[10px] text-slate-400">Curriculum authoring</div>
                        </div>
                      </button>

                      <button
                        onClick={() => handleNavClick('analytics')}
                        className={`w-full p-2 rounded-xl text-left flex items-center gap-2.5 transition-colors mt-0.5 ${
                          currentTab === 'analytics' ? 'bg-blue-50 dark:bg-cyan-950/40 text-blue-600 dark:text-cyan-300 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4 text-emerald-500" />
                        <div>
                          <div className="text-xs font-bold">Live Analytics</div>
                          <div className="text-[10px] text-slate-400">Student telemetry</div>
                        </div>
                      </button>

                      <button
                        onClick={() => handleNavClick('lms')}
                        className={`w-full p-2 rounded-xl text-left flex items-center gap-2.5 transition-colors mt-0.5 ${
                          currentTab === 'lms' ? 'bg-blue-50 dark:bg-cyan-950/40 text-blue-600 dark:text-cyan-300 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <Globe className="w-4 h-4 text-purple-500" />
                        <div>
                          <div className="text-xs font-bold">LMS & SCORM API</div>
                          <div className="text-[10px] text-slate-400">Canvas / Blackboard / LTI</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}

            </nav>

            {/* Right: Controls & Identity (Strictly Single Line) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              
              {/* Quick Search Trigger (Cmd+K) */}
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-slate-100/90 dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-blue-400 dark:hover:border-cyan-500/50 transition-colors"
                title="Search (Cmd+K)"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Search</span>
                <kbd className="hidden md:inline-flex items-center text-[9px] font-mono px-1 py-0.2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400">
                  <Command className="w-2.5 h-2.5 mr-0.5" />K
                </kbd>
              </button>

              {/* Fabric Status / Offline Mode Toggle */}
              <button
                onClick={toggleManualOfflineSim}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-mono font-medium border transition-colors ${
                  isOffline
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                }`}
                title={isOffline ? 'Offline mode active (Click to connect)' : 'Fabric connection active (Click to simulate offline)'}
              >
                {isOffline ? (
                  <>
                    <WifiOff className="w-3 h-3 text-amber-500" />
                    <span className="hidden sm:inline">Offline</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="hidden sm:inline">Fabric 1G</span>
                  </>
                )}
              </button>

              {/* Dark Mode Icon Toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-[#0c1220] transition-colors"
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Modern Dark Mode'}
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </button>

              {/* Notification Bell */}
              <button
                onClick={onOpenNotifications}
                className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-[#0c1220] transition-colors"
                title="System Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-3.5 h-3.5 px-0.5 rounded-full bg-red-500 text-[8px] font-mono font-bold text-white ring-1 ring-white dark:ring-[#070b14]">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>

              {/* User Profile & Role Switcher */}
              <div className="relative" ref={roleDropdownRef}>
                <button
                  onClick={() => setRoleDropdownOpen(prev => !prev)}
                  className="flex items-center gap-1.5 p-1 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-blue-400 dark:hover:border-cyan-500/50 bg-slate-50 dark:bg-[#0c1220] transition-colors text-left"
                >
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-lg object-cover ring-1 ring-blue-500/30"
                  />
                  <span className="hidden xl:inline-block text-[10px] uppercase font-mono font-bold text-blue-600 dark:text-cyan-400 px-1">
                    {currentUser.role}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400 hidden xl:inline-block pr-0.5" />
                </button>

                {/* Profile Dropdown */}
                {roleDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl p-2.5 bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 z-50">
                    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 mb-2">
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        className="w-9 h-9 rounded-lg object-cover ring-1 ring-blue-500/40"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                        <p className="text-[10px] text-slate-400 truncate font-mono">{currentUser.email}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-mono font-bold uppercase px-1 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-cyan-950 dark:text-cyan-300">
                            {currentUser.subscription.tier}
                          </span>
                          <span className="text-[9px] font-mono text-emerald-500 font-bold">
                            {currentUser.reputationPoints} pts
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* RBAC Role Selector */}
                    <div className="px-1 py-1">
                      <p className="text-[9px] font-mono font-bold uppercase text-slate-400 mb-1.5">
                        Switch Role (RBAC):
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        {(['student', 'instructor', 'admin'] as UserRole[]).map(r => (
                          <button
                            key={r}
                            onClick={() => {
                              switchRole(r);
                              setRoleDropdownOpen(false);
                            }}
                            className={`py-1.5 rounded-lg text-xs font-semibold capitalize text-center transition-colors ${
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

                    <div className="border-t border-slate-100 dark:border-slate-800 mt-2 pt-1.5">
                      <button
                        onClick={() => {
                          setRoleDropdownOpen(false);
                          handleNavClick('pricing');
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
                          setRoleDropdownOpen(false);
                          onOpenLogin();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 mt-0.5"
                      >
                        <span className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Switch Account</span>
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Hamburger Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(prev => !prev)}
                className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#0c1220]"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>

            </div>

          </div>
        </div>

        {/* Mobile Navigation Dropdown Sheet */}
        {mobileMenuOpen && (
          <div className="lg:hidden px-4 pt-2 pb-5 space-y-3 bg-white/95 dark:bg-[#070b14]/95 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold">
              <button
                onClick={() => handleNavClick('courses')}
                className={`p-2.5 rounded-xl flex items-center gap-2 ${
                  currentTab === 'courses' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#0c1220] text-slate-700 dark:text-slate-300'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Courses</span>
              </button>

              <button
                onClick={() => handleNavClick('dashboard')}
                className={`p-2.5 rounded-xl flex items-center gap-2 ${
                  currentTab === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#0c1220] text-slate-700 dark:text-slate-300'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>My Learning</span>
              </button>

              <button
                onClick={() => handleNavClick('lab-sandbox')}
                className={`p-2.5 rounded-xl flex items-center gap-2 ${
                  currentTab === 'lab-sandbox' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#0c1220] text-slate-700 dark:text-slate-300'
                }`}
              >
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Cisco CLI Lab</span>
              </button>

              <button
                onClick={() => handleNavClick('subnet-calc')}
                className={`p-2.5 rounded-xl flex items-center gap-2 ${
                  currentTab === 'subnet-calc' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#0c1220] text-slate-700 dark:text-slate-300'
                }`}
              >
                <Calculator className="w-4 h-4 text-blue-500" />
                <span>Subnet Calc</span>
              </button>

              <button
                onClick={() => handleNavClick('certificates')}
                className={`p-2.5 rounded-xl flex items-center gap-2 ${
                  currentTab === 'certificates' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#0c1220] text-slate-700 dark:text-slate-300'
                }`}
              >
                <Award className="w-4 h-4 text-amber-500" />
                <span>Certificates</span>
              </button>

              <button
                onClick={() => handleNavClick('forum')}
                className={`p-2.5 rounded-xl flex items-center gap-2 ${
                  currentTab === 'forum' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#0c1220] text-slate-700 dark:text-slate-300'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Forum</span>
              </button>
            </div>

            {(currentUser.role === 'admin' || currentUser.role === 'instructor') && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-mono uppercase font-bold text-cyan-400 mb-1.5">Management</p>
                <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
                  <button
                    onClick={() => handleNavClick('management')}
                    className={`p-2 rounded-xl text-center flex flex-col items-center justify-center ${
                      currentTab === 'management' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#0c1220] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Settings className="w-4 h-4 mb-0.5 text-blue-500" />
                    <span className="text-[10px]">Courses</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('analytics')}
                    className={`p-2 rounded-xl text-center flex flex-col items-center justify-center ${
                      currentTab === 'analytics' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#0c1220] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 mb-0.5 text-emerald-500" />
                    <span className="text-[10px]">Analytics</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('lms')}
                    className={`p-2 rounded-xl text-center flex flex-col items-center justify-center ${
                      currentTab === 'lms' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#0c1220] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Globe className="w-4 h-4 mb-0.5 text-purple-500" />
                    <span className="text-[10px]">LMS</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Global Quick Search / Command Palette Modal */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center pt-20 p-4">
          <div className="w-full max-w-xl bg-white dark:bg-[#0c1220] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-100">
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <Search className="w-4 h-4 text-blue-500 shrink-0" />
              <input
                type="text"
                autoFocus
                value={commandSearch}
                onChange={(e) => setCommandSearch(e.target.value)}
                placeholder="Search courses, Cisco CLI labs, subnetting, certificates..."
                className="w-full bg-transparent border-none text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
                ESC
              </kbd>
            </div>

            <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
              {filteredQuickJumps.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      handleNavClick(item.id);
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/60 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{item.category}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </button>
                );
              })}

              {filteredQuickJumps.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400">
                  No matching section found.
                </div>
              )}
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-[#070b14] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Netplus Academy Quick Jump</span>
              <span>ESC to dismiss</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
