import React, { useState } from 'react';
import {
  Plus,
  Layers,
  Edit3,
  Trash2,
  CheckCircle,
  Search,
  Mail,
  Activity,
  X,
  FileText,
  Terminal,
  Video,
  HelpCircle,
  ChevronUp,
  ChevronDown,
  Save,
  ShieldAlert
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { Course, CourseModule, ModuleType, QuizQuestion } from '../../types';

const DEFAULT_LAB_NODES = [
  { id: 'r1', name: 'R1-Core', type: 'router' as const, ip: '10.0.0.1', subnet: '255.255.255.252', status: 'online' as const, x: 25, y: 50 },
  { id: 'sw1', name: 'SW1-Dist', type: 'switch' as const, ip: '192.168.10.2', subnet: '255.255.255.0', status: 'online' as const, x: 75, y: 50 }
];

const DEFAULT_LAB_LINKS = [
  { from: 'r1', to: 'sw1', interfaceFrom: 'Gi0/0/0', interfaceTo: 'Gi0/1', status: 'up' as const }
];

export const ManagementPanel: React.FC = () => {
  const {
    courses,
    addCourse,
    updateCourse,
    deleteCourse,
    addModuleToCourse,
    updateModuleInCourse,
    deleteModuleFromCourse,
    reorderModuleInCourse,
    studentProgressList,
    currentUser,
    switchRole,
    triggerSystemNotification
  } = useAcademy();

  // Tab: 'courses' | 'progress'
  const [activeTab, setActiveTab] = useState<'courses' | 'progress'>('courses');

  // Search & Filters for Student Progress
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'behind'>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  // Toast Feedback
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setSaveToast(msg);
    window.setTimeout(() => setSaveToast(null), 3200);
  };

  // Add / Edit Course Modal
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  const [courseForm, setCourseForm] = useState<{
    code: string;
    title: string;
    subtitle: string;
    category: Course['category'];
    level: Course['level'];
    durationHours: number;
    price: number;
    badge: string;
    thumbnail: string;
    description: string;
    prerequisitesText: string;
    outcomesText: string;
  }>({
    code: 'BGP-EVPN-501',
    title: 'Data Center Spine-and-Leaf Architecture with VXLAN BGP EVPN',
    subtitle: 'Underlay routing, overlay encapsulation, Anycast Gateway, and EVPN address family.',
    category: 'Enterprise Routing & Switching',
    level: 'Advanced',
    durationHours: 35,
    price: 179,
    badge: 'New Release',
    thumbnail: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&q=80&w=800',
    description: 'Learn modern data center fabric design using BGP EVPN control plane and VXLAN data plane.',
    prerequisitesText: 'BGP fundamentals, OSPF/IS-IS',
    outcomesText: 'Configure VXLAN Tunnel Endpoints (VTEPs)\nDeploy BGP EVPN Type-2 and Type-5 routes\nTroubleshoot asymmetrical routing'
  });

  // Add / Edit Module Modal
  const [moduleModalCourseId, setModuleModalCourseId] = useState<string | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  const [moduleForm, setModuleForm] = useState<{
    title: string;
    type: ModuleType;
    durationMin: number;
    summary: string;
    contentMarkdown: string;
    videoUrl: string;
    videoDuration: string;
    labObjective: string;
    labPrompt: string;
    labCommandsText: string;
    labHintsText: string;
    labVerification: string;
    quizPassingScore: number;
    quizQuestions: QuizQuestion[];
  }>({
    title: '',
    type: 'theory',
    durationMin: 30,
    summary: '',
    contentMarkdown: '',
    videoUrl: '',
    videoDuration: '20:00',
    labObjective: '',
    labPrompt: 'R1-HQ-Core#',
    labCommandsText: 'configure terminal\nrouter ospf 1\nnetwork 10.0.0.0 0.0.0.255 area 0',
    labHintsText: 'Enter global config mode with "configure terminal"',
    labVerification: 'show ip ospf neighbor',
    quizPassingScore: 70,
    quizQuestions: []
  });

  const openAddCourseModal = () => {
    setEditingCourseId(null);
    setCourseForm({
      code: 'BGP-EVPN-501',
      title: 'Data Center Spine-and-Leaf Architecture with VXLAN BGP EVPN',
      subtitle: 'Underlay routing, overlay encapsulation, Anycast Gateway, and EVPN address family.',
      category: 'Enterprise Routing & Switching',
      level: 'Advanced',
      durationHours: 35,
      price: 179,
      badge: 'New Release',
      thumbnail: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&q=80&w=800',
      description: 'Learn modern data center fabric design using BGP EVPN control plane and VXLAN data plane.',
      prerequisitesText: 'BGP fundamentals, OSPF/IS-IS',
      outcomesText: 'Configure VXLAN Tunnel Endpoints (VTEPs)\nDeploy BGP EVPN Type-2 and Type-5 routes\nTroubleshoot asymmetrical routing'
    });
    setShowAddCourseModal(true);
  };

  const openEditCourseModal = (course: Course) => {
    setEditingCourseId(course.id);
    setCourseForm({
      code: course.code,
      title: course.title,
      subtitle: course.subtitle,
      category: course.category,
      level: course.level,
      durationHours: course.durationHours,
      price: course.price,
      badge: course.badge || '',
      thumbnail: course.thumbnail || '',
      description: course.description || '',
      prerequisitesText: (course.prerequisites || []).join(', '),
      outcomesText: (course.learningOutcomes || []).join('\n')
    });
    setShowAddCourseModal(true);
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.title.trim() || !courseForm.code.trim()) return;

    const prerequisites = courseForm.prerequisitesText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const learningOutcomes = courseForm.outcomesText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    if (editingCourseId) {
      updateCourse(editingCourseId, {
        code: courseForm.code.trim(),
        title: courseForm.title.trim(),
        subtitle: courseForm.subtitle.trim(),
        category: courseForm.category,
        level: courseForm.level,
        durationHours: Number(courseForm.durationHours) || 10,
        price: Number(courseForm.price) || 0,
        badge: courseForm.badge.trim() || 'Updated',
        thumbnail: courseForm.thumbnail.trim() || 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&q=80&w=800',
        description: courseForm.description.trim(),
        prerequisites,
        learningOutcomes
      });
      showToast(`Saved changes to ${courseForm.code.trim()}`);
    } else {
      const courseObj: Course = {
        id: `course-${Date.now()}`,
        code: courseForm.code.trim(),
        title: courseForm.title.trim(),
        subtitle: courseForm.subtitle.trim(),
        category: courseForm.category,
        level: courseForm.level,
        instructor: {
          name: currentUser.name,
          title: currentUser.role === 'admin' ? 'Academy Dean & Senior Architect' : 'Senior Instructor',
          avatar: currentUser.avatar
        },
        rating: 5.0,
        reviewsCount: 1,
        durationHours: Number(courseForm.durationHours) || 20,
        modulesCount: 1,
        enrolledCount: 0,
        price: Number(courseForm.price) || 99,
        bannerColor: 'from-blue-700 via-indigo-800 to-slate-900',
        thumbnail: courseForm.thumbnail.trim() || 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&q=80&w=800',
        badge: courseForm.badge.trim() || 'New Release',
        description: courseForm.description.trim(),
        prerequisites: prerequisites.length ? prerequisites : ['Basic Networking'],
        learningOutcomes: learningOutcomes.length ? learningOutcomes : ['Master Networking Concepts'],
        isPublished: true,
        updatedAt: new Date().toISOString().split('T')[0],
        modules: [
          {
            id: `mod-${Date.now()}-1`,
            title: 'Module 1: Fabric Fundamentals & Initial Baseline',
            type: 'theory',
            durationMin: 25,
            summary: 'Introduction to data plane encapsulation and overlay networks.',
            contentMarkdown: `# Welcome to ${courseForm.title.trim()}\n\nGet ready for comprehensive hands-on practice.`
          }
        ]
      };
      addCourse(courseObj);
      showToast(`Published new course ${courseObj.code}`);
    }

    setShowAddCourseModal(false);
    setEditingCourseId(null);
  };

  const openAddModuleModal = (courseId: string) => {
    setModuleModalCourseId(courseId);
    setEditingModuleId(null);
    setModuleForm({
      title: 'Module: VXLAN Network Identifier (VNI) Mapping',
      type: 'theory',
      durationMin: 30,
      summary: 'Understanding 24-bit VNI space, VTEP flood lists, and multi-destination traffic.',
      contentMarkdown: '# VXLAN Architecture Overview\n\nVXLAN encapsulates Layer 2 Ethernet frames in Layer 4 UDP packets on destination port **4789**.',
      videoUrl: 'https://stream.netplus.academy/vxlan-intro',
      videoDuration: '18:45',
      labObjective: 'Configure OSPF underlay and verify neighbor adjacency across R1 and SW1.',
      labPrompt: 'R1-HQ-Core#',
      labCommandsText: 'configure terminal\nrouter ospf 1\nnetwork 10.0.0.0 0.0.0.3 area 0\nend',
      labHintsText: 'Start by typing "configure terminal" to enter global configuration mode.',
      labVerification: 'show ip ospf neighbor',
      quizPassingScore: 70,
      quizQuestions: [
        {
          id: `q-${Date.now()}`,
          question: 'Which UDP destination port is standardized for VXLAN encapsulation?',
          options: ['UDP 4789', 'TCP 179', 'UDP 500', 'TCP 443'],
          correctAnswerIndex: 0,
          explanation: 'RFC 7348 assigns UDP destination port 4789 for VXLAN encapsulated traffic.'
        }
      ]
    });
  };

  const openEditModuleModal = (courseId: string, mod: CourseModule) => {
    setModuleModalCourseId(courseId);
    setEditingModuleId(mod.id);
    setModuleForm({
      title: mod.title,
      type: mod.type,
      durationMin: mod.durationMin,
      summary: mod.summary,
      contentMarkdown: mod.contentMarkdown || '',
      videoUrl: mod.videoUrl || '',
      videoDuration: mod.videoDuration || '20:00',
      labObjective: mod.lab?.objective || 'Configure routing and verify interface reachability.',
      labPrompt: mod.lab?.initialConfigPrompt || 'R1-HQ-Core#',
      labCommandsText: (mod.lab?.expectedCommands || []).join('\n'),
      labHintsText: (mod.lab?.terminalHints || []).join('\n'),
      labVerification: mod.lab?.verificationCheck || 'show ip route',
      quizPassingScore: mod.quiz?.passingScore ?? 70,
      quizQuestions: mod.quiz?.questions ? mod.quiz.questions.map(q => ({ ...q, options: [...q.options] })) : []
    });
  };

  const handleAddQuizQuestion = () => {
    setModuleForm(prev => ({
      ...prev,
      quizQuestions: [
        ...prev.quizQuestions,
        {
          id: `q-${Date.now()}-${prev.quizQuestions.length}`,
          question: 'New assessment question...',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswerIndex: 0,
          explanation: 'Explanation for the correct answer.'
        }
      ]
    }));
  };

  const handleUpdateQuizQuestion = (index: number, patch: Partial<QuizQuestion>) => {
    setModuleForm(prev => ({
      ...prev,
      quizQuestions: prev.quizQuestions.map((q, i) => (i === index ? { ...q, ...patch } : q))
    }));
  };

  const handleRemoveQuizQuestion = (index: number) => {
    setModuleForm(prev => ({
      ...prev,
      quizQuestions: prev.quizQuestions.filter((_, i) => i !== index)
    }));
  };

  const handleSaveModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleModalCourseId || !moduleForm.title.trim()) return;

    const targetCourse = courses.find(c => c.id === moduleModalCourseId);
    const existingModule = editingModuleId
      ? targetCourse?.modules.find(m => m.id === editingModuleId)
      : undefined;

    const modulePayload: CourseModule = {
      id: editingModuleId || `mod-${Date.now()}`,
      title: moduleForm.title.trim(),
      type: moduleForm.type,
      durationMin: Number(moduleForm.durationMin) || 30,
      summary: moduleForm.summary.trim(),
      contentMarkdown: moduleForm.contentMarkdown,
      ...(moduleForm.type === 'video'
        ? {
            videoUrl: moduleForm.videoUrl.trim(),
            videoDuration: moduleForm.videoDuration.trim() || '20:00'
          }
        : {}),
      ...(moduleForm.type === 'lab'
        ? {
            lab: {
              objective: moduleForm.labObjective.trim(),
              nodes: existingModule?.lab?.nodes || DEFAULT_LAB_NODES,
              links: existingModule?.lab?.links || DEFAULT_LAB_LINKS,
              initialConfigPrompt: moduleForm.labPrompt.trim() || 'R1-HQ-Core#',
              expectedCommands: moduleForm.labCommandsText
                .split('\n')
                .map(s => s.trim())
                .filter(Boolean),
              terminalHints: moduleForm.labHintsText
                .split('\n')
                .map(s => s.trim())
                .filter(Boolean),
              verificationCheck: moduleForm.labVerification.trim() || 'show ip route'
            }
          }
        : {}),
      ...(moduleForm.type === 'quiz'
        ? {
            quiz: {
              passingScore: Number(moduleForm.quizPassingScore) || 70,
              questions: moduleForm.quizQuestions
            }
          }
        : {})
    };

    if (editingModuleId) {
      updateModuleInCourse(moduleModalCourseId, editingModuleId, modulePayload);
      showToast(`Updated module "${modulePayload.title}"`);
    } else {
      addModuleToCourse(moduleModalCourseId, modulePayload);
      showToast(`Added module "${modulePayload.title}"`);
    }

    setModuleModalCourseId(null);
    setEditingModuleId(null);
  };

  const handleSendReminderEmail = (studentEmail: string, studentName: string, courseTitle: string) => {
    triggerSystemNotification(
      `Email Notification Dispatched`,
      `Sent progress reminder to ${studentName} (${studentEmail}) regarding ${courseTitle}.`,
      'system',
      {
        subject: `📚 Reminder: Keep making progress in ${courseTitle}`,
        to: studentEmail,
        bodyHtml: `<div style="font-family:sans-serif;padding:20px;">
          <p>Hi <strong>${studentName}</strong>,</p>
          <p>We noticed you have remaining interactive labs in <strong>${courseTitle}</strong>. Log in today to complete your certification benchmarks!</p>
        </div>`
      }
    );
  };

  // Filter student progress
  const filteredProgress = studentProgressList.filter(item => {
    const matchesSearch =
      item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.studentEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.courseCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesCourse = courseFilter === 'all' || item.courseId === courseFilter;
    return matchesSearch && matchesStatus && matchesCourse;
  });

  if (currentUser.role === 'student') {
    return (
      <div className="w-full p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Instructor or Admin Role Required
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Course authoring, module editing, and live enrollment telemetry are restricted to Instructor and Admin roles.
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => switchRole('instructor')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
          >
            Switch to Instructor
          </button>
          <button
            onClick={() => switchRole('admin')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            Switch to Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Save Toast */}
      {saveToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-xl">
          <CheckCircle className="w-4 h-4" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[11px] font-bold border border-blue-500/30">
              Role: {currentUser.role.toUpperCase()}
            </span>
            <span className="text-xs text-slate-300">• Academy Management Console</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Curriculum Authoring & Live Enrollment Tracking
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Edit course metadata, update module markdown/labs/quizzes/videos, reorder modules, and monitor real-time participant progress.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddCourseModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Course</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('courses')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'courses'
              ? 'border-blue-600 text-blue-600 dark:text-cyan-400 dark:border-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Manage Courses & Content ({courses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('progress')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'progress'
              ? 'border-blue-600 text-blue-600 dark:text-cyan-400 dark:border-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Real-Time Enrollment Progress ({studentProgressList.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'progress' ? (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student, email, course..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Courses</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed (Certified)</option>
                <option value="behind">Behind Pace</option>
              </select>
            </div>
          </div>

          {/* Student Progress Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Enrolled Course</th>
                    <th className="py-3 px-4">Modules Completed</th>
                    <th className="py-3 px-4">Progress</th>
                    <th className="py-3 px-4">Quiz Avg</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredProgress.map((record, index) => (
                    <tr key={index} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={record.avatar}
                            alt={record.studentName}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                          />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{record.studentName}</p>
                            <p className="text-[11px] text-slate-400">{record.studentEmail}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] mr-1.5">
                          {record.courseCode}
                        </span>
                        <span className="truncate max-w-[200px] inline-block align-bottom">{record.courseTitle}</span>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {record.completedModulesCount} / {record.totalModulesCount}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="w-36">
                          <div className="flex justify-between text-[11px] font-mono font-bold mb-1">
                            <span>{record.progressPercent}%</span>
                            <span className={record.progressPercent === 100 ? 'text-emerald-500' : 'text-blue-500'}>
                              {record.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                record.progressPercent === 100
                                  ? 'bg-emerald-500'
                                  : record.progressPercent < 30
                                  ? 'bg-amber-500'
                                  : 'bg-blue-600'
                              }`}
                              style={{ width: `${record.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {record.quizAverage}%
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">{record.lastActive}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleSendReminderEmail(record.studentEmail, record.studentName, record.courseTitle)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Send Email Notification"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Tab Content: Manage Courses & Modules */
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {courses.map(course => (
              <div
                key={course.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <img
                        src={course.thumbnail || 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&q=80&w=800'}
                        alt={course.title}
                        className="w-20 h-14 rounded-xl object-cover shrink-0 bg-slate-950 border border-slate-200 dark:border-slate-800"
                      />
                      <div className="min-w-0">
                        <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold">
                          {course.code}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                          {course.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {course.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateCourse(course.id, { isPublished: !course.isPublished })}
                        className={`px-2 py-1 rounded-md text-[10px] font-mono font-semibold ${
                          course.isPublished
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                        title="Toggle Published / Draft"
                      >
                        {course.isPublished ? 'Published' : 'Draft'}
                      </button>

                      <button
                        onClick={() => openEditCourseModal(course)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit Course Details"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => deleteCourse(course.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Delete Course"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Modules breakdown with Edit, Reorder & Delete */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      <span>Curriculum Modules ({course.modules.length})</span>
                      <button
                        onClick={() => openAddModuleModal(course.id)}
                        className="text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Module</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {course.modules.map((mod, idx) => (
                        <div
                          key={mod.id}
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs group"
                        >
                          <button
                            type="button"
                            onClick={() => openEditModuleModal(course.id, mod)}
                            className="flex items-center gap-2 truncate flex-1 text-left hover:text-blue-600 dark:hover:text-cyan-400 transition-colors"
                            title="Click to edit module content"
                          >
                            {mod.type === 'lab' ? (
                              <Terminal className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                            ) : mod.type === 'video' ? (
                              <Video className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            ) : mod.type === 'quiz' ? (
                              <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            )}
                            <span className="truncate text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-cyan-300">
                              {mod.title}
                            </span>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] font-mono text-slate-400 mr-1">
                              {mod.type} • {mod.durationMin}m
                            </span>

                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => reorderModuleInCourse(course.id, mod.id, 'up')}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
                              title="Move Up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              disabled={idx === course.modules.length - 1}
                              onClick={() => reorderModuleInCourse(course.id, mod.id, 'down')}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
                              title="Move Down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditModuleModal(course.id, mod)}
                              className="p-1 rounded text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-slate-700"
                              title="Edit Module & Content"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              disabled={course.modules.length <= 1}
                              onClick={() => {
                                deleteModuleFromCourse(course.id, mod.id);
                                showToast(`Removed module "${mod.title}"`);
                              }}
                              className="p-1 rounded text-red-400 hover:text-red-600 disabled:opacity-30"
                              title={course.modules.length <= 1 ? 'Course requires at least 1 module' : 'Delete Module'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>Enrolled: {course.enrolledCount.toLocaleString()}</span>
                  <span>Price: ${course.price}</span>
                  <span>Hours: {course.durationHours}h • Updated {course.updatedAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Course Modal */}
      {showAddCourseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingCourseId ? 'Edit Course Details & Content' : 'Create New Networking Course'}
              </h3>
              <button
                onClick={() => {
                  setShowAddCourseModal(false);
                  setEditingCourseId(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Course Code</label>
                  <input
                    type="text"
                    required
                    value={courseForm.code}
                    onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                    placeholder="e.g. CCNA-200-301"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={courseForm.category}
                    onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value as Course['category'] })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="Enterprise Routing & Switching">Enterprise Routing & Switching</option>
                    <option value="Network Security & Firewalls">Network Security & Firewalls</option>
                    <option value="Cloud & SD-WAN">Cloud & SD-WAN</option>
                    <option value="Packet Analysis & Forensics">Packet Analysis & Forensics</option>
                    <option value="Automation & NetDevOps">Automation & NetDevOps</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Level</label>
                  <select
                    value={courseForm.level}
                    onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value as Course['level'] })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Subtitle / Summary</label>
                <input
                  type="text"
                  value={courseForm.subtitle}
                  onChange={(e) => setCourseForm({ ...courseForm, subtitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Description</label>
                <textarea
                  rows={3}
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Course Thumbnail Image URL</label>
                <input
                  type="text"
                  value={courseForm.thumbnail}
                  onChange={(e) => setCourseForm({ ...courseForm, thumbnail: e.target.value })}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
                />
                {courseForm.thumbnail && (
                  <div className="mt-2 relative rounded-xl overflow-hidden aspect-video border border-slate-200 dark:border-slate-700 max-w-xs bg-slate-950">
                    <img
                      src={courseForm.thumbnail}
                      alt="Thumbnail Preview"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-2 left-2 text-[10px] font-mono bg-slate-900/80 backdrop-blur-md text-white px-2 py-0.5 rounded">
                      Live Preview
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Estimated Hours</label>
                  <input
                    type="number"
                    value={courseForm.durationHours}
                    onChange={(e) => setCourseForm({ ...courseForm, durationHours: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Price ($ USD)</label>
                  <input
                    type="number"
                    value={courseForm.price}
                    onChange={(e) => setCourseForm({ ...courseForm, price: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Badge Label</label>
                  <input
                    type="text"
                    value={courseForm.badge}
                    onChange={(e) => setCourseForm({ ...courseForm, badge: e.target.value })}
                    placeholder="e.g. Certification Track"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Prerequisites (comma-separated)</label>
                  <input
                    type="text"
                    value={courseForm.prerequisitesText}
                    onChange={(e) => setCourseForm({ ...courseForm, prerequisitesText: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Learning Outcomes (1 per line)</label>
                  <textarea
                    rows={3}
                    value={courseForm.outcomesText}
                    onChange={(e) => setCourseForm({ ...courseForm, outcomesText: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCourseModal(false);
                    setEditingCourseId(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingCourseId ? 'Save Course Changes' : 'Publish Course'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Module & Content Modal */}
      {moduleModalCourseId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingModuleId ? 'Edit Module & Course Content' : 'Add Curriculum Module'}
              </h3>
              <button
                onClick={() => {
                  setModuleModalCourseId(null);
                  setEditingModuleId(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModule} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Module Title</label>
                <input
                  type="text"
                  required
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  placeholder="e.g. Module 3: Hands-On OSPF Adjacency Lab"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Content Type</label>
                  <select
                    value={moduleForm.type}
                    onChange={(e) => setModuleForm({ ...moduleForm, type: e.target.value as ModuleType })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="theory">Theory / Reading</option>
                    <option value="lab">Interactive CLI Lab</option>
                    <option value="video">Video Walkthrough</option>
                    <option value="quiz">Benchmark Quiz</option>
                    <option value="pcap">Wireshark PCAP Deep Dive</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Duration (Min)</label>
                  <input
                    type="number"
                    value={moduleForm.durationMin}
                    onChange={(e) => setModuleForm({ ...moduleForm, durationMin: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Summary</label>
                <input
                  type="text"
                  value={moduleForm.summary}
                  onChange={(e) => setModuleForm({ ...moduleForm, summary: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Markdown Lesson Content */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lesson Content (Markdown / Notes)
                </label>
                <textarea
                  rows={6}
                  value={moduleForm.contentMarkdown}
                  onChange={(e) => setModuleForm({ ...moduleForm, contentMarkdown: e.target.value })}
                  className="w-full p-2.5 rounded-xl font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Video Specific Fields */}
              {moduleForm.type === 'video' && (
                <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Video Stream URL</label>
                    <input
                      type="text"
                      value={moduleForm.videoUrl}
                      onChange={(e) => setModuleForm({ ...moduleForm, videoUrl: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Video Duration</label>
                    <input
                      type="text"
                      value={moduleForm.videoDuration}
                      onChange={(e) => setModuleForm({ ...moduleForm, videoDuration: e.target.value })}
                      placeholder="22:15"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* CLI Lab Specific Fields */}
              {moduleForm.type === 'lab' && (
                <div className="p-3.5 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/50 space-y-3">
                  <p className="font-bold text-cyan-800 dark:text-cyan-300 text-[11px] uppercase font-mono">
                    Cisco IOS Lab Configuration
                  </p>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Lab Objective</label>
                    <input
                      type="text"
                      value={moduleForm.labObjective}
                      onChange={(e) => setModuleForm({ ...moduleForm, labObjective: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Initial CLI Prompt</label>
                      <input
                        type="text"
                        value={moduleForm.labPrompt}
                        onChange={(e) => setModuleForm({ ...moduleForm, labPrompt: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Verification Command</label>
                      <input
                        type="text"
                        value={moduleForm.labVerification}
                        onChange={(e) => setModuleForm({ ...moduleForm, labVerification: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Expected Commands (1 per line)</label>
                      <textarea
                        rows={3}
                        value={moduleForm.labCommandsText}
                        onChange={(e) => setModuleForm({ ...moduleForm, labCommandsText: e.target.value })}
                        className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Terminal Hints (1 per line)</label>
                      <textarea
                        rows={3}
                        value={moduleForm.labHintsText}
                        onChange={(e) => setModuleForm({ ...moduleForm, labHintsText: e.target.value })}
                        className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Quiz Specific Fields */}
              {moduleForm.type === 'quiz' && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-amber-800 dark:text-amber-300 text-[11px] uppercase font-mono">
                        Assessment Questions ({moduleForm.quizQuestions.length})
                      </span>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <span>Pass %:</span>
                        <input
                          type="number"
                          min={10}
                          max={100}
                          value={moduleForm.quizPassingScore}
                          onChange={(e) => setModuleForm({ ...moduleForm, quizPassingScore: parseInt(e.target.value, 10) || 70 })}
                          className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddQuizQuestion}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Question</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {moduleForm.quizQuestions.map((q, qIdx) => (
                      <div
                        key={q.id}
                        className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-bold text-slate-500">Question {qIdx + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuizQuestion(qIdx)}
                            className="text-red-400 hover:text-red-600 text-[11px]"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          value={q.question}
                          onChange={(e) => handleUpdateQuizQuestion(qIdx, { question: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          placeholder="Question text..."
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                name={`correct-${q.id}`}
                                checked={q.correctAnswerIndex === optIdx}
                                onChange={() => handleUpdateQuizQuestion(qIdx, { correctAnswerIndex: optIdx })}
                                title="Mark as correct answer"
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const nextOpts = [...q.options];
                                  nextOpts[optIdx] = e.target.value;
                                  handleUpdateQuizQuestion(qIdx, { options: nextOpts });
                                }}
                                className="flex-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                              />
                            </div>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={q.explanation}
                          onChange={(e) => handleUpdateQuizQuestion(qIdx, { explanation: e.target.value })}
                          placeholder="Explanation shown after answer submission..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setModuleModalCourseId(null);
                    setEditingModuleId(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingModuleId ? 'Update Module Content' : 'Save Module'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
