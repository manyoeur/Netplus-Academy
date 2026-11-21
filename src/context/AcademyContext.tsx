import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  User, 
  Course, 
  UserRole, 
  Certificate, 
  ForumPost, 
  StudentProgressRecord, 
  RealtimeActivityItem, 
  LMSConfig, 
  NotificationItem, 
  SubscriptionTier,
  CourseModule,
  Invitation,
  CourseEnrollment,
  CourseClass,
  ClassAnnouncement,
  AttendanceStatus,
  CoursePaymentMethod,
  CoursePaymentRecord,
  CourseBookmark
} from '../types';
import { createDefaultCourseEnrollment } from '../utils/enrollmentDates';
import { mergeModuleHierarchyIntoChapters } from '../utils/courseHierarchy';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  preloadGoogleAuthSdk,
  syncFirebaseUserProfile,
  testFirestoreConnection,
  saveInvitationToFirestore,
  updateInvitationStatusInFirestore,
  deleteInvitationFromFirestore,
  fetchInvitationsFromFirestore,
  fetchUsersFromFirestore,
  updateUserInFirestore,
  deleteUserFromFirestore,
  saveCoursePaymentToFirestore,
  fetchCoursePaymentsFromFirestore,
  fetchLearningStreakFromFirestore,
  saveLearningStreakToFirestore,
  fetchStudyGoalFromFirestore,
  saveStudyGoalToFirestore,
  fetchPersonalFlashcardsFromFirestore,
  savePersonalFlashcardToFirestore,
  deletePersonalFlashcardFromFirestore,
  fetchQuickNotesFromFirestore,
  saveQuickNoteToFirestore,
  deleteQuickNoteFromFirestore,
  fetchCourseBookmarksFromFirestore,
  saveCourseBookmarkToFirestore,
  deleteCourseBookmarkFromFirestore
} from '../firebase';
import {
  CardMasteryStatus,
  PersonalFlashcard,
  PersonalFlashcardInput
} from '../components/Flashcards/flashcardTypes';
import {
  GENERAL_COURSE_ID,
  loadLocalPersonalFlashcards,
  mergePersonalFlashcards,
  normalizePersonalFlashcard,
  saveLocalPersonalFlashcards,
  sanitizeCourseRefId,
  sanitizeFlashcardId
} from '../utils/personalFlashcards';
import {
  ComputedLearningStreak,
  LearningStreakData,
  computeLearningStreak,
  loadLocalLearningStreak,
  mergeStreakData,
  recordActivityInStreakData,
  saveLocalLearningStreak
} from '../utils/learningStreak';
import {
  ComputedDailyStudyGoal,
  DailyStudyGoalData,
  StudySource,
  addStudySecondsToData,
  computeDailyStudyGoal,
  loadLocalStudyGoal,
  mergeStudyGoalData,
  saveLocalStudyGoal,
  updateDailyGoalMinutesInData
} from '../utils/studyGoal';
import {
  QuickNote,
  QuickNoteInput,
  loadLocalQuickNotes,
  mergeQuickNotes,
  normalizeQuickNote,
  saveLocalQuickNotes,
  sanitizeNoteId
} from '../utils/quickNotes';
import {
  buildBookmarkDocId,
  loadLocalCourseBookmarks,
  mergeCourseBookmarks,
  normalizeCourseBookmark,
  saveLocalCourseBookmarks
} from '../utils/courseBookmarks';
import { 
  INITIAL_USERS, 
  INITIAL_COURSES, 
  INITIAL_FORUM_POSTS, 
  INITIAL_STUDENT_PROGRESS, 
  INITIAL_REALTIME_ACTIVITY, 
  INITIAL_LMS_CONFIGS, 
  INITIAL_NOTIFICATIONS,
  INITIAL_CLASSES
} from '../data/mockData';

interface AcademyContextType {
  currentUser: User;
  allUsers: User[];
  courses: Course[];
  forumPosts: ForumPost[];
  studentProgressList: StudentProgressRecord[];
  activityFeed: RealtimeActivityItem[];
  lmsConfigs: LMSConfig[];
  notifications: NotificationItem[];
  unreadNotifsCount: number;
  darkMode: boolean;
  isOffline: boolean;
  manualOfflineSim: boolean;
  
  // Auth & Roles
  isAuthenticated: boolean;
  authReady: boolean;
  setCurrentUser: (user: User) => void;
  loginUser: (email: string, role?: UserRole, password?: string) => boolean;
  registerUser: (
    name: string,
    email: string,
    password?: string,
    inviteCode?: string
  ) => { success: boolean; error?: string; role?: UserRole };
  signInWithGoogle: (inviteCode?: string) => Promise<{ success: boolean; error?: string }>;
  logoutUser: () => Promise<void>;

  // Invitations (Admin-managed Instructor & Student Registration)
  invitations: Invitation[];
  findInvitationByCode: (code: string) => Invitation | undefined;
  createInstructorInvite: (params: {
    fullName: string;
    email: string;
    specialty: string;
    assignedCourseIds: string[];
    welcomeNote?: string;
  }) => Invitation;
  createStudentInvites: (params: {
    entries: Array<{ fullName: string; email: string }>;
    cohort: string;
    assignedCourseIds: string[];
    subscriptionTier: SubscriptionTier;
    welcomeNote?: string;
  }) => Invitation[];
  resendInvitation: (inviteId: string) => void;
  revokeInvitation: (inviteId: string) => void;
  deleteInvitation: (inviteId: string) => void;

  // Admin Account Management
  refreshUsersDirectory: () => Promise<number>;
  updateUserAccount: (
    userId: string,
    updates: {
      name?: string;
      role?: UserRole;
      subscriptionTier?: SubscriptionTier;
      subscriptionStatus?: User['subscription']['status'];
      enrolledCourseIds?: string[];
      courseEnrollments?: Record<string, CourseEnrollment>;
    }
  ) => Promise<void>;
  deleteUserAccount: (userId: string) => Promise<void>;
  
  // Dark mode & Offline
  toggleDarkMode: () => void;
  toggleManualOfflineSim: () => void;
  
  // Courses & Learning
  enrollInCourse: (courseId: string, customDates?: Partial<Omit<CourseEnrollment, 'courseId'>>) => void;
  completeModule: (courseId: string, moduleId: string) => void;
  updateStudentQuizAverage: (courseId: string, averageScore: number) => void;
  learningStreak: ComputedLearningStreak;
  recordLearningActivity: (activityLabel?: string) => void;
  dailyStudyGoal: ComputedDailyStudyGoal;
  setDailyStudyGoalMinutes: (minutes: number) => void;
  recordStudyTime: (seconds: number, source: StudySource, moduleId?: string) => void;
  personalFlashcards: PersonalFlashcard[];
  savePersonalFlashcard: (input: PersonalFlashcardInput) => PersonalFlashcard;
  deletePersonalFlashcard: (cardId: string) => void;
  updatePersonalFlashcardMastery: (cardId: string, status: CardMasteryStatus) => void;
  quickNotes: QuickNote[];
  saveQuickNote: (input: QuickNoteInput) => QuickNote;
  deleteQuickNote: (noteId: string) => void;
  courseBookmarks: CourseBookmark[];
  bookmarkedCourseIds: string[];
  isCourseBookmarked: (courseId: string) => boolean;
  toggleCourseBookmark: (courseId: string) => boolean;
  addCourse: (course: Course) => void;
  updateCourse: (courseId: string, updated: Partial<Course>) => void;
  deleteCourse: (courseId: string) => void;
  addModuleToCourse: (courseId: string, module: CourseModule, insertAtIndex?: number) => void;
  updateModuleInCourse: (courseId: string, moduleId: string, updated: Partial<CourseModule>) => void;
  deleteModuleFromCourse: (courseId: string, moduleId: string) => void;
  reorderModuleInCourse: (courseId: string, moduleId: string, direction: 'up' | 'down') => void;
  setCourseModulesOrder: (courseId: string, modules: CourseModule[]) => void;

  // Classes & Instructor My Class Management
  classes: CourseClass[];
  getOwnedCoursesForUser: (user?: User) => Course[];
  createClass: (params: {
    name: string;
    sectionCode?: string;
    courseId: string;
    scheduleLabel: string;
    startDate: string;
    endDate: string;
    maxSeats: number;
    deliveryType?: 'Instructor-led' | 'Self-paced';
    language?: string;
    meetingUrl?: string;
    notes?: string;
  }) => { success: boolean; courseClass?: CourseClass; error?: string };
  updateClass: (
    classId: string,
    updates: Partial<Omit<CourseClass, 'id' | 'courseId' | 'courseCode' | 'courseTitle'>>
  ) => void;
  deleteClass: (classId: string) => void;
  enrollStudentInClass: (
    classId: string,
    student: { existingUserId?: string; name?: string; email?: string }
  ) => { success: boolean; error?: string };
  removeStudentFromClass: (classId: string, studentId: string) => void;
  inviteStudentsToClass: (
    classId: string,
    entries: Array<{ fullName: string; email: string }>,
    subscriptionTier: SubscriptionTier,
    welcomeNote?: string
  ) => Invitation[];
  addClassAnnouncement: (
    classId: string,
    params: {
      title: string;
      message: string;
      category: ClassAnnouncement['category'];
      pinned?: boolean;
    }
  ) => void;
  togglePinClassAnnouncement: (classId: string, announcementId: string) => void;
  deleteClassAnnouncement: (classId: string, announcementId: string) => void;
  markClassAttendance: (
    classId: string,
    sessionDate: string,
    studentId: string,
    status: AttendanceStatus
  ) => void;
  markAllClassAttendance: (
    classId: string,
    sessionDate: string,
    status: AttendanceStatus
  ) => void;
  
  // Certificates
  generateCertificate: (courseId: string) => Certificate;
  verifyCertificate: (hashOrNumber: string) => Certificate | undefined;
  
  // Subscriptions & Per-Course Payments
  coursePayments: CoursePaymentRecord[];
  getCoursePaymentForStudent: (courseId: string, studentId?: string) => CoursePaymentRecord | undefined;
  completeCoursePaymentAndEnroll: (params: {
    courseId: string;
    paymentMethod: CoursePaymentMethod;
    cardLast4?: string;
    promoCode?: string;
    billingName?: string;
    billingEmail?: string;
  }) => Promise<{ success: boolean; payment?: CoursePaymentRecord; error?: string }>;
  upgradeSubscription: (tier: SubscriptionTier, billingCycle: 'monthly' | 'annual', cardLast4?: string) => Promise<any>;
  
  // Forum
  addForumPost: (title: string, content: string, category: string, tags: string[]) => void;
  addForumReply: (postId: string, content: string, codeSnippet?: string) => void;
  upvotePost: (postId: string) => void;
  markAcceptedAnswer: (postId: string, replyId: string) => void;
  
  // Notifications
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  triggerSystemNotification: (title: string, message: string, type: NotificationItem['type'], emailPreview?: NotificationItem['emailPreview']) => void;
  
  // LMS
  updateLMSConfig: (provider: LMSConfig['provider'], updates: Partial<LMSConfig>) => void;
  generateApiKeyForLMS: (provider: LMSConfig['provider']) => string;
  triggerLMSSync: (provider: LMSConfig['provider']) => void;
}

const AcademyContext = createContext<AcademyContextType | undefined>(undefined);

export const AcademyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Persistence Keys
  const STORAGE_PREFIX = 'netpulse_academy_';
  
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}dark_mode`);
    return saved !== null ? JSON.parse(saved) : true; // Default dark mode for network engineers
  });

  // Offline detection
  const [isSystemOnline, setIsSystemOnline] = useState<boolean>(navigator.onLine);
  const [manualOfflineSim, setManualOfflineSim] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => setIsSystemOnline(true);
    const handleOffline = () => setIsSystemOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isOffline = !isSystemOnline || manualOfflineSim;

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(`${STORAGE_PREFIX}dark_mode`, JSON.stringify(darkMode));
  }, [darkMode]);

  // Auth State (startup requires login/signup unless authenticated)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(`${STORAGE_PREFIX}authenticated`) === 'true';
  });
  const [authReady, setAuthReady] = useState<boolean>(false);

  const [credentialsMap, setCredentialsMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}credentials`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}credentials`, JSON.stringify(credentialsMap));
  }, [credentialsMap]);

  // Core Data State
  const buildNormalizedCourseEnrollments = (
    user: User,
    courseIds: string[],
    availableCourses: Course[] = INITIAL_COURSES
  ): Record<string, CourseEnrollment> => {
    const seedUser = INITIAL_USERS.find(su => su.id === user.id || su.email.toLowerCase() === user.email.toLowerCase());
    const result: Record<string, CourseEnrollment> = {};
    for (const courseId of courseIds) {
      const existing = user.courseEnrollments?.[courseId];
      if (existing && existing.startDate && existing.expiresAt) {
        result[courseId] = {
          courseId,
          startDate: existing.startDate,
          endDate: existing.endDate || existing.expiresAt,
          expiresAt: existing.expiresAt
        };
      } else if (seedUser?.courseEnrollments?.[courseId]) {
        result[courseId] = { ...seedUser.courseEnrollments[courseId] };
      } else {
        const course = availableCourses.find(c => c.id === courseId);
        result[courseId] = createDefaultCourseEnrollment(
          courseId,
          course?.defaultAccessDays,
          user.joinedDate
        );
      }
    }
    return result;
  };

  const [allUsers, setAllUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}users`);
    const parsed: User[] = saved ? JSON.parse(saved) : INITIAL_USERS;
    return parsed.map(u => ({
      ...u,
      courseEnrollments: buildNormalizedCourseEnrollments(u, u.enrolledCourseIds || [])
    }));
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}current_user_id`);
    return saved || 'user-student-1';
  });

  const currentUser = allUsers.find(u => u.id === currentUserId) || allUsers[0];

  const [streakData, setStreakData] = useState<LearningStreakData>(() =>
    loadLocalLearningStreak(currentUser.id)
  );

  useEffect(() => {
    setStreakData(loadLocalLearningStreak(currentUser.id));
  }, [currentUser.id]);

  const learningStreak = computeLearningStreak(streakData);

  const [studyGoalData, setStudyGoalData] = useState<DailyStudyGoalData>(() =>
    loadLocalStudyGoal(currentUser.id)
  );
  const lastStudyGoalCloudSyncRef = useRef<number>(0);

  useEffect(() => {
    setStudyGoalData(loadLocalStudyGoal(currentUser.id));
  }, [currentUser.id]);

  const dailyStudyGoal = computeDailyStudyGoal(studyGoalData);

  useEffect(() => {
    if (dailyStudyGoal.totalSecondsToday > 0 && !learningStreak.studiedToday) {
      recordLearningActivity('Study Session');
    }
  }, [currentUser.id, dailyStudyGoal.totalSecondsToday, learningStreak.studiedToday]);

  const [personalFlashcards, setPersonalFlashcards] = useState<PersonalFlashcard[]>(() =>
    loadLocalPersonalFlashcards(currentUser.id)
  );
  const personalFlashcardsRef = useRef<PersonalFlashcard[]>(personalFlashcards);
  personalFlashcardsRef.current = personalFlashcards;

  useEffect(() => {
    setPersonalFlashcards(loadLocalPersonalFlashcards(currentUser.id));
  }, [currentUser.id]);

  const [quickNotes, setQuickNotes] = useState<QuickNote[]>(() =>
    loadLocalQuickNotes(currentUser.id)
  );
  const quickNotesRef = useRef<QuickNote[]>(quickNotes);
  quickNotesRef.current = quickNotes;

  useEffect(() => {
    setQuickNotes(loadLocalQuickNotes(currentUser.id));
  }, [currentUser.id]);

  const [courseBookmarks, setCourseBookmarks] = useState<CourseBookmark[]>(() =>
    loadLocalCourseBookmarks(currentUser.id)
  );
  const courseBookmarksRef = useRef<CourseBookmark[]>(courseBookmarks);
  courseBookmarksRef.current = courseBookmarks;

  useEffect(() => {
    setCourseBookmarks(loadLocalCourseBookmarks(currentUser.id));
  }, [currentUser.id]);

  const [invitations, setInvitations] = useState<Invitation[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}invitations`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const invitationsRef = useRef<Invitation[]>(invitations);
  useEffect(() => {
    invitationsRef.current = invitations;
    localStorage.setItem(`${STORAGE_PREFIX}invitations`, JSON.stringify(invitations));
  }, [invitations]);

  const pendingGoogleInviteCodeRef = useRef<string | undefined>(undefined);

  const findInvitationByCode = (code: string): Invitation | undefined => {
    const clean = code.trim().toLowerCase();
    if (!clean) return undefined;
    return invitationsRef.current.find(
      inv => inv.code.toLowerCase() === clean || inv.id.toLowerCase() === clean
    );
  };

  const mergeFirestoreInvitations = (remoteInvites: Invitation[] | null) => {
    if (!remoteInvites || remoteInvites.length === 0) return;
    setInvitations(prev => {
      const mergedMap = new Map<string, Invitation>();
      for (const inv of prev) {
        mergedMap.set(inv.id, inv);
      }
      for (const remote of remoteInvites) {
        mergedMap.set(remote.id, remote);
      }
      return Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  };

  const upsertGoogleUser = async (
    fbUser: {
      uid: string;
      displayName: string | null;
      email: string | null;
      photoURL: string | null;
      emailVerified: boolean;
    },
    explicitInviteCode?: string
  ) => {
    if (!fbUser.email) return;
    const normalizedEmail = fbUser.email.toLowerCase();
    const isBootstrappedAdmin = normalizedEmail === 'yoeur.man2010@gmail.com';
    const fallbackAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80';

    let candidateInvites = [...invitationsRef.current];
    if (fbUser.emailVerified) {
      const remoteInvites = await fetchInvitationsFromFirestore(isBootstrappedAdmin, normalizedEmail);
      if (remoteInvites && remoteInvites.length > 0) {
        mergeFirestoreInvitations(remoteInvites);
        const map = new Map<string, Invitation>();
        candidateInvites.forEach(i => map.set(i.id, i));
        remoteInvites.forEach(i => map.set(i.id, i));
        candidateInvites = Array.from(map.values());
      }
    }

    const codeToCheck = (explicitInviteCode || pendingGoogleInviteCodeRef.current || '').trim().toLowerCase();
    const nowMs = Date.now();
    const matchedInvite = candidateInvites.find(inv => {
      if (inv.status !== 'pending') return false;
      if (inv.expiresAt && new Date(inv.expiresAt).getTime() < nowMs) return false;
      const emailMatches = inv.email.toLowerCase() === normalizedEmail;
      if (codeToCheck) {
        return (inv.code.toLowerCase() === codeToCheck || inv.id.toLowerCase() === codeToCheck) && emailMatches;
      }
      return emailMatches;
    });

    const defaultRole: UserRole = isBootstrappedAdmin
      ? 'admin'
      : matchedInvite
      ? matchedInvite.role
      : 'student';

    let resolvedId = fbUser.uid;
    let resolvedRole: UserRole = defaultRole;
    let resolvedName = fbUser.displayName || matchedInvite?.fullName || fbUser.email.split('@')[0];
    let resolvedAvatar = fbUser.photoURL || fallbackAvatar;

    const invitedCourseIds = matchedInvite?.assignedCourseIds?.length
      ? matchedInvite.assignedCourseIds
      : ['course-ccna-1'];
    const invitedTier: SubscriptionTier = matchedInvite?.subscriptionTier || 'pro';

    setAllUsers(prev => {
      const existing = prev.find(u => u.id === fbUser.uid || u.email.toLowerCase() === normalizedEmail);
      if (existing) {
        resolvedId = existing.id;
        resolvedRole = isBootstrappedAdmin
          ? 'admin'
          : matchedInvite
          ? matchedInvite.role
          : existing.role;
        resolvedName = fbUser.displayName || existing.name;
        resolvedAvatar = fbUser.photoURL || existing.avatar;
        const mergedCourses = Array.from(new Set([...existing.enrolledCourseIds, ...invitedCourseIds]));
        const nextEnrollments: Record<string, CourseEnrollment> = { ...(existing.courseEnrollments || {}) };
        for (const cid of mergedCourses) {
          if (!nextEnrollments[cid]) {
            const c = courses.find(item => item.id === cid);
            nextEnrollments[cid] = createDefaultCourseEnrollment(cid, c?.defaultAccessDays);
          }
        }
        return prev.map(u =>
          u.id === existing.id
            ? {
                ...u,
                name: resolvedName,
                avatar: resolvedAvatar,
                role: resolvedRole,
                enrolledCourseIds: mergedCourses,
                courseEnrollments: nextEnrollments,
                subscription: matchedInvite?.subscriptionTier
                  ? { ...u.subscription, tier: matchedInvite.subscriptionTier }
                  : u.subscription
              }
            : u
        );
      }
      const createdEnrollments: Record<string, CourseEnrollment> = {};
      for (const cid of invitedCourseIds) {
        const c = courses.find(item => item.id === cid);
        createdEnrollments[cid] = createDefaultCourseEnrollment(cid, c?.defaultAccessDays);
      }
      const created: User = {
        id: fbUser.uid,
        name: resolvedName,
        email: fbUser.email!,
        role: resolvedRole,
        avatar: resolvedAvatar,
        subscription: { tier: invitedTier, status: 'active' },
        enrolledCourseIds: invitedCourseIds,
        courseEnrollments: createdEnrollments,
        completedModuleIds: [],
        certificates: [],
        joinedDate: new Date().toISOString().split('T')[0],
        reputationPoints: 100
      };
      return [...prev, created];
    });

    setCurrentUserId(resolvedId);
    setIsAuthenticated(true);
    localStorage.setItem(`${STORAGE_PREFIX}authenticated`, 'true');

    if (fbUser.emailVerified) {
      const storedRole = await syncFirebaseUserProfile({
        uid: fbUser.uid,
        name: resolvedName,
        email: fbUser.email,
        role: resolvedRole,
        avatar: resolvedAvatar,
        inviteCode: matchedInvite?.role === 'instructor' ? matchedInvite.code : undefined
      });
      if (storedRole && storedRole !== resolvedRole && !matchedInvite && !isBootstrappedAdmin) {
        setAllUsers(prev => prev.map(u => (u.id === resolvedId ? { ...u, role: storedRole } : u)));
      }
    }

    if (matchedInvite) {
      const acceptedAt = new Date().toISOString();
      setInvitations(prev =>
        prev.map(inv =>
          inv.id === matchedInvite.id
            ? { ...inv, status: 'accepted', acceptedByUid: fbUser.uid, acceptedAt }
            : inv
        )
      );
      if (fbUser.emailVerified) {
        await updateInvitationStatusInFirestore(matchedInvite.id, {
          status: 'accepted',
          acceptedByUid: fbUser.uid,
          acceptedAt
        });
      }
      if (matchedInvite.role === 'student') {
        const enrolledCourses = courses.filter(c => matchedInvite.assignedCourseIds.includes(c.id));
        if (enrolledCourses.length > 0) {
          setStudentProgressList(prev => {
            const additions: StudentProgressRecord[] = enrolledCourses
              .filter(c => !prev.some(p => p.studentId === resolvedId && p.courseId === c.id))
              .map(c => {
                const dates = createDefaultCourseEnrollment(c.id, c.defaultAccessDays);
                return {
                  studentId: resolvedId,
                  studentName: resolvedName,
                  studentEmail: fbUser.email!,
                  avatar: resolvedAvatar,
                  courseId: c.id,
                  courseCode: c.code,
                  courseTitle: c.title,
                  progressPercent: 0,
                  completedModulesCount: 0,
                  totalModulesCount: c.modules.length,
                  quizAverage: 0,
                  lastActive: 'Just now',
                  status: 'active',
                  timeSpentHours: 0,
                  startDate: dates.startDate,
                  endDate: dates.endDate,
                  expiresAt: dates.expiresAt
                };
              });
            return additions.length ? [...additions, ...prev] : prev;
          });
        }
      }
    }

    if (fbUser.emailVerified) {
      fetchCoursePaymentsFromFirestore(resolvedRole === 'admin')
        .then(remotePayments => {
          if (remotePayments && remotePayments.length > 0) {
            setCoursePayments(prev => {
              const map = new Map<string, CoursePaymentRecord>();
              prev.forEach(p => map.set(p.id, p));
              remotePayments.forEach(rp => map.set(rp.id, rp));
              return Array.from(map.values()).sort(
                (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
              );
            });
          }
        })
        .catch(() => {});
    }

    if (resolvedRole === 'admin' && fbUser.emailVerified) {
      refreshUsersDirectory().catch(() => {});
    }

    if (fbUser.emailVerified) {
      fetchLearningStreakFromFirestore()
        .then(remoteStreak => {
          const localStreak = loadLocalLearningStreak(resolvedId);
          const merged = mergeStreakData(localStreak, remoteStreak);
          saveLocalLearningStreak(resolvedId, merged);
          if (resolvedId === currentUser.id || resolvedId === fbUser.uid) {
            setStreakData(merged);
          }
          if (
            remoteStreak === null
              ? merged.activeDates.length > 0
              : merged.activeDates.length > remoteStreak.activeDates.length
          ) {
            saveLearningStreakToFirestore(merged).catch(() => {});
          }
        })
        .catch(() => {});

      fetchStudyGoalFromFirestore()
        .then(remoteGoal => {
          const localGoal = loadLocalStudyGoal(resolvedId);
          const mergedGoal = mergeStudyGoalData(localGoal, remoteGoal);
          saveLocalStudyGoal(resolvedId, mergedGoal);
          if (resolvedId === currentUser.id || resolvedId === fbUser.uid) {
            setStudyGoalData(mergedGoal);
          }
          if (
            remoteGoal === null ||
            mergedGoal.courseSeconds > remoteGoal.courseSeconds ||
            mergedGoal.labSeconds > remoteGoal.labSeconds ||
            mergedGoal.practiceSeconds > remoteGoal.practiceSeconds
          ) {
            saveStudyGoalToFirestore(mergedGoal).catch(() => {});
          }
        })
        .catch(() => {});

      fetchPersonalFlashcardsFromFirestore()
        .then(remoteCards => {
          const localCards = loadLocalPersonalFlashcards(resolvedId);
          const mergedCards = mergePersonalFlashcards(localCards, remoteCards);
          saveLocalPersonalFlashcards(resolvedId, mergedCards);
          if (resolvedId === currentUser.id || resolvedId === fbUser.uid) {
            setPersonalFlashcards(mergedCards);
          }
          if (remoteCards !== null) {
            const remoteById = new Map(remoteCards.map(c => [c.id, c]));
            for (const card of localCards) {
              const remoteMatch = remoteById.get(card.id);
              const localMs = Date.parse(card.updatedAt) || 0;
              const remoteMs = remoteMatch ? Date.parse(remoteMatch.updatedAt) || 0 : -1;
              if (!remoteMatch || localMs > remoteMs) {
                savePersonalFlashcardToFirestore(card).catch(() => {});
              }
            }
          }
        })
        .catch(() => {});

      fetchQuickNotesFromFirestore()
        .then(remoteNotes => {
          const localNotes = loadLocalQuickNotes(resolvedId);
          const mergedNotes = mergeQuickNotes(localNotes, remoteNotes);
          saveLocalQuickNotes(resolvedId, mergedNotes);
          if (resolvedId === currentUser.id || resolvedId === fbUser.uid) {
            setQuickNotes(mergedNotes);
          }
          if (remoteNotes !== null) {
            const remoteById = new Map(remoteNotes.map(n => [n.id, n]));
            for (const note of localNotes) {
              const remoteMatch = remoteById.get(note.id);
              const localMs = Date.parse(note.updatedAt) || 0;
              const remoteMs = remoteMatch ? Date.parse(remoteMatch.updatedAt) || 0 : -1;
              if (!remoteMatch || localMs > remoteMs) {
                saveQuickNoteToFirestore(note).catch(() => {});
              }
            }
          }
        })
        .catch(() => {});

      fetchCourseBookmarksFromFirestore()
        .then(remoteBookmarks => {
          const localBookmarks = loadLocalCourseBookmarks(resolvedId);
          const mergedBookmarks = mergeCourseBookmarks(localBookmarks, remoteBookmarks, resolvedId);
          saveLocalCourseBookmarks(resolvedId, mergedBookmarks);
          if (resolvedId === currentUser.id || resolvedId === fbUser.uid) {
            setCourseBookmarks(mergedBookmarks);
          }
          if (remoteBookmarks !== null) {
            const remoteByCourse = new Map(remoteBookmarks.map(b => [b.courseId, b]));
            for (const bm of localBookmarks) {
              const remoteMatch = remoteByCourse.get(bm.courseId);
              const localMs = Date.parse(bm.updatedAt) || 0;
              const remoteMs = remoteMatch ? Date.parse(remoteMatch.updatedAt) || 0 : -1;
              if (!remoteMatch || localMs > remoteMs) {
                saveCourseBookmarkToFirestore(bm).catch(() => {});
              }
            }
          }
        })
        .catch(() => {});
    }

    pendingGoogleInviteCodeRef.current = undefined;
  };

  // Boot Firestore connection test, warm Google Auth script, & Firebase Auth state listener
  useEffect(() => {
    testFirestoreConnection();
    preloadGoogleAuthSdk();
    const unsubscribe = onAuthStateChanged(auth, async fbUser => {
      if (fbUser && fbUser.email) {
        await upsertGoogleUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName,
          email: fbUser.email,
          photoURL: fbUser.photoURL,
          emailVerified: fbUser.emailVerified
        });
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}courses`);
    if (!saved) return INITIAL_COURSES;
    try {
      const parsed: Course[] = JSON.parse(saved);
      const seededCcnpFlag = localStorage.getItem(`${STORAGE_PREFIX}multilevel_seed_v1`);
      const hydrated = parsed.map(c => {
        const seed = INITIAL_COURSES.find(ic => ic.id === c.id);
        if (!seed) return c;
        return {
          ...c,
          chapters: c.chapters && c.chapters.length > 0 ? c.chapters : seed.chapters,
          modules: (c.modules || []).map(mod => {
            const seedMod = seed.modules.find(sm => sm.id === mod.id);
            return {
              ...mod,
              chapterTitle: mod.chapterTitle || seedMod?.chapterTitle,
              mainContentTitle: mod.mainContentTitle || seedMod?.mainContentTitle
            };
          })
        };
      });

      if (!seededCcnpFlag) {
        const ccnpSeed = INITIAL_COURSES.find(ic => ic.id === 'course-ccnp-1');
        if (ccnpSeed && !hydrated.some(c => c.id === 'course-ccnp-1')) {
          hydrated.splice(1, 0, ccnpSeed);
        }
        try {
          localStorage.setItem(`${STORAGE_PREFIX}multilevel_seed_v1`, 'true');
        } catch {
          // ignore storage write errors
        }
      }

      return hydrated;
    } catch {
      return INITIAL_COURSES;
    }
  });

  const [forumPosts, setForumPosts] = useState<ForumPost[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}forum_posts`);
    return saved ? JSON.parse(saved) : INITIAL_FORUM_POSTS;
  });

  const [studentProgressList, setStudentProgressList] = useState<StudentProgressRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}student_progress`);
    return saved ? JSON.parse(saved) : INITIAL_STUDENT_PROGRESS;
  });

  const [activityFeed, setActivityFeed] = useState<RealtimeActivityItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}activity_feed`);
    return saved ? JSON.parse(saved) : INITIAL_REALTIME_ACTIVITY;
  });

  const [lmsConfigs, setLmsConfigs] = useState<LMSConfig[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}lms_configs`);
    return saved ? JSON.parse(saved) : INITIAL_LMS_CONFIGS;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}notifications`);
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  const [classes, setClasses] = useState<CourseClass[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}classes`);
    return saved ? JSON.parse(saved) : INITIAL_CLASSES;
  });

  const [coursePayments, setCoursePayments] = useState<CoursePaymentRecord[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}course_payments`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save changes to localStorage for offline cache
  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}users`, JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}current_user_id`, currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}courses`, JSON.stringify(courses));
  }, [courses]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}forum_posts`, JSON.stringify(forumPosts));
  }, [forumPosts]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}student_progress`, JSON.stringify(studentProgressList));
  }, [studentProgressList]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}notifications`, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}lms_configs`, JSON.stringify(lmsConfigs));
  }, [lmsConfigs]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}classes`, JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}course_payments`, JSON.stringify(coursePayments));
  }, [coursePayments]);

  // Periodic heartbeat simulation for real-time progress & activity updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time student activity occasionally
      const studentNames = ['Jordan Taylor', 'Maya Patel', 'Liam Chen', 'Samantha Wu', 'Devon Miller'];
      const actions: RealtimeActivityItem['action'][] = ['completed_module', 'passed_quiz', 'finished_lab'];
      const targets = [
        'VLAN Trunking & 802.1Q Verification',
        'Subnetting Challenge: /27 Network',
        'ACL Packet Filter Simulation',
        'BGP Autonomous System Routing'
      ];

      const randomStudent = studentNames[Math.floor(Math.random() * studentNames.length)];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      const randomTarget = targets[Math.floor(Math.random() * targets.length)];

      const newActivity: RealtimeActivityItem = {
        id: 'act-' + Date.now(),
        studentName: randomStudent,
        action: randomAction,
        target: randomTarget,
        timestamp: 'Just now',
        avatar: `https://images.unsplash.com/photo-${1530000000000 + (Math.floor(Math.random() * 50000))}?auto=format&fit=crop&w=256&q=80`
      };

      setActivityFeed(prev => [newActivity, ...prev.slice(0, 15)]);
    }, 45000); // every 45s

    return () => clearInterval(interval);
  }, []);

  // Auth Helpers
  const setCurrentUser = (user: User) => {
    setCurrentUserId(user.id);
    setIsAuthenticated(true);
    localStorage.setItem(`${STORAGE_PREFIX}authenticated`, 'true');
  };

  const generateInviteCode = (prefix: 'INST' | 'STUD'): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segment = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${prefix}-${segment(4)}-${segment(4)}`;
  };

  const createInstructorInvite = (params: {
    fullName: string;
    email: string;
    specialty: string;
    assignedCourseIds: string[];
    welcomeNote?: string;
  }): Invitation => {
    const code = generateInviteCode('INST');
    const now = new Date();
    const expires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const invite: Invitation = {
      id: code,
      code,
      email: params.email.trim().toLowerCase(),
      fullName: params.fullName.trim(),
      role: 'instructor',
      assignedCourseIds: params.assignedCourseIds,
      cohortOrSpecialty: params.specialty.trim() || 'Network Engineering Faculty',
      welcomeNote: params.welcomeNote?.trim() || undefined,
      status: 'pending',
      invitedByUid: currentUser.id,
      invitedByName: currentUser.name,
      invitedByEmail: currentUser.email,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString()
    };

    setInvitations(prev => [invite, ...prev]);
    saveInvitationToFirestore(invite).catch(() => {});

    const inviteUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/?invite=${code}` : `/?invite=${code}`;

    triggerSystemNotification(
      `Instructor Invitation Sent: ${invite.fullName}`,
      `Onboarding link and code ${code} prepared for ${invite.email}.`,
      'system',
      {
        subject: `🎓 You're Invited to Join Netplus Academy as an Instructor`,
        to: invite.email,
        bodyHtml: `<div style="font-family:sans-serif;padding:24px;background:#f8fafc;border-radius:12px;">
          <h2 style="color:#4338ca;margin-bottom:8px;">Netplus Academy Faculty Onboarding</h2>
          <p>Hello <strong>${invite.fullName}</strong>,</p>
          <p>Administrator <strong>${currentUser.name}</strong> has invited you to join Netplus Academy as an <strong>Instructor</strong> (${invite.cohortOrSpecialty}).</p>
          ${invite.welcomeNote ? `<p style="padding:12px;background:#eef2ff;border-left:3px solid #4f46e5;border-radius:6px;">${invite.welcomeNote}</p>` : ''}
          <div style="background:#fff;padding:16px;border:1px solid #e2e8f0;border-radius:8px;margin:16px 0;">
            <p><strong>Instructor Invite Code:</strong> <code>${code}</code></p>
            <p><strong>Assigned Courses:</strong> ${invite.assignedCourseIds.length} course(s)</p>
            <p><strong>Registration Link:</strong> <a href="${inviteUrl}">${inviteUrl}</a></p>
          </div>
          <p>Use the link above or enter your invite code during Sign Up or Google Sign-On to activate Instructor privileges.</p>
        </div>`
      }
    );

    return invite;
  };

  const createStudentInvites = (params: {
    entries: Array<{ fullName: string; email: string }>;
    cohort: string;
    assignedCourseIds: string[];
    subscriptionTier: SubscriptionTier;
    welcomeNote?: string;
  }): Invitation[] => {
    const now = new Date();
    const expires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const created: Invitation[] = params.entries.map(entry => {
      const code = generateInviteCode('STUD');
      const normalizedEmail = entry.email.trim().toLowerCase();
      const displayName = entry.fullName.trim() || normalizedEmail.split('@')[0];
      return {
        id: code,
        code,
        email: normalizedEmail,
        fullName: displayName,
        role: 'student',
        assignedCourseIds: params.assignedCourseIds,
        cohortOrSpecialty: params.cohort.trim() || 'Enterprise Networking Cohort',
        subscriptionTier: params.subscriptionTier,
        welcomeNote: params.welcomeNote?.trim() || undefined,
        status: 'pending',
        invitedByUid: currentUser.id,
        invitedByName: currentUser.name,
        invitedByEmail: currentUser.email,
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString()
      };
    });

    setInvitations(prev => [...created, ...prev]);
    created.forEach(inv => {
      saveInvitationToFirestore(inv).catch(() => {});
    });

    const firstInvite = created[0];
    if (firstInvite) {
      const inviteUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/?invite=${firstInvite.code}`
          : `/?invite=${firstInvite.code}`;

      triggerSystemNotification(
        created.length === 1
          ? `Student Registration Invite Sent: ${firstInvite.fullName}`
          : `${created.length} Student Registration Invites Dispatched`,
        created.length === 1
          ? `Registration code ${firstInvite.code} sent to ${firstInvite.email}.`
          : `Sent registration invites for cohort "${firstInvite.cohortOrSpecialty}" (${params.assignedCourseIds.length} pre-enrolled course(s)).`,
        'system',
        {
          subject:
            created.length === 1
              ? `🚀 Welcome to Netplus Academy — Complete Your Student Registration`
              : `🚀 ${created.length} Student Invitations Sent (${firstInvite.cohortOrSpecialty})`,
          to: created.length === 1 ? firstInvite.email : created.map(i => i.email).join(', '),
          bodyHtml: `<div style="font-family:sans-serif;padding:24px;background:#f8fafc;border-radius:12px;">
            <h2 style="color:#0284c7;margin-bottom:8px;">Netplus Academy Student Registration</h2>
            <p>Hello <strong>${created.length === 1 ? firstInvite.fullName : 'Student Cohort'}</strong>,</p>
            <p>You have been invited to register as a student in cohort <strong>${firstInvite.cohortOrSpecialty}</strong> with <strong>${params.subscriptionTier.toUpperCase()}</strong> access.</p>
            ${params.welcomeNote ? `<p style="padding:12px;background:#ecfeff;border-left:3px solid #06b6d4;border-radius:6px;">${params.welcomeNote}</p>` : ''}
            <div style="background:#fff;padding:16px;border:1px solid #e2e8f0;border-radius:8px;margin:16px 0;">
              <p><strong>Sample Registration Code:</strong> <code>${firstInvite.code}</code></p>
              <p><strong>Pre-Enrolled Courses:</strong> ${params.assignedCourseIds.length} course(s)</p>
              <p><strong>Registration Link:</strong> <a href="${inviteUrl}">${inviteUrl}</a></p>
            </div>
          </div>`
        }
      );
    }

    return created;
  };

  const resendInvitation = (inviteId: string) => {
    const target = invitationsRef.current.find(i => i.id === inviteId);
    if (!target) return;
    const newExpires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    setInvitations(prev =>
      prev.map(i => (i.id === inviteId ? { ...i, status: 'pending', expiresAt: newExpires } : i))
    );
    updateInvitationStatusInFirestore(inviteId, { status: 'pending' }).catch(() => {});
    const inviteUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/?invite=${target.code}` : `/?invite=${target.code}`;
    triggerSystemNotification(
      `Invitation Resent (${target.role.toUpperCase()})`,
      `Refreshed registration code ${target.code} for ${target.email}.`,
      'system',
      {
        subject: `Reminder: Your Netplus Academy ${target.role === 'instructor' ? 'Instructor' : 'Student'} Invitation`,
        to: target.email,
        bodyHtml: `<div style="font-family:sans-serif;padding:20px;">
          <p>Hi <strong>${target.fullName}</strong>,</p>
          <p>Your registration invite code is <code>${target.code}</code>.</p>
          <p>Complete registration at: <a href="${inviteUrl}">${inviteUrl}</a></p>
        </div>`
      }
    );
  };

  const revokeInvitation = (inviteId: string) => {
    setInvitations(prev => prev.map(i => (i.id === inviteId ? { ...i, status: 'revoked' } : i)));
    updateInvitationStatusInFirestore(inviteId, { status: 'revoked' }).catch(() => {});
  };

  const deleteInvitation = (inviteId: string) => {
    setInvitations(prev => prev.filter(i => i.id !== inviteId));
    deleteInvitationFromFirestore(inviteId).catch(() => {});
  };

  const refreshUsersDirectory = async (): Promise<number> => {
    const remoteUsers = await fetchUsersFromFirestore();
    if (!remoteUsers || remoteUsers.length === 0) return 0;

    setAllUsers(prev => {
      const next = [...prev];
      const fallbackAvatar =
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80';

      for (const remote of remoteUsers) {
        const idx = next.findIndex(
          u =>
            u.id === remote.uid ||
            u.email.toLowerCase() === remote.email.toLowerCase()
        );
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            name: remote.name || next[idx].name,
            role: remote.role || next[idx].role,
            avatar: remote.avatar || next[idx].avatar
          };
        } else {
          const defaultCourse = courses.find(c => c.id === 'course-ccna-1');
          next.push({
            id: remote.uid,
            name: remote.name,
            email: remote.email,
            role: remote.role,
            avatar: remote.avatar || fallbackAvatar,
            subscription: { tier: 'pro', status: 'active' },
            enrolledCourseIds: ['course-ccna-1'],
            courseEnrollments: {
              'course-ccna-1': createDefaultCourseEnrollment('course-ccna-1', defaultCourse?.defaultAccessDays, remote.joinedDate)
            },
            completedModuleIds: [],
            certificates: [],
            joinedDate: remote.joinedDate,
            reputationPoints: 50
          });
        }
      }
      return next;
    });

    return remoteUsers.length;
  };

  const updateUserAccount = async (
    userId: string,
    updates: {
      name?: string;
      role?: UserRole;
      subscriptionTier?: SubscriptionTier;
      subscriptionStatus?: User['subscription']['status'];
      enrolledCourseIds?: string[];
      courseEnrollments?: Record<string, CourseEnrollment>;
    }
  ): Promise<void> => {
    const targetUser = allUsers.find(u => u.id === userId);
    if (!targetUser) return;

    const cleanName = updates.name !== undefined ? updates.name.trim() || targetUser.name : targetUser.name;
    const nextRole = updates.role ?? targetUser.role;
    const nextEnrolledCourseIds = updates.enrolledCourseIds ?? targetUser.enrolledCourseIds;

    const mergedEnrollments: Record<string, CourseEnrollment> = {};
    for (const cid of nextEnrolledCourseIds) {
      const provided = updates.courseEnrollments?.[cid];
      const existing = targetUser.courseEnrollments?.[cid];
      if (provided && provided.startDate && provided.expiresAt) {
        mergedEnrollments[cid] = {
          courseId: cid,
          startDate: provided.startDate,
          endDate: provided.endDate || provided.expiresAt,
          expiresAt: provided.expiresAt
        };
      } else if (existing && existing.startDate && existing.expiresAt) {
        mergedEnrollments[cid] = {
          courseId: cid,
          startDate: existing.startDate,
          endDate: existing.endDate || existing.expiresAt,
          expiresAt: existing.expiresAt
        };
      } else {
        const course = courses.find(c => c.id === cid);
        mergedEnrollments[cid] = createDefaultCourseEnrollment(cid, course?.defaultAccessDays);
      }
    }

    setAllUsers(prev =>
      prev.map(u => {
        if (u.id !== userId) return u;
        return {
          ...u,
          name: cleanName,
          role: nextRole,
          enrolledCourseIds: nextEnrolledCourseIds,
          courseEnrollments: mergedEnrollments,
          subscription: {
            ...u.subscription,
            tier: updates.subscriptionTier ?? u.subscription.tier,
            status: updates.subscriptionStatus ?? u.subscription.status
          }
        };
      })
    );

    if (updates.name !== undefined || updates.courseEnrollments !== undefined || updates.enrolledCourseIds !== undefined) {
      setStudentProgressList(prev =>
        prev.map(p => {
          if (p.studentId !== userId) return p;
          const dates = mergedEnrollments[p.courseId];
          return {
            ...p,
            studentName: cleanName,
            ...(dates
              ? {
                  startDate: dates.startDate,
                  endDate: dates.endDate,
                  expiresAt: dates.expiresAt
                }
              : {})
          };
        })
      );
    }

    await updateUserInFirestore(userId, {
      ...(updates.name !== undefined ? { name: cleanName } : {}),
      ...(updates.role !== undefined ? { role: nextRole } : {})
    }).catch(() => {});

    triggerSystemNotification(
      `Account Updated: ${cleanName}`,
      `Updated ${targetUser.email} (${nextRole.toUpperCase()}).`,
      'system'
    );
  };

  const deleteUserAccount = async (userId: string): Promise<void> => {
    if (userId === currentUser.id) return;
    const targetUser = allUsers.find(u => u.id === userId);
    if (!targetUser) return;

    setAllUsers(prev => prev.filter(u => u.id !== userId));
    setStudentProgressList(prev => prev.filter(p => p.studentId !== userId));

    await deleteUserFromFirestore(userId).catch(() => {});

    triggerSystemNotification(
      `Account Removed: ${targetUser.name}`,
      `${targetUser.email} (${targetUser.role}) has been removed from the directory.`,
      'system'
    );
  };

  const loginUser = (email: string, _role?: UserRole, password?: string): boolean => {
    const normalizedEmail = email.trim().toLowerCase();
    const found = allUsers.find(u => u.email.toLowerCase() === normalizedEmail);
    if (!found) {
      return false;
    }

    const storedPassword = credentialsMap[normalizedEmail];
    if (storedPassword && password !== undefined && storedPassword !== password) {
      return false;
    }

    setCurrentUserId(found.id);
    setIsAuthenticated(true);
    localStorage.setItem(`${STORAGE_PREFIX}authenticated`, 'true');
    return true;
  };

  const registerUser = (
    name: string,
    email: string,
    password?: string,
    inviteCode?: string
  ): { success: boolean; error?: string; role?: UserRole } => {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = (inviteCode || '').trim();

    let matchedInvite: Invitation | undefined;
    if (cleanCode) {
      const foundInvite = findInvitationByCode(cleanCode);
      if (!foundInvite) {
        return {
          success: false,
          error: 'Invitation code not found. Verify the code or contact an administrator.'
        };
      }
      if (foundInvite.status === 'revoked') {
        return {
          success: false,
          error: 'This invitation code has been revoked by an administrator.'
        };
      }
      if (foundInvite.status === 'accepted') {
        return {
          success: false,
          error: 'This invitation code has already been redeemed.'
        };
      }
      if (foundInvite.expiresAt && new Date(foundInvite.expiresAt).getTime() < Date.now()) {
        return {
          success: false,
          error: 'This invitation code has expired. Request a new invitation from an administrator.'
        };
      }
      if (foundInvite.email.toLowerCase() !== normalizedEmail) {
        return {
          success: false,
          error: `This invitation was issued for ${foundInvite.email}. Please register with that email address.`
        };
      }
      matchedInvite = foundInvite;
    } else {
      matchedInvite = invitationsRef.current.find(
        inv =>
          inv.status === 'pending' &&
          inv.email.toLowerCase() === normalizedEmail &&
          (!inv.expiresAt || new Date(inv.expiresAt).getTime() >= Date.now())
      );
    }

    const existing = allUsers.find(u => u.email.toLowerCase() === normalizedEmail);

    if (password) {
      setCredentialsMap(prev => ({ ...prev, [normalizedEmail]: password }));
    }

    if (existing) {
      const nextRole: UserRole = matchedInvite ? matchedInvite.role : existing.role;
      const mergedCourses = matchedInvite?.assignedCourseIds.length
        ? Array.from(new Set([...existing.enrolledCourseIds, ...matchedInvite.assignedCourseIds]))
        : existing.enrolledCourseIds;
      const nextEnrollments: Record<string, CourseEnrollment> = { ...(existing.courseEnrollments || {}) };
      for (const cid of mergedCourses) {
        if (!nextEnrollments[cid]) {
          const c = courses.find(item => item.id === cid);
          nextEnrollments[cid] = createDefaultCourseEnrollment(cid, c?.defaultAccessDays);
        }
      }

      setAllUsers(prev =>
        prev.map(u =>
          u.id === existing.id
            ? {
                ...u,
                name: name.trim() || u.name,
                role: nextRole,
                enrolledCourseIds: mergedCourses,
                courseEnrollments: nextEnrollments
              }
            : u
        )
      );
      if (matchedInvite) {
        const acceptedAt = new Date().toISOString();
        setInvitations(prev =>
          prev.map(i =>
            i.id === matchedInvite!.id
              ? { ...i, status: 'accepted', acceptedByUid: existing.id, acceptedAt }
              : i
          )
        );
      }
      setCurrentUserId(existing.id);
      setIsAuthenticated(true);
      localStorage.setItem(`${STORAGE_PREFIX}authenticated`, 'true');
      return { success: true, role: nextRole };
    }

    const assignedRole: UserRole = matchedInvite ? matchedInvite.role : 'student';
    const enrolledCourseIds = matchedInvite?.assignedCourseIds.length
      ? matchedInvite.assignedCourseIds
      : ['course-ccna-1'];
    const subscriptionTier: SubscriptionTier = matchedInvite?.subscriptionTier || 'pro';
    const newUserId = `user-${Date.now()}`;
    const avatarUrl = `https://images.unsplash.com/photo-${1535000000000 + (Math.floor(Math.random() * 50000))}?auto=format&fit=crop&w=256&q=80`;
    const newEnrollments: Record<string, CourseEnrollment> = {};
    for (const cid of enrolledCourseIds) {
      const c = courses.find(item => item.id === cid);
      newEnrollments[cid] = createDefaultCourseEnrollment(cid, c?.defaultAccessDays);
    }

    const newUser: User = {
      id: newUserId,
      name: name.trim(),
      email: email.trim(),
      role: assignedRole,
      avatar: avatarUrl,
      subscription: { tier: subscriptionTier, status: 'active' },
      enrolledCourseIds,
      courseEnrollments: newEnrollments,
      completedModuleIds: [],
      certificates: [],
      joinedDate: new Date().toISOString().split('T')[0],
      reputationPoints: 50
    };
    setAllUsers(prev => [...prev, newUser]);

    if (matchedInvite) {
      const acceptedAt = new Date().toISOString();
      setInvitations(prev =>
        prev.map(i =>
          i.id === matchedInvite!.id
            ? { ...i, status: 'accepted', acceptedByUid: newUserId, acceptedAt }
            : i
        )
      );
      if (assignedRole === 'student') {
        const enrolledCourses = courses.filter(c => enrolledCourseIds.includes(c.id));
        if (enrolledCourses.length > 0) {
          setStudentProgressList(prev => [
            ...enrolledCourses.map(c => {
              const dates = newEnrollments[c.id] || createDefaultCourseEnrollment(c.id, c.defaultAccessDays);
              return {
                studentId: newUserId,
                studentName: newUser.name,
                studentEmail: newUser.email,
                avatar: avatarUrl,
                courseId: c.id,
                courseCode: c.code,
                courseTitle: c.title,
                progressPercent: 0,
                completedModulesCount: 0,
                totalModulesCount: c.modules.length,
                quizAverage: 0,
                lastActive: 'Just now',
                status: 'active' as const,
                timeSpentHours: 0,
                startDate: dates.startDate,
                endDate: dates.endDate,
                expiresAt: dates.expiresAt
              };
            }),
            ...prev
          ]);
        }
      }
      triggerSystemNotification(
        `${assignedRole === 'instructor' ? 'Instructor' : 'Student'} Account Activated`,
        `${newUser.name} redeemed invitation ${matchedInvite.code} and joined as ${assignedRole}.`,
        'system'
      );
    }

    setCurrentUserId(newUserId);
    setIsAuthenticated(true);
    localStorage.setItem(`${STORAGE_PREFIX}authenticated`, 'true');
    return { success: true, role: assignedRole };
  };

  const signInWithGoogle = async (inviteCode?: string): Promise<{ success: boolean; error?: string }> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        success: false,
        error: 'You appear to be offline. Please check your internet connection and try again.'
      };
    }

    pendingGoogleInviteCodeRef.current = inviteCode?.trim() || undefined;

    try {
      const result = await signInWithPopup(auth, googleProvider);
      await upsertGoogleUser(
        {
          uid: result.user.uid,
          displayName: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoURL,
          emailVerified: result.user.emailVerified
        },
        inviteCode
      );
      triggerSystemNotification(
        'Signed In with Google',
        `Welcome to Netplus Academy, ${result.user.displayName || result.user.email}!`,
        'system'
      );
      return { success: true };
    } catch (error: any) {
      pendingGoogleInviteCodeRef.current = undefined;
      const code = error?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return { success: false, error: 'Google sign-in popup was closed before completing.' };
      }
      if (code === 'auth/popup-blocked') {
        return { success: false, error: 'Popup was blocked by your browser. Please allow popups and try again.' };
      }
      if (code === 'auth/network-request-failed') {
        return {
          success: false,
          error:
            'Network error connecting to Google Sign-In. Check your connection or disable browser extensions blocking googleapis.com / firebaseapp.com and try again.'
        };
      }
      if (code === 'auth/unauthorized-domain') {
        return {
          success: false,
          error: 'This domain is not authorized for Google Sign-In in Firebase Authentication settings.'
        };
      }
      if (code === 'auth/operation-not-allowed') {
        return {
          success: false,
          error: 'Google Sign-In is not enabled in Firebase Authentication providers.'
        };
      }
      return { success: false, error: error?.message || 'Google sign-in failed. Please try again.' };
    }
  };

  const logoutUser = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch {
      // ignore if not signed in via Firebase
    }
    localStorage.removeItem(`${STORAGE_PREFIX}authenticated`);
    setIsAuthenticated(false);
  };

  const toggleDarkMode = () => setDarkMode(prev => !prev);
  const toggleManualOfflineSim = () => setManualOfflineSim(prev => !prev);

  // Course Actions
  const enrollInCourse = (
    courseId: string,
    customDates?: Partial<Omit<CourseEnrollment, 'courseId'>>
  ) => {
    const course = courses.find(c => c.id === courseId);
    const defaultDates = createDefaultCourseEnrollment(courseId, course?.defaultAccessDays);
    const enrollmentDates: CourseEnrollment = {
      courseId,
      startDate: customDates?.startDate || defaultDates.startDate,
      endDate: customDates?.endDate || customDates?.expiresAt || defaultDates.endDate,
      expiresAt: customDates?.expiresAt || customDates?.endDate || defaultDates.expiresAt
    };

    setAllUsers(prev => prev.map(u => {
      if (u.id === currentUser.id) {
        const nextIds = u.enrolledCourseIds.includes(courseId)
          ? u.enrolledCourseIds
          : [...u.enrolledCourseIds, courseId];
        return {
          ...u,
          enrolledCourseIds: nextIds,
          courseEnrollments: {
            ...(u.courseEnrollments || {}),
            [courseId]: enrollmentDates
          }
        };
      }
      return u;
    }));

    // Update course student count
    if (!currentUser.enrolledCourseIds.includes(courseId)) {
      setCourses(prev => prev.map(c => {
        if (c.id === courseId) {
          return { ...c, enrolledCount: c.enrolledCount + 1 };
        }
        return c;
      }));
    }

    // Add to student progress records
    if (course) {
      const newProgress: StudentProgressRecord = {
        studentId: currentUser.id,
        studentName: currentUser.name,
        studentEmail: currentUser.email,
        avatar: currentUser.avatar,
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        progressPercent: 0,
        completedModulesCount: 0,
        totalModulesCount: course.modules.length,
        quizAverage: 0,
        lastActive: 'Just now',
        status: 'active',
        timeSpentHours: 0.1,
        startDate: enrollmentDates.startDate,
        endDate: enrollmentDates.endDate,
        expiresAt: enrollmentDates.expiresAt
      };
      setStudentProgressList(prev => [newProgress, ...prev.filter(p => !(p.studentId === currentUser.id && p.courseId === courseId))]);
      
      triggerSystemNotification(
        `Enrolled in ${course.code}`,
        `You have successfully registered for ${course.title}. Access active from ${enrollmentDates.startDate} until ${enrollmentDates.expiresAt}.`,
        'course'
      );
    }
  };

  const recordLearningActivity = (activityLabel?: string) => {
    const activeUserId = currentUser.id;
    setStreakData(prev => {
      const beforeComputed = computeLearningStreak(prev);
      const { next, changed } = recordActivityInStreakData(prev);
      if (!changed) return prev;

      saveLocalLearningStreak(activeUserId, next);
      saveLearningStreakToFirestore(next).catch(() => {});

      const afterComputed = computeLearningStreak(next);
      if (afterComputed.badge.id !== beforeComputed.badge.id && afterComputed.badge.minDays >= 1) {
        triggerSystemNotification(
          `Streak Badge Unlocked: ${afterComputed.badge.title}`,
          `${afterComputed.currentStreak}-day learning streak achieved${activityLabel ? ` via ${activityLabel}` : ''}!`,
          'system'
        );
      }

      return next;
    });
  };

  const setDailyStudyGoalMinutes = (minutes: number) => {
    const activeUserId = currentUser.id;
    setStudyGoalData(prev => {
      const next = updateDailyGoalMinutesInData(prev, minutes);
      saveLocalStudyGoal(activeUserId, next);
      lastStudyGoalCloudSyncRef.current = Date.now();
      saveStudyGoalToFirestore(next).catch(() => {});
      return next;
    });
  };

  const recordStudyTime = (seconds: number, source: StudySource, moduleId?: string) => {
    const activeUserId = currentUser.id;
    setStudyGoalData(prev => {
      const before = computeDailyStudyGoal(prev);
      const { next, added } = addStudySecondsToData(prev, seconds, source, moduleId);
      if (!added) return prev;

      saveLocalStudyGoal(activeUserId, next);
      const after = computeDailyStudyGoal(next);
      const justReachedGoal = !before.goalReached && after.goalReached;
      const now = Date.now();

      if (justReachedGoal || moduleId || now - lastStudyGoalCloudSyncRef.current >= 30000) {
        lastStudyGoalCloudSyncRef.current = now;
        saveStudyGoalToFirestore(next).catch(() => {});
      }

      if (justReachedGoal) {
        triggerSystemNotification(
          `Daily Study Goal Reached (${after.dailyGoalMinutes} min)`,
          `Great focus! You hit your ${after.dailyGoalMinutes}-minute daily study target.`,
          'system'
        );
      }

      return next;
    });

    if (seconds > 0 && !learningStreak.studiedToday) {
      recordLearningActivity(
        source === 'lab' ? 'Lab Simulation' : source === 'practice' ? 'Practice Lab' : 'Course Study'
      );
    }
  };

  const savePersonalFlashcard = (input: PersonalFlashcardInput): PersonalFlashcard => {
    const activeUserId = currentUser.id;
    const nowIso = new Date().toISOString();
    const existing = input.id
      ? personalFlashcardsRef.current.find(c => c.id === input.id)
      : undefined;

    const safeCourseId = sanitizeCourseRefId(input.courseId);
    const matchedCourse =
      safeCourseId !== GENERAL_COURSE_ID
        ? courses.find(c => c.id === safeCourseId)
        : undefined;
    const safeModuleId =
      safeCourseId !== GENERAL_COURSE_ID && input.moduleId
        ? sanitizeFlashcardId(input.moduleId)
        : undefined;
    const matchedModule =
      safeModuleId && matchedCourse
        ? matchedCourse.modules.find(m => m.id === safeModuleId)
        : undefined;

    const card = normalizePersonalFlashcard(
      {
        id:
          existing?.id ||
          (input.id
            ? sanitizeFlashcardId(input.id)
            : `pfc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        ownerUid: existing?.ownerUid || activeUserId,
        courseId: safeCourseId,
        courseCode:
          safeCourseId === GENERAL_COURSE_ID
            ? undefined
            : matchedCourse?.code || input.courseCode,
        courseTitle:
          safeCourseId === GENERAL_COURSE_ID
            ? undefined
            : matchedCourse?.title || input.courseTitle,
        moduleId: safeModuleId,
        moduleTitle:
          safeCourseId === GENERAL_COURSE_ID
            ? undefined
            : matchedModule?.title || input.moduleTitle,
        category: input.category,
        term: input.term,
        question: input.question,
        answer: input.answer,
        portNumber: input.portNumber,
        transportProtocol: input.transportProtocol,
        osiLayer: input.osiLayer,
        explanation: input.explanation || '',
        memoryTip: input.memoryTip || '',
        masteryStatus: input.masteryStatus || existing?.masteryStatus || 'unreviewed',
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso
      },
      activeUserId
    );

    setPersonalFlashcards(prev => {
      const filtered = prev.filter(c => c.id !== card.id);
      const next = [card, ...filtered];
      saveLocalPersonalFlashcards(activeUserId, next);
      return next;
    });

    savePersonalFlashcardToFirestore(card).catch(() => {});
    recordLearningActivity(existing ? 'Updated personal flashcard' : 'Created personal flashcard');
    return card;
  };

  const deletePersonalFlashcard = (cardId: string) => {
    const activeUserId = currentUser.id;
    setPersonalFlashcards(prev => {
      const next = prev.filter(c => c.id !== cardId);
      saveLocalPersonalFlashcards(activeUserId, next);
      return next;
    });
    deletePersonalFlashcardFromFirestore(cardId).catch(() => {});
  };

  const updatePersonalFlashcardMastery = (cardId: string, status: CardMasteryStatus) => {
    const activeUserId = currentUser.id;
    const nowIso = new Date().toISOString();
    let updatedCard: PersonalFlashcard | null = null;

    setPersonalFlashcards(prev => {
      const next = prev.map(card => {
        if (card.id !== cardId) return card;
        updatedCard = {
          ...card,
          masteryStatus: status,
          updatedAt: nowIso
        };
        return updatedCard;
      });
      saveLocalPersonalFlashcards(activeUserId, next);
      return next;
    });

    if (updatedCard) {
      savePersonalFlashcardToFirestore(updatedCard).catch(() => {});
    }
  };

  const saveQuickNote = (input: QuickNoteInput): QuickNote => {
    const activeUserId = currentUser.id;
    const nowIso = new Date().toISOString();
    const existing = input.id
      ? quickNotesRef.current.find(n => n.id === input.id)
      : undefined;

    const safeCourseId = sanitizeNoteId(input.courseId || 'general');
    const matchedCourse = courses.find(c => c.id === safeCourseId);
    const safeModuleId = sanitizeNoteId(input.moduleId || 'module-general');
    const matchedModule = matchedCourse?.modules.find(m => m.id === safeModuleId);

    const note = normalizeQuickNote(
      {
        id:
          existing?.id ||
          (input.id
            ? sanitizeNoteId(input.id)
            : `qn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        ownerUid: existing?.ownerUid || activeUserId,
        courseId: safeCourseId,
        courseCode: matchedCourse?.code || input.courseCode,
        courseTitle: matchedCourse?.title || input.courseTitle,
        moduleId: safeModuleId,
        moduleTitle: matchedModule?.title || input.moduleTitle || 'Lesson Notes',
        title: input.title,
        content: input.content,
        videoTimestampSeconds: input.videoTimestampSeconds,
        tags: input.tags,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso
      },
      activeUserId
    );

    setQuickNotes(prev => {
      const filtered = prev.filter(n => n.id !== note.id);
      const next = [note, ...filtered];
      saveLocalQuickNotes(activeUserId, next);
      return next;
    });

    saveQuickNoteToFirestore(note).catch(() => {});
    recordLearningActivity(existing ? 'Updated quick note' : 'Saved quick note');
    return note;
  };

  const deleteQuickNote = (noteId: string) => {
    const activeUserId = currentUser.id;
    setQuickNotes(prev => {
      const next = prev.filter(n => n.id !== noteId);
      saveLocalQuickNotes(activeUserId, next);
      return next;
    });
    deleteQuickNoteFromFirestore(noteId).catch(() => {});
  };

  const bookmarkedCourseIds = courseBookmarks.map(b => b.courseId);

  const isCourseBookmarked = (courseId: string): boolean => {
    return courseBookmarks.some(b => b.courseId === courseId);
  };

  const toggleCourseBookmark = (courseId: string): boolean => {
    const activeUserId = currentUser.id;
    const alreadyBookmarked = courseBookmarksRef.current.some(b => b.courseId === courseId);

    if (alreadyBookmarked) {
      setCourseBookmarks(prev => {
        const next = prev.filter(b => b.courseId !== courseId);
        saveLocalCourseBookmarks(activeUserId, next);
        return next;
      });
      deleteCourseBookmarkFromFirestore(courseId).catch(() => {});
      return false;
    }

    const nowIso = new Date().toISOString();
    const matchedCourse = courses.find(c => c.id === courseId);
    const bookmark = normalizeCourseBookmark(
      {
        id: buildBookmarkDocId(activeUserId, courseId),
        ownerUid: activeUserId,
        courseId,
        courseCode: matchedCourse?.code,
        courseTitle: matchedCourse?.title,
        createdAt: nowIso,
        updatedAt: nowIso
      },
      activeUserId
    );

    setCourseBookmarks(prev => {
      const filtered = prev.filter(b => b.courseId !== courseId);
      const next = [bookmark, ...filtered];
      saveLocalCourseBookmarks(activeUserId, next);
      return next;
    });

    saveCourseBookmarkToFirestore(bookmark).catch(() => {});
    return true;
  };

  const completeModule = (courseId: string, moduleId: string) => {
    recordLearningActivity('Module completion');
    const targetCourse = courses.find(c => c.id === courseId);
    const completedMod = targetCourse?.modules.find(m => m.id === moduleId);
    const creditMinutes = Math.min(15, Math.max(3, Math.round((completedMod?.durationMin || 8) * 0.4)));
    recordStudyTime(creditMinutes * 60, 'course', moduleId);

    setAllUsers(prev => prev.map(u => {
      if (u.id === currentUser.id) {
        const completed = u.completedModuleIds.includes(moduleId)
          ? u.completedModuleIds
          : [...u.completedModuleIds, moduleId];
        return { ...u, completedModuleIds: completed };
      }
      return u;
    }));

    // Update StudentProgressList
    if (targetCourse) {
      const userCompletedInCourse = targetCourse.modules.filter(m => 
        currentUser.completedModuleIds.includes(m.id) || m.id === moduleId
      ).length;
      const progressPercent = Math.round((userCompletedInCourse / targetCourse.modules.length) * 100);

      setStudentProgressList(prev => {
        const existing = prev.find(p => p.studentId === currentUser.id && p.courseId === courseId);
        if (existing) {
          return prev.map(p => {
            if (p.studentId === currentUser.id && p.courseId === courseId) {
              return {
                ...p,
                progressPercent,
                completedModulesCount: userCompletedInCourse,
                status: progressPercent === 100 ? 'completed' : 'active',
                lastActive: 'Just now',
              };
            }
            return p;
          });
        }
        return prev;
      });

      // If finished all modules, auto generate certificate!
      if (progressPercent === 100) {
        generateCertificate(courseId);
      }
    }
  };

  const updateStudentQuizAverage = (courseId: string, averageScore: number) => {
    recordLearningActivity('Quiz completion');
    recordStudyTime(120, 'course');
    const safeAvg = Math.max(0, Math.min(100, Math.round(averageScore)));
    setStudentProgressList(prev =>
      prev.map(p =>
        p.studentId === currentUser.id && p.courseId === courseId
          ? { ...p, quizAverage: safeAvg, lastActive: 'Just now' }
          : p
      )
    );
  };

  const addCourse = (newCourse: Course) => {
    const courseWithOwner: Course = {
      ...newCourse,
      createdById: newCourse.createdById || currentUser.id,
      createdByEmail: newCourse.createdByEmail || currentUser.email
    };
    setCourses(prev => [courseWithOwner, ...prev]);
    triggerSystemNotification(
      `New Course Published: ${courseWithOwner.code}`,
      `${courseWithOwner.title} has been added to the academy catalog.`,
      'course'
    );
  };

  const updateCourse = (courseId: string, updated: Partial<Course>) => {
    const today = new Date().toISOString().split('T')[0];
    setCourses(prev =>
      prev.map(c => (c.id === courseId ? { ...c, ...updated, updatedAt: today } : c))
    );
    if (updated.code || updated.title) {
      setStudentProgressList(prev =>
        prev.map(p =>
          p.courseId === courseId
            ? {
                ...p,
                courseCode: updated.code ?? p.courseCode,
                courseTitle: updated.title ?? p.courseTitle
              }
            : p
        )
      );
    }
    triggerSystemNotification(
      'Course Updated',
      `Changes to ${updated.code || 'course'} have been saved and published to the curriculum.`,
      'course'
    );
  };

  const deleteCourse = (courseId: string) => {
    setCourses(prev => prev.filter(c => c.id !== courseId));
    setCourseBookmarks(prev => {
      if (!prev.some(b => b.courseId === courseId)) return prev;
      const next = prev.filter(b => b.courseId !== courseId);
      saveLocalCourseBookmarks(currentUser.id, next);
      return next;
    });
    deleteCourseBookmarkFromFirestore(courseId).catch(() => {});
  };

  const addModuleToCourse = (courseId: string, newModule: CourseModule, insertAtIndex?: number) => {
    const today = new Date().toISOString().split('T')[0];
    setCourses(prev =>
      prev.map(c => {
        if (c.id === courseId) {
          const modules = [...c.modules];
          if (
            typeof insertAtIndex === 'number' &&
            insertAtIndex >= 0 &&
            insertAtIndex <= modules.length
          ) {
            modules.splice(insertAtIndex, 0, newModule);
          } else {
            modules.push(newModule);
          }
          return {
            ...c,
            chapters: mergeModuleHierarchyIntoChapters(
              c.chapters,
              newModule.chapterTitle,
              newModule.mainContentTitle
            ),
            modules,
            modulesCount: modules.length,
            updatedAt: today
          };
        }
        return c;
      })
    );
  };

  const updateModuleInCourse = (courseId: string, moduleId: string, updated: Partial<CourseModule>) => {
    const today = new Date().toISOString().split('T')[0];
    setCourses(prev =>
      prev.map(c => {
        if (c.id === courseId) {
          const modules = c.modules.map(m => (m.id === moduleId ? { ...m, ...updated } : m));
          const updatedMod = modules.find(m => m.id === moduleId);
          return {
            ...c,
            chapters: updatedMod
              ? mergeModuleHierarchyIntoChapters(
                  c.chapters,
                  updatedMod.chapterTitle,
                  updatedMod.mainContentTitle
                )
              : c.chapters,
            modules,
            updatedAt: today
          };
        }
        return c;
      })
    );
  };

  const deleteModuleFromCourse = (courseId: string, moduleId: string) => {
    const today = new Date().toISOString().split('T')[0];
    setCourses(prev =>
      prev.map(c => {
        if (c.id === courseId) {
          const modules = c.modules.filter(m => m.id !== moduleId);
          return {
            ...c,
            modules,
            modulesCount: modules.length,
            updatedAt: today
          };
        }
        return c;
      })
    );
  };

  const reorderModuleInCourse = (courseId: string, moduleId: string, direction: 'up' | 'down') => {
    const today = new Date().toISOString().split('T')[0];
    setCourses(prev =>
      prev.map(c => {
        if (c.id !== courseId) return c;
        const idx = c.modules.findIndex(m => m.id === moduleId);
        if (idx === -1) return c;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= c.modules.length) return c;
        const modules = [...c.modules];
        const [moved] = modules.splice(idx, 1);
        modules.splice(targetIdx, 0, moved);
        return {
          ...c,
          modules,
          updatedAt: today
        };
      })
    );
  };

  const setCourseModulesOrder = (courseId: string, modules: CourseModule[]) => {
    const today = new Date().toISOString().split('T')[0];
    setCourses(prev =>
      prev.map(c =>
        c.id === courseId
          ? {
              ...c,
              modules,
              modulesCount: modules.length,
              updatedAt: today
            }
          : c
      )
    );
  };

  // Ownership helper: Admins can access all courses; Instructors only courses they created
  const getOwnedCoursesForUser = (user: User = currentUser): Course[] => {
    if (user.role === 'admin') return courses;
    if (user.role !== 'instructor') return [];
    const normalizedEmail = user.email.trim().toLowerCase();
    const normalizedName = user.name.trim().toLowerCase();
    return courses.filter(c => {
      if (c.createdById && c.createdById === user.id) return true;
      if (c.createdByEmail && c.createdByEmail.trim().toLowerCase() === normalizedEmail) return true;
      if (!c.createdById && c.instructor?.name?.trim().toLowerCase() === normalizedName) return true;
      return false;
    });
  };

  const createClass = (params: {
    name: string;
    sectionCode?: string;
    courseId: string;
    scheduleLabel: string;
    startDate: string;
    endDate: string;
    maxSeats: number;
    deliveryType?: 'Instructor-led' | 'Self-paced';
    language?: string;
    meetingUrl?: string;
    notes?: string;
  }): { success: boolean; courseClass?: CourseClass; error?: string } => {
    if (currentUser.role !== 'admin' && currentUser.role !== 'instructor') {
      return { success: false, error: 'Only admins and instructors can create classes.' };
    }

    const ownedCourses = getOwnedCoursesForUser(currentUser);
    const targetCourse = ownedCourses.find(c => c.id === params.courseId);
    if (!targetCourse) {
      return {
        success: false,
        error: 'Instructors can only create classes for courses they have created.'
      };
    }

    const today = new Date().toISOString().split('T')[0];
    const startDate = params.startDate || today;
    const endDate = params.endDate && params.endDate >= startDate ? params.endDate : startDate;
    const autoSection =
      params.sectionCode?.trim().toUpperCase() ||
      `${targetCourse.code.split('-')[0]}-${Math.floor(100 + Math.random() * 900)}`;

    const status: CourseClass['status'] =
      startDate > today ? 'upcoming' : endDate < today ? 'completed' : 'active';

    const newClass: CourseClass = {
      id: `class-${Date.now()}`,
      name: params.name.trim(),
      sectionCode: autoSection,
      joinCode: `CLS-${autoSection.replace(/[^A-Z0-9]/g, '')}`,
      enrollmentOpen: true,
      deliveryType: params.deliveryType || 'Instructor-led',
      language: params.language?.trim() || 'English',
      pinned: false,
      meetingUrl: params.meetingUrl?.trim() || undefined,
      courseId: targetCourse.id,
      courseCode: targetCourse.code,
      courseTitle: targetCourse.title,
      instructorId: currentUser.id,
      instructorName: currentUser.name,
      instructorEmail: currentUser.email,
      instructorAvatar: currentUser.avatar,
      scheduleLabel: params.scheduleLabel.trim() || 'Flexible Self-Paced + Weekly Live Q&A',
      startDate,
      endDate,
      expiresAt: endDate,
      maxSeats: Math.max(1, Number(params.maxSeats) || 30),
      enrolledStudentIds: [],
      invitedEmails: [],
      announcements: [],
      attendanceRecords: {},
      notes: params.notes?.trim() || undefined,
      status,
      createdAt: today
    };

    setClasses(prev => [newClass, ...prev]);
    triggerSystemNotification(
      `Class Created: ${newClass.sectionCode}`,
      `${newClass.name} created under ${targetCourse.code} (${startDate} – ${endDate}).`,
      'course'
    );
    return { success: true, courseClass: newClass };
  };

  const updateClass = (
    classId: string,
    updates: Partial<Omit<CourseClass, 'id' | 'courseId' | 'courseCode' | 'courseTitle'>>
  ) => {
    setClasses(prev =>
      prev.map(cls => {
        if (cls.id !== classId) return cls;
        const nextEndDate = updates.endDate || updates.expiresAt || cls.endDate;
        const nextStartDate = updates.startDate || cls.startDate;
        const today = new Date().toISOString().split('T')[0];
        const nextStatus: CourseClass['status'] =
          updates.status ||
          (nextStartDate > today ? 'upcoming' : nextEndDate < today ? 'completed' : 'active');
        return {
          ...cls,
          ...updates,
          startDate: nextStartDate,
          endDate: nextEndDate,
          expiresAt: nextEndDate,
          status: nextStatus
        };
      })
    );
  };

  const deleteClass = (classId: string) => {
    setClasses(prev => prev.filter(c => c.id !== classId));
  };

  const enrollStudentInClass = (
    classId: string,
    student: { existingUserId?: string; name?: string; email?: string }
  ): { success: boolean; error?: string } => {
    const targetClass = classes.find(c => c.id === classId);
    if (!targetClass) return { success: false, error: 'Class not found.' };
    const targetCourse = courses.find(c => c.id === targetClass.courseId);
    if (!targetCourse) return { success: false, error: 'Course not found.' };

    if (currentUser.role === 'instructor' && targetClass.instructorId !== currentUser.id) {
      const owned = getOwnedCoursesForUser(currentUser);
      if (!owned.some(c => c.id === targetClass.courseId)) {
        return { success: false, error: 'You can only manage classes for your own courses.' };
      }
    }

    let resolvedUser = student.existingUserId
      ? allUsers.find(u => u.id === student.existingUserId)
      : undefined;

    if (!resolvedUser && student.email) {
      const cleanEmail = student.email.trim().toLowerCase();
      resolvedUser = allUsers.find(u => u.email.toLowerCase() === cleanEmail);
    }

    const today = new Date().toISOString().split('T')[0];
    const enrollmentWindow: CourseEnrollment = {
      courseId: targetCourse.id,
      startDate: targetClass.startDate,
      endDate: targetClass.endDate,
      expiresAt: targetClass.expiresAt
    };

    let targetStudentId = resolvedUser?.id || '';
    let targetStudentName = resolvedUser?.name || student.name?.trim() || '';
    let targetStudentEmail = resolvedUser?.email || student.email?.trim().toLowerCase() || '';
    let targetStudentAvatar =
      resolvedUser?.avatar ||
      `https://images.unsplash.com/photo-${1530000000000 + Math.floor(Math.random() * 50000)}?auto=format&fit=crop&w=256&q=80`;

    if (!resolvedUser) {
      if (!targetStudentEmail) {
        return { success: false, error: 'Please select a student or provide a valid email address.' };
      }
      if (!targetStudentName) {
        targetStudentName = targetStudentEmail.split('@')[0];
      }
      targetStudentId = `user-${Date.now()}`;
      const newStudent: User = {
        id: targetStudentId,
        name: targetStudentName,
        email: targetStudentEmail,
        role: 'student',
        avatar: targetStudentAvatar,
        subscription: { tier: 'pro', status: 'active' },
        enrolledCourseIds: [targetCourse.id],
        courseEnrollments: {
          [targetCourse.id]: enrollmentWindow
        },
        completedModuleIds: [],
        certificates: [],
        joinedDate: today,
        reputationPoints: 50
      };
      setAllUsers(prev => [...prev, newStudent]);
    } else {
      const alreadyEnrolledInCourse = resolvedUser.enrolledCourseIds.includes(targetCourse.id);
      setAllUsers(prev =>
        prev.map(u => {
          if (u.id !== resolvedUser!.id) return u;
          return {
            ...u,
            enrolledCourseIds: alreadyEnrolledInCourse
              ? u.enrolledCourseIds
              : [...u.enrolledCourseIds, targetCourse.id],
            courseEnrollments: {
              ...(u.courseEnrollments || {}),
              [targetCourse.id]: enrollmentWindow
            }
          };
        })
      );
    }

    if (!targetClass.enrolledStudentIds.includes(targetStudentId)) {
      setClasses(prev =>
        prev.map(c =>
          c.id === classId
            ? { ...c, enrolledStudentIds: [...c.enrolledStudentIds, targetStudentId] }
            : c
        )
      );
    }

    if (!resolvedUser || !resolvedUser.enrolledCourseIds.includes(targetCourse.id)) {
      setCourses(prev =>
        prev.map(c =>
          c.id === targetCourse.id ? { ...c, enrolledCount: c.enrolledCount + 1 } : c
        )
      );
    }

    setStudentProgressList(prev => {
      const existingProgress = prev.find(
        p => p.studentId === targetStudentId && p.courseId === targetCourse.id
      );
      if (existingProgress) {
        return prev.map(p =>
          p.studentId === targetStudentId && p.courseId === targetCourse.id
            ? {
                ...p,
                startDate: enrollmentWindow.startDate,
                endDate: enrollmentWindow.endDate,
                expiresAt: enrollmentWindow.expiresAt
              }
            : p
        );
      }
      const newRecord: StudentProgressRecord = {
        studentId: targetStudentId,
        studentName: targetStudentName,
        studentEmail: targetStudentEmail,
        avatar: targetStudentAvatar,
        courseId: targetCourse.id,
        courseCode: targetCourse.code,
        courseTitle: targetCourse.title,
        progressPercent: 0,
        completedModulesCount: 0,
        totalModulesCount: targetCourse.modules.length,
        quizAverage: 0,
        lastActive: 'Just enrolled',
        status: 'active',
        timeSpentHours: 0,
        startDate: enrollmentWindow.startDate,
        endDate: enrollmentWindow.endDate,
        expiresAt: enrollmentWindow.expiresAt
      };
      return [newRecord, ...prev];
    });

    triggerSystemNotification(
      `Student Enrolled in ${targetClass.sectionCode}`,
      `${targetStudentName} enrolled in ${targetClass.name} (${targetCourse.code}).`,
      'course'
    );
    return { success: true };
  };

  const removeStudentFromClass = (classId: string, studentId: string) => {
    setClasses(prev =>
      prev.map(c =>
        c.id === classId
          ? { ...c, enrolledStudentIds: c.enrolledStudentIds.filter(id => id !== studentId) }
          : c
      )
    );
  };

  const inviteStudentsToClass = (
    classId: string,
    entries: Array<{ fullName: string; email: string }>,
    subscriptionTier: SubscriptionTier,
    welcomeNote?: string
  ): Invitation[] => {
    const targetClass = classes.find(c => c.id === classId);
    if (!targetClass) return [];

    const created = createStudentInvites({
      entries,
      cohort: `${targetClass.name} (${targetClass.sectionCode})`,
      assignedCourseIds: [targetClass.courseId],
      subscriptionTier,
      welcomeNote:
        welcomeNote?.trim() ||
        `You are invited to join class ${targetClass.name} (${targetClass.scheduleLabel}) running ${targetClass.startDate} to ${targetClass.endDate}.`
    });

    const newEmails = created.map(i => i.email.toLowerCase());
    setClasses(prev =>
      prev.map(c =>
        c.id === classId
          ? {
              ...c,
              invitedEmails: Array.from(new Set([...c.invitedEmails, ...newEmails]))
            }
          : c
      )
    );
    return created;
  };

  const addClassAnnouncement = (
    classId: string,
    params: {
      title: string;
      message: string;
      category: ClassAnnouncement['category'];
      pinned?: boolean;
    }
  ) => {
    const targetClass = classes.find(c => c.id === classId);
    if (!targetClass) return;

    const now = new Date();
    const stamp = `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`;
    const newAnnouncement: ClassAnnouncement = {
      id: `ann-${Date.now()}`,
      title: params.title.trim(),
      message: params.message.trim(),
      category: params.category,
      pinned: Boolean(params.pinned),
      authorName: currentUser.name,
      createdAt: stamp
    };

    setClasses(prev =>
      prev.map(cls =>
        cls.id === classId
          ? { ...cls, announcements: [newAnnouncement, ...(cls.announcements || [])] }
          : cls
      )
    );

    triggerSystemNotification(
      `Class Announcement · ${targetClass.sectionCode}`,
      `${newAnnouncement.title}: ${newAnnouncement.message.slice(0, 120)}`,
      'course'
    );
  };

  const togglePinClassAnnouncement = (classId: string, announcementId: string) => {
    setClasses(prev =>
      prev.map(cls =>
        cls.id === classId
          ? {
              ...cls,
              announcements: (cls.announcements || []).map(a =>
                a.id === announcementId ? { ...a, pinned: !a.pinned } : a
              )
            }
          : cls
      )
    );
  };

  const deleteClassAnnouncement = (classId: string, announcementId: string) => {
    setClasses(prev =>
      prev.map(cls =>
        cls.id === classId
          ? {
              ...cls,
              announcements: (cls.announcements || []).filter(a => a.id !== announcementId)
            }
          : cls
      )
    );
  };

  const markClassAttendance = (
    classId: string,
    sessionDate: string,
    studentId: string,
    status: AttendanceStatus
  ) => {
    setClasses(prev =>
      prev.map(cls => {
        if (cls.id !== classId) return cls;
        const records = { ...(cls.attendanceRecords || {}) };
        records[sessionDate] = {
          ...(records[sessionDate] || {}),
          [studentId]: status
        };
        return { ...cls, attendanceRecords: records };
      })
    );
  };

  const markAllClassAttendance = (
    classId: string,
    sessionDate: string,
    status: AttendanceStatus
  ) => {
    setClasses(prev =>
      prev.map(cls => {
        if (cls.id !== classId) return cls;
        const records = { ...(cls.attendanceRecords || {}) };
        const dayMap: Record<string, AttendanceStatus> = { ...(records[sessionDate] || {}) };
        cls.enrolledStudentIds.forEach(sid => {
          dayMap[sid] = status;
        });
        records[sessionDate] = dayMap;
        return { ...cls, attendanceRecords: records };
      })
    );
  };

  // Certificate Generation
  const generateCertificate = (courseId: string): Certificate => {
    const course = courses.find(c => c.id === courseId);
    const existingCert = currentUser.certificates.find(c => c.courseId === courseId);
    if (existingCert) return existingCert;

    const certSerial = `NP-${(course?.code || 'CERT').replace(/[^a-zA-Z0-9]/g, '')}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const randomHex = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const verificationHash = `sha256-np${randomHex}`;

    const newCert: Certificate = {
      id: `cert-${Date.now()}`,
      certificateNumber: certSerial,
      courseId,
      courseTitle: course?.title || 'Networking Engineering Certification',
      studentId: currentUser.id,
      studentName: currentUser.name,
      studentEmail: currentUser.email,
      issueDate: new Date().toISOString().split('T')[0],
      instructorName: course?.instructor.name || 'Dr. Marcus Vance, CCIE #49281',
      instructorTitle: course?.instructor.title || 'Principal Network Architect',
      verificationHash,
      grade: '98% (Honors & Lab Distinction)',
      skillsAcquired: course?.learningOutcomes || [
        'Cisco IOS Advanced Configuration',
        'Enterprise Routing Protocol Troubleshooting',
        'VLAN Segmentation and Layer 2 Security'
      ]
    };

    setAllUsers(prev => prev.map(u => {
      if (u.id === currentUser.id) {
        return {
          ...u,
          certificates: [newCert, ...u.certificates]
        };
      }
      return u;
    }));

    // Trigger congratulations email notification
    triggerSystemNotification(
      `Certificate Issued: ${course?.code || 'Academy Mastery'}`,
      `Official verified certificate #${certSerial} has been generated. Download or verify anytime!`,
      'certificate',
      {
        subject: `🎓 Congratulations! Your Certificate for ${course?.title || 'Course'} is Ready`,
        to: currentUser.email,
        bodyHtml: `<div style="font-family:sans-serif;padding:24px;background:#f8fafc;border-radius:12px;">
          <h2 style="color:#1d4ed8;margin-bottom:8px;">Netplus Academy Certificate of Excellence</h2>
          <p>Congratulations <strong>${currentUser.name}</strong>,</p>
          <p>You have satisfied all curricular lab benchmarks and passed the comprehensive assessment for <strong>${course?.title}</strong>.</p>
          <div style="background:#fff;padding:16px;border:1px solid #e2e8f0;border-radius:8px;margin:16px 0;">
            <p><strong>Certificate ID:</strong> <code>${certSerial}</code></p>
            <p><strong>Hash:</strong> <code>${verificationHash}</code></p>
            <p><strong>Issued:</strong> ${newCert.issueDate}</p>
          </div>
          <p>This credential can be publicly verified at any time on the Netplus global registry.</p>
        </div>`
      }
    );

    return newCert;
  };

  const verifyCertificate = (hashOrNumber: string): Certificate | undefined => {
    const cleanQuery = hashOrNumber.trim().toLowerCase();
    for (const u of allUsers) {
      const match = u.certificates.find(c => 
        c.certificateNumber.toLowerCase() === cleanQuery || 
        c.verificationHash.toLowerCase() === cleanQuery
      );
      if (match) return match;
    }
    return undefined;
  };

  // Per-Course Student Checkout & Enrollment
  const getCoursePaymentForStudent = (
    courseId: string,
    studentId: string = currentUser.id
  ): CoursePaymentRecord | undefined => {
    return coursePayments.find(
      p => p.courseId === courseId && p.studentId === studentId && p.status === 'paid'
    );
  };

  const completeCoursePaymentAndEnroll = async (params: {
    courseId: string;
    paymentMethod: CoursePaymentMethod;
    cardLast4?: string;
    promoCode?: string;
    billingName?: string;
    billingEmail?: string;
  }): Promise<{ success: boolean; payment?: CoursePaymentRecord; error?: string }> => {
    const targetCourse = courses.find(c => c.id === params.courseId);
    if (!targetCourse) {
      return { success: false, error: 'Course not found.' };
    }

    const originalPrice = Math.max(0, Number(targetCourse.price) || 0);
    const cleanPromo = (params.promoCode || '').trim().toUpperCase();
    const promoRates: Record<string, number> = {
      NETPLUS20: 0.2,
      STUDENT10: 0.1,
      CCNA50: 0.5
    };
    const localDiscountRate = promoRates[cleanPromo] || 0;
    const localDiscount = Math.min(
      originalPrice,
      Math.round(originalPrice * localDiscountRate * 100) / 100
    );
    const localAmountPaid = Math.max(0, Math.round((originalPrice - localDiscount) * 100) / 100);

    let transactionId = `TXN-CRS-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    let invoiceNumber = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
    let discountAmount = localDiscount;
    let amountPaid = localAmountPaid;
    let appliedPromo = localDiscountRate > 0 ? cleanPromo : undefined;
    let paidAt = new Date().toISOString();

    if (!isOffline) {
      try {
        const res = await fetch('/api/payments/course-enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: targetCourse.id,
            courseCode: targetCourse.code,
            courseTitle: targetCourse.title,
            price: originalPrice,
            promoCode: cleanPromo || undefined,
            paymentMethod: params.paymentMethod,
            cardLast4: params.cardLast4,
            email: params.billingEmail || currentUser.email,
            studentName: params.billingName || currentUser.name
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.transactionId) transactionId = data.transactionId;
          if (data.invoiceNumber) invoiceNumber = data.invoiceNumber;
          if (typeof data.discountAmount === 'number') discountAmount = data.discountAmount;
          if (typeof data.amountPaid === 'number') amountPaid = data.amountPaid;
          if (data.promoCode) appliedPromo = data.promoCode;
          if (data.paidAt) paidAt = data.paidAt;
        }
      } catch {
        // Use local fallback receipt calculation when server request fails
      }
    }

    const accessWindow = createDefaultCourseEnrollment(
      targetCourse.id,
      targetCourse.defaultAccessDays
    );

    // Enroll student & unlock full access window
    enrollInCourse(targetCourse.id, {
      startDate: accessWindow.startDate,
      endDate: accessWindow.endDate,
      expiresAt: accessWindow.expiresAt
    });

    const record: CoursePaymentRecord = {
      id: `pay-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      transactionId,
      invoiceNumber,
      studentId: currentUser.id,
      studentName: (params.billingName || currentUser.name).trim(),
      studentEmail: (params.billingEmail || currentUser.email).trim(),
      courseId: targetCourse.id,
      courseCode: targetCourse.code,
      courseTitle: targetCourse.title,
      originalPrice,
      discountAmount,
      amountPaid,
      currency: 'USD',
      ...(appliedPromo ? { promoCode: appliedPromo } : {}),
      paymentMethod: params.paymentMethod,
      ...(params.paymentMethod === 'card'
        ? { cardLast4: (params.cardLast4 || '4242').slice(-4) }
        : {}),
      status: 'paid',
      paidAt,
      accessStartDate: accessWindow.startDate,
      accessExpiresAt: accessWindow.expiresAt
    };

    setCoursePayments(prev => [record, ...prev]);

    // Persist payment receipt to Firestore when Firebase auth is active
    saveCoursePaymentToFirestore(record).catch(() => {});

    triggerSystemNotification(
      `Course Payment Confirmed: ${targetCourse.code}`,
      `Paid $${amountPaid.toFixed(2)} USD for ${targetCourse.title}. Invoice #${invoiceNumber} is saved to your receipts.`,
      'billing',
      {
        subject: `Netplus Academy Receipt #${invoiceNumber} — ${targetCourse.code}`,
        to: record.studentEmail,
        bodyHtml: `<div style="font-family:sans-serif;padding:24px;background:#f8fafc;border-radius:12px;">
          <h2 style="color:#1d4ed8;margin-bottom:8px;">Course Enrollment Receipt</h2>
          <p>Hi <strong>${record.studentName}</strong>,</p>
          <p>Your payment for <strong>${targetCourse.title} (${targetCourse.code})</strong> has been processed and your enrollment is now active.</p>
          <div style="background:#fff;padding:16px;border:1px solid #e2e8f0;border-radius:8px;margin:16px 0;">
            <p><strong>Invoice Number:</strong> <code>${invoiceNumber}</code></p>
            <p><strong>Transaction ID:</strong> <code>${transactionId}</code></p>
            <p><strong>Amount Paid:</strong> $${amountPaid.toFixed(2)} USD</p>
            <p><strong>Access Window:</strong> ${accessWindow.startDate} to ${accessWindow.expiresAt}</p>
          </div>
        </div>`
      }
    );

    return { success: true, payment: record };
  };

  // Subscriptions & Payments
  const upgradeSubscription = async (tier: SubscriptionTier, billingCycle: 'monthly' | 'annual', cardLast4 = '4242') => {
    try {
      const res = await fetch('/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: tier,
          billingCycle,
          cardLast4,
          email: currentUser.email,
          studentName: currentUser.name
        })
      });
      const data = await res.json();

      setAllUsers(prev => prev.map(u => {
        if (u.id === currentUser.id) {
          return {
            ...u,
            subscription: {
              tier,
              status: 'active',
              renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }
          };
        }
        return u;
      }));

      triggerSystemNotification(
        `Subscription Activated: ${tier.toUpperCase()}`,
        `Your account has been upgraded to ${tier.toUpperCase()} plan. Full lab environments and automated certificates are now unlocked.`,
        'billing',
        {
          subject: `💳 Netplus Academy Invoice #${data.invoiceNumber || 'INV-9901'}`,
          to: currentUser.email,
          bodyHtml: `<div style="font-family:sans-serif;padding:20px;">
            <h3>Thank you for subscribing to Netplus ${tier.toUpperCase()}</h3>
            <p>Amount: $${data.amount || 29}.00 USD billed ${billingCycle}</p>
            <p>Payment Method: Card ending in ${cardLast4}</p>
            <p>Transaction ID: <code>${data.transactionId}</code></p>
          </div>`
        }
      );

      return data;
    } catch (err) {
      console.error('Payment error:', err);
      // Fallback local update
      setAllUsers(prev => prev.map(u => {
        if (u.id === currentUser.id) {
          return {
            ...u,
            subscription: { tier, status: 'active' }
          };
        }
        return u;
      }));
      return { success: true, transactionId: 'TXN-LOCAL-OFFLINE' };
    }
  };

  // Forum Handlers
  const addForumPost = (title: string, content: string, category: string, tags: string[]) => {
    const newPost: ForumPost = {
      id: `post-${Date.now()}`,
      title,
      content,
      author: {
        name: currentUser.name,
        avatar: currentUser.avatar,
        role: currentUser.role
      },
      category,
      tags,
      upvotes: 1,
      repliesCount: 0,
      replies: [],
      isResolved: false,
      createdAt: new Date().toISOString()
    };
    setForumPosts(prev => [newPost, ...prev]);
    triggerSystemNotification(
      'Forum Discussion Created',
      `Your question "${title.substring(0, 40)}..." has been posted to the community.`,
      'forum'
    );
  };

  const addForumReply = (postId: string, content: string, codeSnippet?: string) => {
    const newReply = {
      id: `rep-${Date.now()}`,
      author: {
        name: currentUser.name,
        avatar: currentUser.avatar,
        role: currentUser.role
      },
      content,
      codeSnippet,
      createdAt: new Date().toISOString(),
      upvotes: 0
    };

    setForumPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          repliesCount: p.repliesCount + 1,
          replies: [...p.replies, newReply]
        };
      }
      return p;
    }));
  };

  const upvotePost = (postId: string) => {
    setForumPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const isUpvoted = p.upvotedByUser;
        return {
          ...p,
          upvotes: isUpvoted ? p.upvotes - 1 : p.upvotes + 1,
          upvotedByUser: !isUpvoted
        };
      }
      return p;
    }));
  };

  const markAcceptedAnswer = (postId: string, replyId: string) => {
    setForumPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          isResolved: true,
          replies: p.replies.map(r => ({
            ...r,
            isAcceptedAnswer: r.id === replyId
          }))
        };
      }
      return p;
    }));
  };

  // Notifications
  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const triggerSystemNotification = (
    title: string, 
    message: string, 
    type: NotificationItem['type'], 
    emailPreview?: NotificationItem['emailPreview']
  ) => {
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title,
      message,
      type,
      timestamp: 'Just now',
      read: false,
      emailSent: !!emailPreview,
      emailPreview
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  // LMS
  const updateLMSConfig = (provider: LMSConfig['provider'], updates: Partial<LMSConfig>) => {
    setLmsConfigs(prev => prev.map(c => c.provider === provider ? { ...c, ...updates } : c));
  };

  const generateApiKeyForLMS = (provider: LMSConfig['provider']): string => {
    const newKey = `np_live_${provider}_${Math.random().toString(36).substring(2, 14)}${Math.random().toString(36).substring(2, 8)}`;
    updateLMSConfig(provider, { apiKey: newKey, connected: true });
    return newKey;
  };

  const triggerLMSSync = (provider: LMSConfig['provider']) => {
    const target = lmsConfigs.find(c => c.provider === provider);
    const addedCount = Math.floor(15 + Math.random() * 40);
    updateLMSConfig(provider, {
      lastSync: 'Just now',
      syncedStudentsCount: (target?.syncedStudentsCount || 0) + addedCount
    });
    triggerSystemNotification(
      `LMS Sync Completed: ${target?.name || provider}`,
      `Successfully synced ${addedCount} student roster progress records and gradebook grades.`,
      'system'
    );
  };

  return (
    <AcademyContext.Provider
      value={{
        currentUser,
        allUsers,
        courses,
        forumPosts,
        studentProgressList,
        activityFeed,
        lmsConfigs,
        notifications,
        unreadNotifsCount,
        darkMode,
        isOffline,
        manualOfflineSim,
        isAuthenticated,
        authReady,
        setCurrentUser,
        loginUser,
        registerUser,
        signInWithGoogle,
        logoutUser,
        invitations,
        findInvitationByCode,
        createInstructorInvite,
        createStudentInvites,
        resendInvitation,
        revokeInvitation,
        deleteInvitation,
        refreshUsersDirectory,
        updateUserAccount,
        deleteUserAccount,
        toggleDarkMode,
        toggleManualOfflineSim,
        enrollInCourse,
        completeModule,
        updateStudentQuizAverage,
        learningStreak,
        recordLearningActivity,
        dailyStudyGoal,
        setDailyStudyGoalMinutes,
        recordStudyTime,
        personalFlashcards,
        savePersonalFlashcard,
        deletePersonalFlashcard,
        updatePersonalFlashcardMastery,
        quickNotes,
        saveQuickNote,
        deleteQuickNote,
        courseBookmarks,
        bookmarkedCourseIds,
        isCourseBookmarked,
        toggleCourseBookmark,
        addCourse,
        updateCourse,
        deleteCourse,
        addModuleToCourse,
        updateModuleInCourse,
        deleteModuleFromCourse,
        reorderModuleInCourse,
        setCourseModulesOrder,
        classes,
        getOwnedCoursesForUser,
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
        generateCertificate,
        verifyCertificate,
        coursePayments,
        getCoursePaymentForStudent,
        completeCoursePaymentAndEnroll,
        upgradeSubscription,
        addForumPost,
        addForumReply,
        upvotePost,
        markAcceptedAnswer,
        markNotificationAsRead,
        markAllNotificationsRead,
        triggerSystemNotification,
        updateLMSConfig,
        generateApiKeyForLMS,
        triggerLMSSync,
      }}
    >
      {children}
    </AcademyContext.Provider>
  );
};

export const useAcademy = () => {
  const context = useContext(AcademyContext);
  if (!context) {
    throw new Error('useAcademy must be used within an AcademyProvider');
  }
  return context;
};
