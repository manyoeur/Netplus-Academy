export type UserRole = 'student' | 'instructor' | 'admin';

export type SubscriptionTier = 'free' | 'pro' | 'expert' | 'enterprise';

export interface CourseEnrollment {
  courseId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  expiresAt: string; // YYYY-MM-DD
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  subscription: {
    tier: SubscriptionTier;
    status: 'active' | 'trial' | 'expired';
    renewsAt?: string;
  };
  enrolledCourseIds: string[];
  courseEnrollments?: Record<string, CourseEnrollment>;
  completedModuleIds: string[];
  certificates: Certificate[];
  joinedDate: string;
  reputationPoints: number;
}

export type InvitationRole = 'instructor' | 'student';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export interface Invitation {
  id: string;
  code: string;
  email: string;
  fullName: string;
  role: InvitationRole;
  assignedCourseIds: string[];
  cohortOrSpecialty: string;
  subscriptionTier?: SubscriptionTier;
  welcomeNote?: string;
  status: InvitationStatus;
  invitedByUid: string;
  invitedByName: string;
  invitedByEmail: string;
  acceptedByUid?: string;
  acceptedAt?: string;
  createdAt: string;
  expiresAt: string;
}

export type ModuleType = 'theory' | 'video' | 'lab' | 'quiz' | 'pcap';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface LabTopologyNode {
  id: string;
  name: string;
  type: 'router' | 'switch' | 'firewall' | 'server' | 'pc';
  ip: string;
  subnet: string;
  status: 'online' | 'warning' | 'offline';
  x: number;
  y: number;
}

export interface LabTopologyLink {
  from: string;
  to: string;
  interfaceFrom: string;
  interfaceTo: string;
  status: 'up' | 'down';
}

export interface CourseMainContentSection {
  id: string;
  title: string; // Level 2: Main Contents
  summary?: string;
}

export interface CourseChapterSection {
  id: string;
  title: string; // Level 1: Chapter Section
  summary?: string;
  mainContents: CourseMainContentSection[];
}

export interface CourseModule {
  id: string;
  title: string; // Level 3: Course Content
  type: ModuleType;
  durationMin: number;
  summary: string;
  chapterTitle?: string;      // Level 1: Chapter Section assignment
  mainContentTitle?: string;  // Level 2: Main Contents assignment
  contentMarkdown?: string;
  videoUrl?: string;
  videoDuration?: string;
  quiz?: {
    passingScore: number;
    questions: QuizQuestion[];
  };
  checkpointQuiz?: {
    title?: string;
    passingScore: number;
    questions: QuizQuestion[];
  };
  lab?: {
    objective: string;
    nodes: LabTopologyNode[];
    links: LabTopologyLink[];
    initialConfigPrompt: string;
    expectedCommands: string[];
    terminalHints: string[];
    verificationCheck: string;
  };
}

export interface CourseGradingCriteria {
  overallPassingScore: number;
  quizPassingScore: number;
  requireAllModulesComplete: boolean;
  requireQuizPassForCertificate: boolean;
  allowQuizRetakes: boolean;
  maxQuizAttempts: number; // 0 = unlimited
  weights: {
    quizzes: number;
    labs: number;
    lessonsAndPcaps: number;
  };
}

export interface Course {
  id: string;
  code: string; // e.g. CCNA-201, CCNP-ENCOR
  title: string;
  subtitle: string;
  category: 'Enterprise Routing & Switching' | 'Network Security & Firewalls' | 'Cloud & SD-WAN' | 'Packet Analysis & Forensics' | 'Automation & NetDevOps';
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  instructor: {
    name: string;
    title: string;
    avatar: string;
  };
  rating: number;
  reviewsCount: number;
  durationHours: number;
  modulesCount: number;
  enrolledCount: number;
  price: number;
  bannerColor: string;
  thumbnail?: string;
  badge: string;
  description: string;
  prerequisites: string[];
  learningOutcomes: string[];
  chapters?: CourseChapterSection[];
  modules: CourseModule[];
  gradingCriteria?: CourseGradingCriteria;
  createdById?: string;
  createdByEmail?: string;
  isPublished: boolean;
  updatedAt: string;
  defaultAccessDays?: number;
}

export type AttendanceStatus = 'present' | 'late' | 'absent';

export interface ClassAnnouncement {
  id: string;
  title: string;
  message: string;
  category: 'general' | 'lab' | 'deadline' | 'live_session';
  pinned?: boolean;
  authorName: string;
  createdAt: string;
}

export interface CourseClass {
  id: string;
  name: string;
  sectionCode: string;
  joinCode?: string;
  enrollmentOpen?: boolean;
  meetingUrl?: string;
  deliveryType?: 'Instructor-led' | 'Self-paced';
  language?: string;
  pinned?: boolean;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  instructorId: string;
  instructorName: string;
  instructorEmail: string;
  instructorAvatar?: string;
  scheduleLabel: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  expiresAt: string; // YYYY-MM-DD
  maxSeats: number;
  enrolledStudentIds: string[];
  invitedEmails: string[];
  announcements?: ClassAnnouncement[];
  attendanceRecords?: Record<string, Record<string, AttendanceStatus>>;
  notes?: string;
  status: 'active' | 'upcoming' | 'completed';
  createdAt: string;
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  courseId: string;
  courseTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  issueDate: string;
  instructorName: string;
  instructorTitle: string;
  verificationHash: string;
  grade: string;
  skillsAcquired: string[];
}

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  author: {
    name: string;
    avatar: string;
    role: UserRole;
  };
  category: string;
  tags: string[];
  upvotes: number;
  upvotedByUser?: boolean;
  repliesCount: number;
  replies: ForumReply[];
  isResolved: boolean;
  createdAt: string;
  pinned?: boolean;
}

export interface ForumReply {
  id: string;
  author: {
    name: string;
    avatar: string;
    role: UserRole;
  };
  content: string;
  codeSnippet?: string;
  createdAt: string;
  upvotes: number;
  isAcceptedAnswer?: boolean;
}

export interface StudentProgressRecord {
  studentId: string;
  studentName: string;
  studentEmail: string;
  avatar: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  progressPercent: number;
  completedModulesCount: number;
  totalModulesCount: number;
  quizAverage: number;
  lastActive: string;
  status: 'active' | 'completed' | 'behind' | 'inactive';
  timeSpentHours: number;
  startDate?: string;
  endDate?: string;
  expiresAt?: string;
}

export interface RealtimeActivityItem {
  id: string;
  studentName: string;
  action: 'enrolled' | 'completed_module' | 'passed_quiz' | 'earned_certificate' | 'finished_lab';
  target: string;
  timestamp: string;
  avatar: string;
}

export interface LMSConfig {
  provider: 'canvas' | 'blackboard' | 'moodle' | 'google_classroom';
  name: string;
  connected: boolean;
  endpointUrl: string;
  clientId: string;
  apiKey: string;
  lastSync: string;
  syncedStudentsCount: number;
  syncGradesAuto: boolean;
  syncEnrollmentsAuto: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'course' | 'certificate' | 'billing' | 'forum';
  timestamp: string;
  read: boolean;
  emailSent: boolean;
  emailPreview?: {
    subject: string;
    to: string;
    bodyHtml: string;
  };
}

export type CoursePaymentMethod = 'card' | 'paypal' | 'bank_transfer';

export interface CoursePaymentRecord {
  id: string;
  transactionId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  originalPrice: number;
  discountAmount: number;
  amountPaid: number;
  currency: 'USD';
  promoCode?: string;
  paymentMethod: CoursePaymentMethod;
  cardLast4?: string;
  status: 'paid' | 'refunded';
  paidAt: string;
  accessStartDate: string;
  accessExpiresAt: string;
}

