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
  Invitation
} from '../types';
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
  deleteUserFromFirestore
} from '../firebase';
import { 
  INITIAL_USERS, 
  INITIAL_COURSES, 
  INITIAL_FORUM_POSTS, 
  INITIAL_STUDENT_PROGRESS, 
  INITIAL_REALTIME_ACTIVITY, 
  INITIAL_LMS_CONFIGS, 
  INITIAL_NOTIFICATIONS 
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
    }
  ) => Promise<void>;
  deleteUserAccount: (userId: string) => Promise<void>;
  
  // Dark mode & Offline
  toggleDarkMode: () => void;
  toggleManualOfflineSim: () => void;
  
  // Courses & Learning
  enrollInCourse: (courseId: string) => void;
  completeModule: (courseId: string, moduleId: string) => void;
  addCourse: (course: Course) => void;
  updateCourse: (courseId: string, updated: Partial<Course>) => void;
  deleteCourse: (courseId: string) => void;
  addModuleToCourse: (courseId: string, module: CourseModule) => void;
  updateModuleInCourse: (courseId: string, moduleId: string, updated: Partial<CourseModule>) => void;
  deleteModuleFromCourse: (courseId: string, moduleId: string) => void;
  reorderModuleInCourse: (courseId: string, moduleId: string, direction: 'up' | 'down') => void;
  
  // Certificates
  generateCertificate: (courseId: string) => Certificate;
  verifyCertificate: (hashOrNumber: string) => Certificate | undefined;
  
  // Subscriptions & Payments
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
  const [allUsers, setAllUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}users`);
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}current_user_id`);
    return saved || 'user-student-1';
  });

  const currentUser = allUsers.find(u => u.id === currentUserId) || allUsers[0];

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
        return prev.map(u =>
          u.id === existing.id
            ? {
                ...u,
                name: resolvedName,
                avatar: resolvedAvatar,
                role: resolvedRole,
                enrolledCourseIds: mergedCourses,
                subscription: matchedInvite?.subscriptionTier
                  ? { ...u.subscription, tier: matchedInvite.subscriptionTier }
                  : u.subscription
              }
            : u
        );
      }
      const created: User = {
        id: fbUser.uid,
        name: resolvedName,
        email: fbUser.email!,
        role: resolvedRole,
        avatar: resolvedAvatar,
        subscription: { tier: invitedTier, status: 'active' },
        enrolledCourseIds: invitedCourseIds,
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
              .map(c => ({
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
                timeSpentHours: 0
              }));
            return additions.length ? [...additions, ...prev] : prev;
          });
        }
      }
    }

    if (resolvedRole === 'admin' && fbUser.emailVerified) {
      refreshUsersDirectory().catch(() => {});
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
    return saved ? JSON.parse(saved) : INITIAL_COURSES;
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
          next.push({
            id: remote.uid,
            name: remote.name,
            email: remote.email,
            role: remote.role,
            avatar: remote.avatar || fallbackAvatar,
            subscription: { tier: 'pro', status: 'active' },
            enrolledCourseIds: ['course-ccna-1'],
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
    }
  ): Promise<void> => {
    const targetUser = allUsers.find(u => u.id === userId);
    if (!targetUser) return;

    const cleanName = updates.name !== undefined ? updates.name.trim() || targetUser.name : targetUser.name;
    const nextRole = updates.role ?? targetUser.role;

    setAllUsers(prev =>
      prev.map(u => {
        if (u.id !== userId) return u;
        return {
          ...u,
          name: cleanName,
          role: nextRole,
          enrolledCourseIds: updates.enrolledCourseIds ?? u.enrolledCourseIds,
          subscription: {
            ...u.subscription,
            tier: updates.subscriptionTier ?? u.subscription.tier,
            status: updates.subscriptionStatus ?? u.subscription.status
          }
        };
      })
    );

    if (updates.name !== undefined) {
      setStudentProgressList(prev =>
        prev.map(p => (p.studentId === userId ? { ...p, studentName: cleanName } : p))
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

      setAllUsers(prev =>
        prev.map(u =>
          u.id === existing.id
            ? {
                ...u,
                name: name.trim() || u.name,
                role: nextRole,
                enrolledCourseIds: mergedCourses
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

    const newUser: User = {
      id: newUserId,
      name: name.trim(),
      email: email.trim(),
      role: assignedRole,
      avatar: avatarUrl,
      subscription: { tier: subscriptionTier, status: 'active' },
      enrolledCourseIds,
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
            ...enrolledCourses.map(c => ({
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
              timeSpentHours: 0
            })),
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
  const enrollInCourse = (courseId: string) => {
    setAllUsers(prev => prev.map(u => {
      if (u.id === currentUser.id && !u.enrolledCourseIds.includes(courseId)) {
        return {
          ...u,
          enrolledCourseIds: [...u.enrolledCourseIds, courseId]
        };
      }
      return u;
    }));

    // Update course student count
    setCourses(prev => prev.map(c => {
      if (c.id === courseId) {
        return { ...c, enrolledCount: c.enrolledCount + 1 };
      }
      return c;
    }));

    // Add to student progress records
    const course = courses.find(c => c.id === courseId);
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
        timeSpentHours: 0.1
      };
      setStudentProgressList(prev => [newProgress, ...prev.filter(p => !(p.studentId === currentUser.id && p.courseId === courseId))]);
      
      triggerSystemNotification(
        `Enrolled in ${course.code}`,
        `You have successfully registered for ${course.title}. Start with Module 1!`,
        'course'
      );
    }
  };

  const completeModule = (courseId: string, moduleId: string) => {
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
    const targetCourse = courses.find(c => c.id === courseId);
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

  const addCourse = (newCourse: Course) => {
    setCourses(prev => [newCourse, ...prev]);
    triggerSystemNotification(
      `New Course Published: ${newCourse.code}`,
      `${newCourse.title} has been added to the academy catalog.`,
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
  };

  const addModuleToCourse = (courseId: string, newModule: CourseModule) => {
    const today = new Date().toISOString().split('T')[0];
    setCourses(prev =>
      prev.map(c => {
        if (c.id === courseId) {
          const modules = [...c.modules, newModule];
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

  const updateModuleInCourse = (courseId: string, moduleId: string, updated: Partial<CourseModule>) => {
    const today = new Date().toISOString().split('T')[0];
    setCourses(prev =>
      prev.map(c => {
        if (c.id === courseId) {
          const modules = c.modules.map(m => (m.id === moduleId ? { ...m, ...updated } : m));
          return {
            ...c,
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
        addCourse,
        updateCourse,
        deleteCourse,
        addModuleToCourse,
        updateModuleInCourse,
        deleteModuleFromCourse,
        reorderModuleInCourse,
        generateCertificate,
        verifyCertificate,
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
