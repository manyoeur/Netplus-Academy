import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Plus,
  BookOpen,
  Users,
  UserPlus,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Trash2,
  Mail,
  Copy,
  Check,
  RefreshCw,
  Ban,
  ExternalLink,
  ShieldCheck,
  Sliders,
  X,
  UserMinus,
  Megaphone,
  Pin,
  PinOff,
  ClipboardCheck,
  Download,
  Video,
  Lock,
  Unlock,
  XCircle,
  MoreVertical
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import {
  AttendanceStatus,
  ClassAnnouncement,
  Course,
  CourseClass,
  SubscriptionTier
} from '../../types';
import {
  addDaysToIsoDate,
  formatEnrollmentDate,
  getEnrollmentExpirationInfo,
  getTodayIsoDate
} from '../../utils/enrollmentDates';

interface MyClassManagerProps {
  onOpenCoursePlayer?: (courseId: string) => void;
}

type WorkspaceTab = 'students' | 'attendance' | 'announcements' | 'invites' | 'settings';

export const MyClassManager: React.FC<MyClassManagerProps> = ({ onOpenCoursePlayer }) => {
  const {
    currentUser,
    allUsers,
    courses,
    classes,
    invitations,
    getOwnedCoursesForUser,
    addCourse,
    createClass,
    updateClass,
    deleteClass,
    enrollStudentInClass,
    removeStudentFromClass,
    inviteStudentsToClass,
    addClassAnnouncement,
    togglePinClassAnnouncement,
    deleteClassAnnouncement,
    markClassAttendance,
    markAllClassAttendance,
    resendInvitation,
    revokeInvitation,
    updateUserAccount
  } = useAcademy();

  const isAdmin = currentUser.role === 'admin';
  const isInstructor = currentUser.role === 'instructor';
  const hasAccess = isAdmin || isInstructor;

  const ownedCourses = useMemo(() => getOwnedCoursesForUser(currentUser), [courses, currentUser]);

  // Filter classes: Admins see all classes; Instructors only see classes tied to courses they created/own
  const visibleClasses = useMemo(() => {
    if (isAdmin) return classes;
    if (!isInstructor) return [];
    const ownedIds = new Set(ownedCourses.map(c => c.id));
    return classes.filter(
      cls => ownedIds.has(cls.courseId) || cls.instructorId === currentUser.id
    );
  }, [classes, isAdmin, isInstructor, ownedCourses, currentUser.id]);

  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [classSearch, setClassSearch] = useState('');

  // Modal / Drawer Class Workspace
  const [activeModalClassId, setActiveModalClassId] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('students');
  const [openMenuClassId, setOpenMenuClassId] = useState<string | null>(null);
  const [confirmDeleteClassId, setConfirmDeleteClassId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  // Create Course Modal
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseSubtitle, setNewCourseSubtitle] = useState('');
  const [newCourseCategory, setNewCourseCategory] = useState<Course['category']>(
    'Enterprise Routing & Switching'
  );
  const [newCourseLevel, setNewCourseLevel] = useState<Course['level']>('Intermediate');
  const [newCoursePrice, setNewCoursePrice] = useState('49');
  const [newCourseDuration, setNewCourseDuration] = useState('16');
  const [newCourseDescription, setNewCourseDescription] = useState('');

  // Create Class Modal
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [classFormCourseId, setClassFormCourseId] = useState('');
  const [classFormName, setClassFormName] = useState('');
  const [classFormSection, setClassFormSection] = useState('');
  const [classFormDeliveryType, setClassFormDeliveryType] = useState<'Instructor-led' | 'Self-paced'>('Instructor-led');
  const [classFormLanguage, setClassFormLanguage] = useState('English');
  const [classFormSchedule, setClassFormSchedule] = useState('Mon & Wed · 18:00–20:00 UTC');
  const [classFormStartDate, setClassFormStartDate] = useState(getTodayIsoDate());
  const [classFormEndDate, setClassFormEndDate] = useState(addDaysToIsoDate(getTodayIsoDate(), 90));
  const [classFormMaxSeats, setClassFormMaxSeats] = useState('30');
  const [classFormMeetingUrl, setClassFormMeetingUrl] = useState('');
  const [classFormNotes, setClassFormNotes] = useState('');
  const [classFormError, setClassFormError] = useState<string | null>(null);

  // Enroll Student State
  const [enrollMode, setEnrollMode] = useState<'existing' | 'new'>('existing');
  const [selectedStudentUserId, setSelectedStudentUserId] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pageExportNotice, setPageExportNotice] = useState<string | null>(null);

  // Attendance Tab State
  const [attendanceDate, setAttendanceDate] = useState(getTodayIsoDate());

  // Announcements Tab State
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementCategory, setAnnouncementCategory] =
    useState<ClassAnnouncement['category']>('general');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementPinned, setAnnouncementPinned] = useState(false);

  // Invite Student State
  const [inviteBatchInput, setInviteBatchInput] = useState('');
  const [inviteTier, setInviteTier] = useState<SubscriptionTier>('pro');
  const [inviteNote, setInviteNote] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Settings Tab State
  const [editClassName, setEditClassName] = useState('');
  const [editSectionCode, setEditSectionCode] = useState('');
  const [editDeliveryType, setEditDeliveryType] = useState<'Instructor-led' | 'Self-paced'>('Instructor-led');
  const [editLanguage, setEditLanguage] = useState('English');
  const [editScheduleLabel, setEditScheduleLabel] = useState('');
  const [editMeetingUrl, setEditMeetingUrl] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editMaxSeats, setEditMaxSeats] = useState('30');
  const [editEnrollmentOpen, setEditEnrollmentOpen] = useState(true);
  const [editNotes, setEditNotes] = useState('');
  const [syncDatesToStudents, setSyncDatesToStudents] = useState(true);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenuClassId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    const list = visibleClasses.filter(cls => {
      if (selectedCourseFilter !== 'all' && cls.courseId !== selectedCourseFilter) {
        return false;
      }
      if (!q) return true;
      return (
        cls.name.toLowerCase().includes(q) ||
        cls.sectionCode.toLowerCase().includes(q) ||
        cls.courseCode.toLowerCase().includes(q) ||
        cls.courseTitle.toLowerCase().includes(q) ||
        cls.instructorName.toLowerCase().includes(q)
      );
    });
    // Sort pinned classes first while preserving original order
    return [...list].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [visibleClasses, selectedCourseFilter, classSearch]);

  const activeModalClass = useMemo(
    () => visibleClasses.find(c => c.id === activeModalClassId) || null,
    [visibleClasses, activeModalClassId]
  );

  // Sync Settings form with active modal class
  useEffect(() => {
    if (!activeModalClass) return;
    setEditClassName(activeModalClass.name);
    setEditSectionCode(activeModalClass.sectionCode);
    setEditDeliveryType(activeModalClass.deliveryType || 'Instructor-led');
    setEditLanguage(activeModalClass.language || 'English');
    setEditScheduleLabel(activeModalClass.scheduleLabel);
    setEditMeetingUrl(activeModalClass.meetingUrl || '');
    setEditStartDate(activeModalClass.startDate);
    setEditEndDate(activeModalClass.endDate);
    setEditMaxSeats(String(activeModalClass.maxSeats));
    setEditEnrollmentOpen(activeModalClass.enrollmentOpen !== false);
    setEditNotes(activeModalClass.notes || '');
    setActionFeedback(null);
  }, [activeModalClass?.id]);

  // Keep Create Class course default synced with first owned course
  useEffect(() => {
    if (ownedCourses.length > 0 && !ownedCourses.some(c => c.id === classFormCourseId)) {
      setClassFormCourseId(
        selectedCourseFilter !== 'all' && ownedCourses.some(c => c.id === selectedCourseFilter)
          ? selectedCourseFilter
          : ownedCourses[0].id
      );
    }
  }, [ownedCourses, selectedCourseFilter, classFormCourseId]);

  const activeCourseObj = activeModalClass
    ? courses.find(c => c.id === activeModalClass.courseId) || null
    : null;

  const enrolledRoster = useMemo(() => {
    if (!activeModalClass) return [];
    return activeModalClass.enrolledStudentIds
      .map(id => allUsers.find(u => u.id === id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u));
  }, [activeModalClass, allUsers]);

  const availableStudentsToEnroll = useMemo(() => {
    if (!activeModalClass) return [];
    const inClass = new Set(activeModalClass.enrolledStudentIds);
    return allUsers.filter(u => u.role === 'student' && !inClass.has(u.id));
  }, [activeModalClass, allUsers]);

  const classInvitations = useMemo(() => {
    if (!activeModalClass) return [];
    const emailSet = new Set(activeModalClass.invitedEmails.map(e => e.toLowerCase()));
    return invitations.filter(
      inv =>
        inv.role === 'student' &&
        (inv.cohortOrSpecialty.includes(activeModalClass.sectionCode) ||
          (emailSet.has(inv.email.toLowerCase()) &&
            inv.assignedCourseIds.includes(activeModalClass.courseId)))
    );
  }, [activeModalClass, invitations]);

  const sortedAnnouncements = useMemo(() => {
    const list = [...(activeModalClass?.announcements || [])];
    return list.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [activeModalClass?.announcements]);

  const attendanceSessionDates = useMemo(() => {
    if (!activeModalClass?.attendanceRecords) return [];
    return Object.keys(activeModalClass.attendanceRecords).sort((a, b) => b.localeCompare(a));
  }, [activeModalClass?.attendanceRecords]);

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Instructor or Admin Access Required
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          The My Classes workspace is restricted to administrators and instructors for creating classes, tracking attendance, posting announcements, and enrolling students.
        </p>
      </div>
    );
  }

  const openClassWorkspace = (classId: string, tab: WorkspaceTab) => {
    setActiveModalClassId(classId);
    setWorkspaceTab(tab);
    setOpenMenuClassId(null);
    setActionFeedback(null);
  };

  const resolveInstructorAvatar = (cls: CourseClass): string => {
    const matched = allUsers.find(
      u => u.id === cls.instructorId || u.email.toLowerCase() === cls.instructorEmail.toLowerCase()
    );
    return (
      matched?.avatar ||
      cls.instructorAvatar ||
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=256&q=80'
    );
  };

  const getStudentAttendanceRate = (cls: CourseClass, studentId: string): number | null => {
    const records = cls.attendanceRecords || {};
    const dates = Object.keys(records);
    if (dates.length === 0) return null;
    let totalSessions = 0;
    let attendedCount = 0;
    dates.forEach(dateKey => {
      const st = records[dateKey]?.[studentId];
      if (st) {
        totalSessions += 1;
        if (st === 'present' || st === 'late') attendedCount += 1;
      }
    });
    if (totalSessions === 0) return null;
    return Math.round((attendedCount / totalSessions) * 100);
  };

  const handleCreateQuickCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseCode.trim() || !newCourseTitle.trim()) return;

    const courseId = `course-${Date.now()}`;
    const today = getTodayIsoDate();
    const newCourse: Course = {
      id: courseId,
      code: newCourseCode.trim().toUpperCase(),
      title: newCourseTitle.trim(),
      subtitle: newCourseSubtitle.trim() || 'Instructor-Led Enterprise Cohort Track',
      category: newCourseCategory,
      level: newCourseLevel,
      instructor: {
        name: currentUser.name,
        title: isAdmin ? 'Lead Academy Architect' : 'Course Instructor',
        avatar: currentUser.avatar
      },
      createdById: currentUser.id,
      createdByEmail: currentUser.email,
      rating: 5.0,
      reviewsCount: 0,
      durationHours: Math.max(1, Number(newCourseDuration) || 12),
      modulesCount: 1,
      enrolledCount: 0,
      price: Math.max(0, Number(newCoursePrice) || 0),
      bannerColor: 'from-blue-600 to-indigo-700',
      badge: 'New Track',
      description:
        newCourseDescription.trim() ||
        'Instructor-designed curriculum covering architecture, lab verification, and certification readiness.',
      prerequisites: ['Foundational TCP/IP concepts'],
      learningOutcomes: ['Design & validate production topologies'],
      modules: [
        {
          id: `mod-${Date.now()}-intro`,
          title: 'Module 1: Architecture Foundations & Lab Overview',
          type: 'theory',
          durationMin: 25,
          summary: 'Core protocol overview, syllabus milestones, and environment setup.',
          contentMarkdown: `# Welcome to ${newCourseTitle.trim()}\n\nThis opening module establishes the core concepts, grading criteria, and hands-on lab objectives for this track.`
        }
      ],
      isPublished: true,
      updatedAt: today,
      defaultAccessDays: 180
    };

    addCourse(newCourse);
    setClassFormCourseId(courseId);
    setSelectedCourseFilter(courseId);
    setShowCreateCourseModal(false);
    setNewCourseCode('');
    setNewCourseTitle('');
    setNewCourseSubtitle('');
    setNewCourseDescription('');
  };

  const handleOpenCreateClass = () => {
    setClassFormError(null);
    if (ownedCourses.length > 0 && !classFormCourseId) {
      setClassFormCourseId(ownedCourses[0].id);
    }
    setShowCreateClassModal(true);
  };

  const handleCreateClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClassFormError(null);

    if (!classFormCourseId) {
      setClassFormError('Select one of your created courses first.');
      return;
    }
    if (!classFormName.trim()) {
      setClassFormError('Enter a class name.');
      return;
    }

    const res = createClass({
      name: classFormName.trim(),
      sectionCode: classFormSection.trim() || undefined,
      courseId: classFormCourseId,
      deliveryType: classFormDeliveryType,
      language: classFormLanguage.trim() || 'English',
      scheduleLabel: classFormSchedule.trim(),
      startDate: classFormStartDate,
      endDate: classFormEndDate,
      maxSeats: Number(classFormMaxSeats) || 30,
      meetingUrl: classFormMeetingUrl.trim() || undefined,
      notes: classFormNotes.trim() || undefined
    });

    if (!res.success || !res.courseClass) {
      setClassFormError(res.error || 'Unable to create class.');
      return;
    }

    setShowCreateClassModal(false);
    setClassFormName('');
    setClassFormSection('');
    setClassFormMeetingUrl('');
    setClassFormNotes('');
    setSelectedCourseFilter('all');
  };

  const handleEnrollStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalClass) return;
    setActionFeedback(null);

    if (activeModalClass.enrollmentOpen === false) {
      setActionFeedback({
        type: 'error',
        text: 'Enrollment is currently closed for this class. Re-open enrollment in Settings to add students.'
      });
      return;
    }

    const payload =
      enrollMode === 'existing'
        ? { existingUserId: selectedStudentUserId }
        : { name: newStudentName, email: newStudentEmail };

    const res = enrollStudentInClass(activeModalClass.id, payload);
    if (!res.success) {
      setActionFeedback({ type: 'error', text: res.error || 'Could not enroll student.' });
      return;
    }

    setSelectedStudentUserId('');
    setNewStudentName('');
    setNewStudentEmail('');
    setActionFeedback({
      type: 'success',
      text: `Student enrolled in ${activeModalClass.sectionCode} (${formatEnrollmentDate(
        activeModalClass.startDate
      )} – ${formatEnrollmentDate(activeModalClass.endDate)}).`
    });
  };

  const parseInviteEntries = (raw: string): Array<{ fullName: string; email: string }> => {
    const lines = raw
      .split(/\r?\n|;/)
      .map(l => l.trim())
      .filter(Boolean);
    const entries: Array<{ fullName: string; email: string }> = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const emailMatch = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (!emailMatch) continue;
      const email = emailMatch[0].toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);

      let fullName = line
        .replace(emailMatch[0], '')
        .replace(/[<>,()"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!fullName) {
        fullName = email.split('@')[0];
      }
      entries.push({ fullName, email });
    }
    return entries;
  };

  const handleInviteStudentsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalClass) return;
    setActionFeedback(null);

    const parsed = parseInviteEntries(inviteBatchInput);
    if (parsed.length === 0) {
      setActionFeedback({
        type: 'error',
        text: 'Enter at least one valid student email (e.g., Jordan Lee, jordan@company.com).'
      });
      return;
    }

    const created = inviteStudentsToClass(activeModalClass.id, parsed, inviteTier, inviteNote);
    setInviteBatchInput('');
    setInviteNote('');
    setActionFeedback({
      type: 'success',
      text: `Created ${created.length} class invite code(s) for ${activeModalClass.sectionCode}.`
    });
  };

  const handlePostAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalClass || !announcementTitle.trim() || !announcementMessage.trim()) return;
    addClassAnnouncement(activeModalClass.id, {
      title: announcementTitle,
      message: announcementMessage,
      category: announcementCategory,
      pinned: announcementPinned
    });
    setAnnouncementTitle('');
    setAnnouncementMessage('');
    setAnnouncementPinned(false);
    setActionFeedback({
      type: 'success',
      text: `Announcement published to ${activeModalClass.sectionCode}.`
    });
  };

  const handleSaveClassSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalClass) return;

    const cleanStart = editStartDate || activeModalClass.startDate;
    const cleanEnd = editEndDate >= cleanStart ? editEndDate : cleanStart;

    updateClass(activeModalClass.id, {
      name: editClassName.trim() || activeModalClass.name,
      sectionCode: editSectionCode.trim().toUpperCase() || activeModalClass.sectionCode,
      deliveryType: editDeliveryType,
      language: editLanguage.trim() || 'English',
      scheduleLabel: editScheduleLabel.trim() || activeModalClass.scheduleLabel,
      meetingUrl: editMeetingUrl.trim() || undefined,
      enrollmentOpen: editEnrollmentOpen,
      startDate: cleanStart,
      endDate: cleanEnd,
      expiresAt: cleanEnd,
      maxSeats: Math.max(1, Number(editMaxSeats) || activeModalClass.maxSeats),
      notes: editNotes.trim() || undefined
    });

    if (syncDatesToStudents) {
      activeModalClass.enrolledStudentIds.forEach(studentId => {
        const student = allUsers.find(u => u.id === studentId);
        if (!student) return;
        updateUserAccount(student.id, {
          courseEnrollments: {
            ...(student.courseEnrollments || {}),
            [activeModalClass.courseId]: {
              courseId: activeModalClass.courseId,
              startDate: cleanStart,
              endDate: cleanEnd,
              expiresAt: cleanEnd
            }
          }
        });
      });
    }

    setActionFeedback({
      type: 'success',
      text: syncDatesToStudents
        ? 'Class settings saved and dates synced to all enrolled students.'
        : 'Class settings saved.'
    });
  };

  const escapeCsvCell = (value: unknown): string => {
    const str = String(value ?? '');
    return `"${str.replace(/"/g, '""')}"`;
  };

  const buildCsvRowsForClasses = (targetClasses: CourseClass[]): string[] => {
    const rows: string[] = [];
    targetClasses.forEach(cls => {
      const courseObj = courses.find(c => c.id === cls.courseId);
      const roster = cls.enrolledStudentIds
        .map(id => allUsers.find(u => u.id === id))
        .filter((u): u is NonNullable<typeof u> => Boolean(u));

      const totalModules = courseObj?.modules.length || 0;
      roster.forEach(student => {
        const doneModules = courseObj
          ? courseObj.modules.filter(m => student.completedModuleIds.includes(m.id)).length
          : 0;
        const progressPct = totalModules > 0 ? Math.round((doneModules / totalModules) * 100) : 0;
        const attendanceRate = getStudentAttendanceRate(cls, student.id);
        const dates = student.courseEnrollments?.[cls.courseId] || {
          courseId: cls.courseId,
          startDate: cls.startDate,
          endDate: cls.endDate,
          expiresAt: cls.expiresAt
        };
        const expInfo = getEnrollmentExpirationInfo(dates);

        rows.push(
          [
            escapeCsvCell(cls.name),
            escapeCsvCell(cls.sectionCode),
            escapeCsvCell(cls.courseCode),
            escapeCsvCell(cls.courseTitle),
            escapeCsvCell(cls.deliveryType || 'Instructor-led'),
            escapeCsvCell(cls.language || 'English'),
            escapeCsvCell(cls.instructorName),
            escapeCsvCell(student.name),
            escapeCsvCell(student.email),
            escapeCsvCell(expInfo.statusLabel),
            escapeCsvCell(doneModules),
            escapeCsvCell(totalModules),
            escapeCsvCell(progressPct),
            escapeCsvCell(attendanceRate !== null ? attendanceRate : 'N/A'),
            escapeCsvCell(dates.startDate),
            escapeCsvCell(dates.expiresAt)
          ].join(',')
        );
      });
    });
    return rows;
  };

  const downloadCsvFile = (filename: string, rows: string[]) => {
    const header = [
      'Class Name',
      'Section Code',
      'Course Code',
      'Course Title',
      'Delivery Type',
      'Language',
      'Instructor',
      'Student Name',
      'Student Email',
      'Enrollment Status',
      'Completed Modules',
      'Total Modules',
      'Progress %',
      'Attendance %',
      'Start Date',
      'Expiration Date'
    ];
    const csvContent = `\uFEFF${[header.map(escapeCsvCell).join(','), ...rows].join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportRosterCsvForClass = (cls: CourseClass) => {
    const rows = buildCsvRowsForClasses([cls]);
    downloadCsvFile(`${cls.sectionCode.toLowerCase()}-enrollment-list.csv`, rows);
    setOpenMenuClassId(null);
    const msg = `Exported ${rows.length} student enrollment record${rows.length === 1 ? '' : 's'} for ${cls.sectionCode}.`;
    setPageExportNotice(msg);
    if (activeModalClass?.id === cls.id) {
      setActionFeedback({ type: 'success', text: msg });
    }
    window.setTimeout(() => setPageExportNotice(null), 5000);
  };

  const handleExportAllFilteredEnrollmentsCsv = () => {
    const rows = buildCsvRowsForClasses(filteredClasses);
    const today = getTodayIsoDate();
    downloadCsvFile(`my-class-enrollments-${today}.csv`, rows);
    const msg = `Exported ${rows.length} student enrollment record${rows.length === 1 ? '' : 's'} across ${filteredClasses.length} class${filteredClasses.length === 1 ? '' : 'es'}.`;
    setPageExportNotice(msg);
    window.setTimeout(() => setPageExportNotice(null), 5000);
  };

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  const getAnnouncementCategoryLabel = (cat: ClassAnnouncement['category']) => {
    switch (cat) {
      case 'lab':
        return 'Lab Prep';
      case 'deadline':
        return 'Deadline';
      case 'live_session':
        return 'Live Session';
      default:
        return 'General';
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 dark:text-emerald-400 mb-1">
            <GraduationCap className="w-4 h-4" />
            <span>
              {isAdmin ? 'ADMIN · ALL ACADEMY CLASSES' : 'INSTRUCTOR · OWN CREATED COURSES ONLY'}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Classes
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {isAdmin
              ? 'Manage all active classes, invite learners, record attendance, and adjust class schedules.'
              : 'Create classes for courses you created, invite learners, track attendance, and manage enrollments.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportAllFilteredEnrollmentsCsv}
            disabled={filteredClasses.every(c => c.enrolledStudentIds.length === 0)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Export Enrollments CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateCourseModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Create Course</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateClass}
            disabled={ownedCourses.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Class</span>
          </button>
        </div>
      </div>

      {pageExportNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{pageExportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setPageExportNotice(null)}
            className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Course Ownership Alert if Instructor has 0 courses */}
      {ownedCourses.length === 0 && (
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>Create a Course Before Launching a Class</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Instructors can only create classes for courses they have created. Publish your first course to unlock class creation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateCourseModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Course</span>
          </button>
        </div>
      )}

      {/* Compact Filter Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={classSearch}
            onChange={e => setClassSearch(e.target.value)}
            placeholder="Search class name, course, or instructor..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedCourseFilter}
            onChange={e => setSelectedCourseFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">
              {isAdmin ? 'All Academy Courses' : 'All My Created Courses'} ({visibleClasses.length})
            </option>
            {ownedCourses.map(c => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reference-Style Clean Bordered Table */}
      <div
        ref={menuContainerRef}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-xs overflow-x-auto"
      >
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 divide-x divide-slate-200 dark:divide-slate-800 text-[11px] font-semibold tracking-wider uppercase text-slate-600 dark:text-slate-400">
              <th className="py-3 px-4 w-[32%]">CLASS</th>
              <th className="py-3 px-4 w-[18%]">DATE</th>
              <th className="py-3 px-4 w-[12%]">TYPE</th>
              <th className="py-3 px-4 w-[15%]">INSTRUCTOR</th>
              <th className="py-3 px-4 w-[9%]">LANGUAGE</th>
              <th className="py-3 px-4 w-[14%]">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredClasses.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 px-6 text-center">
                  <div className="max-w-sm mx-auto space-y-2">
                    <Calendar className="w-8 h-8 mx-auto text-slate-400" />
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      No classes found
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {ownedCourses.length === 0
                        ? 'Create your first course above to start creating classes.'
                        : 'Click Create Class to add a new class section for one of your courses.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredClasses.map(cls => {
                const seatPercent = Math.min(
                  100,
                  Math.round((cls.enrolledStudentIds.length / Math.max(1, cls.maxSeats)) * 100)
                );
                const radius = 8;
                const circumference = 2 * Math.PI * radius;
                const strokeDashoffset = circumference - (seatPercent / 100) * circumference;
                const instructorAvatar = resolveInstructorAvatar(cls);

                return (
                  <tr
                    key={cls.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    {/* CLASS */}
                    <td className="py-6 px-4 align-middle">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => openClassWorkspace(cls.id, 'students')}
                            className="text-left text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline leading-snug"
                          >
                            {cls.name}
                          </button>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                            {cls.courseTitle}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-500 mt-1 flex flex-wrap items-center gap-2 tabular-nums">
                            <span className="font-mono">{cls.sectionCode}</span>
                            <span>·</span>
                            <span>
                              {cls.enrolledStudentIds.length}/{cls.maxSeats} Learners
                            </span>
                            {(cls.announcements || []).length > 0 && (
                              <>
                                <span>·</span>
                                <span>{(cls.announcements || []).length} Notice{(cls.announcements || []).length === 1 ? '' : 's'}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Subtle Circular Progress / Seat Ring */}
                        <div
                          title={`${seatPercent}% seats filled (${cls.enrolledStudentIds.length}/${cls.maxSeats})`}
                          className="shrink-0"
                        >
                          <svg className="w-5 h-5 -rotate-90" viewBox="0 0 22 22">
                            <circle
                              cx="11"
                              cy="11"
                              r={radius}
                              fill="none"
                              strokeWidth="3.5"
                              className="stroke-slate-300 dark:stroke-slate-700"
                            />
                            <circle
                              cx="11"
                              cy="11"
                              r={radius}
                              fill="none"
                              strokeWidth="3.5"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeDashoffset}
                              strokeLinecap="round"
                              className="stroke-emerald-500 transition-all"
                            />
                          </svg>
                        </div>
                      </div>
                    </td>

                    {/* DATE */}
                    <td className="py-6 px-4 align-middle text-xs text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {formatEnrollmentDate(cls.startDate)} - {formatEnrollmentDate(cls.endDate)}
                    </td>

                    {/* TYPE */}
                    <td className="py-6 px-4 align-middle text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {cls.deliveryType || 'Instructor-led'}
                    </td>

                    {/* INSTRUCTOR */}
                    <td className="py-6 px-4 align-middle">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={instructorAvatar}
                          alt={cls.instructorName}
                          className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <span className="text-xs text-slate-800 dark:text-slate-200 truncate">
                          {cls.instructorName}
                        </span>
                      </div>
                    </td>

                    {/* LANGUAGE */}
                    <td className="py-6 px-4 align-middle text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {cls.language || 'English'}
                    </td>

                    {/* ACTIONS */}
                    <td className="py-6 px-4 align-middle relative">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openClassWorkspace(cls.id, 'invites')}
                          className="px-4 py-1.5 rounded-full border border-emerald-500 text-xs font-bold text-slate-900 dark:text-white hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors whitespace-nowrap shrink-0"
                        >
                          Invite Learners
                        </button>

                        <button
                          type="button"
                          title={cls.pinned ? 'Unpin class' : 'Pin class to top'}
                          onClick={() => updateClass(cls.id, { pinned: !cls.pinned })}
                          className={`w-8 h-8 rounded border flex items-center justify-center transition-colors shrink-0 ${
                            cls.pinned
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                              : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            title="More class actions"
                            onClick={() =>
                              setOpenMenuClassId(prev => (prev === cls.id ? null : cls.id))
                            }
                            className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuClassId === cls.id && (
                            <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl z-40 py-1.5 text-xs">
                              <button
                                type="button"
                                onClick={() => openClassWorkspace(cls.id, 'students')}
                                className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Manage & Enroll Learners</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openClassWorkspace(cls.id, 'attendance')}
                                className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <ClipboardCheck className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                                <span>Record Attendance</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openClassWorkspace(cls.id, 'announcements')}
                                className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Megaphone className="w-3.5 h-3.5 text-amber-500" />
                                <span>Class Announcements</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openClassWorkspace(cls.id, 'settings')}
                                className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                                <span>Edit Class & Dates</span>
                              </button>
                              {onOpenCoursePlayer && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuClassId(null);
                                    onOpenCoursePlayer(cls.courseId);
                                  }}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Open Course Curriculum</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleExportRosterCsvForClass(cls)}
                                className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Download className="w-3.5 h-3.5 text-slate-500" />
                                <span>Export Roster CSV</span>
                              </button>
                              <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
                              {confirmDeleteClassId === cls.id ? (
                                <div className="px-3.5 py-2 flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      deleteClass(cls.id);
                                      setConfirmDeleteClassId(null);
                                      setOpenMenuClassId(null);
                                    }}
                                    className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold"
                                  >
                                    Confirm Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteClassId(null)}
                                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteClassId(cls.id)}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete Class</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Class Workspace Slide-Over / Modal (Students, Attendance, Announcements, Invite Learners, Settings) */}
      {activeModalClass && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-emerald-700 dark:text-emerald-400">
                    <span>{activeModalClass.sectionCode}</span>
                    <span className="text-slate-400">·</span>
                    <span>{activeModalClass.courseCode}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 dark:text-slate-400 font-sans">
                      {activeModalClass.deliveryType || 'Instructor-led'} · {activeModalClass.language || 'English'}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {activeModalClass.name}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {activeModalClass.courseTitle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModalClassId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeModalClass.scheduleLabel}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {formatEnrollmentDate(activeModalClass.startDate)} –{' '}
                    {formatEnrollmentDate(activeModalClass.endDate)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {enrolledRoster.length} / {activeModalClass.maxSeats} seats filled
                  </span>
                </span>
              </div>

              {/* Join Code, Live URL, Enrollment Status */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      `join-${activeModalClass.id}`,
                      activeModalClass.joinCode || `CLS-${activeModalClass.sectionCode}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
                >
                  {copiedKey === `join-${activeModalClass.id}` ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>Copied Join Code</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>
                        Join Code:{' '}
                        {activeModalClass.joinCode || `CLS-${activeModalClass.sectionCode}`}
                      </span>
                    </>
                  )}
                </button>

                {activeModalClass.meetingUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(`meet-${activeModalClass.id}`, activeModalClass.meetingUrl!)
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 whitespace-nowrap shrink-0"
                  >
                    {copiedKey === `meet-${activeModalClass.id}` ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>Live Room URL Copied</span>
                      </>
                    ) : (
                      <>
                        <Video className="w-3 h-3" />
                        <span>Copy Live Session URL</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    updateClass(activeModalClass.id, {
                      enrollmentOpen: activeModalClass.enrollmentOpen === false
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    activeModalClass.enrollmentOpen === false
                      ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                      : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {activeModalClass.enrollmentOpen === false ? (
                    <>
                      <Lock className="w-3 h-3" />
                      <span>Enrollment Closed</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3 h-3" />
                      <span>Enrollment Open</span>
                    </>
                  )}
                </button>
              </div>

              {/* Workspace Tabs */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceTab('students');
                    setActionFeedback(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    workspaceTab === 'students'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="tabular-nums">Learners ({enrolledRoster.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceTab('invites');
                    setActionFeedback(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    workspaceTab === 'invites'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="tabular-nums">Invite Learners ({classInvitations.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceTab('attendance');
                    setActionFeedback(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    workspaceTab === 'attendance'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span className="tabular-nums">
                    Attendance ({attendanceSessionDates.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceTab('announcements');
                    setActionFeedback(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    workspaceTab === 'announcements'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span className="tabular-nums">
                    Announcements ({sortedAnnouncements.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceTab('settings');
                    setActionFeedback(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    workspaceTab === 'settings'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Settings</span>
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto">
              {actionFeedback && (
                <div
                  className={`mx-5 mt-4 p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
                    actionFeedback.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {actionFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{actionFeedback.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionFeedback(null)}
                    className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Tab 1: Enrolled Learners */}
              {workspaceTab === 'students' && (
                <div className="p-5 space-y-5">
                  <form
                    onSubmit={handleEnrollStudentSubmit}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Enroll Learner into {activeModalClass.sectionCode}
                      </div>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setEnrollMode('existing')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                            enrollMode === 'existing'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          Existing Learner
                        </button>
                        <button
                          type="button"
                          onClick={() => setEnrollMode('new')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                            enrollMode === 'new'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          New Email
                        </button>
                      </div>
                    </div>

                    {enrollMode === 'existing' ? (
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <select
                          value={selectedStudentUserId}
                          onChange={e => setSelectedStudentUserId(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">
                            {availableStudentsToEnroll.length === 0
                              ? 'All existing learners are already enrolled in this class'
                              : 'Select a learner account...'}
                          </option>
                          {availableStudentsToEnroll.map(student => (
                            <option key={student.id} value={student.id}>
                              {student.name} ({student.email})
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          disabled={!selectedStudentUserId}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Enroll Learner</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <input
                          type="text"
                          value={newStudentName}
                          onChange={e => setNewStudentName(e.target.value)}
                          placeholder="Full Name (e.g., Jordan Lee)"
                          className="sm:col-span-4 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                        />
                        <input
                          type="email"
                          required
                          value={newStudentEmail}
                          onChange={e => setNewStudentEmail(e.target.value)}
                          placeholder="learner@domain.com"
                          className="sm:col-span-5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="submit"
                          className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add & Enroll</span>
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Enrolled learners receive course access from{' '}
                      <strong>{formatEnrollmentDate(activeModalClass.startDate)}</strong> until{' '}
                      <strong>{formatEnrollmentDate(activeModalClass.endDate)}</strong>.
                    </p>
                  </form>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Class Roster ({enrolledRoster.length})
                      </h3>
                      <button
                        type="button"
                        disabled={enrolledRoster.length === 0}
                        onClick={() => handleExportRosterCsvForClass(activeModalClass)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Roster CSV</span>
                      </button>
                    </div>

                    {enrolledRoster.length === 0 ? (
                      <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                        No learners enrolled in this class yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        {enrolledRoster.map(student => {
                          const totalModules = activeCourseObj?.modules.length || 1;
                          const doneModules = activeCourseObj
                            ? activeCourseObj.modules.filter(m =>
                                student.completedModuleIds.includes(m.id)
                              ).length
                            : 0;
                          const pct = Math.round((doneModules / totalModules) * 100);
                          const attendanceRate = getStudentAttendanceRate(
                            activeModalClass,
                            student.id
                          );
                          const windowDates =
                            student.courseEnrollments?.[activeModalClass.courseId];

                          return (
                            <div
                              key={student.id}
                              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={student.avatar}
                                  alt={student.name}
                                  className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {student.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {student.email}
                                  </div>
                                  {windowDates && (
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                      Access: {formatEnrollmentDate(windowDates.startDate)} –{' '}
                                      {formatEnrollmentDate(windowDates.expiresAt)}
                                      {attendanceRate !== null && (
                                        <span> · Attendance: {attendanceRate}%</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-4 shrink-0">
                                <div className="w-28">
                                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 tabular-nums mb-1">
                                    <span>Progress</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                      {pct}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeStudentFromClass(activeModalClass.id, student.id)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 whitespace-nowrap shrink-0"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Invite Learners */}
              {workspaceTab === 'invites' && (
                <div className="p-5 space-y-5">
                  <form
                    onSubmit={handleInviteStudentsSubmit}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Invite Learners to {activeModalClass.sectionCode}
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Pre-assigns {activeModalClass.courseCode}
                      </span>
                    </div>

                    <textarea
                      rows={3}
                      value={inviteBatchInput}
                      onChange={e => setInviteBatchInput(e.target.value)}
                      placeholder={
                        'Enter one learner per line:\nMaya Patel, maya.patel@company.com\nalex.chen@enterprise.io'
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <select
                        value={inviteTier}
                        onChange={e => setInviteTier(e.target.value as SubscriptionTier)}
                        className="sm:col-span-4 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="free">Tier: Free</option>
                        <option value="pro">Tier: Pro (Recommended)</option>
                        <option value="expert">Tier: Expert</option>
                      </select>
                      <input
                        type="text"
                        value={inviteNote}
                        onChange={e => setInviteNote(e.target.value)}
                        placeholder="Optional welcome note or Zoom/lab link..."
                        className="sm:col-span-5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Send Invites</span>
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Issued Class Invitations ({classInvitations.length})
                    </h3>

                    {classInvitations.length === 0 ? (
                      <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                        No invitations sent for this class section yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        {classInvitations.map(inv => {
                          const isAccepted = inv.status === 'accepted';
                          const isRevoked = inv.status === 'revoked';
                          return (
                            <div
                              key={inv.id}
                              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {inv.fullName}
                                  </span>
                                  <span className="text-slate-400 text-xs">·</span>
                                  <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                    {inv.code}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {inv.email}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                                    isAccepted
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : isRevoked
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {isAccepted ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  ) : isRevoked ? (
                                    <Ban className="w-3.5 h-3.5" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5" />
                                  )}
                                  <span className="capitalize">{inv.status}</span>
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyText(
                                      inv.code,
                                      `${window.location.origin}/?invite=${inv.code}`
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                                >
                                  {copiedKey === inv.code ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span>Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy Link</span>
                                    </>
                                  )}
                                </button>

                                {!isAccepted && !isRevoked && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => resendInvitation(inv.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      <span>Resend</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => revokeInvitation(inv.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap shrink-0"
                                    >
                                      <Ban className="w-3 h-3" />
                                      <span>Revoke</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Session Attendance Tracker */}
              {workspaceTab === 'attendance' && (
                <div className="p-5 space-y-5">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Session Date
                      </label>
                      <input
                        type="date"
                        value={attendanceDate}
                        onChange={e => setAttendanceDate(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={enrolledRoster.length === 0}
                      onClick={() =>
                        markAllClassAttendance(activeModalClass.id, attendanceDate, 'present')
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark All Present</span>
                    </button>
                  </div>

                  {attendanceSessionDates.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Logged Sessions:
                      </span>
                      {attendanceSessionDates.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setAttendanceDate(d)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
                            attendanceDate === d
                              ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {formatEnrollmentDate(d)}
                        </button>
                      ))}
                    </div>
                  )}

                  {enrolledRoster.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                      Enroll learners first to record session attendance.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      {enrolledRoster.map(student => {
                        const status: AttendanceStatus | undefined =
                          activeModalClass.attendanceRecords?.[attendanceDate]?.[student.id];
                        const overallRate = getStudentAttendanceRate(
                          activeModalClass,
                          student.id
                        );

                        return (
                          <div
                            key={student.id}
                            className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={student.avatar}
                                alt={student.name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {student.name}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                  {overallRate !== null
                                    ? `Overall Attendance: ${overallRate}%`
                                    : 'No recorded sessions yet'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  markClassAttendance(
                                    activeModalClass.id,
                                    attendanceDate,
                                    student.id,
                                    'present'
                                  )
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                                  status === 'present'
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Present</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  markClassAttendance(
                                    activeModalClass.id,
                                    attendanceDate,
                                    student.id,
                                    'late'
                                  )
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                                  status === 'late'
                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span>Late</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  markClassAttendance(
                                    activeModalClass.id,
                                    attendanceDate,
                                    student.id,
                                    'absent'
                                  )
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                                  status === 'absent'
                                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Absent</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Announcements */}
              {workspaceTab === 'announcements' && (
                <div className="p-5 space-y-5">
                  <form
                    onSubmit={handlePostAnnouncement}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Post Announcement to {activeModalClass.sectionCode}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <input
                        type="text"
                        required
                        value={announcementTitle}
                        onChange={e => setAnnouncementTitle(e.target.value)}
                        placeholder="Announcement headline..."
                        className="sm:col-span-8 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                      <select
                        value={announcementCategory}
                        onChange={e =>
                          setAnnouncementCategory(
                            e.target.value as ClassAnnouncement['category']
                          )
                        }
                        className="sm:col-span-4 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="general">Category: General</option>
                        <option value="lab">Category: Lab Prep</option>
                        <option value="live_session">Category: Live Session</option>
                        <option value="deadline">Category: Deadline</option>
                      </select>
                    </div>

                    <textarea
                      rows={3}
                      required
                      value={announcementMessage}
                      onChange={e => setAnnouncementMessage(e.target.value)}
                      placeholder="Write session reminders, lab prep instructions, or syllabus updates for this class..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={announcementPinned}
                          onChange={e => setAnnouncementPinned(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Pin announcement to top</span>
                      </label>

                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                      >
                        <Megaphone className="w-3.5 h-3.5" />
                        <span>Post Announcement</span>
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Class Feed ({sortedAnnouncements.length})
                    </h3>

                    {sortedAnnouncements.length === 0 ? (
                      <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                        No announcements posted for this class yet.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {sortedAnnouncements.map(ann => (
                          <div
                            key={ann.id}
                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                                    {getAnnouncementCategoryLabel(ann.category)}
                                  </span>
                                  <span>·</span>
                                  <span>{ann.authorName}</span>
                                  <span>·</span>
                                  <span className="tabular-nums">{ann.createdAt}</span>
                                  {ann.pinned && (
                                    <>
                                      <span>·</span>
                                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                                        <Pin className="w-3 h-3" />
                                        <span>Pinned</span>
                                      </span>
                                    </>
                                  )}
                                </div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                  {ann.title}
                                </h4>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  title={ann.pinned ? 'Unpin' : 'Pin'}
                                  onClick={() =>
                                    togglePinClassAnnouncement(activeModalClass.id, ann.id)
                                  }
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                  {ann.pinned ? (
                                    <PinOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Pin className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  title="Delete announcement"
                                  onClick={() =>
                                    deleteClassAnnouncement(activeModalClass.id, ann.id)
                                  }
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              {ann.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 5: Settings & Dates */}
              {workspaceTab === 'settings' && (
                <form onSubmit={handleSaveClassSettings} className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Class Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editClassName}
                        onChange={e => setEditClassName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Section Code
                      </label>
                      <input
                        type="text"
                        required
                        value={editSectionCode}
                        onChange={e => setEditSectionCode(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Delivery Type
                      </label>
                      <select
                        value={editDeliveryType}
                        onChange={e =>
                          setEditDeliveryType(
                            e.target.value as 'Instructor-led' | 'Self-paced'
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Instructor-led">Instructor-led</option>
                        <option value="Self-paced">Self-paced</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Language
                      </label>
                      <input
                        type="text"
                        value={editLanguage}
                        onChange={e => setEditLanguage(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Schedule
                      </label>
                      <input
                        type="text"
                        value={editScheduleLabel}
                        onChange={e => setEditScheduleLabel(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Max Seat Capacity
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={editMaxSeats}
                        onChange={e => setEditMaxSeats(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={e => setEditStartDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        End / Expiration Date
                      </label>
                      <input
                        type="date"
                        min={editStartDate}
                        value={editEndDate}
                        onChange={e => setEditEndDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Live Session / Meeting URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={editMeetingUrl}
                      onChange={e => setEditMeetingUrl(e.target.value)}
                      placeholder="https://meet.netplus.academy/..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Class Notes
                    </label>
                    <textarea
                      rows={2}
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editEnrollmentOpen}
                        onChange={e => setEditEnrollmentOpen(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Allow new learner enrollments in this class</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncDatesToStudents}
                        onChange={e => setSyncDatesToStudents(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        Sync updated Start & Expiration Dates to all learners enrolled in this class
                      </span>
                    </label>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save Class Changes</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Class Modal (Strictly scoped to ownedCourses!) */}
      {showCreateClassModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Create New Class
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isInstructor
                    ? 'You can only launch classes under courses you have created.'
                    : 'Select a course to create a new class cohort.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateClassModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClassSubmit} className="p-5 space-y-3.5">
              {classFormError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{classFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Course ({isAdmin ? 'All Courses' : 'Your Created Courses Only'})
                </label>
                <select
                  required
                  value={classFormCourseId}
                  onChange={e => setClassFormCourseId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  {ownedCourses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Class Name
                  </label>
                  <input
                    type="text"
                    required
                    value={classFormName}
                    onChange={e => setClassFormName(e.target.value)}
                    placeholder="e.g., Getting Started with Packet Tracer"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Section Code
                  </label>
                  <input
                    type="text"
                    value={classFormSection}
                    onChange={e => setClassFormSection(e.target.value)}
                    placeholder="Auto if blank"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Delivery Type
                  </label>
                  <select
                    value={classFormDeliveryType}
                    onChange={e =>
                      setClassFormDeliveryType(
                        e.target.value as 'Instructor-led' | 'Self-paced'
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Instructor-led">Instructor-led</option>
                    <option value="Self-paced">Self-paced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Language
                  </label>
                  <input
                    type="text"
                    value={classFormLanguage}
                    onChange={e => setClassFormLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Seat Capacity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={classFormMaxSeats}
                    onChange={e => setClassFormMaxSeats(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={classFormStartDate}
                    onChange={e => setClassFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End / Expiration Date
                  </label>
                  <input
                    type="date"
                    required
                    min={classFormStartDate}
                    value={classFormEndDate}
                    onChange={e => setClassFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Schedule
                </label>
                <input
                  type="text"
                  value={classFormSchedule}
                  onChange={e => setClassFormSchedule(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Live Session / Meeting URL (Optional)
                </label>
                <input
                  type="url"
                  value={classFormMeetingUrl}
                  onChange={e => setClassFormMeetingUrl(e.target.value)}
                  placeholder="https://meet.netplus.academy/..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateClassModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Create Course Modal */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Create New Course
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Courses created here are attributed to you so you can launch classes under them.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateCourseModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickCourse} className="p-5 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Course Code
                  </label>
                  <input
                    type="text"
                    required
                    value={newCourseCode}
                    onChange={e => setNewCourseCode(e.target.value)}
                    placeholder="e.g., BGP-401"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Course Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newCourseTitle}
                    onChange={e => setNewCourseTitle(e.target.value)}
                    placeholder="e.g., Enterprise BGP & MPLS Architecture"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={newCourseSubtitle}
                  onChange={e => setNewCourseSubtitle(e.target.value)}
                  placeholder="Hands-on routing policies, multi-homing & route reflection"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newCourseCategory}
                    onChange={e => setNewCourseCategory(e.target.value as Course['category'])}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Enterprise Routing & Switching">Enterprise Routing & Switching</option>
                    <option value="Network Security & Firewalls">Network Security & Firewalls</option>
                    <option value="Cloud & SD-WAN">Cloud & SD-WAN</option>
                    <option value="Packet Analysis & Forensics">Packet Analysis & Forensics</option>
                    <option value="Automation & NetDevOps">Automation & NetDevOps</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Level
                  </label>
                  <select
                    value={newCourseLevel}
                    onChange={e => setNewCourseLevel(e.target.value as Course['level'])}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Hours)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newCourseDuration}
                    onChange={e => setNewCourseDuration(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Price (USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newCoursePrice}
                    onChange={e => setNewCoursePrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newCourseDescription}
                  onChange={e => setNewCourseDescription(e.target.value)}
                  placeholder="Brief summary of modules, lab topology, and target learners..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  Publish Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
