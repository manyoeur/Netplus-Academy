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
  Calculator,
  X,
  Search,
  Command,
  ArrowRight,
  ChevronRight,
  Globe,
  Pin,
  PinOff,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
  Users,
  UserCog,
  GraduationCap,
  Binary,
  Gamepad2,
  SquareStack,
  LucideIcon
} from 'lucide-react';
import { useAcademy } from '../context/AcademyContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  managementSubTab?: 'courses' | 'progress' | 'accounts' | 'invite-instructors' | 'invite-students';
  onSelectManagementTab?: (subTab: 'courses' | 'progress' | 'accounts' | 'invite-instructors' | 'invite-students') => void;
  isPinned: boolean;
  setIsPinned: React.Dispatch<React.SetStateAction<boolean>>;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

interface NavItemConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  accentText: string;
  accentBg: string;
  accentBar: string;
  tag?: string;
}

interface NavSectionConfig {
  title: string;
  items: NavItemConfig[];
}

const INACTIVITY_HIDE_MS = 3500;
const MOUSE_LEAVE_HIDE_MS = 650;
const HOVER_EXPAND_DELAY_MS = 90;

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  managementSubTab = 'courses',
  onSelectManagementTab,
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
  const [railTooltip, setRailTooltip] = useState<{ label: string; top: number } | null>(null);

  const asideRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const hoverExpandTimerRef = useRef<number | null>(null);
  const suppressHoverUntilRef = useRef<number>(0);

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

  const clearHoverExpandTimer = useCallback(() => {
    if (hoverExpandTimerRef.current !== null) {
      window.clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }
  }, []);

  const scheduleAutoHide = useCallback((delayMs: number) => {
    clearHideTimer();
    if (isPinnedRef.current || commandPaletteOpenRef.current) return;
    hideTimerRef.current = window.setTimeout(() => {
      if (isPinnedRef.current || commandPaletteOpenRef.current) return;
      suppressHoverUntilRef.current = Date.now() + 450;
      setIsOpen(false);
    }, delayMs);
  }, [clearHideTimer, setIsOpen]);

  // Keep open when pinned; start inactivity auto-hide timer whenever expanded while unpinned
  useEffect(() => {
    if (isPinned) {
      clearHideTimer();
      setIsOpen(true);
    } else if (isOpen && !commandPaletteOpen) {
      scheduleAutoHide(INACTIVITY_HIDE_MS);
    } else {
      clearHideTimer();
    }
    return () => {
      clearHideTimer();
    };
  }, [isPinned, isOpen, commandPaletteOpen, clearHideTimer, scheduleAutoHide, setIsOpen]);

  useEffect(() => {
    return () => {
      clearHideTimer();
      clearHoverExpandTimer();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [clearHideTimer, clearHoverExpandTimer]);

  // Keyboard shortcuts (Cmd+K / Ctrl+K for Search, Cmd+B / Ctrl+B to toggle pin/expand)
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
    clearHideTimer();
    if (!isOpen && !isPinned) {
      if (Date.now() < suppressHoverUntilRef.current) return;
      clearHoverExpandTimer();
      hoverExpandTimerRef.current = window.setTimeout(() => {
        setRailTooltip(null);
        setIsOpen(true);
      }, HOVER_EXPAND_DELAY_MS);
    } else {
      resetInactivityTimer();
    }
  };

  const handleSidebarMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const asideEl = asideRef.current;
    if (asideEl) {
      const rect = asideEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = window.requestAnimationFrame(() => {
        asideEl.style.setProperty('--mx', `${x}px`);
        asideEl.style.setProperty('--my', `${y}px`);
      });
    }

    if (isOpen) {
      resetInactivityTimer();
    }
  };

  const handleSidebarMouseLeave = () => {
    clearHoverExpandTimer();
    setRailTooltip(null);
    if (asideRef.current) {
      asideRef.current.style.setProperty('--mx', '-200px');
      asideRef.current.style.setProperty('--my', '-200px');
    }
    if (!isPinned && isOpen && !commandPaletteOpen) {
      scheduleAutoHide(MOUSE_LEAVE_HIDE_MS);
    }
  };

  const handleTogglePin = () => {
    clearHoverExpandTimer();
    if (isPinned) {
      setIsPinned(false);
    } else {
      clearHideTimer();
      setIsPinned(true);
      setIsOpen(true);
    }
  };

  const handleCollapseToIcons = () => {
    clearHideTimer();
    clearHoverExpandTimer();
    suppressHoverUntilRef.current = Date.now() + 600;
    setIsPinned(false);
    setIsOpen(false);
  };

  const handleExpandSidebar = () => {
    clearHoverExpandTimer();
    setRailTooltip(null);
    setIsOpen(true);
  };

  const handleNavClick = (tabId: string) => {
    if (tabId === 'accounts') {
      onSelectManagementTab?.('accounts');
    } else if (tabId === 'invite-instructors') {
      onSelectManagementTab?.('invite-instructors');
    } else if (tabId === 'invite-students') {
      onSelectManagementTab?.('invite-students');
    } else if (tabId === 'management') {
      onSelectManagementTab?.('courses');
    } else {
      setCurrentTab(tabId);
    }
    setMobileMenuOpen(false);
    setRailTooltip(null);
    resetInactivityTimer();
  };

  const isAdminOnly = currentUser.role === 'admin';
  const isAdminOrInstructor = currentUser.role === 'admin' || currentUser.role === 'instructor';

  const isNavItemActive = (itemId: string) => {
    if (itemId === 'accounts') {
      return currentTab === 'management' && managementSubTab === 'accounts';
    }
    if (itemId === 'invite-instructors') {
      return currentTab === 'management' && managementSubTab === 'invite-instructors';
    }
    if (itemId === 'invite-students') {
      return currentTab === 'management' && managementSubTab === 'invite-students';
    }
    if (itemId === 'management') {
      return currentTab === 'management' && (managementSubTab === 'courses' || managementSubTab === 'progress');
    }
    return currentTab === itemId;
  };

  const navSections: NavSectionConfig[] = [
    {
      title: 'Curriculum',
      items: [
        {
          id: 'courses',
          label: 'Courses',
          icon: Layers,
          accentText: 'text-blue-600 dark:text-cyan-400',
          accentBg: 'bg-blue-50 dark:bg-blue-950/60',
          accentBar: 'bg-blue-600 dark:bg-cyan-400'
        },
        {
          id: 'dashboard',
          label: 'My Learning',
          icon: UserCheck,
          accentText: 'text-indigo-600 dark:text-indigo-400',
          accentBg: 'bg-indigo-50 dark:bg-indigo-950/60',
          accentBar: 'bg-indigo-600 dark:bg-indigo-400'
        },
        {
          id: 'flashcard',
          label: 'Flashcard',
          icon: SquareStack,
          accentText: 'text-cyan-600 dark:text-cyan-400',
          accentBg: 'bg-cyan-50 dark:bg-cyan-950/60',
          accentBar: 'bg-cyan-500',
          tag: 'AI'
        }
      ]
    },
    {
      title: 'Hands-on Labs',
      items: [
        {
          id: 'lab-sandbox',
          label: 'Lab Simulation',
          icon: Network,
          accentText: 'text-cyan-600 dark:text-cyan-400',
          accentBg: 'bg-cyan-50 dark:bg-cyan-950/60',
          accentBar: 'bg-cyan-500',
          tag: 'SIM'
        },
        {
          id: 'subnet-calc',
          label: 'Subnet & VLSM Calc',
          icon: Calculator,
          accentText: 'text-sky-600 dark:text-sky-400',
          accentBg: 'bg-sky-50 dark:bg-sky-950/60',
          accentBar: 'bg-sky-500'
        },
        {
          id: 'base-converter',
          label: 'Base Converter',
          icon: Binary,
          accentText: 'text-indigo-600 dark:text-indigo-400',
          accentBg: 'bg-indigo-50 dark:bg-indigo-950/60',
          accentBar: 'bg-indigo-500'
        },
        {
          id: 'binary-game',
          label: 'Binary Game',
          icon: Gamepad2,
          accentText: 'text-emerald-600 dark:text-emerald-400',
          accentBg: 'bg-emerald-50 dark:bg-emerald-950/60',
          accentBar: 'bg-emerald-500'
        }
      ]
    },
    {
      title: 'Community & Credentials',
      items: [
        {
          id: 'certificates',
          label: 'Certificates',
          icon: Award,
          accentText: 'text-amber-600 dark:text-amber-400',
          accentBg: 'bg-amber-50 dark:bg-amber-950/50',
          accentBar: 'bg-amber-500'
        },
        {
          id: 'forum',
          label: 'Discussion Forum',
          icon: MessageSquare,
          accentText: 'text-violet-600 dark:text-violet-400',
          accentBg: 'bg-violet-50 dark:bg-violet-950/50',
          accentBar: 'bg-violet-500'
        }
      ]
    },
    ...(isAdminOrInstructor
      ? [
          {
            title: 'Administration',
            items: [
              ...(isAdminOnly
                ? [
                    {
                      id: 'accounts',
                      label: 'User Accounts',
                      icon: UserCog,
                      accentText: 'text-blue-600 dark:text-cyan-400',
                      accentBg: 'bg-blue-50 dark:bg-blue-950/60',
                      accentBar: 'bg-blue-600 dark:bg-cyan-400'
                    },
                    {
                      id: 'invite-instructors',
                      label: 'Invite Instructors',
                      icon: UserPlus,
                      accentText: 'text-indigo-600 dark:text-indigo-400',
                      accentBg: 'bg-indigo-50 dark:bg-indigo-950/60',
                      accentBar: 'bg-indigo-500'
                    },
                    {
                      id: 'invite-students',
                      label: 'Invite Students',
                      icon: Users,
                      accentText: 'text-emerald-600 dark:text-emerald-400',
                      accentBg: 'bg-emerald-50 dark:bg-emerald-950/60',
                      accentBar: 'bg-emerald-500'
                    }
                  ]
                : []),
              {
                id: 'my-class',
                label: 'My Class',
                icon: GraduationCap,
                accentText: 'text-cyan-600 dark:text-cyan-400',
                accentBg: 'bg-cyan-50 dark:bg-cyan-950/60',
                accentBar: 'bg-cyan-500'
              },
              {
                id: 'management',
                label: 'Course Manager',
                icon: Settings,
                accentText: 'text-blue-600 dark:text-blue-400',
                accentBg: 'bg-blue-50 dark:bg-blue-950/60',
                accentBar: 'bg-blue-500'
              },
              {
                id: 'analytics',
                label: 'Live Analytics',
                icon: BarChart3,
                accentText: 'text-emerald-600 dark:text-emerald-400',
                accentBg: 'bg-emerald-50 dark:bg-emerald-950/60',
                accentBar: 'bg-emerald-500'
              },
              {
                id: 'lms',
                label: 'LMS & SCORM API',
                icon: Globe,
                accentText: 'text-purple-600 dark:text-purple-400',
                accentBg: 'bg-purple-50 dark:bg-purple-950/60',
                accentBar: 'bg-purple-500'
              }
            ]
          }
        ]
      : [])
  ];

  const railNavItems = navSections.flatMap(section => section.items);

  const quickJumpItems = [
    { id: 'courses', label: 'Course Catalog & Syllabus', category: 'Curriculum', icon: Layers },
    { id: 'dashboard', label: 'My Enrolled Courses & Progress', category: 'Learning', icon: UserCheck },
    { id: 'flashcard', label: 'Flashcard · AI Terminology, Protocols & Ports Deck', category: 'Curriculum', icon: SquareStack },
    { id: 'lab-sandbox', label: 'Lab Simulation · Network Topology & Cisco Lab', category: 'Hands-on Labs', icon: Network },
    { id: 'subnet-calc', label: 'Subnetting & VLSM Architecture Calculator', category: 'Hands-on Labs', icon: Calculator },
    { id: 'base-converter', label: 'Binary, Decimal & Hexadecimal Converter', category: 'Hands-on Labs', icon: Binary },
    { id: 'binary-game', label: 'Binary Conversion Practice Game', category: 'Hands-on Labs', icon: Gamepad2 },
    { id: 'certificates', label: 'Verifiable Digital Credentials & Registry', category: 'Certificates', icon: Award },
    { id: 'forum', label: 'Network Engineers Discussion Forum', category: 'Community', icon: MessageSquare },
    { id: 'pricing', label: 'Subscription Tiers & Pro Checkout', category: 'Account', icon: CreditCard },
    ...(isAdminOnly
      ? [
          { id: 'accounts', label: 'Manage Instructor & Student Accounts', category: 'Administration', icon: UserCog },
          { id: 'invite-instructors', label: 'Invite Instructors & Faculty Onboarding', category: 'Administration', icon: UserPlus },
          { id: 'invite-students', label: 'Invite Students & Cohort Registration', category: 'Administration', icon: Users }
        ]
      : []),
    ...(isAdminOrInstructor
      ? [
          { id: 'my-class', label: 'My Class · Classes, Attendance & Enrollment', category: 'Administration', icon: GraduationCap },
          { id: 'management', label: 'Admin Course Manager & Enrollment Telemetry', category: 'Administration', icon: Settings },
          { id: 'analytics', label: 'Real-Time Learner Activity Stream', category: 'Administration', icon: BarChart3 },
          { id: 'lms', label: 'External LMS (Canvas / Blackboard / SCORM)', category: 'Administration', icon: Globe }
        ]
      : [])
  ];

  const filteredQuickJumps = quickJumpItems.filter(
    item =>
      item.label.toLowerCase().includes(commandSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(commandSearch.toLowerCase())
  );

  const isSidebarShown = isPinned || isOpen;
  const isExpandedView = isSidebarShown || mobileMenuOpen;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
        />
      )}

      {/* Left Sidebar: Desktop expands (w-64) or auto-hides into Compact Icon Rail (lg:w-[72px]); Mobile is slide-over drawer */}
      <aside
        ref={asideRef}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseMove={handleSidebarMouseMove}
        onMouseLeave={handleSidebarMouseLeave}
        onWheel={resetInactivityTimer}
        onMouseDown={resetInactivityTimer}
        onKeyDown={resetInactivityTimer}
        className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col backdrop-blur-2xl bg-white/95 dark:bg-[#090e1a]/95 border-r border-slate-200/90 dark:border-slate-800/90 transition-[width,transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none overflow-hidden ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        } lg:translate-x-0 w-64 ${
          isSidebarShown ? 'lg:w-64' : 'lg:w-[72px]'
        } ${
          !isPinned && isSidebarShown ? 'lg:shadow-2xl lg:shadow-slate-900/15 dark:lg:shadow-black/45' : ''
        }`}
      >
        {/* Subtle cursor-tracking ambient radial spotlight */}
        <div className="sidebar-spotlight pointer-events-none absolute inset-0 z-0 transition-opacity duration-300" />

        {isExpandedView ? (
          <div className="relative z-10 flex flex-col h-full min-w-0">
            {/* Expanded Sidebar Header */}
            <div className="px-3.5 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleNavClick('courses')}
                className="flex items-center gap-2.5 cursor-pointer group/brand select-none min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
              >
                <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/20 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/brand:scale-105 group-hover/brand:shadow-indigo-500/35 motion-reduce:transition-none">
                  <Network className="w-4 h-4 text-white" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-col leading-tight">
                    <span className="text-[13px] font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500 bg-clip-text text-transparent truncate">
                      Network Plus
                    </span>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 transition-colors group-hover/brand:text-slate-900 dark:group-hover/brand:text-white">
                      Academy
                    </span>
                  </div>
                  <p className="hidden lg:block text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {isPinned ? 'Pinned workspace' : 'Auto-hide active'}
                  </p>
                </div>
              </button>

              {/* Desktop Pin & Collapse-to-Rail Controls */}
              <div className="hidden lg:flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleTogglePin}
                  className={`p-2 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isPinned
                      ? 'bg-blue-600/12 dark:bg-cyan-500/20 text-blue-600 dark:text-cyan-300 border border-blue-500/25 dark:border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                  title={isPinned ? 'Unpin Sidebar (Enable Auto-Hide)' : 'Pin Sidebar Open'}
                  aria-label={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
                >
                  {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={handleCollapseToIcons}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all duration-150 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  title="Collapse to Icon Rail"
                  aria-label="Collapse to Icon Rail"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Mobile Close Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close Menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Quick Jump Search Bar */}
            <div className="px-3 pt-3">
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="group/search w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs bg-slate-100/80 dark:bg-[#0d1424]/90 border border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-[#111a2e] hover:border-blue-400/70 dark:hover:border-cyan-500/50 hover:text-slate-800 dark:hover:text-slate-100 hover:shadow-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 transition-transform duration-150 group-hover/search:scale-110 group-hover/search:text-blue-500 dark:group-hover/search:text-cyan-400" />
                  <span>Quick Jump...</span>
                </span>
                <kbd className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 group-hover/search:text-slate-700 dark:group-hover/search:text-slate-200 group-hover/search:border-slate-300 dark:group-hover/search:border-slate-600 transition-colors">
                  <Command className="w-2.5 h-2.5 mr-0.5" />K
                </kbd>
              </button>
            </div>

            {/* Expanded Interactive Navigation Links */}
            <nav aria-label="Primary Sidebar Navigation" className="flex-1 overflow-y-auto px-3 py-3.5 space-y-5">
              {navSections.map(section => (
                <div key={section.title} className="space-y-1">
                  <p className="px-2.5 pb-0.5 text-[11px] font-semibold tracking-wide text-slate-400 dark:text-slate-500">
                    {section.title}
                  </p>

                  {section.items.map(item => {
                    const Icon = item.icon;
                    const active = isNavItemActive(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavClick(item.id)}
                        className={`group/nav relative w-full min-h-[40px] flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          active
                            ? 'bg-slate-900 dark:bg-gradient-to-r dark:from-indigo-600/95 dark:to-blue-600/95 text-white border-slate-900 dark:border-indigo-400/30 shadow-md shadow-slate-900/10 dark:shadow-indigo-500/20'
                            : 'border-transparent text-slate-600 dark:text-slate-400 hover:translate-x-0.5 hover:bg-slate-100/90 dark:hover:bg-slate-800/75 hover:border-slate-200/90 dark:hover:border-slate-700/70 hover:text-slate-950 dark:hover:text-white hover:shadow-xs'
                        }`}
                      >
                        {/* Smooth inner micro-indicator line that fades & scales in on hover */}
                        <span
                          aria-hidden="true"
                          className={`absolute left-1 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            active
                              ? 'h-5 bg-cyan-400 opacity-100 scale-y-100'
                              : `h-4 ${item.accentBar} opacity-0 scale-y-50 group-hover/nav:opacity-100 group-hover/nav:scale-y-100`
                          }`}
                        />

                        <span className="flex items-center gap-2.5 pl-1.5 min-w-0 flex-1">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-[transform,background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                              active
                                ? 'bg-white/15 text-white shadow-inner'
                                : `${item.accentBg} ${item.accentText} group-hover/nav:scale-110 group-hover/nav:shadow-xs`
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>

                          <span className="truncate whitespace-nowrap transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/nav:translate-x-0.5">
                            {item.label}
                          </span>
                        </span>

                        <span className="flex items-center gap-1.5 shrink-0">
                          {item.tag && (
                            <span
                              className={`text-[10px] font-mono font-bold tracking-wide transition-colors ${
                                active
                                  ? 'text-cyan-200'
                                  : 'text-slate-400 dark:text-slate-500 group-hover/nav:text-cyan-600 dark:group-hover/nav:text-cyan-400'
                              }`}
                            >
                              {item.tag}
                            </span>
                          )}
                          <ChevronRight
                            aria-hidden="true"
                            className={`w-3.5 h-3.5 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                              active
                                ? 'opacity-80 translate-x-0 text-white'
                                : 'opacity-0 -translate-x-1.5 text-slate-400 dark:text-slate-500 group-hover/nav:opacity-80 group-hover/nav:translate-x-0 group-hover/nav:text-slate-700 dark:group-hover/nav:text-slate-200'
                            }`}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Slim Footer */}
            <div className="px-3.5 py-2.5 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-50/70 dark:bg-[#070b14]/60">
              <span>{isPinned ? 'Pinned Mode' : 'Auto-hide (3.5s)'}</span>
              <button
                type="button"
                onClick={handleTogglePin}
                className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px] hover:border-blue-400 dark:hover:border-cyan-500/60 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title="Toggle Pin Mode (Ctrl+B)"
              >
                Ctrl+B
              </button>
            </div>
          </div>
        ) : (
          /* Collapsed Auto-Hide Icon Rail (Desktop) */
          <div className="relative z-10 flex flex-col items-center h-full py-3.5">
            {/* Top Brand Symbol */}
            <div className="w-full flex justify-center pb-3.5 border-b border-slate-200/80 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => handleNavClick('courses')}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setRailTooltip({ label: 'Network Plus Academy Home', top: rect.top + rect.height / 2 });
                }}
                onMouseLeave={() => setRailTooltip(null)}
                className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/20 hover:scale-105 active:scale-95 transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Network Plus Academy Home"
              >
                <Network className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Menu Symbol Icons Column */}
            <div className="flex-1 w-full overflow-y-auto py-3.5 flex flex-col items-center gap-1.5">
              {railNavItems.map(item => {
                const Icon = item.icon;
                const isActive = isNavItemActive(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setRailTooltip({ label: item.label, top: rect.top + rect.height / 2 });
                    }}
                    onMouseLeave={() => setRailTooltip(null)}
                    aria-label={item.label}
                    className={`group/rail relative flex items-center justify-center w-11 h-11 rounded-xl border transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isActive
                        ? 'bg-slate-900 dark:bg-gradient-to-tr dark:from-indigo-600 dark:to-blue-600 text-white border-slate-900 dark:border-indigo-400/30 shadow-md shadow-slate-900/15 dark:shadow-indigo-500/30'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:scale-105 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/95 dark:hover:bg-slate-800/80 hover:border-slate-200/80 dark:hover:border-slate-700/70 hover:shadow-xs'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] transition-transform duration-150 group-hover/rail:scale-110" />
                  </button>
                );
              })}
            </div>

            {/* Bottom Rail Controls (Expand & Pin) */}
            <div className="w-full pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={handleExpandSidebar}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setRailTooltip({ label: 'Expand Sidebar', top: rect.top + rect.height / 2 });
                }}
                onMouseLeave={() => setRailTooltip(null)}
                className="p-2.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:scale-105 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Expand Sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleTogglePin}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setRailTooltip({ label: 'Pin Sidebar Open (Ctrl+B)', top: rect.top + rect.height / 2 });
                }}
                onMouseLeave={() => setRailTooltip(null)}
                className="p-2.5 rounded-xl text-slate-400 hover:text-blue-600 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:scale-105 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Pin Sidebar Open"
              >
                <Pin className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Instant Floating Hover Tooltip for Collapsed Rail (positioned at viewport layer so scrollbars never clip it) */}
      {!isExpandedView && railTooltip && (
        <div
          role="tooltip"
          style={{ top: railTooltip.top }}
          className="hidden lg:flex fixed left-[82px] -translate-y-1/2 z-50 pointer-events-none items-center px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold border border-slate-800 dark:border-slate-700 shadow-lg whitespace-nowrap transition-opacity duration-150"
        >
          {railTooltip.label}
        </div>
      )}

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
                    type="button"
                    onClick={() => {
                      handleNavClick(item.id);
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/60 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 transition-transform duration-150 group-hover:scale-105">
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
              <span>Network Plus Academy Quick Jump</span>
              <span>ESC to dismiss</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
