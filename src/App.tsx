import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AcademyProvider, useAcademy } from './context/AcademyContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { CourseCatalog } from './components/Courses/CourseCatalog';
import { CoursePlayer } from './components/Courses/CoursePlayer';
import { MyClassManager } from './components/Courses/MyClassManager';
import { StudentDashboard } from './components/Dashboard/StudentDashboard';
import { NetworkTopologySimulator } from './components/Lab/NetworkTopologySimulator';
import { NetworkDiagramDesigner } from './components/Lab/NetworkDiagramDesigner';
import { SubnettingCalculator } from './components/Lab/SubnettingCalculator';
import { NumberBaseConverter } from './components/Lab/NumberBaseConverter';
import { BinaryGame } from './components/Lab/BinaryGame';
import { FlashcardDeckView } from './components/Flashcards/FlashcardDeckView';
import { CertificateViewer } from './components/Certificates/CertificateViewer';
import { ManagementPanel } from './components/Admin/ManagementPanel';
import { AnalyticsDashboard } from './components/Admin/AnalyticsDashboard';
import { LMSIntegrationPanel } from './components/LMS/LMSIntegrationPanel';
import { DiscussionForum } from './components/Forum/DiscussionForum';
import { NotificationDrawer } from './components/Notifications/NotificationDrawer';
import { LoginPage } from './components/Auth/LoginPage';
import { PaymentGatewayModal } from './components/Billing/PaymentGatewayModal';
import { CoursePaymentModal } from './components/Billing/CoursePaymentModal';
import { Course, CoursePaymentRecord } from './types';
import { WifiOff, Network } from 'lucide-react';
import { OfflineIndicator } from './components/PWA/OfflineIndicator';
import { KeyboardShortcutsModal, ShortcutFeedbackToast } from './components/KeyboardShortcutsModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import {
  KeyboardShortcutDef,
  ManagementSubTabId,
  loadShortcutsEnabled,
  saveShortcutsEnabled
} from './utils/keyboardShortcuts';
import {
  isLabToolTabId,
  LabToolTabId,
  recordCourseAccess,
  recordLabAccess
} from './utils/recentActivity';

type ManagementSubTab = 'courses' | 'progress' | 'accounts' | 'invite-instructors' | 'invite-students';

const AcademyApp: React.FC = () => {
  const {
    currentUser,
    isOffline,
    toggleManualOfflineSim,
    courses,
    isAuthenticated,
    authReady,
    recordStudyTime,
  } = useAcademy();

  const [currentTab, setCurrentTab] = useState<string>('courses');
  const [managementSubTab, setManagementSubTab] = useState<ManagementSubTab>('courses');
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  // Left Sidebar Pin & Auto-Hide State (auto-hide active by default unless pinned)
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('netpulse_academy_sidebar_pinned_v2');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('netpulse_academy_sidebar_pinned_v2', JSON.stringify(isSidebarPinned));
    } catch {
      // ignore storage errors
    }
  }, [isSidebarPinned]);

  // Modals & Drawers
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [checkoutCourse, setCheckoutCourse] = useState<Course | null>(null);
  const [checkoutReceipt, setCheckoutReceipt] = useState<CoursePaymentRecord | null>(null);

  // Global Keyboard Shortcuts Manager
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [shortcutsEnabled, setShortcutsEnabled] = useState<boolean>(() => loadShortcutsEnabled());
  const [activeShortcutToast, setActiveShortcutToast] = useState<KeyboardShortcutDef | null>(null);
  const shortcutToastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (shortcutToastTimerRef.current !== null) {
        window.clearTimeout(shortcutToastTimerRef.current);
      }
    };
  }, []);

  const handleToggleShortcutsEnabled = useCallback((enabled: boolean) => {
    setShortcutsEnabled(enabled);
    saveShortcutsEnabled(enabled);
  }, []);

  const showShortcutToast = useCallback((shortcut: KeyboardShortcutDef) => {
    setActiveShortcutToast(shortcut);
    if (shortcutToastTimerRef.current !== null) {
      window.clearTimeout(shortcutToastTimerRef.current);
    }
    shortcutToastTimerRef.current = window.setTimeout(() => {
      setActiveShortcutToast(null);
      shortcutToastTimerRef.current = null;
    }, 1600);
  }, []);

  const handleNavigateTab = useCallback((tabId: string) => {
    if (tabId === 'pricing') {
      setIsPaymentOpen(true);
    } else {
      setCurrentTab(tabId);
      setActiveCourseId(null);
    }
  }, []);

  const handleSelectManagementTab = useCallback((subTab: ManagementSubTabId) => {
    setManagementSubTab(subTab);
    setCurrentTab('management');
    setActiveCourseId(null);
  }, []);

  const handleTriggerShortcutFromModal = useCallback(
    (shortcut: KeyboardShortcutDef) => {
      if (!shortcut.tabId) return;
      if (shortcut.tabId === 'management' && shortcut.managementSubTab) {
        handleSelectManagementTab(shortcut.managementSubTab);
      } else {
        handleNavigateTab(shortcut.tabId);
      }
      showShortcutToast(shortcut);
    },
    [handleNavigateTab, handleSelectManagementTab, showShortcutToast]
  );

  useKeyboardShortcuts({
    enabled: shortcutsEnabled,
    isAuthenticated,
    userRole: currentUser.role,
    isModalOpen:
      isNotificationsOpen ||
      isPaymentOpen ||
      Boolean(checkoutCourse || checkoutReceipt),
    isShortcutsModalOpen,
    onNavigateTab: handleNavigateTab,
    onSelectManagementTab: handleSelectManagementTab,
    onToggleShortcutsModal: () => setIsShortcutsModalOpen(prev => !prev),
    onCloseShortcutsModal: () => setIsShortcutsModalOpen(false),
    onShortcutTriggered: showShortcutToast
  });

  const handleSelectCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    setCurrentTab('player');
  };

  // Record Recent Activity whenever user opens a course or standalone lab tool
  useEffect(() => {
    if (!isAuthenticated || !currentUser.id) return;
    if (currentTab === 'player' && activeCourseId) {
      const targetCourse = courses.find(c => c.id === activeCourseId);
      if (targetCourse) {
        recordCourseAccess(currentUser.id, targetCourse);
      }
      return;
    }
    if (isLabToolTabId(currentTab)) {
      recordLabAccess(currentUser.id, currentTab);
    }
  }, [isAuthenticated, currentUser.id, currentTab, activeCourseId, courses]);

  // Track active study seconds when interacting with course content, lab simulator, or practice tools
  const lastInteractionAtRef = useRef<number>(Date.now());
  const recordStudyTimeRef = useRef(recordStudyTime);
  useEffect(() => {
    recordStudyTimeRef.current = recordStudyTime;
  }, [recordStudyTime]);

  useEffect(() => {
    const markActive = () => {
      lastInteractionAtRef.current = Date.now();
    };
    window.addEventListener('pointerdown', markActive, { passive: true });
    window.addEventListener('keydown', markActive, { passive: true });
    window.addEventListener('scroll', markActive, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('scroll', markActive);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const studySource =
      currentTab === 'player'
        ? 'course'
        : currentTab === 'lab-sandbox' || currentTab === 'network-designer'
        ? 'lab'
        : currentTab === 'subnet-calc' ||
          currentTab === 'base-converter' ||
          currentTab === 'binary-game' ||
          currentTab === 'flashcard'
        ? 'practice'
        : null;

    if (!studySource) return;
    lastInteractionAtRef.current = Date.now();

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastInteractionAtRef.current > 90000) return;
      recordStudyTimeRef.current(5, studySource);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [isAuthenticated, currentTab]);

  if (!authReady) {
    return (
      <>
        <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-lg">
              <Network className="w-5 h-5 animate-pulse" />
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Loading Netplus Academy...
            </p>
          </div>
        </div>
        <OfflineIndicator showOfflineToast={true} />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <OfflineIndicator showOfflineToast={true} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors flex flex-col font-sans">
      <OfflineIndicator showOfflineToast={false} />
      
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={handleNavigateTab}
        managementSubTab={managementSubTab}
        onSelectManagementTab={handleSelectManagementTab}
        isPinned={isSidebarPinned}
        setIsPinned={setIsSidebarPinned}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
      />

      {/* Workspace Content Wrapper: responds smoothly to expanded sidebar (256px) or collapsed icon rail (72px) */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${isSidebarPinned || isSidebarOpen ? 'lg:pl-64' : 'lg:pl-[72px]'}`}>

        {/* Sticky Top Bar (Top-right Fabric, Mode Toggle, Notifications, User Profile) */}
        <TopBar
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenPricing={() => setIsPaymentOpen(true)}
          onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
          isSidebarPinned={isSidebarPinned}
          isSidebarOpen={isSidebarOpen}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          onNavigateHome={() => {
            setCurrentTab('courses');
            setActiveCourseId(null);
          }}
        />

        {/* Offline Alert Bar */}
        {isOffline && (
          <div className="bg-amber-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 animate-bounce" />
              <span>
                <strong>Offline Mode Active:</strong> All course content, Subnetting calculator, and Cisco CLI terminal sandbox are fully accessible offline.
              </span>
            </div>
            <button
              onClick={toggleManualOfflineSim}
              className="px-2.5 py-0.5 rounded bg-white/20 hover:bg-white/30 text-[11px] font-mono transition-colors"
            >
              Reconnect Network
            </button>
          </div>
        )}

        {/* Main Content Area: tighter margins & full width when sidebar is auto-hidden into icon rail */}
        <main className={`flex-1 w-full min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarPinned || isSidebarOpen
            ? 'max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-7 py-6'
            : 'max-w-none px-3 sm:px-4 lg:px-5 py-5'
        }`}>
        
        {/* Learning Player */}
        {currentTab === 'player' && activeCourseId && (
          <CoursePlayer
            courseId={activeCourseId}
            onBack={() => {
              setActiveCourseId(null);
              setCurrentTab('courses');
            }}
            onViewCertificates={() => setCurrentTab('certificates')}
            onOpenPricing={() => setIsPaymentOpen(true)}
            onOpenCourseCheckout={(course) => {
              setCheckoutReceipt(null);
              setCheckoutCourse(course);
            }}
          />
        )}

        {/* Course Catalog */}
        {currentTab === 'courses' && (
          <CourseCatalog
            onSelectCourse={handleSelectCourse}
            onOpenPaymentModal={() => setIsPaymentOpen(true)}
            onOpenCourseCheckout={(course) => {
              setCheckoutReceipt(null);
              setCheckoutCourse(course);
            }}
          />
        )}

        {/* Student Dashboard */}
        {currentTab === 'dashboard' && (
          <StudentDashboard
            onSelectCourse={handleSelectCourse}
            onViewCertificates={() => setCurrentTab('certificates')}
            onOpenPricing={() => setIsPaymentOpen(true)}
            onOpenCliLab={() => handleNavigateTab('lab-sandbox')}
            onOpenLabTab={(tabId: LabToolTabId) => handleNavigateTab(tabId)}
            onBrowseCourses={() => handleNavigateTab('courses')}
            onOpenCourseCheckout={(course, receipt) => {
              setCheckoutCourse(course);
              setCheckoutReceipt(receipt || null);
            }}
          />
        )}

        {/* Standalone Network Topology & Cisco Lab Simulator */}
        {currentTab === 'lab-sandbox' && (
          <NetworkTopologySimulator key={currentUser.id} />
        )}

        {/* Standalone Visio-style Network Diagram & Topology Designer */}
        {currentTab === 'network-designer' && (
          <NetworkDiagramDesigner />
        )}

        {/* Subnetting & VLSM Calculator */}
        {currentTab === 'subnet-calc' && (
          <SubnettingCalculator />
        )}

        {/* Binary, Decimal & Hexadecimal Base Converter */}
        {currentTab === 'base-converter' && (
          <NumberBaseConverter />
        )}

        {/* Binary Conversion Practice Game */}
        {currentTab === 'binary-game' && (
          <BinaryGame />
        )}

        {/* AI Networking Flashcards */}
        {currentTab === 'flashcard' && (
          <FlashcardDeckView />
        )}

        {/* Discussion Forum */}
        {currentTab === 'forum' && (
          <DiscussionForum />
        )}

        {/* Certificates Registry */}
        {currentTab === 'certificates' && (
          <CertificateViewer
            onSelectCourseToEarn={() => setCurrentTab('courses')}
          />
        )}

        {/* My Class (Admin & Instructor Class & Enrollment Workspace) */}
        {currentTab === 'my-class' && (
          <MyClassManager onOpenCoursePlayer={handleSelectCourse} />
        )}

        {/* Admin Management Panel */}
        {currentTab === 'management' && (
          <ManagementPanel initialTab={managementSubTab} />
        )}

        {/* Analytics Dashboard */}
        {currentTab === 'analytics' && (
          <AnalyticsDashboard />
        )}

        {/* LMS API Integrations */}
        {currentTab === 'lms' && (
          <LMSIntegrationPanel />
        )}

      </main>

      {/* System Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* Subscription Checkout Modal */}
      <PaymentGatewayModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
      />

      {/* Per-Course Student Enrollment Checkout Modal */}
      <CoursePaymentModal
        course={checkoutCourse}
        initialReceipt={checkoutReceipt}
        isOpen={Boolean(checkoutCourse || checkoutReceipt)}
        onClose={() => {
          setCheckoutCourse(null);
          setCheckoutReceipt(null);
        }}
        onPaymentSuccess={(paidCourse) => {
          setCheckoutCourse(null);
          setCheckoutReceipt(null);
          handleSelectCourse(paidCourse.id);
        }}
      />

      {/* Global Keyboard Shortcuts Reference Modal & Feedback Toast */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
        userRole={currentUser.role}
        shortcutsEnabled={shortcutsEnabled}
        onToggleShortcutsEnabled={handleToggleShortcutsEnabled}
        currentTab={currentTab}
        onTriggerShortcut={handleTriggerShortcutFromModal}
      />
      <ShortcutFeedbackToast shortcut={activeShortcutToast} />

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 py-6 text-xs text-slate-500 dark:text-slate-400">
        <div className={`w-full flex flex-col sm:flex-row items-center justify-between gap-3 transition-all duration-300 ${
          isSidebarPinned || isSidebarOpen
            ? 'max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-7'
            : 'max-w-none px-3 sm:px-4 lg:px-5'
        }`}>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">Netplus Academy</span>
            <span>• Enterprise Networking Certification LMS</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>LTI 1.3 Advantage Ready</span>
            <span>•</span>
            <span>SCORM 2004</span>
            <span>•</span>
            <span>256-bit SSL</span>
          </div>
        </div>
      </footer>

      </div>
    </div>
  );
};

export default function App() {
  return (
    <AcademyProvider>
      <AcademyApp />
    </AcademyProvider>
  );
}
