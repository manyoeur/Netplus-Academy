export type UserRole = 'student' | 'instructor' | 'admin';

export type SubscriptionTier = 'free' | 'pro' | 'expert' | 'enterprise';

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
  completedModuleIds: string[];
  certificates: Certificate[];
  joinedDate: string;
  reputationPoints: number;
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

export interface CourseModule {
  id: string;
  title: string;
  type: ModuleType;
  durationMin: number;
  summary: string;
  contentMarkdown?: string;
  videoUrl?: string;
  videoDuration?: string;
  quiz?: {
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
  badge: string;
  description: string;
  prerequisites: string[];
  learningOutcomes: string[];
  modules: CourseModule[];
  isPublished: boolean;
  updatedAt: string;
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
