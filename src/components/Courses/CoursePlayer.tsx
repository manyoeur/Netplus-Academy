import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Award,
  BookmarkCheck,
  ArrowUp,
  X,
  Calendar,
  AlertTriangle,
  XCircle,
  Clock,
  CheckSquare,
  Lock,
  CreditCard,
  FileText,
  ChevronUp,
  BookOpen,
  CheckCircle2,
  Plus,
  SquareStack,
  Edit3,
  Check,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { Course, CourseModule } from '../../types';
import { InteractiveCliTerminal } from '../Lab/InteractiveCliTerminal';
import { InteractiveQuiz, QuizResult } from './InteractiveQuiz';
import { VideoLecturePlayer } from './VideoLecturePlayer';
import { PostModuleQuiz } from './PostModuleQuiz';
import {
  HierarchyContentWorkspace,
  MarkdownProse,
  ModuleContentWorkspace
} from './HierarchyContentWorkspace';
import { PersonalFlashcardModal } from '../Flashcards/PersonalFlashcardModal';
import {
  getBetweenModuleQuiz,
  getModuleQuiz,
  getPostVideoModuleQuiz
} from '../../data/checkpointQuizzes';
import {
  resolveCourseHierarchy,
  getModuleSectionBreadcrumb,
  toChapterConfigFromHierarchy
} from '../../utils/courseHierarchy';
import {
  resolveCourseEnrollment,
  formatEnrollmentDate,
  getEnrollmentExpirationInfo,
  DEFAULT_ENROLLMENT_DAYS
} from '../../utils/enrollmentDates';

interface CoursePlayerProps {
  courseId: string;
  onBack: () => void;
  onViewCertificates: () => void;
  onOpenPricing?: () => void;
  onOpenCourseCheckout?: (course: Course) => void;
}

interface ModuleReadingProgress {
  scrollY: number;
  scrollRatio: number;
  percent: number;
  updatedAt: string;
}

interface CourseReadingState {
  lastModuleId: string;
  modules: Record<string, ModuleReadingProgress>;
}

type ReadingStore = Record<string, CourseReadingState>;

const READING_PROGRESS_STORAGE_PREFIX = 'netpulse_academy_reading_progress_v1';

function getReadingStorageKey(userId: string): string {
  return `${READING_PROGRESS_STORAGE_PREFIX}:${userId}`;
}

function readReadingStore(userId: string): ReadingStore {
  try {
    const raw = localStorage.getItem(getReadingStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeReadingStore(userId: string, store: ReadingStore): void {
  try {
    localStorage.setItem(getReadingStorageKey(userId), JSON.stringify(store));
  } catch {
    // Ignore localStorage quota or private-mode errors
  }
}

type CheckpointStore = Record<string, Record<string, QuizResult>>;

const CHECKPOINT_STORAGE_PREFIX = 'netpulse_academy_checkpoints_v1';

function getCheckpointStorageKey(userId: string): string {
  return `${CHECKPOINT_STORAGE_PREFIX}:${userId}`;
}

function readCheckpointStore(userId: string): CheckpointStore {
  try {
    const raw = localStorage.getItem(getCheckpointStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCheckpointStore(userId: string, store: CheckpointStore): void {
  try {
    localStorage.setItem(getCheckpointStorageKey(userId), JSON.stringify(store));
  } catch {
    // Ignore localStorage quota or private-mode errors
  }
}

type WatchedVideosStore = Record<string, Record<string, boolean>>;

const WATCHED_VIDEOS_STORAGE_PREFIX = 'netpulse_academy_watched_videos_v1';

function getWatchedVideosStorageKey(userId: string): string {
  return `${WATCHED_VIDEOS_STORAGE_PREFIX}:${userId}`;
}

function readWatchedVideosStore(userId: string): WatchedVideosStore {
  try {
    const raw = localStorage.getItem(getWatchedVideosStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeWatchedVideosStore(userId: string, store: WatchedVideosStore): void {
  try {
    localStorage.setItem(getWatchedVideosStorageKey(userId), JSON.stringify(store));
  } catch {
    // Ignore localStorage quota or private-mode errors
  }
}

export const CoursePlayer: React.FC<CoursePlayerProps> = ({
  courseId,
  onBack,
  onViewCertificates,
  onOpenPricing,
  onOpenCourseCheckout
}) => {
  const {
    courses,
    currentUser,
    completeModule,
    updateStudentQuizAverage,
    enrollInCourse,
    recordStudyTime,
    personalFlashcards,
    savePersonalFlashcard,
    updateCourse,
    updateModuleInCourse
  } = useAcademy();
  const course = courses.find(c => c.id === courseId) || courses[0];
  const canEditCourseContent =
    currentUser.role === 'admin' || currentUser.role === 'instructor';

  const [readingStore, setReadingStore] = useState<ReadingStore>(() =>
    readReadingStore(currentUser.id)
  );

  // Initialize active module to the last module the user was reading in this course (if saved)
  const [activeModuleIndex, setActiveModuleIndex] = useState<number>(() => {
    const store = readReadingStore(currentUser.id);
    const lastModId = store[course.id]?.lastModuleId;
    if (!lastModId) return 0;
    const foundIdx = course.modules.findIndex(m => m.id === lastModId);
    return foundIdx >= 0 ? foundIdx : 0;
  });

  const activeModule = course.modules[activeModuleIndex] || course.modules[0];

  // Multi-Level Curriculum Hierarchy (Level 1 Chapter -> Level 2 Main Contents -> Level 3 Course Contents)
  const hierarchyTree = useMemo(() => resolveCourseHierarchy(course), [course]);
  const activeBreadcrumb = useMemo(
    () => (activeModule ? getModuleSectionBreadcrumb(course, activeModule.id) : null),
    [course, activeModule]
  );

  // Accordion expand/collapse state for Level 1 chapters and Level 2 main contents (collapsed by default)
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [isOutlineSidebarCollapsed, setIsOutlineSidebarCollapsed] = useState<boolean>(false);
  const [isOutlineBodyCollapsed, setIsOutlineBodyCollapsed] = useState<boolean>(false);

  // Reset outline to collapsed by default when switching courses
  useEffect(() => {
    setExpandedChapters({});
    setExpandedSections({});
    setIsOutlineBodyCollapsed(false);
  }, [course.id]);

  const toggleChapterAccordion = (chapterId: string) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapterId]: !prev[chapterId]
    }));
  };

  const toggleSectionAccordion = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const allExpanded =
    hierarchyTree.length > 0 &&
    hierarchyTree.every(
      ch =>
        expandedChapters[ch.id] === true &&
        ch.mainContents.every(mc => expandedSections[mc.id] === true)
    );

  const handleToggleAllHierarchy = () => {
    const nextState = !allExpanded;
    const nextCh: Record<string, boolean> = {};
    const nextSec: Record<string, boolean> = {};
    hierarchyTree.forEach(ch => {
      nextCh[ch.id] = nextState;
      ch.mainContents.forEach(mc => {
        nextSec[mc.id] = nextState;
      });
    });
    setExpandedChapters(nextCh);
    setExpandedSections(nextSec);
  };

  // Player mode: 'study' (module lessons/labs) or 'quiz' (per-module MCQ Quiz Mode)
  const [playerMode, setPlayerMode] = useState<'study' | 'quiz'>('study');
  const [selectedOutlineNode, setSelectedOutlineNode] = useState<
    | { level: 'module' }
    | { level: 'chapter'; chapterId: string }
    | { level: 'section'; chapterId: string; sectionId: string }
  >({ level: 'module' });
  const [openHierarchyEditorOnSelect, setOpenHierarchyEditorOnSelect] = useState<boolean>(false);
  const [openModuleEditorOnSelect, setOpenModuleEditorOnSelect] = useState<boolean>(false);
  const [quizOrigin, setQuizOrigin] = useState<'manual' | 'next-step'>('manual');
  const [checkpointStore, setCheckpointStore] = useState<CheckpointStore>(() =>
    readCheckpointStore(currentUser.id)
  );
  const [watchedVideosStore, setWatchedVideosStore] = useState<WatchedVideosStore>(() =>
    readWatchedVideosStore(currentUser.id)
  );
  const [postQuizModalModuleIndex, setPostQuizModalModuleIndex] = useState<number | null>(null);
  const [instructorMasteryBypass, setInstructorMasteryBypass] = useState<boolean>(false);
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState<boolean>(false);
  const [flashcardSavedToast, setFlashcardSavedToast] = useState<string | null>(null);
  const [liveQuizProgress, setLiveQuizProgress] = useState<{
    quizKey: string;
    answeredCount: number;
    totalCount: number;
    percent: number;
  } | null>(null);

  // Reading scroll progress state
  const moduleContentRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef<boolean>(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const [currentReadingPercent, setCurrentReadingPercent] = useState<number>(() => {
    const store = readReadingStore(currentUser.id);
    const initialMod = course.modules[0];
    if (!initialMod) return 0;
    const targetModId = store[course.id]?.lastModuleId || initialMod.id;
    return store[course.id]?.modules?.[targetModId]?.percent ?? 0;
  });
  const [resumedFromPercent, setResumedFromPercent] = useState<number | null>(null);

  // Reload reading & checkpoint stores if user or courseId changes
  useEffect(() => {
    const freshStore = readReadingStore(currentUser.id);
    setReadingStore(freshStore);
    setCheckpointStore(readCheckpointStore(currentUser.id));
    setWatchedVideosStore(readWatchedVideosStore(currentUser.id));
    setPostQuizModalModuleIndex(null);
    setInstructorMasteryBypass(false);
    setPlayerMode('study');
    setSelectedOutlineNode({ level: 'module' });
    setOpenHierarchyEditorOnSelect(false);
    setOpenModuleEditorOnSelect(false);
    setQuizOrigin('manual');
    setLiveQuizProgress(null);
    const lastModId = freshStore[course.id]?.lastModuleId;
    const foundIdx = lastModId ? course.modules.findIndex(m => m.id === lastModId) : -1;
    setActiveModuleIndex(foundIdx >= 0 ? foundIdx : 0);
  }, [currentUser.id, course.id, course.modules.length]);

  const computeScrollMetrics = useCallback(() => {
    const el = moduleContentRef.current;
    const scrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    const docMaxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );

    if (!el || docMaxScroll <= 0) {
      return {
        scrollY,
        scrollRatio: 0,
        percent: 0
      };
    }

    const rect = el.getBoundingClientRect();
    const elTop = scrollY + rect.top;
    const elBottom = elTop + el.offsetHeight;
    // Start measuring once top of module enters main viewport area, end when bottom reaches viewport bottom
    const startY = Math.max(0, elTop - 100);
    const endY = Math.max(startY + 1, elBottom - window.innerHeight);
    const span = Math.min(docMaxScroll, endY) - startY;

    let ratio = 0;
    if (span > 20) {
      ratio = Math.min(1, Math.max(0, (scrollY - startY) / span));
    } else if (docMaxScroll > 0) {
      ratio = Math.min(1, Math.max(0, scrollY / docMaxScroll));
    }

    return {
      scrollY: Math.round(scrollY),
      scrollRatio: Number(ratio.toFixed(4)),
      percent: Math.round(ratio * 100)
    };
  }, []);

  const persistModuleReading = useCallback(
    (targetCourseId: string, targetModuleId: string, metrics: { scrollY: number; scrollRatio: number; percent: number }) => {
      setReadingStore(prev => {
        const existingCourse = prev[targetCourseId] || {
          lastModuleId: targetModuleId,
          modules: {}
        };
        const updatedCourse: CourseReadingState = {
          lastModuleId: targetModuleId,
          modules: {
            ...existingCourse.modules,
            [targetModuleId]: {
              scrollY: metrics.scrollY,
              scrollRatio: metrics.scrollRatio,
              percent: metrics.percent,
              updatedAt: new Date().toISOString()
            }
          }
        };
        const nextStore: ReadingStore = {
          ...prev,
          [targetCourseId]: updatedCourse
        };
        writeReadingStore(currentUser.id, nextStore);
        return nextStore;
      });
    },
    [currentUser.id]
  );

  // Save active module reference & restore its saved scroll position whenever course or module changes
  useEffect(() => {
    if (!activeModule || playerMode === 'quiz' || selectedOutlineNode.level !== 'module') return;

    isRestoringRef.current = true;
    setResumedFromPercent(null);

    const store = readReadingStore(currentUser.id);
    const courseState = store[course.id];
    const savedProgress = courseState?.modules?.[activeModule.id];

    // Record this module as the most recently opened module for the course
    const nextStore: ReadingStore = {
      ...store,
      [course.id]: {
        lastModuleId: activeModule.id,
        modules: courseState?.modules || {}
      }
    };
    writeReadingStore(currentUser.id, nextStore);
    setReadingStore(nextStore);

    if (savedProgress) {
      setCurrentReadingPercent(savedProgress.percent);
    } else {
      setCurrentReadingPercent(0);
    }

    let releaseTimer: number | null = null;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        const docMaxScroll = Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight
        );

        if (savedProgress && savedProgress.scrollY > 24 && docMaxScroll > 24) {
          let targetScrollY = savedProgress.scrollY;
          const el = moduleContentRef.current;
          if (el && savedProgress.scrollRatio > 0) {
            const currentY = window.scrollY || 0;
            const rect = el.getBoundingClientRect();
            const elTop = currentY + rect.top;
            const elBottom = elTop + el.offsetHeight;
            const startY = Math.max(0, elTop - 100);
            const endY = Math.max(startY + 1, elBottom - window.innerHeight);
            const span = Math.min(docMaxScroll, endY) - startY;
            if (span > 20) {
              const ratioTarget = Math.round(startY + savedProgress.scrollRatio * span);
              targetScrollY = Math.abs(ratioTarget - savedProgress.scrollY) < 160
                ? savedProgress.scrollY
                : ratioTarget;
            }
          }

          const clampedY = Math.min(docMaxScroll, Math.max(0, targetScrollY));
          window.scrollTo({ top: clampedY, behavior: 'auto' });
          if (savedProgress.percent > 0) {
            setResumedFromPercent(savedProgress.percent);
          }
        } else {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }

        releaseTimer = window.setTimeout(() => {
          isRestoringRef.current = false;
        }, 120);
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) {
        window.cancelAnimationFrame(raf2);
      }
      if (releaseTimer !== null) {
        window.clearTimeout(releaseTimer);
      }
      isRestoringRef.current = false;
    };
  }, [course.id, activeModule?.id, currentUser.id, playerMode]);

  // Listen for scroll events on the active module and persist reading progress to localStorage
  useEffect(() => {
    if (!activeModule || playerMode === 'quiz' || selectedOutlineNode.level !== 'module') return;

    let pendingMetrics: { scrollY: number; scrollRatio: number; percent: number } | null = null;

    const writePendingToStorage = () => {
      if (!pendingMetrics) return;
      const metricsToSave = pendingMetrics;
      pendingMetrics = null;
      const current = readReadingStore(currentUser.id);
      const existingCourse = current[course.id] || {
        lastModuleId: activeModule.id,
        modules: {}
      };
      const updatedStore: ReadingStore = {
        ...current,
        [course.id]: {
          lastModuleId: activeModule.id,
          modules: {
            ...existingCourse.modules,
            [activeModule.id]: {
              scrollY: metricsToSave.scrollY,
              scrollRatio: metricsToSave.scrollRatio,
              percent: metricsToSave.percent,
              updatedAt: new Date().toISOString()
            }
          }
        }
      };
      writeReadingStore(currentUser.id, updatedStore);
    };

    const handleScroll = () => {
      if (isRestoringRef.current) return;
      const metrics = computeScrollMetrics();
      pendingMetrics = metrics;
      setCurrentReadingPercent(metrics.percent);

      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        pendingMetrics = null;
        persistModuleReading(course.id, activeModule.id, metrics);
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pagehide', writePendingToStorage);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', writePendingToStorage);
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      writePendingToStorage();
    };
  }, [course.id, activeModule?.id, currentUser.id, playerMode, selectedOutlineNode.level, computeScrollMetrics, persistModuleReading]);

  const flushCurrentModuleProgress = useCallback(() => {
    if (!activeModule || isRestoringRef.current || playerMode === 'quiz' || selectedOutlineNode.level !== 'module') return;
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const metrics = computeScrollMetrics();
    persistModuleReading(course.id, activeModule.id, metrics);
  }, [activeModule, playerMode, selectedOutlineNode.level, course.id, computeScrollMetrics, persistModuleReading]);

  const handleJumpToTop = () => {
    setResumedFromPercent(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isModuleCompleted = (modId: string) => currentUser.completedModuleIds.includes(modId);

  const completedCount = course.modules.filter(m => isModuleCompleted(m.id)).length;
  const progressPercent = Math.round((completedCount / course.modules.length) * 100);
  const isEnrolled = currentUser.enrolledCourseIds.includes(course.id);
  const enrollment = resolveCourseEnrollment(currentUser, course);
  const expiryInfo = enrollment ? getEnrollmentExpirationInfo(enrollment) : null;
  const isStudentPaymentRequired =
    currentUser.role === 'student' &&
    course.price > 0 &&
    (!isEnrolled || expiryInfo?.status === 'expired');
  const isViewingLockedContent =
    isStudentPaymentRequired && activeModuleIndex > 0;

  // Resolve quizzes only for modules that explicitly have one (dedicated quiz modules or checkpoints)
  const moduleQuizzes = useMemo(
    () => course.modules.map((mod, idx) => getModuleQuiz(course, mod, idx)),
    [course]
  );

  const quizzableModuleIndices = useMemo(
    () => moduleQuizzes.map((q, idx) => (q ? idx : -1)).filter(idx => idx >= 0),
    [moduleQuizzes]
  );
  const totalQuizCount = quizzableModuleIndices.length;

  const postVideoQuizzes = useMemo(
    () =>
      course.modules.map((mod, idx) =>
        mod.type === 'video' ? getPostVideoModuleQuiz(course, mod, idx) : null
      ),
    [course]
  );

  // Determine whether any earlier video lecture in this course has an unpassed mastery quiz
  const getBlockingVideoForModule = useCallback(
    (targetIdx: number) => {
      const courseCheckpoints = checkpointStore[course.id] || {};
      for (let i = 0; i < targetIdx; i++) {
        const mod = course.modules[i];
        if (!mod || mod.type !== 'video') continue;
        const vQuiz = postVideoQuizzes[i] || moduleQuizzes[i];
        if (vQuiz && !courseCheckpoints[vQuiz.id]?.passed) {
          return {
            moduleIndex: i,
            module: mod,
            quiz: vQuiz
          };
        }
      }
      return null;
    },
    [checkpointStore, course.id, course.modules, moduleQuizzes, postVideoQuizzes]
  );

  const activeBlockingVideo = useMemo(
    () => getBlockingVideoForModule(activeModuleIndex),
    [activeModuleIndex, getBlockingVideoForModule]
  );

  const isViewingMasteryLocked =
    !isViewingLockedContent &&
    Boolean(activeBlockingVideo) &&
    !(currentUser.role !== 'student' && instructorMasteryBypass);

  const markVideoWatched = useCallback(
    (targetCourseId: string, targetModuleId: string) => {
      setWatchedVideosStore(prev => {
        if (prev[targetCourseId]?.[targetModuleId]) return prev;
        const next: WatchedVideosStore = {
          ...prev,
          [targetCourseId]: {
            ...(prev[targetCourseId] || {}),
            [targetModuleId]: true
          }
        };
        writeWatchedVideosStore(currentUser.id, next);
        return next;
      });
    },
    [currentUser.id]
  );

  const activeModuleQuiz = moduleQuizzes[activeModuleIndex] || null;
  const activeQuizKey =
    activeModule && activeModuleQuiz
      ? `quiz-mode:${course.id}:${activeModule.id}:${activeModuleQuiz.id}`
      : '';

  const handleActiveQuizProgressChange = useCallback(
    (progress: { answeredCount: number; totalCount: number; percent: number }) => {
      if (!activeQuizKey) return;
      setLiveQuizProgress(prev => {
        if (
          prev &&
          prev.quizKey === activeQuizKey &&
          prev.answeredCount === progress.answeredCount &&
          prev.totalCount === progress.totalCount &&
          prev.percent === progress.percent
        ) {
          return prev;
        }
        return {
          quizKey: activeQuizKey,
          answeredCount: progress.answeredCount,
          totalCount: progress.totalCount,
          percent: progress.percent
        };
      });
    },
    [activeQuizKey]
  );

  const activeQuizTotal = activeModuleQuiz?.questions.length ?? 0;
  const activeQuizCompleted =
    liveQuizProgress && liveQuizProgress.quizKey === activeQuizKey
      ? liveQuizProgress.answeredCount
      : 0;
  const activeQuizPercent =
    activeQuizTotal > 0 ? Math.round((activeQuizCompleted / activeQuizTotal) * 100) : 0;

  const isModuleQuizCompleted = useCallback(
    (mod: CourseModule | undefined, idx: number): boolean => {
      if (!mod) return false;
      const quiz = moduleQuizzes[idx];
      if (!quiz) return false;
      if (checkpointStore[course.id]?.[quiz.id]?.passed) return true;
      return mod.type === 'quiz' && currentUser.completedModuleIds.includes(mod.id);
    },
    [checkpointStore, course.id, currentUser.completedModuleIds, moduleQuizzes]
  );

  const quizMastery = useMemo(() => {
    const courseResults = checkpointStore[course.id] || {};
    let passedCount = 0;
    let attemptedCount = 0;
    let scoreSum = 0;

    moduleQuizzes.forEach((quiz, idx) => {
      if (!quiz) return;
      const mod = course.modules[idx];
      const res = courseResults[quiz.id];
      if (res) {
        attemptedCount += 1;
        scoreSum += res.score;
      }
      if (isModuleQuizCompleted(mod, idx)) {
        passedCount += 1;
      }
    });

    const averageScore = attemptedCount > 0 ? Math.round(scoreSum / attemptedCount) : 0;
    return { passedCount, attemptedCount, averageScore };
  }, [checkpointStore, course.id, course.modules, isModuleQuizCompleted, moduleQuizzes]);

  const pendingQuizCount = Math.max(0, totalQuizCount - quizMastery.passedCount);
  const quizProgressPercent =
    totalQuizCount > 0 ? Math.round((quizMastery.passedCount / totalQuizCount) * 100) : 0;

  const saveQuizResult = useCallback(
    (quizId: string, result: QuizResult) => {
      setCheckpointStore(prev => {
        const courseMap = prev[course.id] || {};
        const prevResult = courseMap[quizId];
        // Keep highest score if already passed, otherwise update latest attempt
        const shouldKeepBest =
          prevResult && prevResult.passed && prevResult.score > result.score;
        const storedResult = shouldKeepBest ? prevResult : result;
        const nextCourseMap = {
          ...courseMap,
          [quizId]: storedResult
        };
        const next: CheckpointStore = {
          ...prev,
          [course.id]: nextCourseMap
        };
        writeCheckpointStore(currentUser.id, next);

        // Sync average quiz score into AcademyContext progress analytics
        const scores = moduleQuizzes
          .map(q => (q ? nextCourseMap[q.id]?.score : undefined))
          .filter((s): s is number => typeof s === 'number');
        if (scores.length > 0) {
          const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          updateStudentQuizAverage(course.id, avg);
        }

        return next;
      });
    },
    [course.id, currentUser.id, moduleQuizzes, updateStudentQuizAverage]
  );

  const activeHierarchyChapter = useMemo(() => {
    if (selectedOutlineNode.level === 'module') return null;
    return (
      hierarchyTree.find(ch => ch.id === selectedOutlineNode.chapterId) ||
      hierarchyTree[0] ||
      null
    );
  }, [hierarchyTree, selectedOutlineNode]);

  const activeHierarchySection = useMemo(() => {
    if (selectedOutlineNode.level !== 'section' || !activeHierarchyChapter) return null;
    return (
      activeHierarchyChapter.mainContents.find(
        sec => sec.id === selectedOutlineNode.sectionId
      ) || null
    );
  }, [activeHierarchyChapter, selectedOutlineNode]);

  const activeChapterIdx = activeHierarchyChapter
    ? hierarchyTree.findIndex(ch => ch.id === activeHierarchyChapter.id)
    : -1;
  const previousHierarchyChapter =
    activeChapterIdx > 0 ? hierarchyTree[activeChapterIdx - 1] : null;
  const nextHierarchyChapter =
    activeChapterIdx >= 0 && activeChapterIdx < hierarchyTree.length - 1
      ? hierarchyTree[activeChapterIdx + 1]
      : null;
  const activeSectionIdx =
    activeHierarchyChapter && activeHierarchySection
      ? activeHierarchyChapter.mainContents.findIndex(sec => sec.id === activeHierarchySection.id)
      : -1;
  const nextHierarchySection =
    activeHierarchyChapter &&
    activeSectionIdx >= 0 &&
    activeSectionIdx < activeHierarchyChapter.mainContents.length - 1
      ? {
          chapterId: activeHierarchyChapter.id,
          id: activeHierarchyChapter.mainContents[activeSectionIdx + 1].id,
          sectionNumber: activeHierarchyChapter.mainContents[activeSectionIdx + 1].sectionNumber,
          title: activeHierarchyChapter.mainContents[activeSectionIdx + 1].title
        }
      : null;

  const isViewingHierarchyContent =
    playerMode === 'study' &&
    selectedOutlineNode.level !== 'module' &&
    Boolean(activeHierarchyChapter);

  const handleSelectHierarchyChapter = (chapterId: string, openEditor = false) => {
    flushCurrentModuleProgress();
    setPlayerMode('study');
    setQuizOrigin('manual');
    setExpandedChapters(prev => ({ ...prev, [chapterId]: true }));
    setOpenHierarchyEditorOnSelect(openEditor);
    setSelectedOutlineNode({ level: 'chapter', chapterId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectHierarchySection = (
    chapterId: string,
    sectionId: string,
    openEditor = false
  ) => {
    flushCurrentModuleProgress();
    setPlayerMode('study');
    setQuizOrigin('manual');
    setExpandedChapters(prev => ({ ...prev, [chapterId]: true }));
    setExpandedSections(prev => ({ ...prev, [sectionId]: true }));
    setOpenHierarchyEditorOnSelect(openEditor);
    setSelectedOutlineNode({ level: 'section', chapterId, sectionId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveHierarchyContent = (payload: {
    level: 'chapter' | 'section';
    chapterId: string;
    sectionId?: string;
    title: string;
    summary: string;
    contentMarkdown: string;
  }) => {
    const baseChapters = toChapterConfigFromHierarchy(hierarchyTree);
    let updatedModules = course.modules;
    let savedLabel = payload.title;

    if (payload.level === 'chapter') {
      const targetCh = baseChapters.find(ch => ch.id === payload.chapterId);
      const oldTitle = targetCh?.title;
      const nextChapters = baseChapters.map(ch =>
        ch.id === payload.chapterId
          ? {
              ...ch,
              title: payload.title,
              summary: payload.summary || undefined,
              contentMarkdown: payload.contentMarkdown
            }
          : ch
      );
      if (oldTitle && oldTitle.trim().toLowerCase() !== payload.title.trim().toLowerCase()) {
        updatedModules = course.modules.map(m =>
          (m.chapterTitle || '').trim().toLowerCase() === oldTitle.trim().toLowerCase()
            ? { ...m, chapterTitle: payload.title }
            : m
        );
      }
      updateCourse(course.id, { chapters: nextChapters, modules: updatedModules });
      const chNum =
        hierarchyTree.find(c => c.id === payload.chapterId)?.chapterNumber || '';
      savedLabel = `${chNum ? `${chNum} ` : ''}${payload.title}`;
    } else if (payload.level === 'section' && payload.sectionId) {
      const targetCh = baseChapters.find(ch => ch.id === payload.chapterId);
      const targetSec = targetCh?.mainContents.find(mc => mc.id === payload.sectionId);
      const oldSecTitle = targetSec?.title;
      const nextChapters = baseChapters.map(ch =>
        ch.id === payload.chapterId
          ? {
              ...ch,
              mainContents: ch.mainContents.map(mc =>
                mc.id === payload.sectionId
                  ? {
                      ...mc,
                      title: payload.title,
                      summary: payload.summary || undefined,
                      contentMarkdown: payload.contentMarkdown
                    }
                  : mc
              )
            }
          : ch
      );
      if (
        targetCh &&
        oldSecTitle &&
        oldSecTitle.trim().toLowerCase() !== payload.title.trim().toLowerCase()
      ) {
        updatedModules = course.modules.map(m =>
          (m.chapterTitle || '').trim().toLowerCase() === targetCh.title.trim().toLowerCase() &&
          (m.mainContentTitle || '').trim().toLowerCase() === oldSecTitle.trim().toLowerCase()
            ? { ...m, mainContentTitle: payload.title }
            : m
        );
      }
      updateCourse(course.id, { chapters: nextChapters, modules: updatedModules });
      const secNum =
        hierarchyTree
          .find(c => c.id === payload.chapterId)
          ?.mainContents.find(s => s.id === payload.sectionId)?.sectionNumber || '';
      savedLabel = `${secNum ? `${secNum} ` : ''}${payload.title}`;
    }

    setFlashcardSavedToast(`Saved content for ${savedLabel}`);
    window.setTimeout(() => setFlashcardSavedToast(null), 3200);
  };

  const handleSaveModuleContent = (
    moduleId: string,
    updated: Partial<CourseModule>
  ) => {
    updateModuleInCourse(course.id, moduleId, updated);
    const modIndex = course.modules.findIndex(m => m.id === moduleId);
    const breadcrumb = getModuleSectionBreadcrumb(course, moduleId);
    const itemNum = breadcrumb?.itemNumber || (modIndex >= 0 ? `M${modIndex + 1}` : '');
    const title = updated.title || course.modules[modIndex]?.title || 'Lesson';
    setFlashcardSavedToast(`Saved content for ${itemNum ? `${itemNum} ` : ''}${title}`);
    window.setTimeout(() => setFlashcardSavedToast(null), 3200);
  };

  const handleOpenModuleQuiz = (moduleIndex: number, origin: 'manual' | 'next-step' = 'manual') => {
    if (!moduleQuizzes[moduleIndex]) return;
    flushCurrentModuleProgress();
    setSelectedOutlineNode({ level: 'module' });
    setOpenModuleEditorOnSelect(false);
    setActiveModuleIndex(moduleIndex);
    setQuizOrigin(origin);
    setPlayerMode('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSwitchPlayerMode = (nextMode: 'study' | 'quiz') => {
    if (nextMode === playerMode && selectedOutlineNode.level === 'module') return;
    if (nextMode === 'quiz') {
      if (totalQuizCount === 0) return;
      const targetQuizIndex = moduleQuizzes[activeModuleIndex]
        ? activeModuleIndex
        : quizzableModuleIndices[0];
      if (typeof targetQuizIndex === 'number') {
        handleOpenModuleQuiz(targetQuizIndex, 'manual');
      }
    } else {
      setQuizOrigin('manual');
      setSelectedOutlineNode({ level: 'module' });
      setOpenModuleEditorOnSelect(false);
      setPlayerMode('study');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectModule = (idx: number, openEditor = false) => {
    const wasViewingHierarchy = selectedOutlineNode.level !== 'module';
    flushCurrentModuleProgress();
    const targetMod = course.modules[idx];
    if (targetMod) {
      const targetCrumb = getModuleSectionBreadcrumb(course, targetMod.id);
      if (targetCrumb) {
        setExpandedChapters(prev => ({ ...prev, [targetCrumb.chapterId]: true }));
        setExpandedSections(prev => ({ ...prev, [targetCrumb.mainContentId]: true }));
      }
    }
    setSelectedOutlineNode({ level: 'module' });
    setQuizOrigin('manual');
    if (openEditor && canEditCourseContent) {
      setPlayerMode('study');
      setOpenModuleEditorOnSelect(true);
    } else {
      setOpenModuleEditorOnSelect(false);
    }
    setActiveModuleIndex(idx);
    if (playerMode === 'quiz' || openEditor || wasViewingHierarchy) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextModule = () => {
    if (isStudentPaymentRequired) {
      if (onOpenCourseCheckout) {
        onOpenCourseCheckout(course);
      }
      return;
    }

    if (isViewingMasteryLocked && activeBlockingVideo) {
      setPostQuizModalModuleIndex(activeBlockingVideo.moduleIndex);
      return;
    }

    if (playerMode === 'quiz') {
      if (activeModule.type === 'video' && activeModuleQuiz) {
        const videoPassed = Boolean(checkpointStore[course.id]?.[activeModuleQuiz.id]?.passed);
        if (!videoPassed && !(currentUser.role !== 'student' && instructorMasteryBypass)) {
          setPostQuizModalModuleIndex(activeModuleIndex);
          return;
        }
      }

      if (quizOrigin === 'next-step') {
        const nextIdx = activeModuleIndex + 1;
        if (nextIdx < course.modules.length) {
          setActiveModuleIndex(nextIdx);
          setPlayerMode('study');
          setQuizOrigin('manual');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          setPlayerMode('study');
          setQuizOrigin('manual');
          if (progressPercent === 100) {
            onViewCertificates();
          }
        }
      } else {
        const nextQuizIdx = quizzableModuleIndices.find(idx => idx > activeModuleIndex);
        if (typeof nextQuizIdx === 'number') {
          setActiveModuleIndex(nextQuizIdx);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          setPlayerMode('study');
          setQuizOrigin('manual');
          if (progressPercent === 100) {
            onViewCertificates();
          }
        }
      }
      return;
    }

    flushCurrentModuleProgress();

    // Video lecture mastery gate: only require passing the post-module quiz when one exists
    if (activeModule.type === 'video') {
      const videoQuiz = postVideoQuizzes[activeModuleIndex] || activeModuleQuiz;
      if (videoQuiz) {
        const isVideoMastered = Boolean(checkpointStore[course.id]?.[videoQuiz.id]?.passed);
        if (!isVideoMastered && !(currentUser.role !== 'student' && instructorMasteryBypass)) {
          setPostQuizModalModuleIndex(activeModuleIndex);
          return;
        }
      }

      completeModule(course.id, activeModule.id);
      if (activeModuleIndex < course.modules.length - 1) {
        setActiveModuleIndex(prev => prev + 1);
      } else if (progressPercent === 100) {
        onViewCertificates();
      }
      return;
    }

    completeModule(course.id, activeModule.id);

    if (activeModuleIndex < course.modules.length - 1) {
      const nextModule = course.modules[activeModuleIndex + 1];
      const betweenQuiz = getBetweenModuleQuiz(course, activeModule, nextModule);
      const existingCheckpoint = activeModuleQuiz
        ? checkpointStore[course.id]?.[activeModuleQuiz.id]
        : undefined;

      if (betweenQuiz && !existingCheckpoint?.passed) {
        handleOpenModuleQuiz(activeModuleIndex, 'next-step');
      } else {
        setActiveModuleIndex(prev => prev + 1);
      }
    }
  };

  const handlePrevModule = () => {
    if (playerMode === 'quiz') {
      setPlayerMode('study');
      setQuizOrigin('manual');
      return;
    }

    if (activeModuleIndex > 0) {
      flushCurrentModuleProgress();
      setActiveModuleIndex(prev => prev - 1);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Top Navigation Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              flushCurrentModuleProgress();
              onBack();
            }}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Back to courses"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-blue-600 dark:text-cyan-400 font-bold shrink-0">
                {course.code}
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {course.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Mode Switcher, Progress & Actions */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 shrink-0">
          {/* Segmented Study Mode / Quiz Mode Toggle (Quiz Mode shown when course has quizzes) */}
          {totalQuizCount > 0 && (
            <div
              role="tablist"
              aria-label="Course player mode"
              className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <button
                type="button"
                role="tab"
                aria-selected={playerMode === 'study'}
                onClick={() => handleSwitchPlayerMode('study')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  playerMode === 'study'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Study Mode</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={playerMode === 'quiz'}
                onClick={() => handleSwitchPlayerMode('quiz')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  playerMode === 'quiz'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                <span>Quiz Mode</span>
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    playerMode === 'quiz' ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {quizMastery.passedCount}/{totalQuizCount}
                </span>
              </button>
            </div>
          )}

          {!isViewingLockedContent && (
            <button
              type="button"
              onClick={() => setIsFlashcardModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-cyan-500 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Create a personal flashcard tagged to this course and module"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>Flashcard</span>
              {personalFlashcards.filter(c => c.courseId === course.id).length > 0 && (
                <span className="font-mono text-[10px] tabular-nums text-blue-600 dark:text-cyan-400">
                  ({personalFlashcards.filter(c => c.courseId === course.id).length})
                </span>
              )}
            </button>
          )}

          <div className="w-36 hidden sm:block text-right">
            <div className="flex justify-between text-[11px] font-mono tabular-nums font-bold text-slate-500 mb-1">
              <span>Course</span>
              <span className="text-blue-600 dark:text-cyan-400">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 dark:bg-cyan-400 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {progressPercent === 100 && (
            <button
              onClick={onViewCertificates}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 whitespace-nowrap shrink-0"
            >
              <Award className="w-3.5 h-3.5" />
              <span>View Certificate</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

        {/* Left Column: Collapsible Course Outline Only (no thumbnail) */}
        {!isOutlineSidebarCollapsed && (
          <div className="lg:col-span-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Course Outline Header with Progress Bar & Collapse Toggle */}
            <div className="p-4 bg-emerald-50/90 dark:bg-emerald-950/35 border-b border-emerald-200/70 dark:border-emerald-900/50 space-y-2.5">
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">
                    Course Outline
                  </span>
                  <h3 className="text-[13px] font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                    {course.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOutlineBodyCollapsed(prev => !prev)}
                  aria-expanded={!isOutlineBodyCollapsed}
                  aria-label={isOutlineBodyCollapsed ? 'Expand course outline' : 'Collapse course outline'}
                  title={isOutlineBodyCollapsed ? 'Expand course outline' : 'Collapse course outline'}
                  className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {isOutlineBodyCollapsed ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <div className="space-y-1">
                <div
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Course completion ${progressPercent}%`}
                  className="h-1.5 w-full bg-emerald-200/70 dark:bg-emerald-950 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-emerald-600 dark:bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-600 dark:text-slate-300">
                      {completedCount} / {course.modules.length} done
                    </span>
                    {!isOutlineBodyCollapsed && (
                      <button
                        type="button"
                        onClick={handleToggleAllHierarchy}
                        className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                      >
                        {allExpanded ? 'Collapse all' : 'Expand all'}
                      </button>
                    )}
                  </div>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                    {progressPercent}%
                  </span>
                </div>
              </div>

              {/* Quiz Completion Progress Indicator (Completed vs Pending) */}
              {totalQuizCount > 0 && (
                <div className="pt-2 border-t border-emerald-200/70 dark:border-emerald-900/50 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                      <CheckSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Quizzes</span>
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">
                        {quizMastery.passedCount}/{totalQuizCount} passed
                      </span>
                      <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                        ·
                      </span>
                      <span
                        className={
                          pendingQuizCount === 0
                            ? 'font-bold text-emerald-600 dark:text-emerald-400'
                            : 'font-semibold text-amber-600 dark:text-amber-400'
                        }
                      >
                        {pendingQuizCount === 0 ? 'All done' : `${pendingQuizCount} pending`}
                      </span>
                    </div>
                  </div>

                  {totalQuizCount <= 24 ? (
                    <div
                      role="progressbar"
                      aria-valuenow={quizMastery.passedCount}
                      aria-valuemin={0}
                      aria-valuemax={totalQuizCount}
                      aria-label={`Quiz completion: ${quizMastery.passedCount} of ${totalQuizCount} completed, ${pendingQuizCount} pending`}
                      className="flex items-center gap-1 w-full"
                    >
                      {quizzableModuleIndices.map((qIdx) => {
                        const qMod = course.modules[qIdx];
                        const qCfg = moduleQuizzes[qIdx];
                        if (!qMod || !qCfg) return null;
                        const qPassed = isModuleQuizCompleted(qMod, qIdx);
                        const qResult = checkpointStore[course.id]?.[qCfg.id];
                        const qStatusLabel = qPassed
                          ? `Completed (${qResult?.score ?? 100}%)`
                          : qResult
                          ? `Pending retry (${qResult.score}%)`
                          : 'Pending';

                        return (
                          <button
                            key={`quiz-seg-${qMod.id}`}
                            type="button"
                            onClick={() => handleOpenModuleQuiz(qIdx, 'manual')}
                            title={`${qMod.title} — ${qStatusLabel}`}
                            aria-label={`${qMod.title} quiz: ${qStatusLabel}`}
                            className={`h-1.5 flex-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                              qPassed
                                ? 'bg-emerald-600 dark:bg-emerald-400'
                                : qResult
                                ? 'bg-amber-500 dark:bg-amber-400'
                                : 'bg-amber-200/90 dark:bg-slate-700 hover:bg-amber-400 dark:hover:bg-amber-500'
                            }`}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      role="progressbar"
                      aria-valuenow={quizProgressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Quiz completion ${quizProgressPercent}%`}
                      className="h-1.5 w-full bg-amber-200/70 dark:bg-slate-800 rounded-full overflow-hidden"
                    >
                      <div
                        className="h-full bg-emerald-600 dark:bg-emerald-400 rounded-full transition-all"
                        style={{ width: `${quizProgressPercent}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3-Level Nested Course Outline: 1.0 Chapter -> 1.1 Main Contents -> 1.1.1 Course Contents */}
            {!isOutlineBodyCollapsed && (
              <div className="p-3 space-y-3">
                <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                  {hierarchyTree.map((chapter) => {
                    const isChapterOpen = Boolean(expandedChapters[chapter.id]);
                    const isChapterSelected =
                      playerMode === 'study' &&
                      selectedOutlineNode.level === 'chapter' &&
                      selectedOutlineNode.chapterId === chapter.id;
                    const chapterHasContent = Boolean(chapter.contentMarkdown?.trim());
                    const chapterModules = chapter.mainContents.flatMap(mc => mc.items);
                    const chapterDoneCount = chapterModules.filter(item =>
                      isModuleCompleted(item.module.id)
                    ).length;
                    const chapterTotal = chapterModules.length;
                    const isChapterCompleted = chapterTotal > 0 && chapterDoneCount === chapterTotal;
                    const chapterRatio = chapterTotal > 0 ? chapterDoneCount / chapterTotal : 0;
                    const chapterQuizItems = chapterModules.filter(item =>
                      Boolean(moduleQuizzes[item.flatIndex])
                    );
                    const chapterQuizTotal = chapterQuizItems.length;
                    const chapterQuizPassed = chapterQuizItems.filter(item =>
                      isModuleQuizCompleted(item.module, item.flatIndex)
                    ).length;
                    const chapterQuizPending = chapterQuizTotal - chapterQuizPassed;
                    const ringRadius = 7.5;
                    const ringCircumference = 2 * Math.PI * ringRadius;

                    return (
                      <div key={chapter.id} className="py-1.5 first:pt-0 last:pb-0">
                        {/* Level 1: Chapter Header */}
                        <div
                          className={`group flex items-start justify-between gap-1.5 px-2 py-2 rounded-lg transition-colors ${
                            isChapterOpen || isChapterSelected
                              ? 'bg-emerald-100/75 dark:bg-emerald-900/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleChapterAccordion(chapter.id)}
                            aria-expanded={isChapterOpen}
                            aria-label={isChapterOpen ? `Collapse ${chapter.title}` : `Expand ${chapter.title}`}
                            className="mt-0.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-full"
                          >
                            {isChapterCompleted ? (
                              <span
                                className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs"
                                title="Section completed"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            ) : chapterDoneCount > 0 ? (
                              <svg
                                viewBox="0 0 20 20"
                                className="w-5 h-5 -rotate-90"
                                aria-label={`${chapterDoneCount} of ${chapterTotal} completed`}
                              >
                                <circle
                                  cx="10"
                                  cy="10"
                                  r={ringRadius}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  className="text-emerald-200 dark:text-emerald-900"
                                />
                                <circle
                                  cx="10"
                                  cy="10"
                                  r={ringRadius}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeDasharray={ringCircumference}
                                  strokeDashoffset={ringCircumference * (1 - chapterRatio)}
                                  className="text-emerald-600 dark:text-emerald-400 transition-all"
                                />
                              </svg>
                            ) : (
                              <span className="w-5 h-5 rounded-full border border-emerald-500/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center bg-white dark:bg-slate-900">
                                {isChapterOpen ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleSelectHierarchyChapter(chapter.id, false);
                              if (!isChapterOpen) {
                                toggleChapterAccordion(chapter.id);
                              }
                            }}
                            className="flex-1 min-w-0 text-left"
                            title="Open chapter content"
                          >
                            <span
                              className={`text-[13px] font-bold leading-snug transition-colors block ${
                                isChapterSelected
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : 'text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300'
                              }`}
                            >
                              <span className="tabular-nums mr-1.5">{chapter.chapterNumber}</span>
                              {chapter.title}
                            </span>
                            {chapterQuizTotal > 0 && (
                              <span className="mt-1 flex items-center gap-1.5 text-[10px] font-mono tabular-nums">
                                <span className="inline-flex items-center gap-0.5 shrink-0">
                                  {chapterQuizItems.slice(0, 6).map((qItem) => {
                                    const qPassed = isModuleQuizCompleted(
                                      qItem.module,
                                      qItem.flatIndex
                                    );
                                    return (
                                      <span
                                        key={`ch-qdot-${qItem.module.id}`}
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          qPassed
                                            ? 'bg-emerald-500 dark:bg-emerald-400'
                                            : 'bg-amber-400 dark:bg-amber-500'
                                        }`}
                                      />
                                    );
                                  })}
                                  {chapterQuizTotal > 6 && (
                                    <span className="text-[9px] text-slate-400 ml-0.5">
                                      +{chapterQuizTotal - 6}
                                    </span>
                                  )}
                                </span>
                                <span
                                  className={
                                    chapterQuizPending === 0
                                      ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                                      : 'font-semibold text-amber-700 dark:text-amber-400'
                                  }
                                >
                                  {chapterQuizPassed}/{chapterQuizTotal}{' '}
                                  {chapterQuizTotal === 1 ? 'quiz' : 'quizzes'}{' '}
                                  {chapterQuizPending === 0
                                    ? 'done'
                                    : `· ${chapterQuizPending} pending`}
                                </span>
                              </span>
                            )}
                          </button>

                          <div className="flex items-center gap-1 shrink-0 pt-0.5">
                            {chapterHasContent && (
                              <FileText
                                className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0"
                                aria-label="Chapter has written content"
                              />
                            )}
                            {canEditCourseContent && (
                              <button
                                type="button"
                                onClick={() => handleSelectHierarchyChapter(chapter.id, true)}
                                className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-slate-900 opacity-70 group-hover:opacity-100 transition-opacity"
                                title={`Write or edit content for ${chapter.chapterNumber} ${chapter.title}`}
                                aria-label={`Write content for ${chapter.chapterNumber} ${chapter.title}`}
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            )}
                            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                              {chapterDoneCount} / {chapterTotal}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleChapterAccordion(chapter.id)}
                              aria-expanded={isChapterOpen}
                              aria-label={isChapterOpen ? `Collapse ${chapter.title}` : `Expand ${chapter.title}`}
                              className="p-0.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                            >
                              {isChapterOpen ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Level 2: Main Contents List (indented inside Level 1 Chapter) */}
                        {isChapterOpen && (
                          <div className="mt-1 rounded-lg bg-emerald-50/45 dark:bg-emerald-950/20 py-1.5 px-1.5 space-y-1">
                            {chapter.mainContents.map((section) => {
                              const isSectionOpen = Boolean(expandedSections[section.id]);
                              const isSectionSelected =
                                playerMode === 'study' &&
                                selectedOutlineNode.level === 'section' &&
                                selectedOutlineNode.sectionId === section.id;
                              const sectionHasContent = Boolean(section.contentMarkdown?.trim());
                              const sectionTotal = section.items.length;
                              const sectionDoneCount = section.items.filter(item =>
                                isModuleCompleted(item.module.id)
                              ).length;
                              const isSectionCompleted =
                                sectionTotal > 0 && sectionDoneCount === sectionTotal;
                              const sectionQuizItems = section.items.filter(item =>
                                Boolean(moduleQuizzes[item.flatIndex])
                              );
                              const sectionQuizTotal = sectionQuizItems.length;
                              const sectionQuizPassed = sectionQuizItems.filter(item =>
                                isModuleQuizCompleted(item.module, item.flatIndex)
                              ).length;
                              const sectionQuizPending = sectionQuizTotal - sectionQuizPassed;

                              return (
                                <div key={section.id} className="space-y-1">
                                  {/* Level 2 Subheader */}
                                  <div
                                    className={`group/sec flex items-start justify-between gap-1.5 px-2 py-1.5 rounded-md transition-colors ${
                                      sectionQuizTotal > 0
                                        ? sectionQuizPending === 0
                                          ? 'border-l-2 border-emerald-500 dark:border-emerald-400'
                                          : 'border-l-2 border-amber-400 dark:border-amber-500'
                                        : ''
                                    } ${
                                      isSectionSelected
                                        ? 'bg-white dark:bg-slate-800 shadow-2xs'
                                        : sectionQuizTotal > 0 && sectionQuizPending === 0
                                        ? 'bg-emerald-50/50 dark:bg-emerald-950/25 hover:bg-white/80 dark:hover:bg-slate-800/50'
                                        : 'hover:bg-white/70 dark:hover:bg-slate-800/50'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleSectionAccordion(section.id)}
                                      aria-expanded={isSectionOpen}
                                      aria-label={isSectionOpen ? `Collapse ${section.title}` : `Expand ${section.title}`}
                                      className="mt-0.5 shrink-0"
                                    >
                                      {isSectionCompleted ? (
                                        <span
                                          className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center"
                                          title="Section completed"
                                        >
                                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                                        </span>
                                      ) : sectionDoneCount > 0 ? (
                                        <span
                                          className="w-4 h-4 rounded-full border-2 border-emerald-600 dark:border-emerald-400 bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center"
                                          title={`${sectionDoneCount} of ${sectionTotal} completed`}
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                                        </span>
                                      ) : (
                                        <span className="w-4 h-4 rounded-full border border-emerald-500/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center bg-white dark:bg-slate-900">
                                          {isSectionOpen ? (
                                            <ChevronDown className="w-2.5 h-2.5" />
                                          ) : (
                                            <ChevronRight className="w-2.5 h-2.5" />
                                          )}
                                        </span>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleSelectHierarchySection(chapter.id, section.id, false);
                                        if (!isSectionOpen) {
                                          toggleSectionAccordion(section.id);
                                        }
                                      }}
                                      className="flex-1 min-w-0 text-left"
                                      title="Open section content"
                                    >
                                      <span
                                        className={`text-[12px] font-bold leading-snug transition-colors block ${
                                          isSectionSelected
                                            ? 'text-emerald-700 dark:text-emerald-300'
                                            : 'text-slate-800 dark:text-slate-200 group-hover/sec:text-emerald-700 dark:group-hover/sec:text-emerald-300'
                                        }`}
                                      >
                                        <span className="tabular-nums mr-1.5">{section.sectionNumber}</span>
                                        {section.title}
                                      </span>
                                      {sectionQuizTotal > 0 && (
                                        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-mono tabular-nums">
                                          <span className="inline-flex items-center gap-0.5 shrink-0">
                                            {sectionQuizItems.slice(0, 6).map((qItem) => {
                                              const qPassed = isModuleQuizCompleted(
                                                qItem.module,
                                                qItem.flatIndex
                                              );
                                              return (
                                                <span
                                                  key={`sec-qdot-${qItem.module.id}`}
                                                  className={`w-1.5 h-1.5 rounded-full ${
                                                    qPassed
                                                      ? 'bg-emerald-500 dark:bg-emerald-400'
                                                      : 'bg-amber-400 dark:bg-amber-500'
                                                  }`}
                                                />
                                              );
                                            })}
                                          </span>
                                          <span
                                            className={
                                              sectionQuizPending === 0
                                                ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                                                : 'font-semibold text-amber-700 dark:text-amber-400'
                                            }
                                          >
                                            {sectionQuizPassed}/{sectionQuizTotal}{' '}
                                            {sectionQuizTotal === 1 ? 'quiz' : 'quizzes'}{' '}
                                            {sectionQuizPending === 0
                                              ? 'passed'
                                              : `· ${sectionQuizPending} pending`}
                                          </span>
                                        </span>
                                      )}
                                    </button>

                                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                      {sectionHasContent && (
                                        <FileText
                                          className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0"
                                          aria-label="Section has written content"
                                        />
                                      )}
                                      {canEditCourseContent && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleSelectHierarchySection(chapter.id, section.id, true)
                                          }
                                          className="p-0.5 rounded text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-slate-900 opacity-70 group-hover/sec:opacity-100 transition-opacity"
                                          title={`Write or edit content for ${section.sectionNumber} ${section.title}`}
                                          aria-label={`Write content for ${section.sectionNumber} ${section.title}`}
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                      )}
                                      <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                        {sectionDoneCount}/{sectionTotal}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => toggleSectionAccordion(section.id)}
                                        aria-expanded={isSectionOpen}
                                        aria-label={isSectionOpen ? `Collapse ${section.title}` : `Expand ${section.title}`}
                                        className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                      >
                                        {isSectionOpen ? (
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Level 3: Course Content Items with vertical dashed timeline */}
                                  {isSectionOpen && (
                                    <div className="relative ml-4 pl-3 space-y-0.5 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:border-l before:border-dashed before:border-slate-300 dark:before:border-slate-700">
                                      {section.items.length === 0 ? (
                                        <p className="px-2 py-1 text-[11px] text-slate-400">
                                          No course contents yet.
                                        </p>
                                      ) : (
                                        section.items.map(({ module: m, flatIndex: idx, itemNumber }) => {
                                          const isActive =
                                            playerMode === 'study' &&
                                            selectedOutlineNode.level === 'module' &&
                                            idx === activeModuleIndex;
                                          const isDone = isModuleCompleted(m.id);
                                          const savedModPercent = isActive
                                            ? currentReadingPercent
                                            : readingStore[course.id]?.modules?.[m.id]?.percent ?? 0;

                                          const modQuiz = moduleQuizzes[idx];
                                          const modQuizResult = modQuiz
                                            ? checkpointStore[course.id]?.[modQuiz.id]
                                            : undefined;
                                          const isModQuizPassed = isModuleQuizCompleted(m, idx);
                                          const isDedicatedQuiz = m.type === 'quiz';
                                          const isQuizActive =
                                            playerMode === 'quiz' && idx === activeModuleIndex;
                                          const modBlockingVideo = getBlockingVideoForModule(idx);
                                          const isModMasteryLocked =
                                            Boolean(modBlockingVideo) &&
                                            !(isStudentPaymentRequired && idx > 0) &&
                                            !(currentUser.role !== 'student' && instructorMasteryBypass);

                                          return (
                                            <React.Fragment key={m.id}>
                                              <div
                                                className={`group/mod relative w-full px-2 py-1.5 rounded-lg transition-colors flex items-start gap-1.5 ${
                                                  isDedicatedQuiz && modQuiz
                                                    ? isModQuizPassed
                                                      ? 'border-l-2 border-emerald-500 dark:border-emerald-400'
                                                      : 'border-l-2 border-amber-400 dark:border-amber-500'
                                                    : ''
                                                } ${
                                                  isActive
                                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-2xs'
                                                    : isModMasteryLocked
                                                    ? 'text-slate-400 dark:text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800/40'
                                                    : isDedicatedQuiz && modQuiz && isModQuizPassed
                                                    ? 'bg-emerald-50/45 dark:bg-emerald-950/20 hover:bg-white/80 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200'
                                                    : 'hover:bg-white/70 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                                                }`}
                                              >
                                                <button
                                                  type="button"
                                                  onClick={() => handleSelectModule(idx, false)}
                                                  className="flex-1 min-w-0 text-left flex items-start gap-2.5"
                                                >
                                                  <div className="mt-0.5 shrink-0 relative z-10">
                                                    {isDone || isModQuizPassed ? (
                                                      <span
                                                        className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center"
                                                        aria-label="Completed"
                                                      >
                                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                                      </span>
                                                    ) : isModMasteryLocked ? (
                                                      <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                                        <Lock className="w-2.5 h-2.5" />
                                                      </span>
                                                    ) : isDedicatedQuiz && modQuiz ? (
                                                      <span
                                                        className="w-4 h-4 rounded-full border border-amber-500/80 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center"
                                                        aria-label="Quiz pending"
                                                      >
                                                        <Clock className="w-2.5 h-2.5" />
                                                      </span>
                                                    ) : (
                                                      <span
                                                        className={`w-4 h-4 rounded-full border flex items-center justify-center bg-white dark:bg-slate-900 ${
                                                          isActive
                                                            ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                                                            : 'border-emerald-500/60 text-emerald-600/80 dark:text-emerald-400/80'
                                                        }`}
                                                      >
                                                        <ChevronRight className="w-2.5 h-2.5" />
                                                      </span>
                                                    )}
                                                  </div>

                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] leading-snug">
                                                      <span className="tabular-nums mr-1.5 text-slate-500 dark:text-slate-400">
                                                        {itemNumber}
                                                      </span>
                                                      {m.title}
                                                    </p>
                                                    {isModMasteryLocked && modBlockingVideo ? (
                                                      <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 block mt-0.5">
                                                        Pass M{modBlockingVideo.moduleIndex + 1} quiz to unlock
                                                      </span>
                                                    ) : isDedicatedQuiz && modQuiz ? (
                                                      <span
                                                        className={`text-[10px] font-mono tabular-nums flex items-center gap-1 mt-0.5 ${
                                                          isModQuizPassed
                                                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                                            : 'text-amber-700 dark:text-amber-400 font-semibold'
                                                        }`}
                                                      >
                                                        <span
                                                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                            isModQuizPassed
                                                              ? 'bg-emerald-500 dark:bg-emerald-400'
                                                              : 'bg-amber-500 dark:bg-amber-400'
                                                          }`}
                                                        />
                                                        {isModQuizPassed
                                                          ? `Quiz passed${modQuizResult ? ` · ${modQuizResult.score}%` : ''}`
                                                          : modQuizResult
                                                          ? `Quiz pending · Retry (${modQuizResult.score}%)`
                                                          : `Quiz pending · ${modQuiz.questions.length} Qs`}
                                                      </span>
                                                    ) : !isDone && savedModPercent > 0 ? (
                                                      <span className="text-[10px] font-mono tabular-nums text-emerald-700 dark:text-emerald-400 block mt-0.5">
                                                        {savedModPercent}% read
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                </button>

                                                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                                  {canEditCourseContent && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleSelectModule(idx, true)}
                                                      className="p-0.5 rounded text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-slate-900 opacity-70 group-hover/mod:opacity-100 transition-opacity"
                                                      title={`Edit content for ${itemNumber} ${m.title}`}
                                                      aria-label={`Edit content for ${itemNumber} ${m.title}`}
                                                    >
                                                      <Edit3 className="w-3 h-3" />
                                                    </button>
                                                  )}

                                                  {isStudentPaymentRequired && idx > 0 ? (
                                                    <Lock
                                                      className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                                                      aria-label="Payment required"
                                                    />
                                                  ) : isModMasteryLocked ? (
                                                    <Lock
                                                      className="w-3.5 h-3.5 shrink-0 text-amber-500"
                                                      aria-label="Mastery check required"
                                                    />
                                                  ) : null}
                                                </div>
                                              </div>

                                              {/* Per-Module Quiz Mode Trigger */}
                                              {modQuiz && m.type !== 'quiz' && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (m.type === 'video' && !isModMasteryLocked) {
                                                      setPostQuizModalModuleIndex(idx);
                                                    } else {
                                                      handleOpenModuleQuiz(idx, 'manual');
                                                    }
                                                  }}
                                                  className={`w-full px-2.5 py-1.5 rounded-lg text-left transition-colors flex items-center justify-between gap-2 border ${
                                                    isQuizActive
                                                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-cyan-200 font-semibold'
                                                      : isModQuizPassed
                                                      ? 'bg-emerald-50/75 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50'
                                                      : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/75 dark:border-amber-900/50 text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40'
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    {isModQuizPassed ? (
                                                      <CheckCircle2
                                                        className={`w-3.5 h-3.5 shrink-0 ${
                                                          isQuizActive
                                                            ? 'text-blue-600 dark:text-cyan-400'
                                                            : 'text-emerald-600 dark:text-emerald-400'
                                                        }`}
                                                      />
                                                    ) : (
                                                      <Clock
                                                        className={`w-3.5 h-3.5 shrink-0 ${
                                                          isQuizActive
                                                            ? 'text-blue-600 dark:text-cyan-400'
                                                            : 'text-amber-500 dark:text-amber-400'
                                                        }`}
                                                      />
                                                    )}
                                                    <span className="text-[11px] truncate">
                                                      Module Quiz · {modQuiz.questions.length} Qs
                                                    </span>
                                                  </div>
                                                  <span
                                                    className={`text-[10px] font-mono tabular-nums font-bold shrink-0 ${
                                                      isModQuizPassed
                                                        ? 'text-emerald-700 dark:text-emerald-400'
                                                        : 'text-amber-700 dark:text-amber-400'
                                                    }`}
                                                  >
                                                    {isModQuizPassed
                                                      ? modQuizResult
                                                        ? `${modQuizResult.score}% · Passed`
                                                        : 'Passed'
                                                      : modQuizResult
                                                      ? `${modQuizResult.score}% · Retry`
                                                      : 'Pending'}
                                                  </span>
                                                </button>
                                              )}
                                            </React.Fragment>
                                          );
                                        })
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Enrollment Window or Preview Status */}
                {isEnrolled && enrollment && expiryInfo ? (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2 text-[11px] tabular-nums">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        Enrollment Window
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          expiryInfo.status === 'expired'
                            ? 'text-red-600 dark:text-red-400'
                            : expiryInfo.status === 'expiring_soon'
                            ? 'text-amber-600 dark:text-amber-400'
                            : expiryInfo.status === 'upcoming'
                            ? 'text-blue-600 dark:text-cyan-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {expiryInfo.status === 'expired' ? (
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : expiryInfo.status === 'expiring_soon' ? (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        ) : expiryInfo.status === 'upcoming' ? (
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>{expiryInfo.statusLabel}</span>
                      </span>
                    </div>

                    <div className="space-y-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center justify-between gap-2">
                        <span>Start Date</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">
                          {formatEnrollmentDate(enrollment.startDate)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>End Date</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">
                          {formatEnrollmentDate(enrollment.endDate)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                        <span>Expires</span>
                        <span
                          className={`font-bold ${
                            expiryInfo.status === 'expired'
                              ? 'text-red-600 dark:text-red-400'
                              : expiryInfo.status === 'expiring_soon'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {formatEnrollmentDate(enrollment.expiresAt)} · {expiryInfo.countdownLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : currentUser.role === 'student' && course.price > 0 && onOpenCourseCheckout ? (
                  <div className="p-3.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/35 border border-blue-200 dark:border-blue-800/70 space-y-2.5 text-[11px] text-slate-700 dark:text-slate-300">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">Preview Mode</span>
                      <span className="font-mono font-bold tabular-nums text-blue-700 dark:text-cyan-300">
                        ${course.price}.00 USD
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Module 1 is open for free preview. Complete enrollment payment to unlock all {course.modules.length} modules and labs for {course.defaultAccessDays || DEFAULT_ENROLLMENT_DAYS} days.
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenCourseCheckout(course)}
                      className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pay ${course.price} &amp; Enroll</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                    <p className="font-bold mb-1">Preview Mode</p>
                    <button
                      onClick={() => enrollInCourse(course.id)}
                      className="w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs mt-1"
                    >
                      Enroll Free &amp; Track Progress
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Right Column: Module Learning Workspace */}
        <div
          ref={moduleContentRef}
          className={`${isOutlineSidebarCollapsed ? 'lg:col-span-4' : 'lg:col-span-3'} space-y-4`}
        >
          {/* Workspace Collapse/Expand Outline Strip */}
          <div className="px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setIsOutlineSidebarCollapsed(prev => !prev)}
                aria-expanded={!isOutlineSidebarCollapsed}
                aria-label={
                  isOutlineSidebarCollapsed
                    ? 'Show course outline sidebar'
                    : 'Collapse course outline sidebar'
                }
                title={
                  isOutlineSidebarCollapsed
                    ? 'Show Course Outline'
                    : 'Collapse Course Outline'
                }
                className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-emerald-500 dark:hover:border-emerald-400 text-slate-700 dark:text-slate-200 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {isOutlineSidebarCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                )}
              </button>

              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {isViewingHierarchyContent && activeHierarchyChapter
                  ? activeHierarchySection
                    ? `${activeHierarchySection.sectionNumber} ${activeHierarchySection.title}`
                    : `${activeHierarchyChapter.chapterNumber} ${activeHierarchyChapter.title}`
                  : activeBreadcrumb
                  ? `${activeBreadcrumb.itemNumber} ${activeModule.title}`
                  : activeModule.title}
              </span>
            </div>

            {isOutlineSidebarCollapsed && (
              <span className="text-[11px] font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                {completedCount}/{course.modules.length} ({progressPercent}%)
              </span>
            )}
          </div>
          {/* Course Expiration Notice Banner */}
          {isEnrolled && enrollment && expiryInfo && (expiryInfo.status === 'expiring_soon' || expiryInfo.status === 'expired') && (
            <div
              className={`px-4 py-3 rounded-2xl border shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs ${
                expiryInfo.status === 'expired'
                  ? 'bg-red-50 dark:bg-red-950/35 border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200'
                  : 'bg-amber-50 dark:bg-amber-950/35 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {expiryInfo.status === 'expired' ? (
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <p className="tabular-nums">
                  {expiryInfo.status === 'expired' ? (
                    <>
                      <strong>Course access expired on {formatEnrollmentDate(enrollment.expiresAt)}</strong>{' '}
                      ({expiryInfo.countdownLabel}). Renew your plan or contact an administrator to extend enrollment.
                    </>
                  ) : (
                    <>
                      <strong>Course access expires on {formatEnrollmentDate(enrollment.expiresAt)}</strong>{' '}
                      ({expiryInfo.countdownLabel}). Complete your remaining modules and earn your certificate before the end date.
                    </>
                  )}
                </p>
              </div>

              {(onOpenCourseCheckout && currentUser.role === 'student' && course.price > 0 && expiryInfo.status === 'expired') ? (
                <button
                  type="button"
                  onClick={() => onOpenCourseCheckout(course)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 text-white transition-colors bg-red-600 hover:bg-red-500"
                >
                  Renew Access · ${course.price}
                </button>
              ) : onOpenPricing ? (
                <button
                  type="button"
                  onClick={onOpenPricing}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 text-white transition-colors ${
                    expiryInfo.status === 'expired'
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-amber-600 hover:bg-amber-500'
                  }`}
                >
                  {expiryInfo.status === 'expired' ? 'Renew Access' : 'Extend Plan'}
                </button>
              ) : null}
            </div>
          )}

          {/* Reading Progress & Resume Banner (shown in Study Mode for unlocked Level 3 modules) */}
          {playerMode === 'study' && !isViewingHierarchyContent && !isViewingLockedContent && !isViewingMasteryLocked && (
            <div className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 min-w-0">
                  <BookmarkCheck className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                  {resumedFromPercent !== null ? (
                    <span className="truncate tabular-nums">
                      Resumed <strong className="text-slate-900 dark:text-white">{activeModule.title}</strong> from your last scroll position ({resumedFromPercent}%)
                    </span>
                  ) : (
                    <span className="truncate">
                      Reading progress auto-saved for <strong className="text-slate-900 dark:text-white">{activeModule.title}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[11px] font-bold tabular-nums text-blue-600 dark:text-cyan-400">
                    {currentReadingPercent}% read
                  </span>
                  {resumedFromPercent !== null && (
                    <>
                      <button
                        type="button"
                        onClick={handleJumpToTop}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 whitespace-nowrap"
                      >
                        <ArrowUp className="w-3 h-3" />
                        <span>Top</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setResumedFromPercent(null)}
                        aria-label="Dismiss resume notice"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div
                role="progressbar"
                aria-valuenow={currentReadingPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Module reading progress ${currentReadingPercent}%`}
                className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-[width] duration-150"
                  style={{ width: `${currentReadingPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* First-Level Chapter & Second-Level Section Content Reading / Writing Stage */}
          {isViewingHierarchyContent && activeHierarchyChapter ? (
            <HierarchyContentWorkspace
              courseCode={course.code}
              chapter={activeHierarchyChapter}
              section={activeHierarchySection}
              canEdit={canEditCourseContent}
              startInEditMode={openHierarchyEditorOnSelect}
              onConsumeStartInEditMode={() => setOpenHierarchyEditorOnSelect(false)}
              onSelectChapter={(chapterId, openEditor) =>
                handleSelectHierarchyChapter(chapterId, Boolean(openEditor))
              }
              onSelectSection={(chapterId, sectionId, openEditor) =>
                handleSelectHierarchySection(chapterId, sectionId, Boolean(openEditor))
              }
              onOpenModule={(flatIndex) => handleSelectModule(flatIndex, false)}
              onSaveContent={handleSaveHierarchyContent}
              onBackToActiveModule={() => setSelectedOutlineNode({ level: 'module' })}
              activeModuleTitle={activeModule?.title}
              previousChapter={
                previousHierarchyChapter
                  ? {
                      id: previousHierarchyChapter.id,
                      chapterNumber: previousHierarchyChapter.chapterNumber,
                      title: previousHierarchyChapter.title
                    }
                  : null
              }
              nextChapter={
                nextHierarchyChapter
                  ? {
                      id: nextHierarchyChapter.id,
                      chapterNumber: nextHierarchyChapter.chapterNumber,
                      title: nextHierarchyChapter.title
                    }
                  : null
              }
              nextSection={nextHierarchySection}
            />
          ) : isViewingLockedContent ? (
            <div className="p-6 sm:p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-cyan-400 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>

              <div className="max-w-lg mx-auto space-y-2">
                <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                  {course.code} · {expiryInfo?.status === 'expired' ? 'Enrollment Expired' : 'Full Course Enrollment Required'}
                </p>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {expiryInfo?.status === 'expired'
                    ? `Renew access to continue ${course.title}`
                    : `Unlock Module ${activeModuleIndex + 1} & All Interactive Labs`}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {expiryInfo?.status === 'expired'
                    ? 'Your previous enrollment window has ended. Complete renewal payment to restore full access to all modules, CLI labs, and certificate tracking.'
                    : `Module 1 is included as a free preview. Complete per-course tuition payment to unlock all ${course.modules.length} curriculum modules, retention checkpoints, and official certificate eligibility.`}
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 grid grid-cols-3 gap-3 text-left font-mono text-xs tabular-nums">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Tuition</span>
                  <span className="font-bold text-slate-900 dark:text-white">${course.price}.00</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Access</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {course.defaultAccessDays || DEFAULT_ENROLLMENT_DAYS} Days
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Modules</span>
                  <span className="font-bold text-slate-900 dark:text-white">{course.modules.length} Total</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                {onOpenCourseCheckout && (
                  <button
                    type="button"
                    onClick={() => onOpenCourseCheckout(course)}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>
                      {expiryInfo?.status === 'expired'
                        ? `Renew Access · $${course.price}`
                        : `Complete Payment · $${course.price}`}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setPlayerMode('study');
                    setQuizOrigin('manual');
                    setActiveModuleIndex(0);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
                >
                  Back to Preview Module 1
                </button>
              </div>
            </div>
          ) : isViewingMasteryLocked && activeBlockingVideo ? (
            /* Post-Video Lecture Mastery Gate */
            <div className="p-6 sm:p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>

              <div className="max-w-lg mx-auto space-y-2">
                <p className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-300">
                  Module {activeBlockingVideo.moduleIndex + 1} Mastery Gate · Required Score{' '}
                  {activeBlockingVideo.quiz?.passingScore ?? 75}%+
                </p>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Complete the Post-Lecture Quiz to Unlock Module {activeModuleIndex + 1}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Before advancing to <strong>{activeModule.title}</strong>, verify your understanding of{' '}
                  <strong>{activeBlockingVideo.module.title}</strong> by passing its post-module mastery check.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModuleIndex(activeBlockingVideo.moduleIndex);
                    setPlayerMode('study');
                    setPostQuizModalModuleIndex(activeBlockingVideo.moduleIndex);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Take Module {activeBlockingVideo.moduleIndex + 1} Mastery Quiz</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPlayerMode('study');
                    setQuizOrigin('manual');
                    setActiveModuleIndex(activeBlockingVideo.moduleIndex);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  Rewatch Video Lecture
                </button>

                {currentUser.role !== 'student' && (
                  <button
                    type="button"
                    onClick={() => setInstructorMasteryBypass(true)}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    Instructor Preview Bypass
                  </button>
                )}
              </div>
            </div>
          ) : playerMode === 'quiz' && activeModuleQuiz ? (
            <div className="space-y-4">
              {/* Quiz Mode Mastery Header & Per-Module Selector Strip */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Quiz Mode · Test Your Knowledge by Module
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>
                        Passed <strong className="text-slate-800 dark:text-slate-200">{quizMastery.passedCount}/{totalQuizCount}</strong> {totalQuizCount === 1 ? 'quiz' : 'quizzes'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Average score <strong className="text-blue-600 dark:text-cyan-400">{quizMastery.attemptedCount > 0 ? `${quizMastery.averageScore}%` : '—'}</strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Passing any module quiz marks that module complete</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSwitchPlayerMode('study')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Return to Study Mode</span>
                  </button>
                </div>

                {/* Active Quiz Progress Tracker */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      Active Quiz Progress:{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {activeQuizCompleted} of {activeQuizTotal}
                      </strong>{' '}
                      questions completed
                    </span>
                    <span
                      className={`font-mono text-[11px] font-bold ${
                        activeQuizTotal > 0 && activeQuizCompleted === activeQuizTotal
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-blue-600 dark:text-cyan-400'
                      }`}
                    >
                      {activeQuizPercent}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={activeQuizCompleted}
                    aria-valuemin={0}
                    aria-valuemax={activeQuizTotal}
                    aria-label={`Active module quiz progress: ${activeQuizCompleted} of ${activeQuizTotal} questions completed`}
                    className="h-1.5 w-full bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden"
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${
                        activeQuizTotal > 0 && activeQuizCompleted === activeQuizTotal
                          ? 'bg-emerald-500 dark:bg-emerald-400'
                          : 'bg-gradient-to-r from-blue-600 to-cyan-400'
                      }`}
                      style={{ width: `${activeQuizPercent}%` }}
                    />
                  </div>
                </div>

                {/* Module-by-Module Quiz Switcher (only modules with an actual quiz) */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  {quizzableModuleIndices.map((idx) => {
                    const mod = course.modules[idx];
                    const qConfig = moduleQuizzes[idx];
                    if (!mod || !qConfig) return null;
                    const res = checkpointStore[course.id]?.[qConfig.id];
                    const isSelected = idx === activeModuleIndex;
                    const modBlocked =
                      Boolean(getBlockingVideoForModule(idx)) &&
                      !(currentUser.role !== 'student' && instructorMasteryBypass);
                    const isLocked = (isStudentPaymentRequired && idx > 0) || modBlocked;

                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => handleOpenModuleQuiz(idx, 'manual')}
                        title={mod.title}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono tabular-nums transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-sm'
                            : res?.passed
                            ? 'bg-emerald-50/80 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:border-emerald-400'
                            : res
                            ? 'bg-amber-50/80 dark:bg-amber-950/35 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:border-amber-400'
                            : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-cyan-500'
                        }`}
                      >
                        {isLocked ? (
                          <Lock className="w-3 h-3 shrink-0" />
                        ) : res?.passed ? (
                          <CheckCircle2
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSelected ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          />
                        ) : null}
                        <span>M{idx + 1}</span>
                        {res ? (
                          <span className="opacity-90">· {res.score}%</span>
                        ) : (
                          <span className="opacity-70">· {qConfig.questions.length} Qs</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <InteractiveQuiz
                quizKey={activeQuizKey}
                title={activeModuleQuiz.title}
                subtitle={activeModuleQuiz.subtitle}
                questions={activeModuleQuiz.questions}
                passingScore={activeModuleQuiz.passingScore}
                mode="quiz-mode"
                allowModeToggle={true}
                requirePassToContinue={activeModule.type === 'video'}
                previousModuleTitle={activeModule.title}
                onProgressChange={handleActiveQuizProgressChange}
                nextModuleTitle={(() => {
                  if (quizOrigin === 'next-step') {
                    return activeModuleIndex < course.modules.length - 1
                      ? course.modules[activeModuleIndex + 1]?.title
                      : undefined;
                  }
                  const nextQuizIdx = quizzableModuleIndices.find(idx => idx > activeModuleIndex);
                  return typeof nextQuizIdx === 'number' ? course.modules[nextQuizIdx]?.title : undefined;
                })()}
                continueLabel={(() => {
                  if (quizOrigin === 'next-step' && activeModuleIndex < course.modules.length - 1) {
                    return `Continue to Module ${activeModuleIndex + 2}`;
                  }
                  const nextQuizIdx = quizzableModuleIndices.find(idx => idx > activeModuleIndex);
                  if (typeof nextQuizIdx === 'number') {
                    return `Next: Module ${nextQuizIdx + 1} Quiz`;
                  }
                  return progressPercent === 100
                    ? 'Finish & View Certificate'
                    : 'Return to Study Mode';
                })()}
                previousResult={checkpointStore[course.id]?.[activeModuleQuiz.id] || null}
                allowRetakes={course.gradingCriteria?.allowQuizRetakes ?? true}
                onComplete={(result) => {
                  saveQuizResult(activeModuleQuiz.id, result);
                  recordStudyTime(30, 'course', activeModule.id);
                  if (result.passed && !isStudentPaymentRequired) {
                    completeModule(course.id, activeModule.id);
                  }
                }}
                onContinue={handleNextModule}
                onSkip={
                  quizOrigin === 'next-step' &&
                  activeModule.type !== 'video' &&
                  activeModuleIndex < course.modules.length - 1
                    ? () => {
                        setPlayerMode('study');
                        setQuizOrigin('manual');
                        setActiveModuleIndex(prev => prev + 1);
                      }
                    : undefined
                }
                onBackToModule={() => {
                  setPlayerMode('study');
                  setQuizOrigin('manual');
                }}
              />
            </div>
          ) : (
            <>
              <ModuleContentWorkspace
                courseCode={course.code}
                breadcrumb={activeBreadcrumb}
                module={activeModule}
                moduleIndex={activeModuleIndex}
                canEdit={canEditCourseContent}
                startInEditMode={openModuleEditorOnSelect}
                onConsumeStartInEditMode={() => setOpenModuleEditorOnSelect(false)}
                onSelectChapter={(chapterId) => handleSelectHierarchyChapter(chapterId, false)}
                onSelectSection={(chapterId, sectionId) =>
                  handleSelectHierarchySection(chapterId, sectionId, false)
                }
                onSaveModuleContent={handleSaveModuleContent}
              >
                {/* Video Module with Interactive Player & Automatic Post-Module Mastery Quiz */}
                {activeModule.type === 'video' && (
                  <div className="space-y-4">
                    <VideoLecturePlayer
                      courseId={course.id}
                      module={activeModule}
                      moduleIndex={activeModuleIndex}
                      passingScore={
                        (postVideoQuizzes[activeModuleIndex] || activeModuleQuiz)?.passingScore ?? 75
                      }
                      hasPostQuiz={Boolean(postVideoQuizzes[activeModuleIndex] || activeModuleQuiz)}
                      isQuizPassed={Boolean(
                        (postVideoQuizzes[activeModuleIndex] || activeModuleQuiz) &&
                          checkpointStore[course.id]?.[
                            (postVideoQuizzes[activeModuleIndex] || activeModuleQuiz)!.id
                          ]?.passed
                      )}
                      hasWatchedVideo={Boolean(watchedVideosStore[course.id]?.[activeModule.id])}
                      nextModuleTitle={
                        activeModuleIndex < course.modules.length - 1
                          ? course.modules[activeModuleIndex + 1]?.title
                          : undefined
                      }
                      onLectureCompleted={() => {
                        markVideoWatched(course.id, activeModule.id);
                        if (postVideoQuizzes[activeModuleIndex] || activeModuleQuiz) {
                          setPostQuizModalModuleIndex(activeModuleIndex);
                        } else if (!isStudentPaymentRequired) {
                          completeModule(course.id, activeModule.id);
                        }
                      }}
                      onOpenPostQuiz={() => setPostQuizModalModuleIndex(activeModuleIndex)}
                      onStudyTimeTick={(seconds, modId) => recordStudyTime(seconds, 'course', modId)}
                    />
                    {activeModule.contentMarkdown?.trim() && (
                      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Lesson Companion Notes
                        </h3>
                        <MarkdownProse content={activeModule.contentMarkdown} />
                      </div>
                    )}
                  </div>
                )}

                {/* Lab Module (Cisco IOS Terminal + Topology) */}
                {activeModule.type === 'lab' && (
                  <div className="space-y-4">
                    <InteractiveCliTerminal
                      module={activeModule}
                      courseId={course.id}
                      onCompleted={() => {
                        if (!isStudentPaymentRequired) {
                          completeModule(course.id, activeModule.id);
                        }
                      }}
                    />
                    {activeModule.contentMarkdown?.trim() && (
                      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Lab Notes &amp; Walkthrough
                        </h3>
                        <MarkdownProse content={activeModule.contentMarkdown} />
                      </div>
                    )}
                  </div>
                )}

                {/* Wireshark PCAP Module */}
                {activeModule.type === 'pcap' && (
                  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                        Packet Capture Dissector
                      </h2>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-mono text-[10px] font-bold">
                        Wireshark Packet Dissector
                      </span>
                    </div>

                    {/* Simulated Packet Table */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden font-mono text-[11px]">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          <tr>
                            <th className="p-2">No.</th>
                            <th className="p-2">Time</th>
                            <th className="p-2">Source</th>
                            <th className="p-2">Destination</th>
                            <th className="p-2">Protocol</th>
                            <th className="p-2">Length</th>
                            <th className="p-2">Info</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                          <tr className="bg-blue-50/50 dark:bg-blue-950/20">
                            <td className="p-2">1</td>
                            <td className="p-2">0.000000</td>
                            <td className="p-2">10.0.0.1</td>
                            <td className="p-2">224.0.0.5</td>
                            <td className="p-2 text-cyan-600 dark:text-cyan-400 font-bold">OSPF</td>
                            <td className="p-2">82</td>
                            <td className="p-2 truncate max-w-xs">Hello Packet (Area 0.0.0.0, Priority 1, Dead 40s)</td>
                          </tr>
                          <tr>
                            <td className="p-2">2</td>
                            <td className="p-2">0.142010</td>
                            <td className="p-2">10.0.0.2</td>
                            <td className="p-2">224.0.0.5</td>
                            <td className="p-2 text-cyan-600 dark:text-cyan-400 font-bold">OSPF</td>
                            <td className="p-2">82</td>
                            <td className="p-2 truncate max-w-xs">Hello Packet (Area 0.0.0.0, Priority 1, Dead 40s)</td>
                          </tr>
                          <tr className="bg-emerald-50/50 dark:bg-emerald-950/20">
                            <td className="p-2">3</td>
                            <td className="p-2">0.281944</td>
                            <td className="p-2">10.0.0.1</td>
                            <td className="p-2">10.0.0.2</td>
                            <td className="p-2 text-cyan-600 dark:text-cyan-400 font-bold">OSPF</td>
                            <td className="p-2">66</td>
                            <td className="p-2 truncate max-w-xs">DB Description (Init, More, Master)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {activeModule.contentMarkdown?.trim() && (
                      <MarkdownProse content={activeModule.contentMarkdown} />
                    )}
                  </div>
                )}

                {/* Quiz Module (Powered by InteractiveQuiz with immediate feedback & scoring) */}
                {activeModule.type === 'quiz' && activeModule.quiz && (
                  <div className="space-y-4">
                    {activeModule.contentMarkdown?.trim() && (
                      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Assessment Briefing
                        </h3>
                        <MarkdownProse content={activeModule.contentMarkdown} />
                      </div>
                    )}
                    <InteractiveQuiz
                      quizKey={`${course.id}:${activeModule.id}`}
                      title={activeModule.title}
                      subtitle={activeModule.summary}
                      questions={activeModule.quiz.questions}
                      passingScore={
                        activeModule.quiz.passingScore ||
                        course.gradingCriteria?.quizPassingScore ||
                        75
                      }
                      mode="module"
                      allowModeToggle={true}
                      nextModuleTitle={
                        activeModuleIndex < course.modules.length - 1
                          ? course.modules[activeModuleIndex + 1]?.title
                          : undefined
                      }
                      previousResult={
                        checkpointStore[course.id]?.[`module:${activeModule.id}`] || null
                      }
                      allowRetakes={course.gradingCriteria?.allowQuizRetakes ?? true}
                      onComplete={(result) => {
                        saveQuizResult(`module:${activeModule.id}`, result);
                        if (result.passed && !isStudentPaymentRequired) {
                          completeModule(course.id, activeModule.id);
                        }
                      }}
                      onContinue={
                        activeModuleIndex < course.modules.length - 1
                          ? () => handleNextModule()
                          : undefined
                      }
                    />
                  </div>
                )}
              </ModuleContentWorkspace>

              {/* Post-Module Quiz Mode Callout at Bottom of Every Non-Quiz Module */}
              {activeModule.type !== 'quiz' && activeModuleQuiz && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-cyan-400 shrink-0">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                        <span>{activeModuleQuiz.title}</span>
                        {checkpointStore[course.id]?.[activeModuleQuiz.id] && (
                          <span
                            className={`font-mono text-[11px] tabular-nums ${
                              checkpointStore[course.id][activeModuleQuiz.id].passed
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            · Best {checkpointStore[course.id][activeModuleQuiz.id].score}%
                            {checkpointStore[course.id][activeModuleQuiz.id].passed
                              ? ' (Passed)'
                              : ' (Retry)'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Test your knowledge after Module {activeModuleIndex + 1} with{' '}
                        {activeModuleQuiz.questions.length} multiple-choice questions (Pass{' '}
                        {activeModuleQuiz.passingScore}%).
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (activeModule.type === 'video') {
                        setPostQuizModalModuleIndex(activeModuleIndex);
                      } else {
                        handleOpenModuleQuiz(activeModuleIndex, 'manual');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 dark:border-cyan-800 bg-white dark:bg-slate-800 text-xs font-semibold text-blue-700 dark:text-cyan-300 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors duration-150 motion-reduce:transition-none whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>
                      {checkpointStore[course.id]?.[activeModuleQuiz.id]
                        ? 'Retake Post-Module Quiz'
                        : activeModule.type === 'video'
                        ? 'Start Post-Lecture Quiz'
                        : 'Test in Quiz Mode'}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Bottom Next/Previous Step Bar (only shown for Level 3 Module views) */}
          {!isViewingHierarchyContent && !isViewingLockedContent && !isViewingMasteryLocked && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePrevModule}
                disabled={activeModuleIndex === 0 && playerMode === 'study'}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>
                  {playerMode === 'quiz'
                    ? `Back to Module ${activeModuleIndex + 1} Study`
                    : 'Previous Module'}
                </span>
              </button>

              <div className="flex items-center gap-2">
                {playerMode === 'study' && activeModule.type !== 'quiz' && activeModuleQuiz && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeModule.type === 'video') {
                        setPostQuizModalModuleIndex(activeModuleIndex);
                      } else {
                        handleOpenModuleQuiz(activeModuleIndex, 'manual');
                      }
                    }}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                    <span>{activeModule.type === 'video' ? 'Mastery Quiz' : 'Module Quiz'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNextModule}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span>
                    {isStudentPaymentRequired
                      ? `Pay $${course.price} & Unlock Next Modules`
                      : playerMode === 'quiz'
                      ? quizOrigin === 'next-step' && activeModuleIndex < course.modules.length - 1
                        ? `Proceed to Module ${activeModuleIndex + 2}`
                        : (() => {
                            const nextQuizIdx = quizzableModuleIndices.find(
                              idx => idx > activeModuleIndex
                            );
                            if (typeof nextQuizIdx === 'number') {
                              return `Next: Module ${nextQuizIdx + 1} Quiz`;
                            }
                            return progressPercent === 100
                              ? 'Finish & View Certificate'
                              : 'Return to Study Mode';
                          })()
                      : activeModule.type === 'video' &&
                        Boolean(postVideoQuizzes[activeModuleIndex] || activeModuleQuiz) &&
                        !checkpointStore[course.id]?.[
                          (postVideoQuizzes[activeModuleIndex] || activeModuleQuiz)!.id
                        ]?.passed
                      ? 'Take Quiz to Unlock Next'
                      : activeModuleIndex === course.modules.length - 1
                      ? 'Finish & Generate Certificate'
                      : 'Complete & Next Module'}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Automatic Post-Module Mastery Quiz Overlay */}
      {postQuizModalModuleIndex !== null &&
        course.modules[postQuizModalModuleIndex] &&
        course.modules[postQuizModalModuleIndex].type === 'video' &&
        (postVideoQuizzes[postQuizModalModuleIndex] || moduleQuizzes[postQuizModalModuleIndex]) && (
          <PostModuleQuiz
            courseId={course.id}
            videoModule={course.modules[postQuizModalModuleIndex]}
            moduleIndex={postQuizModalModuleIndex}
            totalModules={course.modules.length}
            quiz={(postVideoQuizzes[postQuizModalModuleIndex] || moduleQuizzes[postQuizModalModuleIndex])!}
            nextModule={
              postQuizModalModuleIndex < course.modules.length - 1
                ? course.modules[postQuizModalModuleIndex + 1]
                : undefined
            }
            previousResult={
              checkpointStore[course.id]?.[
                (postVideoQuizzes[postQuizModalModuleIndex] || moduleQuizzes[postQuizModalModuleIndex])!.id
              ] || null
            }
            allowRetakes={course.gradingCriteria?.allowQuizRetakes ?? true}
            onComplete={(result) => {
              const targetModule = course.modules[postQuizModalModuleIndex];
              const targetQuiz =
                postVideoQuizzes[postQuizModalModuleIndex] || moduleQuizzes[postQuizModalModuleIndex];
              if (targetQuiz) {
                saveQuizResult(targetQuiz.id, result);
              }
              recordStudyTime(30, 'course', targetModule.id);
              if (result.passed && !isStudentPaymentRequired) {
                completeModule(course.id, targetModule.id);
              }
            }}
            onUnlockAndContinue={() => {
              const completedIdx = postQuizModalModuleIndex;
              setPostQuizModalModuleIndex(null);
              if (completedIdx < course.modules.length - 1) {
                setPlayerMode('study');
                setQuizOrigin('manual');
                setActiveModuleIndex(completedIdx + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else if (progressPercent === 100) {
                onViewCertificates();
              }
            }}
            onClose={() => setPostQuizModalModuleIndex(null)}
          />
        )}

      {/* Quick Course-Tagged Flashcard Toast */}
      {flashcardSavedToast && (
        <div className="fixed bottom-5 right-5 z-40 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 shadow-xl flex items-center gap-2 text-xs font-semibold">
          <SquareStack className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{flashcardSavedToast}</span>
        </div>
      )}

      {/* Quick Personal Flashcard Creation Modal (Pre-tagged to Active Course & Module) */}
      <PersonalFlashcardModal
        isOpen={isFlashcardModalOpen}
        courses={courses}
        defaultCourseId={course.id}
        defaultModuleId={activeModule?.id}
        onSave={(input) => {
          const saved = savePersonalFlashcard(input);
          setFlashcardSavedToast(`Saved "${saved.term}" to ${course.code} flashcards`);
          window.setTimeout(() => setFlashcardSavedToast(null), 3200);
        }}
        onClose={() => setIsFlashcardModalOpen(false)}
      />
    </div>
  );
};
