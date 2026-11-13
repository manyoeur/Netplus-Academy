import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Network, 
  UserCheck, 
  Layers, 
  Award, 
  MessageSquare, 
  BarChart3, 
  Settings, 
  CreditCard, 
  Terminal, 
  Calculator, 
  X,
  Search,
  Command,
  ArrowRight,
  Globe,
  Pin,
  PinOff,
  PanelLeftClose
} from 'lucide-react';
import { useAcademy } from '../context/AcademyContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isPinned: boolean;
  setIsPinned: React.Dispatch<React.SetStateAction<boolean>>;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const INACTIVITY_HIDE_MS = 3500;
const MOUSE_LEAVE_HIDE_MS = 650;

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isPinned,
  setIsPinned,
  isOpen,
  setIsOpen,
  mobileMenuOpen,
  setMobileMenuOpen
}) => {
  const { currentUser } = useAcademy();

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const [isMouseInside, setIsMouseInside] = useState(false);

  const hideTimerRef = useRef<number | null>(null);
  const suppressEdgeHoverUntilRef = useRef<number>(0);

  const isPinnedRef = useRef(isPinned);
  const commandPaletteOpenRef = useRef(commandPaletteOpen);

  useEffect(() => {
    isPinnedRef.current = isPinned;
  }, [isPinned]);

  useEffect(() => {
    commandPaletteOpenRef.current = commandPaletteOpen;
  }, [commandPaletteOpen]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleAutoHide = useCallback((delayMs: number) => {
    clearHideTimer();
    if (isPinnedRef.current || commandPaletteOpenRef.current) return;
    hideTimerRef.current = window.setTimeout(() => {
      if (isPinnedRef.current || commandPaletteOpenRef.current) return;
      suppressEdgeHoverUntilRef.current = Date.now() + 500;
      setIsOpen(false);
      setIsMouseInside(false);
    }, delayMs);
  }, [clearHideTimer, setIsOpen]);

  // Keep open when pinned; start inactivity auto-hide timer whenever opened while unpinned
  useEffect(() => {
    if (isPinned) {
      clearHideTimer();
      setIsOpen(true);
    } else if (isOpen && !commandPaletteOpen) {
      scheduleAutoHide(INACTIVITY_HIDE_MS);
    } else {
      clearHideTimer();
    }
    return () => clearHideTimer();
  }, [isPinned, isOpen, commandPaletteOpen, clearHideTimer, scheduleAutoHide, setIsOpen]);

  // Keyboard shortcuts (Cmd+K / Ctrl+K for Search, Cmd+B / Ctrl+B to toggle sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsPinned(prev => {
          const next = !prev;
          setIsOpen(next);
          return next;
        });
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsOpen, setIsPinned, setMobileMenuOpen]);

  const resetInactivityTimer = () => {
    if (!isPinned && isOpen && !commandPaletteOpen) {
      scheduleAutoHide(INACTIVITY_HIDE_MS);
    }
  };

  const handleSidebarMouseEnter = () => {
    setIsMouseInside(true);
    resetInactivityTimer();
  };

  const handleSidebarMouseMove = () => {
    if (!isMouseInside) setIsMouseInside(true);
    resetInactivityTimer();
  };

  const handleSidebarMouseLeave = () => {
    setIsMouseInside(false);
    if (!isPinned && isOpen && !commandPaletteOpen) {
      scheduleAutoHide(MOUSE_LEAVE_HIDE_MS);
    }
  };

  const handleEdgeHoverReveal = () => {
    if (Date.now() < suppressEdgeHoverUntilRef.current) return;
    if (!isOpen) {
      setIsOpen(true);
      setIsMouseInside(true);
    }
  };

  const handleTogglePin = () => {
    if (isPinned) {
      setIsPinned(false);
    } else {
      clearHideTimer();
      setIsPinned(true);
      setIsOpen(true);
    }
  };

  const handleHideSidebar = () => {
    clearHideTimer();
    suppressEdgeHoverUntilRef.current = Date.now() + 500;
    setIsPinned(false);
    setIsOpen(false);
    setIsMouseInside(false);
  };

  const handleNavClick = (tabId: string) => {
    setCurrentTab(tabId);
    setMobileMenuOpen(false);
    resetInactivityTimer();
  };

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

  const isSidebarShown = isPinned || isOpen;

  return (
    <>
      {/* Desktop Left-Edge Hover Sensor (reveals sidebar when hidden) */}
      {!isSidebarShown && (
        <div
          onMouseEnter={handleEdgeHoverReveal}
          className="hidden lg:flex fixed top-0 left-0 bottom-0 w-3.5 z-40 group cursor-e-resize items-center"
          title="Move mouse here to show sidebar"
        >
          <div className="w-1 h-20 rounded-r-full bg-blue-500/40 dark:bg-cyan-400/40 group-hover:bg-blue-500 dark:group-hover:bg-cyan-400 group-hover:w-1.5 transition-all" />
        </div>
      )}

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
        />
      )}

      {/* Left Sidebar (Desktop Auto-Hide / Pin + Mobile Drawer) */}
      <aside
        onMouseEnter={handleSidebarMouseEnter}
        onMouseMove={handleSidebarMouseMove}
        onMouseLeave={handleSidebarMouseLeave}
        onWheel={resetInactivityTimer}
        onMouseDown={resetInactivityTimer}
        onKeyDown={resetInactivityTimer}
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col backdrop-blur-2xl bg-white/95 dark:bg-[#090e1a]/95 border-r border-slate-200/90 dark:border-slate-800/90 transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        } ${
          isSidebarShown ? 'lg:translate-x-0' : 'lg:-translate-x-full'
        } ${
          !isPinned && isSidebarShown ? 'lg:shadow-2xl lg:shadow-black/40' : ''
        }`}
      >
        {/* Sidebar Brand & Pin / Hide Header */}
        <div className="px-3.5 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2">
          <div 
            className="flex items-center gap-2.5 cursor-pointer group select-none min-w-0"
            onClick={() => handleNavClick('courses')}
          >
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white shadow-md shadow-blue-500/20 ring-1 ring-white/20 shrink-0 group-hover:scale-105 transition-transform">
              <Network className="w-4 h-4 text-white" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-2 ring-white dark:ring-[#090e1a]" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 bg-clip-text text-transparent truncate">
                  Netplus
                </span>
                <span className="text-[8px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-blue-200/80 dark:border-cyan-800/50">
                  Academy
                </span>
              </div>
              <p className="hidden lg:block text-[9px] font-mono text-slate-400 dark:text-slate-500 truncate">
                {isPinned ? 'Sidebar Pinned' : 'Auto-hide Active'}
              </p>
            </div>
          </div>

          {/* Desktop Pin & Hide Controls */}
          <div className="hidden lg:flex items-center gap-1 shrink-0">
            <button
              onClick={handleTogglePin}
              className={`p-1.5 rounded-lg transition-colors ${
                isPinned
                  ? 'bg-blue-600/15 dark:bg-cyan-500/20 text-blue-600 dark:text-cyan-300 border border-blue-500/30 dark:border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={isPinned ? 'Unpin Sidebar (Enable Auto-Hide)' : 'Pin Sidebar Open'}
            >
              {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleHideSidebar}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Hide Sidebar"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Trigger Bar */}
        <div className="px-3 pt-3">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs bg-slate-100/90 dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-blue-400 dark:hover:border-cyan-500/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              <span>Quick Jump...</span>
            </span>
            <kbd className="inline-flex items-center text-[9px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400">
              <Command className="w-2.5 h-2.5 mr-0.5" />K
            </kbd>
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {/* Curriculum */}
          <div className="space-y-1">
            <p className="px-2.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Curriculum
            </p>
            <button
              onClick={() => handleNavClick('courses')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                currentTab === 'courses'
                  ? 'bg-blue-600/10 dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 border border-blue-500/20 dark:border-cyan-500/30 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>Courses</span>
            </button>

            <button
              onClick={() => handleNavClick('dashboard')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-blue-600/10 dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 border border-blue-500/20 dark:border-cyan-500/30 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>My Learning</span>
            </button>
          </div>

          {/* Hands-on Labs */}
          <div className="space-y-1">
            <p className="px-2.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Hands-on Labs
            </p>
            <button
              onClick={() => handleNavClick('lab-sandbox')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                currentTab === 'lab-sandbox'
                  ? 'bg-blue-600/10 dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 border border-blue-500/20 dark:border-cyan-500/30 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-cyan-500 shrink-0" />
                <span>Cisco CLI Sandbox</span>
              </span>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 font-bold">
                IOS
              </span>
            </button>

            <button
              onClick={() => handleNavClick('subnet-calc')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                currentTab === 'subnet-calc'
                  ? 'bg-blue-600/10 dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 border border-blue-500/20 dark:border-cyan-500/30 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <Calculator className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Subnet & VLSM Calc</span>
            </button>
          </div>

          {/* Community & Credentials */}
          <div className="space-y-1">
            <p className="px-2.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Community & Credentials
            </p>
            <button
              onClick={() => handleNavClick('certificates')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                currentTab === 'certificates'
                  ? 'bg-blue-600/10 dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 border border-blue-500/20 dark:border-cyan-500/30 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <Award className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Certificates</span>
            </button>

            <button
              onClick={() => handleNavClick('forum')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                currentTab === 'forum'
                  ? 'bg-blue-600/10 dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 border border-blue-500/20 dark:border-cyan-500/30 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span>Discussion Forum</span>
            </button>
          </div>

          {/* Administration (Instructor & Admin) */}
          {(currentUser.role === 'admin' || currentUser.role === 'instructor') && (
            <div className="space-y-1">
              <p className="px-2.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Administration
              </p>
              <button
                onClick={() => handleNavClick('management')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  currentTab === 'management'
                    ? 'bg-blue-600/10 dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 border border-blue-500/20 dark:border-cyan-500/30 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Settings className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Course Manager</span>
              </button>

              <button
                onClick={() => handleNavClick('analytics')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  currentTab === 'analytics'
                    ? 'bg-blue-600/10 dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 border border-blue-500/20 dark:border-cyan-500/30 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Live Analytics</span>
              </button>

              <button
                onClick={() => handleNavClick('lms')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  currentTab === 'lms'
                    ? 'bg-blue-600/10 dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 border border-blue-500/20 dark:border-cyan-500/30 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Globe className="w-4 h-4 text-purple-500 shrink-0" />
                <span>LMS & SCORM API</span>
              </button>
            </div>
          )}
        </div>

        {/* Slim Footer */}
        <div className="px-3.5 py-2.5 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-50/70 dark:bg-[#070b14]/60">
          <span>{isPinned ? 'Pinned Mode' : 'Auto-hide (3.5s)'}</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px]">
            Ctrl+B
          </kbd>
        </div>
      </aside>

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
