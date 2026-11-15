import React, { useState, useEffect } from 'react';
import { AcademyProvider, useAcademy } from './context/AcademyContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { CourseCatalog } from './components/Courses/CourseCatalog';
import { CoursePlayer } from './components/Courses/CoursePlayer';
import { StudentDashboard } from './components/Dashboard/StudentDashboard';
import { InteractiveCliTerminal } from './components/Lab/InteractiveCliTerminal';
import { SubnettingCalculator } from './components/Lab/SubnettingCalculator';
import { CertificateViewer } from './components/Certificates/CertificateViewer';
import { ManagementPanel } from './components/Admin/ManagementPanel';
import { AnalyticsDashboard } from './components/Admin/AnalyticsDashboard';
import { LMSIntegrationPanel } from './components/LMS/LMSIntegrationPanel';
import { DiscussionForum } from './components/Forum/DiscussionForum';
import { NotificationDrawer } from './components/Notifications/NotificationDrawer';
import { LoginPage } from './components/Auth/LoginPage';
import { PaymentGatewayModal } from './components/Billing/PaymentGatewayModal';
import { WifiOff, Terminal, Network } from 'lucide-react';

type ManagementSubTab = 'courses' | 'progress' | 'accounts' | 'invite-instructors' | 'invite-students';

const AcademyApp: React.FC = () => {
  const { isOffline, toggleManualOfflineSim, courses, isAuthenticated, authReady } = useAcademy();

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

  const handleSelectCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    setCurrentTab('player');
  };

  if (!authReady) {
    return (
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
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors flex flex-col font-sans">
      
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab === 'pricing') {
            setIsPaymentOpen(true);
          } else {
            setCurrentTab(tab);
            setActiveCourseId(null);
          }
        }}
        managementSubTab={managementSubTab}
        onSelectManagementTab={(subTab) => {
          setManagementSubTab(subTab);
          setCurrentTab('management');
          setActiveCourseId(null);
        }}
        isPinned={isSidebarPinned}
        setIsPinned={setIsSidebarPinned}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Workspace Content Wrapper: responds smoothly to expanded sidebar (256px) or collapsed icon rail (72px) */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${isSidebarPinned || isSidebarOpen ? 'lg:pl-64' : 'lg:pl-[72px]'}`}>

        {/* Sticky Top Bar (Top-right Fabric, Mode Toggle, Notifications, User Profile) */}
        <TopBar
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenPricing={() => setIsPaymentOpen(true)}
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
        <main className={`flex-1 w-full transition-all duration-300 ease-in-out ${
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
          />
        )}

        {/* Course Catalog */}
        {currentTab === 'courses' && (
          <CourseCatalog
            onSelectCourse={handleSelectCourse}
            onOpenPaymentModal={() => setIsPaymentOpen(true)}
          />
        )}

        {/* Student Dashboard */}
        {currentTab === 'dashboard' && (
          <StudentDashboard
            onSelectCourse={handleSelectCourse}
            onViewCertificates={() => setCurrentTab('certificates')}
            onOpenPricing={() => setIsPaymentOpen(true)}
            onOpenCliLab={() => setCurrentTab('lab-sandbox')}
          />
        )}

        {/* Standalone Cisco CLI Lab Sandbox */}
        {currentTab === 'lab-sandbox' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-white flex items-center justify-between">
              <div>
                <h1 className="text-base font-bold flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-cyan-400" />
                  <span>Standalone Cisco IOS Sandbox & Dynamic Topology</span>
                </h1>
                <p className="text-xs text-slate-300">
                  Full command-line router & switch virtualization. Enter configuration mode, set up OSPF Area 0, or diagnose routing loops.
                </p>
              </div>
            </div>

            <InteractiveCliTerminal
              module={courses[0].modules[2]}
              courseId={courses[0].id}
            />
          </div>
        )}

        {/* Subnetting & VLSM Calculator */}
        {currentTab === 'subnet-calc' && (
          <SubnettingCalculator />
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
