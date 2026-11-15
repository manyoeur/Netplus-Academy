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
  ShieldAlert,
  UserPlus,
  Users,
  Copy,
  Link2,
  RefreshCw,
  Ban,
  Send,
  GraduationCap,
  ShieldCheck,
  UserCog,
  Calendar,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import {
  Course,
  CourseEnrollment,
  CourseModule,
  Invitation,
  InvitationStatus,
  ModuleType,
  QuizQuestion,
  SubscriptionTier,
  User,
  UserRole
} from '../../types';
import {
  DEFAULT_ENROLLMENT_DAYS,
  createDefaultCourseEnrollment,
  resolveCourseEnrollment,
  formatEnrollmentDate,
  getEnrollmentExpirationInfo
} from '../../utils/enrollmentDates';

type ManagementTab = 'courses' | 'progress' | 'accounts' | 'invite-instructors' | 'invite-students';

interface ManagementPanelProps {
  initialTab?: ManagementTab;
}

const DEFAULT_LAB_NODES = [
  { id: 'r1', name: 'R1-Core', type: 'router' as const, ip: '10.0.0.1', subnet: '255.255.255.252', status: 'online' as const, x: 25, y: 50 },
  { id: 'sw1', name: 'SW1-Dist', type: 'switch' as const, ip: '192.168.10.2', subnet: '255.255.255.0', status: 'online' as const, x: 75, y: 50 }
];

const DEFAULT_LAB_LINKS = [
  { from: 'r1', to: 'sw1', interfaceFrom: 'Gi0/0/0', interfaceTo: 'Gi0/1', status: 'up' as const }
];

export const ManagementPanel: React.FC<ManagementPanelProps> = ({ initialTab = 'courses' }) => {
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
    allUsers,
    refreshUsersDirectory,
    updateUserAccount,
    deleteUserAccount,
    triggerSystemNotification,
    invitations,
    createInstructorInvite,
    createStudentInvites,
    resendInvitation,
    revokeInvitation
  } = useAcademy();

  const isAdmin = currentUser.role === 'admin';

  // Tab: 'courses' | 'progress' | 'accounts' | 'invite-instructors' | 'invite-students'
  const [activeTab, setActiveTab] = useState<ManagementTab>(
    !isAdmin && (initialTab === 'accounts' || initialTab === 'invite-instructors' || initialTab === 'invite-students')
      ? 'courses'
      : initialTab
  );

  React.useEffect(() => {
    if (!isAdmin && (initialTab === 'accounts' || initialTab === 'invite-instructors' || initialTab === 'invite-students')) {
      setActiveTab('courses');
    } else {
      setActiveTab(initialTab);
    }
  }, [initialTab, isAdmin]);

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

  // User Accounts Management State (Admin)
  const [accountSearch, setAccountSearch] = useState('');
  const [accountRoleFilter, setAccountRoleFilter] = useState<'all' | UserRole>('all');
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [editingAccountUser, setEditingAccountUser] = useState<User | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState<{
    name: string;
    role: UserRole;
    subscriptionTier: SubscriptionTier;
    subscriptionStatus: User['subscription']['status'];
    enrolledCourseIds: string[];
    courseEnrollments: Record<string, CourseEnrollment>;
  }>({
    name: '',
    role: 'student',
    subscriptionTier: 'pro',
    subscriptionStatus: 'active',
    enrolledCourseIds: [],
    courseEnrollments: {}
  });

  const handleSyncUsersDirectory = async () => {
    setIsSyncingUsers(true);
    try {
      const syncedCount = await refreshUsersDirectory();
      showToast(
        syncedCount > 0
          ? `Synced ${syncedCount} Firestore user record(s)`
          : 'Directory refreshed from local & Firestore state'
      );
    } catch {
      showToast('Unable to sync Firestore users right now');
    } finally {
      setIsSyncingUsers(false);
    }
  };

  const openEditAccountModal = (user: User) => {
    const initialEnrollments: Record<string, CourseEnrollment> = {};
    for (const cid of user.enrolledCourseIds || []) {
      const course = courses.find(c => c.id === cid);
      const resolved = resolveCourseEnrollment(user, {
        id: cid,
        defaultAccessDays: course?.defaultAccessDays
      });
      if (resolved) {
        initialEnrollments[cid] = resolved;
      }
    }
    setEditingAccountUser(user);
    setAccountForm({
      name: user.name,
      role: user.role,
      subscriptionTier: user.subscription?.tier || 'free',
      subscriptionStatus: user.subscription?.status || 'active',
      enrolledCourseIds: [...(user.enrolledCourseIds || [])],
      courseEnrollments: initialEnrollments
    });
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccountUser || !accountForm.name.trim()) return;
    setSavingAccount(true);
    const isProtectedAdmin =
      editingAccountUser.id === currentUser.id ||
      editingAccountUser.email.toLowerCase() === 'yoeur.man2010@gmail.com';
    try {
      await updateUserAccount(editingAccountUser.id, {
        name: accountForm.name.trim(),
        role: isProtectedAdmin ? editingAccountUser.role : accountForm.role,
        subscriptionTier: accountForm.subscriptionTier,
        subscriptionStatus: accountForm.subscriptionStatus,
        enrolledCourseIds: accountForm.enrolledCourseIds,
        courseEnrollments: accountForm.courseEnrollments
      });
      showToast(`Updated account for ${accountForm.name.trim()}`);
      setEditingAccountUser(null);
    } finally {
      setSavingAccount(false);
    }
  };

  const handleQuickRoleChange = async (user: User, nextRole: UserRole) => {
    if (user.id === currentUser.id || user.email.toLowerCase() === 'yoeur.man2010@gmail.com') {
      return;
    }
    await updateUserAccount(user.id, { role: nextRole });
    showToast(`Changed ${user.name}'s role to ${nextRole.toUpperCase()}`);
  };

  const handleConfirmDeleteAccount = async (user: User) => {
    if (user.id === currentUser.id || user.email.toLowerCase() === 'yoeur.man2010@gmail.com') {
      return;
    }
    await deleteUserAccount(user.id);
    setConfirmDeleteUserId(null);
    showToast(`Removed account for ${user.name}`);
  };

  const instructorAccountsCount = allUsers.filter(u => u.role === 'instructor').length;
  const studentAccountsCount = allUsers.filter(u => u.role === 'student').length;
  const adminAccountsCount = allUsers.filter(u => u.role === 'admin').length;

  const filteredAccounts = allUsers.filter(u => {
    const q = accountSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q);
    const matchesRole = accountRoleFilter === 'all' || u.role === accountRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Invite Instructors State
  const [instName, setInstName] = useState('');
  const [instEmail, setInstEmail] = useState('');
  const [instSpecialty, setInstSpecialty] = useState('CCNP Enterprise & BGP/OSPF Labs');
  const [instAssignedCourseIds, setInstAssignedCourseIds] = useState<string[]>(() =>
    courses.slice(0, 1).map(c => c.id)
  );
  const [instWelcomeNote, setInstWelcomeNote] = useState('');
  const [instSearch, setInstSearch] = useState('');
  const [instStatusFilter, setInstStatusFilter] = useState<'all' | InvitationStatus>('all');
  const [latestInstructorInvite, setLatestInstructorInvite] = useState<Invitation | null>(null);

  // Invite Students State
  const [studentInviteMode, setStudentInviteMode] = useState<'single' | 'bulk'>('single');
  const [studName, setStudName] = useState('');
  const [studEmail, setStudEmail] = useState('');
  const [studBulkText, setStudBulkText] = useState('');
  const [studCohort, setStudCohort] = useState('Enterprise Networking Cohort 2026');
  const [studTier, setStudTier] = useState<SubscriptionTier>('pro');
  const [studCourseIds, setStudCourseIds] = useState<string[]>(() =>
    courses.slice(0, 1).map(c => c.id)
  );
  const [studWelcomeNote, setStudWelcomeNote] = useState('');
  const [studSearch, setStudSearch] = useState('');
  const [studStatusFilter, setStudStatusFilter] = useState<'all' | InvitationStatus>('all');
  const [latestStudentInvites, setLatestStudentInvites] = useState<Invitation[]>([]);
  const [inviteFormError, setInviteFormError] = useState<string | null>(null);

  const buildInviteUrl = (code: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/?invite=${code}` : `/?invite=${code}`;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${label} to clipboard`);
    } catch {
      showToast(`${label}: ${text}`);
    }
  };

  const toggleCourseInSelection = (courseId: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => (prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]));
  };

  const parseBulkStudentEntries = (raw: string): Array<{ fullName: string; email: string }> => {
    const tokens = raw
      .split(/\r?\n|;/)
      .map(s => s.trim())
      .filter(Boolean);
    const entries: Array<{ fullName: string; email: string }> = [];
    const seen = new Set<string>();

    for (const line of tokens) {
      const bracketMatch = line.match(/^(.*?)<([^<>\s]+@[^<>\s]+\.[^<>\s]+)>$/);
      if (bracketMatch) {
        const email = bracketMatch[2].trim().toLowerCase();
        const fullName = bracketMatch[1].replace(/["']/g, '').trim() || email.split('@')[0];
        if (!seen.has(email)) {
          seen.add(email);
          entries.push({ fullName, email });
        }
        continue;
      }

      const parts = line.split(',').map(p => p.trim()).filter(Boolean);
      const emailPart = parts.find(p => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p));
      if (emailPart) {
        const email = emailPart.toLowerCase();
        const namePart = parts.find(p => p !== emailPart) || email.split('@')[0];
        if (!seen.has(email)) {
          seen.add(email);
          entries.push({ fullName: namePart, email });
        }
      }
    }
    return entries;
  };

  const parsedBulkStudents = parseBulkStudentEntries(studBulkText);

  const handleSendInstructorInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteFormError(null);
    if (!instName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(instEmail.trim())) {
      setInviteFormError('Please enter the instructor full name and a valid email address.');
      return;
    }
    const created = createInstructorInvite({
      fullName: instName,
      email: instEmail,
      specialty: instSpecialty,
      assignedCourseIds: instAssignedCourseIds,
      welcomeNote: instWelcomeNote
    });
    setLatestInstructorInvite(created);
    setInstName('');
    setInstEmail('');
    setInstWelcomeNote('');
    showToast(`Instructor invite ${created.code} created for ${created.email}`);
  };

  const handleSendStudentInvites = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteFormError(null);

    let entries: Array<{ fullName: string; email: string }> = [];
    if (studentInviteMode === 'single') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studEmail.trim())) {
        setInviteFormError('Please enter a valid student email address.');
        return;
      }
      entries = [
        {
          fullName: studName.trim() || studEmail.trim().split('@')[0],
          email: studEmail.trim()
        }
      ];
    } else {
      if (parsedBulkStudents.length === 0) {
        setInviteFormError('Add at least one valid email address (e.g. "Jordan Lee <jordan@company.com>" or one email per line).');
        return;
      }
      entries = parsedBulkStudents;
    }

    const created = createStudentInvites({
      entries,
      cohort: studCohort,
      assignedCourseIds: studCourseIds,
      subscriptionTier: studTier,
      welcomeNote: studWelcomeNote
    });
    setLatestStudentInvites(created);
    setStudName('');
    setStudEmail('');
    setStudBulkText('');
    setStudWelcomeNote('');
    showToast(
      created.length === 1
        ? `Student invite ${created[0].code} created for ${created[0].email}`
        : `Created ${created.length} student registration invitations`
    );
  };

  const instructorInvites = invitations.filter(inv => inv.role === 'instructor');
  const studentInvites = invitations.filter(inv => inv.role === 'student');

  const filteredInstructorInvites = instructorInvites.filter(inv => {
    const q = instSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inv.fullName.toLowerCase().includes(q) ||
      inv.email.toLowerCase().includes(q) ||
      inv.code.toLowerCase().includes(q) ||
      inv.cohortOrSpecialty.toLowerCase().includes(q);
    const matchesStatus = instStatusFilter === 'all' || inv.status === instStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredStudentInvites = studentInvites.filter(inv => {
    const q = studSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inv.fullName.toLowerCase().includes(q) ||
      inv.email.toLowerCase().includes(q) ||
      inv.code.toLowerCase().includes(q) ||
      inv.cohortOrSpecialty.toLowerCase().includes(q);
    const matchesStatus = studStatusFilter === 'all' || inv.status === studStatusFilter;
    return matchesSearch && matchesStatus;
  });

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
    defaultAccessDays: number;
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
    defaultAccessDays: DEFAULT_ENROLLMENT_DAYS,
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
      defaultAccessDays: DEFAULT_ENROLLMENT_DAYS,
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
      defaultAccessDays: course.defaultAccessDays || DEFAULT_ENROLLMENT_DAYS,
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
        defaultAccessDays: Math.max(1, Number(courseForm.defaultAccessDays) || DEFAULT_ENROLLMENT_DAYS),
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
        defaultAccessDays: Math.max(1, Number(courseForm.defaultAccessDays) || DEFAULT_ENROLLMENT_DAYS),
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
      <div className="w-full p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Instructor or Admin Access Required
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Course authoring, module editing, live enrollment telemetry, and user invitations are restricted to invited Instructors and Academy Administrators.
        </p>
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
            {activeTab === 'accounts'
              ? 'Instructor & Student Account Directory'
              : activeTab === 'invite-instructors'
              ? 'Instructor Onboarding & Faculty Invitations'
              : activeTab === 'invite-students'
              ? 'Student Registration & Cohort Invitations'
              : 'Curriculum Authoring & Live Enrollment Tracking'}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            {activeTab === 'accounts'
              ? 'Inspect, filter, edit roles, adjust subscriptions, manage course assignments, and remove instructor or student accounts.'
              : activeTab === 'invite-instructors'
              ? 'Issue verified faculty invitation codes and assign teaching courses separately from student cohort registrations.'
              : activeTab === 'invite-students'
              ? 'Send individual or bulk student registration invitations with pre-enrolled tracks and subscription tiers.'
              : 'Edit course metadata, update module markdown/labs/quizzes/videos, reorder modules, and monitor real-time participant progress.'}
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
      <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => {
            setInviteFormError(null);
            setActiveTab('courses');
          }}
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
          onClick={() => {
            setInviteFormError(null);
            setActiveTab('progress');
          }}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'progress'
              ? 'border-blue-600 text-blue-600 dark:text-cyan-400 dark:border-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Real-Time Enrollment Progress ({studentProgressList.length})</span>
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => {
                setInviteFormError(null);
                setConfirmDeleteUserId(null);
                setActiveTab('accounts');
              }}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'accounts'
                  ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400 dark:border-cyan-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserCog className="w-4 h-4" />
              <span>User Accounts ({allUsers.length})</span>
            </button>

            <button
              onClick={() => {
                setInviteFormError(null);
                setActiveTab('invite-instructors');
              }}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'invite-instructors'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite Instructors ({instructorInvites.length})</span>
            </button>

            <button
              onClick={() => {
                setInviteFormError(null);
                setActiveTab('invite-students');
              }}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'invite-students'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Invite Students ({studentInvites.length})</span>
            </button>
          </>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'accounts' && isAdmin ? (
        <div className="space-y-5">
          {/* Account Summary KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Accounts
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                {allUsers.length}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-[11px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Instructors
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                {instructorAccountsCount}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Students
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                {studentAccountsCount}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-[11px] font-mono uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                Administrators
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                {adminAccountsCount}
              </p>
            </div>
          </div>

          {/* Search, Role Filter & Action Toolbar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  placeholder="Search by name, email, or user ID..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold overflow-x-auto">
                {(['all', 'instructor', 'student', 'admin'] as const).map(roleOption => (
                  <button
                    key={roleOption}
                    type="button"
                    onClick={() => setAccountRoleFilter(roleOption)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                      accountRoleFilter === roleOption
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {roleOption === 'all'
                      ? `All (${allUsers.length})`
                      : roleOption === 'instructor'
                      ? `Instructors (${instructorAccountsCount})`
                      : roleOption === 'student'
                      ? `Students (${studentAccountsCount})`
                      : `Admins (${adminAccountsCount})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSyncUsersDirectory}
                disabled={isSyncingUsers}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-cyan-500 text-xs font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingUsers ? 'animate-spin' : ''}`} />
                <span>{isSyncingUsers ? 'Syncing...' : 'Sync Firestore'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('invite-instructors')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite Instructor</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('invite-students')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Invite Student</span>
              </button>
            </div>
          </div>

          {/* Accounts Directory Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Subscription</th>
                    <th className="py-3 px-4">Courses</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 px-4 text-center text-slate-400">
                        No accounts match your current search or role filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map(user => {
                      const isSelf = user.id === currentUser.id;
                      const isBootstrappedAdmin = user.email.toLowerCase() === 'yoeur.man2010@gmail.com';
                      const isProtected = isSelf || isBootstrappedAdmin;
                      const isConfirmingDelete = confirmDeleteUserId === user.id;

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={user.avatar}
                                alt={user.name}
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900 dark:text-white truncate">
                                    {user.name}
                                  </span>
                                  {isSelf && (
                                    <span className="text-[10px] font-mono font-bold uppercase text-cyan-600 dark:text-cyan-400">
                                      (You)
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <select
                              aria-label={`Role for ${user.name}`}
                              disabled={isProtected}
                              value={user.role}
                              onChange={(e) => handleQuickRoleChange(user, e.target.value as UserRole)}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <option value="student">Student</option>
                              <option value="instructor">Instructor</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300 uppercase">
                            <span className="font-bold">{user.subscription?.tier || 'free'}</span>
                            <span className="text-slate-400 mx-1.5">·</span>
                            <span
                              className={
                                user.subscription?.status === 'active'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : user.subscription?.status === 'trial'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-red-500 dark:text-red-400'
                              }
                            >
                              {user.subscription?.status || 'active'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {user.enrolledCourseIds?.length || 0} course(s)
                          </td>

                          <td className="py-3.5 px-4 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                            {user.joinedDate || '—'}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditAccountModal(user)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 bg-slate-100/70 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              {!isProtected && (
                                isConfirmingDelete ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleConfirmDeleteAccount(user)}
                                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteUserId(null)}
                                      className="px-2 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteUserId(user.id)}
                                    className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                    title="Remove Account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'invite-instructors' && isAdmin ? (
        <div className="space-y-6">
          {/* Instructor Invite Composer Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form
              onSubmit={handleSendInstructorInvite}
              className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs"
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Invite New Instructor
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Grants faculty privileges to author modules, edit CLI labs, and review student cohorts.
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-mono text-[10px] font-bold">
                  ROLE: INSTRUCTOR
                </span>
              </div>

              {inviteFormError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs">
                  {inviteFormError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Instructor Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={instName}
                    onChange={(e) => setInstName(e.target.value)}
                    placeholder="Dr. Elena Rostova, CCIE"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Google / Work Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={instEmail}
                    onChange={(e) => setInstEmail(e.target.value)}
                    placeholder="instructor@company.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Teaching Specialization / Certification Track
                </label>
                <input
                  type="text"
                  value={instSpecialty}
                  onChange={(e) => setInstSpecialty(e.target.value)}
                  placeholder="e.g. CCNP Enterprise, BGP EVPN & Security Firewalls"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Assigned Courses to Teach & Author ({instAssignedCourseIds.length} selected)
                </label>
                <div className="flex flex-wrap gap-2">
                  {courses.map(course => {
                    const selected = instAssignedCourseIds.includes(course.id);
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => toggleCourseInSelection(course.id, setInstAssignedCourseIds)}
                        className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                          selected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                        }`}
                      >
                        <span className="font-mono">{course.code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Onboarding Welcome Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={instWelcomeNote}
                  onChange={(e) => setInstWelcomeNote(e.target.value)}
                  placeholder="Add lab curriculum instructions or schedule details for the instructor..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-500/20 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Generate & Send Instructor Invite</span>
                </button>
              </div>
            </form>

            {/* Instructor Onboarding Preview & Verification Card */}
            <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 text-xs">
              {latestInstructorInvite ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-[10px] font-bold">
                      INVITATION READY
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Expires {new Date(latestInstructorInvite.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {latestInstructorInvite.fullName}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {latestInstructorInvite.email}
                    </p>
                    <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1">
                      Track: {latestInstructorInvite.cohortOrSpecialty}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div>
                      <p className="text-[10px] font-mono uppercase text-slate-400">Instructor Invite Code</p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <code className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-300">
                          {latestInstructorInvite.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(latestInstructorInvite.code, 'invite code')}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:border-indigo-500"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-[10px] font-mono uppercase text-slate-400">Direct Registration URL</p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate">
                          {buildInviteUrl(latestInstructorInvite.code)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(buildInviteUrl(latestInstructorInvite.code), 'registration link')
                          }
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-500"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>Copy Link</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Zero-Trust Instructor Onboarding
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Instructors cannot self-register from the public sign-up page. Each invitation binds a single-use{' '}
                    <code className="font-mono text-indigo-600 dark:text-indigo-400">INST-XXXX-XXXX</code> code to the instructor&apos;s verified email address.
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Works with Google Sign-On or Email Sign-Up</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Enforced in Firestore security rules</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Instant revocation &amp; re-issue tracking</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Instructor Invitations Directory */}
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={instSearch}
                  onChange={(e) => setInstSearch(e.target.value)}
                  placeholder="Search instructor name, email, or code..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select
                value={instStatusFilter}
                onChange={(e) => setInstStatusFilter(e.target.value as 'all' | InvitationStatus)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4">Instructor</th>
                      <th className="py-3 px-4">Specialization</th>
                      <th className="py-3 px-4">Assigned Courses</th>
                      <th className="py-3 px-4">Invite Code</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredInstructorInvites.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 px-4 text-center text-slate-400">
                          No instructor invitations yet. Use the form above to invite a new instructor.
                        </td>
                      </tr>
                    ) : (
                      filteredInstructorInvites.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-slate-900 dark:text-white">{inv.fullName}</p>
                            <p className="text-[11px] font-mono text-slate-400">{inv.email}</p>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                            {inv.cohortOrSpecialty}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                            {inv.assignedCourseIds.length} course(s)
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {inv.code}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase ${
                                inv.status === 'accepted'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : inv.status === 'revoked'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => copyToClipboard(inv.code, 'code')}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Copy Invite Code"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(buildInviteUrl(inv.code), 'invite link')}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Copy Registration Link"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                              {inv.status !== 'accepted' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    resendInvitation(inv.id);
                                    showToast(`Resent instructor invite to ${inv.email}`);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title="Resend Invite"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {inv.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    revokeInvitation(inv.id);
                                    showToast(`Revoked invite ${inv.code}`);
                                  }}
                                  className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  title="Revoke Invite"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'invite-students' && isAdmin ? (
        <div className="space-y-6">
          {/* Student Registration Invite Composer Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form
              onSubmit={handleSendStudentInvites}
              className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Invite Students for Registration
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Issue single or bulk cohort registration links with pre-enrolled courses.
                    </p>
                  </div>
                </div>

                {/* Single vs Bulk Mode Switcher */}
                <div className="flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setInviteFormError(null);
                      setStudentInviteMode('single');
                    }}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      studentInviteMode === 'single'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Single Student
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteFormError(null);
                      setStudentInviteMode('bulk');
                    }}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      studentInviteMode === 'bulk'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Bulk Cohort
                  </button>
                </div>
              </div>

              {inviteFormError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs">
                  {inviteFormError}
                </div>
              )}

              {studentInviteMode === 'single' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Student Full Name
                    </label>
                    <input
                      type="text"
                      value={studName}
                      onChange={(e) => setStudName(e.target.value)}
                      placeholder="Jordan Taylor"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Student Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={studEmail}
                      onChange={(e) => setStudEmail(e.target.value)}
                      placeholder="student@company.com"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Student Cohort Roster (one recipient per line)
                    </label>
                    <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                      {parsedBulkStudents.length} valid email(s) detected
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={studBulkText}
                    onChange={(e) => setStudBulkText(e.target.value)}
                    placeholder={`Jordan Taylor <jordan@company.com>\nMaya Patel, maya@company.com\nliam.chen@company.com`}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cohort / Batch Label
                  </label>
                  <input
                    type="text"
                    value={studCohort}
                    onChange={(e) => setStudCohort(e.target.value)}
                    placeholder="Fall 2026 CCNA Bootcamp"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Subscription Tier
                  </label>
                  <select
                    value={studTier}
                    onChange={(e) => setStudTier(e.target.value as SubscriptionTier)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="free">Free Starter</option>
                    <option value="pro">Pro Lab Access</option>
                    <option value="expert">Expert Certification</option>
                    <option value="enterprise">Enterprise Cohort</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Pre-Enrolled Courses ({studCourseIds.length} selected)
                </label>
                <div className="flex flex-wrap gap-2">
                  {courses.map(course => {
                    const selected = studCourseIds.includes(course.id);
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => toggleCourseInSelection(course.id, setStudCourseIds)}
                        className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                          selected
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                        }`}
                      >
                        <span className="font-mono">{course.code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Registration Welcome Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={studWelcomeNote}
                  onChange={(e) => setStudWelcomeNote(e.target.value)}
                  placeholder="Optional cohort start date or orientation message..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-500/20 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {studentInviteMode === 'bulk' && parsedBulkStudents.length > 1
                      ? `Send ${parsedBulkStudents.length} Student Invites`
                      : 'Send Student Registration Invite'}
                  </span>
                </button>
              </div>
            </form>

            {/* Student Registration Invite Ready Summary */}
            <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 text-xs">
              {latestStudentInvites.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-[10px] font-bold">
                      {latestStudentInvites.length === 1
                        ? 'STUDENT INVITE READY'
                        : `${latestStudentInvites.length} INVITES DISPATCHED`}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Tier: {(latestStudentInvites[0].subscriptionTier || 'pro').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {latestStudentInvites.length === 1
                        ? latestStudentInvites[0].fullName
                        : `${latestStudentInvites[0].cohortOrSpecialty}`}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {latestStudentInvites.length === 1
                        ? latestStudentInvites[0].email
                        : `${latestStudentInvites.length} unique registration links generated`}
                    </p>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {latestStudentInvites.map(inv => (
                      <div
                        key={inv.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {inv.email}
                          </span>
                          <code className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                            {inv.code}
                          </code>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inv.code, 'student code')}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold hover:border-emerald-500"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Code</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(buildInviteUrl(inv.code), 'registration link')}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-500"
                          >
                            <Link2 className="w-3 h-3" />
                            <span>Copy Link</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Streamlined Cohort Registration
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Student invitations generate{' '}
                    <code className="font-mono text-emerald-600 dark:text-emerald-400">STUD-XXXX-XXXX</code> codes that automatically enroll learners into selected courses and initialize their progress tracker upon sign-up.
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Strict student-only permissions (never grants faculty access)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Bulk roster paste for fast bootcamp onboarding</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Automatic enrollment &amp; tier provisioning</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Student Registration Invitations Directory */}
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={studSearch}
                  onChange={(e) => setStudSearch(e.target.value)}
                  placeholder="Search student name, email, cohort, or code..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <select
                value={studStatusFilter}
                onChange={(e) => setStudStatusFilter(e.target.value as 'all' | InvitationStatus)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Cohort</th>
                      <th className="py-3 px-4">Pre-Enrolled</th>
                      <th className="py-3 px-4">Tier</th>
                      <th className="py-3 px-4">Registration Code</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredStudentInvites.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 px-4 text-center text-slate-400">
                          No student registration invitations yet. Invite individual students or a bulk cohort above.
                        </td>
                      </tr>
                    ) : (
                      filteredStudentInvites.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-slate-900 dark:text-white">{inv.fullName}</p>
                            <p className="text-[11px] font-mono text-slate-400">{inv.email}</p>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                            {inv.cohortOrSpecialty}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                            {inv.assignedCourseIds.length} course(s)
                          </td>
                          <td className="py-3.5 px-4 font-mono uppercase text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {inv.subscriptionTier || 'pro'}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {inv.code}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase ${
                                inv.status === 'accepted'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : inv.status === 'revoked'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => copyToClipboard(inv.code, 'code')}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Copy Registration Code"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(buildInviteUrl(inv.code), 'registration link')}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Copy Registration Link"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                              {inv.status !== 'accepted' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    resendInvitation(inv.id);
                                    showToast(`Resent student invite to ${inv.email}`);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title="Resend Invite"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {inv.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    revokeInvitation(inv.id);
                                    showToast(`Revoked invite ${inv.code}`);
                                  }}
                                  className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  title="Revoke Invite"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'progress' ? (
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
                    <th className="py-3 px-4">Access Window</th>
                    <th className="py-3 px-4">Modules Completed</th>
                    <th className="py-3 px-4">Progress</th>
                    <th className="py-3 px-4">Quiz Avg</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredProgress.map((record, index) => {
                    const matchedUser = allUsers.find(u => u.id === record.studentId);
                    const matchedCourse = courses.find(c => c.id === record.courseId);
                    const enrollment = record.startDate && record.expiresAt
                      ? {
                          courseId: record.courseId,
                          startDate: record.startDate,
                          endDate: record.endDate || record.expiresAt,
                          expiresAt: record.expiresAt
                        }
                      : matchedUser && matchedCourse
                      ? resolveCourseEnrollment(matchedUser, matchedCourse)
                      : null;
                    const expiryInfo = enrollment ? getEnrollmentExpirationInfo(enrollment) : null;

                    return (
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

                        <td className="py-3.5 px-4 font-mono text-[11px] tabular-nums">
                          {enrollment && expiryInfo ? (
                            <div className="space-y-0.5">
                              <div className="text-slate-700 dark:text-slate-300">
                                {formatEnrollmentDate(enrollment.startDate)} → {formatEnrollmentDate(enrollment.expiresAt)}
                              </div>
                              <div
                                className={`inline-flex items-center gap-1 font-sans text-[10px] font-semibold ${
                                  expiryInfo.status === 'expired'
                                    ? 'text-red-600 dark:text-red-400'
                                    : expiryInfo.status === 'expiring_soon'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {expiryInfo.status === 'expired' ? (
                                  <XCircle className="w-3 h-3 shrink-0" />
                                ) : expiryInfo.status === 'expiring_soon' ? (
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                ) : (
                                  <Calendar className="w-3 h-3 shrink-0" />
                                )}
                                <span>{expiryInfo.statusLabel}</span>
                                <span>·</span>
                                <span>{expiryInfo.countdownLabel}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
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
                    );
                  })}
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
                  <span>Access: {course.defaultAccessDays || DEFAULT_ENROLLMENT_DAYS}d</span>
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Access Days</label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={courseForm.defaultAccessDays}
                    onChange={(e) => setCourseForm({ ...courseForm, defaultAccessDays: parseInt(e.target.value, 10) || DEFAULT_ENROLLMENT_DAYS })}
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

      {/* Edit User Account Modal (Admin) */}
      {editingAccountUser && isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={editingAccountUser.avatar}
                  alt={editingAccountUser.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                    Manage Account: {editingAccountUser.name}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    {editingAccountUser.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccountUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={accountForm.name}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Account Role
                  </label>
                  <select
                    value={accountForm.role}
                    disabled={
                      editingAccountUser.id === currentUser.id ||
                      editingAccountUser.email.toLowerCase() === 'yoeur.man2010@gmail.com'
                    }
                    onChange={(e) => setAccountForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="student">Student</option>
                    <option value="instructor">Instructor</option>
                    <option value="admin">Admin</option>
                  </select>
                  {(editingAccountUser.id === currentUser.id ||
                    editingAccountUser.email.toLowerCase() === 'yoeur.man2010@gmail.com') && (
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      Protected administrator role cannot be downgraded here.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subscription Tier
                  </label>
                  <select
                    value={accountForm.subscriptionTier}
                    onChange={(e) =>
                      setAccountForm(prev => ({
                        ...prev,
                        subscriptionTier: e.target.value as SubscriptionTier
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="free">Free Starter</option>
                    <option value="pro">Pro Lab Access</option>
                    <option value="expert">Expert Certification</option>
                    <option value="enterprise">Enterprise Cohort</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subscription Status
                  </label>
                  <select
                    value={accountForm.subscriptionStatus}
                    onChange={(e) =>
                      setAccountForm(prev => ({
                        ...prev,
                        subscriptionStatus: e.target.value as User['subscription']['status']
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Enrolled / Assigned Courses ({accountForm.enrolledCourseIds.length} selected)
                </label>
                <div className="flex flex-wrap gap-2">
                  {courses.map(course => {
                    const selected = accountForm.enrolledCourseIds.includes(course.id);
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() =>
                          setAccountForm(prev => {
                            const isRemoving = prev.enrolledCourseIds.includes(course.id);
                            const nextIds = isRemoving
                              ? prev.enrolledCourseIds.filter(id => id !== course.id)
                              : [...prev.enrolledCourseIds, course.id];
                            const nextEnrollments = { ...prev.courseEnrollments };
                            if (!isRemoving && !nextEnrollments[course.id]) {
                              nextEnrollments[course.id] = createDefaultCourseEnrollment(
                                course.id,
                                course.defaultAccessDays
                              );
                            }
                            return {
                              ...prev,
                              enrolledCourseIds: nextIds,
                              courseEnrollments: nextEnrollments
                            };
                          })
                        }
                        className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                          selected
                            ? 'bg-cyan-600 border-cyan-600 text-white shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-cyan-400'
                        }`}
                      >
                        <span className="font-mono">{course.code}</span>
                      </button>
                    );
                  })}
                </div>

                {accountForm.enrolledCourseIds.length > 0 && (
                  <div className="mt-3 space-y-2.5">
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Course Enrollment Schedule &amp; Expiration Dates
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {accountForm.enrolledCourseIds.map(cid => {
                        const course = courses.find(c => c.id === cid);
                        const sched =
                          accountForm.courseEnrollments[cid] ||
                          createDefaultCourseEnrollment(cid, course?.defaultAccessDays);
                        const info = getEnrollmentExpirationInfo(sched);

                        return (
                          <div
                            key={cid}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100">
                                {course ? `${course.code} · ${course.title}` : cid}
                              </span>
                              <span
                                className={`text-[10px] font-mono font-bold tabular-nums ${
                                  info.status === 'expired'
                                    ? 'text-red-600 dark:text-red-400'
                                    : info.status === 'expiring_soon'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {info.statusLabel} · {info.countdownLabel}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-0.5">
                                  Start Date
                                </label>
                                <input
                                  type="date"
                                  value={sched.startDate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAccountForm(prev => ({
                                      ...prev,
                                      courseEnrollments: {
                                        ...prev.courseEnrollments,
                                        [cid]: {
                                          ...(prev.courseEnrollments[cid] || sched),
                                          startDate: val
                                        }
                                      }
                                    }));
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px]"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-0.5">
                                  End Date
                                </label>
                                <input
                                  type="date"
                                  value={sched.endDate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAccountForm(prev => ({
                                      ...prev,
                                      courseEnrollments: {
                                        ...prev.courseEnrollments,
                                        [cid]: {
                                          ...(prev.courseEnrollments[cid] || sched),
                                          endDate: val
                                        }
                                      }
                                    }));
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px]"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-0.5">
                                  Expiration Date
                                </label>
                                <input
                                  type="date"
                                  value={sched.expiresAt}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAccountForm(prev => ({
                                      ...prev,
                                      courseEnrollments: {
                                        ...prev.courseEnrollments,
                                        [cid]: {
                                          ...(prev.courseEnrollments[cid] || sched),
                                          expiresAt: val,
                                          endDate: prev.courseEnrollments[cid]?.endDate || val
                                        }
                                      }
                                    }));
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px]"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAccountUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingAccount ? 'Saving...' : 'Save Account Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
