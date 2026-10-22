import React, { useState } from 'react';
import { AcademyProvider, useAcademy } from './context/AcademyContext';
import { Navbar } from './components/Navbar';
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
import { NetGeniusTutor } from './components/AI/NetGeniusTutor';
import { NotificationDrawer } from './components/Notifications/NotificationDrawer';
import { LoginModal } from './components/Auth/LoginModal';
import { PaymentGatewayModal } from './components/Billing/PaymentGatewayModal';
import { WifiOff, RefreshCw, Terminal, Layers } from 'lucide-react';

const AcademyApp: React.FC = () => {
  const { isOffline, toggleManualOfflineSim, courses } = useAcademy();

  const [currentTab, setCurrentTab] = useState<string>('courses');
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  // Modals & Drawers
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAITutorOpen, setIsAITutorOpen] = useState(false);
  const [aiTutorInitialPrompt, setAiTutorInitialPrompt] = useState<string>('');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const handleSelectCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    setCurrentTab('player');
  };

  const handleOpenAITutorWithPrompt = (prompt: string) => {
    setAiTutorInitialPrompt(prompt);
    setIsAITutorOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors flex flex-col font-sans">
      
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

      {/* Main Top Header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab === 'pricing') {
            setIsPaymentOpen(true);
          } else {
            setCurrentTab(tab);
            setActiveCourseId(null);
          }
        }}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenAITutor={() => {
          setAiTutorInitialPrompt('');
          setIsAITutorOpen(true);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Learning Player */}
        {currentTab === 'player' && activeCourseId && (
          <CoursePlayer
            courseId={activeCourseId}
            onBack={() => {
              setActiveCourseId(null);
              setCurrentTab('courses');
            }}
            onOpenAITutorWithPrompt={handleOpenAITutorWithPrompt}
            onViewCertificates={() => setCurrentTab('certificates')}
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
              onAskAI={handleOpenAITutorWithPrompt}
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
          <ManagementPanel />
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

      {/* Floating NetGenius AI Chat Drawer */}
      <NetGeniusTutor
        isOpen={isAITutorOpen}
        onClose={() => setIsAITutorOpen(false)}
        initialPrompt={aiTutorInitialPrompt}
      />

      {/* System Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* Login & Role Switcher Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />

      {/* Subscription Checkout Modal */}
      <PaymentGatewayModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 py-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
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
  );
};

export default function App() {
  return (
    <AcademyProvider>
      <AcademyApp />
    </AcademyProvider>
  );
}
