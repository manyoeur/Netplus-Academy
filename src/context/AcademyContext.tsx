import React, { createContext, useContext, useState, useEffect } from 'react';
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
  CourseModule
} from '../types';
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
  setCurrentUser: (user: User) => void;
  switchRole: (role: UserRole) => void;
  loginUser: (email: string, role?: UserRole) => boolean;
  registerUser: (name: string, email: string, role: UserRole) => void;
  
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
  };

  const switchRole = (role: UserRole) => {
    const targetUser = allUsers.find(u => u.role === role);
    if (targetUser) {
      setCurrentUserId(targetUser.id);
    } else {
      // Create user if not found
      const newUser: User = {
        id: `user-${role}-${Date.now()}`,
        name: role === 'admin' ? 'System Administrator' : role === 'instructor' ? 'Lead Instructor' : 'Student Engineer',
        email: `${role}@netpulse.academy`,
        role,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
        subscription: { tier: 'pro', status: 'active' },
        enrolledCourseIds: ['course-ccna-1'],
        completedModuleIds: [],
        certificates: [],
        joinedDate: new Date().toISOString().split('T')[0],
        reputationPoints: 100
      };
      setAllUsers(prev => [...prev, newUser]);
      setCurrentUserId(newUser.id);
    }
  };

  const loginUser = (email: string, role?: UserRole): boolean => {
    const found = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (found) {
      setCurrentUserId(found.id);
      return true;
    }
    // Auto register if role provided
    if (role) {
      registerUser(email.split('@')[0], email, role);
      return true;
    }
    return false;
  };

  const registerUser = (name: string, email: string, role: UserRole) => {
    const newUser: User = {
      id: `user-${Date.now()}`,
      name,
      email,
      role,
      avatar: `https://images.unsplash.com/photo-${1535000000000 + (Math.floor(Math.random() * 50000))}?auto=format&fit=crop&w=256&q=80`,
      subscription: { tier: 'pro', status: 'active' },
      enrolledCourseIds: ['course-ccna-1'],
      completedModuleIds: [],
      certificates: [],
      joinedDate: new Date().toISOString().split('T')[0],
      reputationPoints: 50
    };
    setAllUsers(prev => [...prev, newUser]);
    setCurrentUserId(newUser.id);
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
    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, ...updated, updatedAt: new Date().toISOString().split('T')[0] } : c));
  };

  const deleteCourse = (courseId: string) => {
    setCourses(prev => prev.filter(c => c.id !== courseId));
  };

  const addModuleToCourse = (courseId: string, newModule: CourseModule) => {
    setCourses(prev => prev.map(c => {
      if (c.id === courseId) {
        const modules = [...c.modules, newModule];
        return {
          ...c,
          modules,
          modulesCount: modules.length
        };
      }
      return c;
    }));
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
        setCurrentUser,
        switchRole,
        loginUser,
        registerUser,
        toggleDarkMode,
        toggleManualOfflineSim,
        enrollInCourse,
        completeModule,
        addCourse,
        updateCourse,
        deleteCourse,
        addModuleToCourse,
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
