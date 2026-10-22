import React, { useState } from 'react';
import { 
  Plus, 
  Settings, 
  Layers, 
  Users, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  Clock, 
  Search, 
  Eye, 
  Mail, 
  Award, 
  Activity, 
  Sliders, 
  X,
  FileText,
  Terminal,
  Video,
  HelpCircle
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { Course, CourseModule, ModuleType } from '../../types';

export const ManagementPanel: React.FC = () => {
  const { 
    courses, 
    addCourse, 
    updateCourse, 
    deleteCourse, 
    addModuleToCourse, 
    studentProgressList, 
    currentUser,
    triggerSystemNotification
  } = useAcademy();

  // Tab: 'courses' | 'progress'
  const [activeTab, setActiveTab] = useState<'courses' | 'progress'>('progress');

  // Search & Filters for Student Progress
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'behind'>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  // Modals
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [showAddModuleModal, setShowAddModuleModal] = useState<string | null>(null); // courseId

  // New Course Form State
  const [newCourse, setNewCourse] = useState<Partial<Course>>({
    code: 'BGP-EVPN-501',
    title: 'Data Center Spine-and-Leaf Architecture with VXLAN BGP EVPN',
    subtitle: 'Underlay routing, overlay encapsulation, Anycast Gateway, and EVPN address family.',
    category: 'Enterprise Routing & Switching',
    level: 'Advanced',
    durationHours: 35,
    price: 179,
    bannerColor: 'from-blue-700 via-indigo-800 to-slate-900',
    description: 'Learn modern data center fabric design using BGP EVPN control plane and VXLAN data plane.',
    prerequisites: ['BGP fundamentals', 'OSPF/IS-IS'],
    learningOutcomes: ['Configure VXLAN Tunnel Endpoints (VTEPs)', 'Deploy BGP EVPN Type-2 and Type-5 routes', 'Troubleshoot asymmetrical routing']
  });

  // New Module Form State
  const [newModule, setNewModule] = useState<Partial<CourseModule>>({
    title: 'Module: VXLAN Network Identifier (VNI) Mapping',
    type: 'theory',
    durationMin: 30,
    summary: 'Understanding 24-bit VNI space, VTEP flood lists, and multi-destination traffic.',
    contentMarkdown: `# VXLAN Architecture Overview\n\nVXLAN encapsulates Layer 2 Ethernet frames in Layer 4 UDP packets on destination port **4789**.`
  });

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse.title || !newCourse.code) return;

    const courseObj: Course = {
      id: `course-${Date.now()}`,
      code: newCourse.code,
      title: newCourse.title,
      subtitle: newCourse.subtitle || '',
      category: (newCourse.category as any) || 'Enterprise Routing & Switching',
      level: (newCourse.level as any) || 'Intermediate',
      instructor: {
        name: currentUser.name,
        title: currentUser.role === 'admin' ? 'Academy Dean & Senior Architect' : 'Senior Instructor',
        avatar: currentUser.avatar
      },
      rating: 5.0,
      reviewsCount: 1,
      durationHours: Number(newCourse.durationHours) || 20,
      modulesCount: 1,
      enrolledCount: 0,
      price: Number(newCourse.price) || 99,
      bannerColor: newCourse.bannerColor || 'from-blue-600 to-slate-900',
      badge: 'New Release',
      description: newCourse.description || '',
      prerequisites: newCourse.prerequisites || ['Basic Networking'],
      learningOutcomes: newCourse.learningOutcomes || ['Master Networking Concepts'],
      isPublished: true,
      updatedAt: new Date().toISOString().split('T')[0],
      modules: [
        {
          id: `mod-${Date.now()}-1`,
          title: 'Module 1: Fabric Fundamentals & Initial Baseline',
          type: 'theory',
          durationMin: 25,
          summary: 'Introduction to data plane encapsulation and overlay networks.',
          contentMarkdown: `# Welcome to ${newCourse.title}\n\nGet ready for comprehensive hands-on practice.`
        }
      ]
    };

    addCourse(courseObj);
    setShowAddCourseModal(false);
  };

  const handleCreateModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddModuleModal || !newModule.title) return;

    const mod: CourseModule = {
      id: `mod-${Date.now()}`,
      title: newModule.title,
      type: newModule.type || 'theory',
      durationMin: Number(newModule.durationMin) || 30,
      summary: newModule.summary || '',
      contentMarkdown: newModule.contentMarkdown || 'Module content coming soon.'
    };

    addModuleToCourse(showAddModuleModal, mod);
    setShowAddModuleModal(null);
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
    const matchesSearch = item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.studentEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.courseCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesCourse = courseFilter === 'all' || item.courseId === courseFilter;
    return matchesSearch && matchesStatus && matchesCourse;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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
            Real-time participant progress analytics, course authoring, module configuration, and automated notification triggers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCourseModal(true)}
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
      </div>

      {/* Tab Content: Real-time Student Progress Tracking */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map(course => (
              <div
                key={course.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold">
                      {course.code}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                      {course.subtitle}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateCourse(course.id, { isPublished: !course.isPublished })}
                      className={`px-2 py-1 rounded-md text-[10px] font-mono font-semibold ${
                        course.isPublished
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {course.isPublished ? 'Published' : 'Draft'}
                    </button>
                    <button
                      onClick={() => deleteCourse(course.id)}
                      className="p-1 rounded text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Modules breakdown */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    <span>Curriculum Modules ({course.modules.length})</span>
                    <button
                      onClick={() => setShowAddModuleModal(course.id)}
                      className="text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Module</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {course.modules.map(mod => (
                      <div
                        key={mod.id}
                        className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          {mod.type === 'lab' ? (
                            <Terminal className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                          ) : mod.type === 'video' ? (
                            <Video className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          ) : mod.type === 'quiz' ? (
                            <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          )}
                          <span className="truncate text-slate-800 dark:text-slate-200">{mod.title}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">{mod.durationMin}m</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>Enrolled: {course.enrolledCount.toLocaleString()}</span>
                  <span>Price: ${course.price}</span>
                  <span>Hours: {course.durationHours}h</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Course Modal */}
      {showAddCourseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Create New Networking Course
              </h3>
              <button onClick={() => setShowAddCourseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Course Code</label>
                  <input
                    type="text"
                    required
                    value={newCourse.code}
                    onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                    placeholder="e.g. CCNA-200-301"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={newCourse.category}
                    onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="Enterprise Routing & Switching">Enterprise Routing & Switching</option>
                    <option value="Network Security & Firewalls">Network Security & Firewalls</option>
                    <option value="Cloud & SD-WAN">Cloud & SD-WAN</option>
                    <option value="Packet Analysis & Forensics">Packet Analysis & Forensics</option>
                    <option value="Automation & NetDevOps">Automation & NetDevOps</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  placeholder="e.g. Enterprise Routing, Switching & Network Fundamentals"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Subtitle / Summary</label>
                <input
                  type="text"
                  value={newCourse.subtitle}
                  onChange={(e) => setNewCourse({ ...newCourse, subtitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Estimated Hours</label>
                  <input
                    type="number"
                    value={newCourse.durationHours}
                    onChange={(e) => setNewCourse({ ...newCourse, durationHours: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tuition / Price ($ USD)</label>
                  <input
                    type="number"
                    value={newCourse.price}
                    onChange={(e) => setNewCourse({ ...newCourse, price: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Publish Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Module Modal */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add Curriculum Module
              </h3>
              <button onClick={() => setShowAddModuleModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateModule} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Module Title</label>
                <input
                  type="text"
                  required
                  value={newModule.title}
                  onChange={(e) => setNewModule({ ...newModule, title: e.target.value })}
                  placeholder="e.g. Module 3: Hands-On OSPF Adjacency Lab"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Content Type</label>
                  <select
                    value={newModule.type}
                    onChange={(e) => setNewModule({ ...newModule, type: e.target.value as any })}
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
                    value={newModule.durationMin}
                    onChange={(e) => setNewModule({ ...newModule, durationMin: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Summary</label>
                <input
                  type="text"
                  value={newModule.summary}
                  onChange={(e) => setNewModule({ ...newModule, summary: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Content (Markdown)</label>
                <textarea
                  rows={4}
                  value={newModule.contentMarkdown}
                  onChange={(e) => setNewModule({ ...newModule, contentMarkdown: e.target.value })}
                  className="w-full p-2.5 rounded-xl font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModuleModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Save Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
