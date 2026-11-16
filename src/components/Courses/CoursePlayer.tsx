import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  Play,
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
  Layers,
  FileText,
  Mouse,
  Clapperboard,
  SquarePen,
  Activity,
  ChevronUp
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { Course } from '../../types';
import { InteractiveCliTerminal } from '../Lab/InteractiveCliTerminal';
import { CourseThumbnail } from './CourseThumbnail';
import { InteractiveQuiz, QuizResult } from './InteractiveQuiz';
import { getBetweenModuleQuiz } from '../../data/checkpointQuizzes';
import {
  resolveCourseHierarchy,
  getModuleSectionBreadcrumb
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

export const CoursePlayer: React.FC<CoursePlayerProps> = ({
  courseId,
  onBack,
  onViewCertificates,
  onOpenPricing,
  onOpenCourseCheckout
}) => {
  const { courses, currentUser, completeModule, enrollInCourse } = useAcademy();
  const course = courses.find(c => c.id === courseId) || courses[0];

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

  // Accordion expand/collapse state for Level 1 chapters and Level 2 main contents
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!activeBreadcrumb) return;
    setExpandedChapters(prev =>
      prev[activeBreadcrumb.chapterId] === false
        ? { ...prev, [activeBreadcrumb.chapterId]: true }
        : prev
    );
    setExpandedSections(prev =>
      prev[activeBreadcrumb.mainContentId] === false
        ? { ...prev, [activeBreadcrumb.mainContentId]: true }
        : prev
    );
  }, [activeBreadcrumb?.chapterId, activeBreadcrumb?.mainContentId]);

  const toggleChapterAccordion = (chapterId: string) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapterId]: prev[chapterId] === false
    }));
  };

  const toggleSectionAccordion = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: prev[sectionId] === false
    }));
  };

  const allExpanded = hierarchyTree.every(
    ch =>
      expandedChapters[ch.id] !== false &&
      ch.mainContents.every(mc => expandedSections[mc.id] !== false)
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

  // Between-module checkpoint state (null = viewing module, number = checkpoint after module index)
  const [activeCheckpointAfterIndex, setActiveCheckpointAfterIndex] = useState<number | null>(null);
  const [checkpointStore, setCheckpointStore] = useState<CheckpointStore>(() =>
    readCheckpointStore(currentUser.id)
  );

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
    setActiveCheckpointAfterIndex(null);
    const lastModId = freshStore[course.id]?.lastModuleId;
    const foundIdx = lastModId ? course.modules.findIndex(m => m.id === lastModId) : -1;
    setActiveModuleIndex(foundIdx >= 0 ? foundIdx : 0);
  }, [currentUser.id, course.id, course.modules]);

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
    if (!activeModule || activeCheckpointAfterIndex !== null) return;

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
  }, [course.id, activeModule?.id, currentUser.id, activeCheckpointAfterIndex]);

  // Listen for scroll events on the active module and persist reading progress to localStorage
  useEffect(() => {
    if (!activeModule || activeCheckpointAfterIndex !== null) return;

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
  }, [course.id, activeModule?.id, currentUser.id, activeCheckpointAfterIndex, computeScrollMetrics, persistModuleReading]);

  const flushCurrentModuleProgress = useCallback(() => {
    if (!activeModule || isRestoringRef.current || activeCheckpointAfterIndex !== null) return;
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const metrics = computeScrollMetrics();
    persistModuleReading(course.id, activeModule.id, metrics);
  }, [activeModule, activeCheckpointAfterIndex, course.id, computeScrollMetrics, persistModuleReading]);

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
    isStudentPaymentRequired && (activeModuleIndex > 0 || activeCheckpointAfterIndex !== null);

  const activeCheckpointQuiz =
    activeCheckpointAfterIndex !== null
      ? getBetweenModuleQuiz(
          course,
          course.modules[activeCheckpointAfterIndex],
          course.modules[activeCheckpointAfterIndex + 1]
        )
      : null;

  const currentModuleCheckpointQuiz =
    activeCheckpointAfterIndex === null && activeModuleIndex < course.modules.length - 1
      ? getBetweenModuleQuiz(
          course,
          activeModule,
          course.modules[activeModuleIndex + 1]
        )
      : null;

  const saveQuizResult = useCallback(
    (quizId: string, result: QuizResult) => {
      setCheckpointStore(prev => {
        const courseMap = prev[course.id] || {};
        const prevResult = courseMap[quizId];
        // Keep highest score if already passed, otherwise update latest attempt
        const shouldKeepBest =
          prevResult && prevResult.passed && prevResult.score > result.score;
        const storedResult = shouldKeepBest ? prevResult : result;
        const next: CheckpointStore = {
          ...prev,
          [course.id]: {
            ...courseMap,
            [quizId]: storedResult
          }
        };
        writeCheckpointStore(currentUser.id, next);
        return next;
      });
    },
    [course.id, currentUser.id]
  );

  const handleOpenCheckpoint = (afterIndex: number) => {
    flushCurrentModuleProgress();
    setActiveModuleIndex(afterIndex);
    setActiveCheckpointAfterIndex(afterIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectModule = (idx: number) => {
    flushCurrentModuleProgress();
    setActiveCheckpointAfterIndex(null);
    setActiveModuleIndex(idx);
  };

  const handleNextModule = () => {
    if (isStudentPaymentRequired) {
      if (onOpenCourseCheckout) {
        onOpenCourseCheckout(course);
      }
      return;
    }

    if (activeCheckpointAfterIndex !== null) {
      const nextIdx = activeCheckpointAfterIndex + 1;
      setActiveCheckpointAfterIndex(null);
      if (nextIdx < course.modules.length) {
        setActiveModuleIndex(nextIdx);
      }
      return;
    }

    flushCurrentModuleProgress();
    completeModule(course.id, activeModule.id);

    if (activeModuleIndex < course.modules.length - 1) {
      const nextModule = course.modules[activeModuleIndex + 1];
      const betweenQuiz = getBetweenModuleQuiz(course, activeModule, nextModule);
      const existingCheckpoint = betweenQuiz
        ? checkpointStore[course.id]?.[betweenQuiz.id]
        : undefined;

      if (betweenQuiz && !existingCheckpoint?.passed) {
        setActiveCheckpointAfterIndex(activeModuleIndex);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setActiveModuleIndex(prev => prev + 1);
      }
    }
  };

  const handlePrevModule = () => {
    if (activeCheckpointAfterIndex !== null) {
      setActiveModuleIndex(activeCheckpointAfterIndex);
      setActiveCheckpointAfterIndex(null);
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
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              flushCurrentModuleProgress();
              onBack();
            }}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors shrink-0"
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
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
              {activeCheckpointAfterIndex !== null && activeCheckpointQuiz
                ? `Knowledge Retention Check · Between Module ${activeCheckpointAfterIndex + 1} & Module ${activeCheckpointAfterIndex + 2}`
                : activeBreadcrumb
                ? `${activeBreadcrumb.chapterNumber} ${activeBreadcrumb.chapterTitle} › ${activeBreadcrumb.sectionNumber} ${activeBreadcrumb.mainContentTitle} › ${activeBreadcrumb.itemNumber} ${activeModule.title} · Scroll ${currentReadingPercent}%`
                : `Module ${activeModuleIndex + 1} of ${course.modules.length}: ${activeModule.title} · Scroll ${currentReadingPercent}%`}
            </p>
          </div>
        </div>

        {/* Progress & Actions */}
        <div className="flex items-center gap-4 shrink-0">
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

        {/* Left Column: Syllabus Navigation */}
        <div className="lg:col-span-1 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          {/* Course Thumbnail Mini Card */}
          <CourseThumbnail
            course={course}
            className="aspect-video rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between gap-2 z-10 text-[10px] font-mono">
              <span className="text-cyan-300 font-bold">{course.code}</span>
              <span className="text-slate-200">{course.level}</span>
            </div>
          </CourseThumbnail>

          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 min-w-0">
              <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                Course Outline
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {completedCount}/{course.modules.length}
              </span>
              <button
                type="button"
                onClick={handleToggleAllHierarchy}
                className="text-[10px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline whitespace-nowrap"
              >
                {allExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>

          {/* 3-Level Nested Course Outline: 1.0 Chapter -> 1.1 Main Contents -> 1.1.1 Course Contents */}
          <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
            {hierarchyTree.map((chapter) => {
              const isChapterOpen = expandedChapters[chapter.id] !== false;
              const chapterModules = chapter.mainContents.flatMap(mc => mc.items);
              const chapterDoneCount = chapterModules.filter(item =>
                isModuleCompleted(item.module.id)
              ).length;

              return (
                <div key={chapter.id} className="py-2.5 first:pt-1 last:pb-1">
                  {/* Level 1: Chapter Header (e.g. "1.0 Chapter Title   ^") */}
                  <button
                    type="button"
                    onClick={() => toggleChapterAccordion(chapter.id)}
                    aria-expanded={isChapterOpen}
                    className="w-full py-1.5 text-left flex items-center justify-between gap-2 group"
                  >
                    <span className="text-[13px] font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-cyan-400 leading-snug transition-colors">
                      <span className="tabular-nums mr-1.5">{chapter.chapterNumber}</span>
                      {chapter.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono tabular-nums text-slate-400">
                        {chapterDoneCount}/{chapterModules.length}
                      </span>
                      {isChapterOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Level 2: Main Contents List */}
                  {isChapterOpen && (
                    <div className="mt-1 space-y-2">
                      {chapter.mainContents.map((section) => {
                        const isSectionOpen = expandedSections[section.id] !== false;

                        return (
                          <div key={section.id} className="space-y-1">
                            {/* Level 2 Subheader (e.g. "1.1 Section Title") */}
                            <button
                              type="button"
                              onClick={() => toggleSectionAccordion(section.id)}
                              aria-expanded={isSectionOpen}
                              className="w-full pl-2.5 pr-1 py-1 text-left flex items-center justify-between gap-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 leading-snug">
                                <span className="tabular-nums mr-1.5">{section.sectionNumber}</span>
                                {section.title}
                              </span>
                              {isSectionOpen ? (
                                <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                            </button>

                            {/* Level 3: Course Content Items (e.g. "1.1.1 Steps of Data Profiling") */}
                            {isSectionOpen && (
                              <div className="pl-6 space-y-0.5">
                                {section.items.length === 0 ? (
                                  <p className="px-2 py-1 text-[11px] text-slate-400">
                                    No course contents yet.
                                  </p>
                                ) : (
                                  section.items.map(({ module: m, flatIndex: idx, itemNumber }) => {
                                    const isActive =
                                      activeCheckpointAfterIndex === null && idx === activeModuleIndex;
                                    const isDone = isModuleCompleted(m.id);
                                    const savedModPercent = isActive
                                      ? currentReadingPercent
                                      : readingStore[course.id]?.modules?.[m.id]?.percent ?? 0;

                                    const nextMod =
                                      idx < course.modules.length - 1
                                        ? course.modules[idx + 1]
                                        : undefined;
                                    const betweenQuiz = nextMod
                                      ? getBetweenModuleQuiz(course, m, nextMod)
                                      : null;
                                    const checkpointResult = betweenQuiz
                                      ? checkpointStore[course.id]?.[betweenQuiz.id]
                                      : undefined;
                                    const isCheckpointActive = activeCheckpointAfterIndex === idx;

                                    const ModTypeIcon =
                                      m.type === 'lab'
                                        ? Mouse
                                        : m.type === 'video'
                                        ? Clapperboard
                                        : m.type === 'quiz'
                                        ? SquarePen
                                        : m.type === 'pcap'
                                        ? Activity
                                        : FileText;

                                    return (
                                      <React.Fragment key={m.id}>
                                        <button
                                          type="button"
                                          onClick={() => handleSelectModule(idx)}
                                          className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors flex items-start gap-2.5 ${
                                            isActive
                                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                                          }`}
                                        >
                                          <div className="mt-0.5 shrink-0">
                                            {isDone ? (
                                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                              <ModTypeIcon
                                                className={`w-4 h-4 ${
                                                  isActive
                                                    ? 'text-slate-900 dark:text-white'
                                                    : 'text-slate-500 dark:text-slate-400'
                                                }`}
                                              />
                                            )}
                                          </div>

                                          <div className="flex-1 min-w-0">
                                            <p className="text-[12px] leading-snug">
                                              <span className="tabular-nums mr-1.5 text-slate-500 dark:text-slate-400">
                                                {itemNumber}
                                              </span>
                                              {m.title}
                                            </p>
                                            {!isDone && savedModPercent > 0 && (
                                              <span className="text-[10px] font-mono tabular-nums text-blue-600 dark:text-cyan-400 block mt-0.5">
                                                {savedModPercent}% read
                                              </span>
                                            )}
                                          </div>

                                          {isStudentPaymentRequired && idx > 0 && (
                                            <Lock
                                              className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400 dark:text-slate-500"
                                              aria-label="Payment required"
                                            />
                                          )}
                                        </button>

                                        {/* Injected Between-Module Retention Checkpoint Trigger */}
                                        {betweenQuiz && (
                                          <button
                                            type="button"
                                            onClick={() => handleOpenCheckpoint(idx)}
                                            className={`w-full px-2.5 py-1.5 rounded-lg text-left transition-colors flex items-center justify-between gap-2 ${
                                              isCheckpointActive
                                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-cyan-200 font-semibold'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 min-w-0">
                                              <CheckSquare
                                                className={`w-3.5 h-3.5 shrink-0 ${
                                                  checkpointResult?.passed
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : isCheckpointActive
                                                    ? 'text-blue-600 dark:text-cyan-400'
                                                    : 'text-slate-400'
                                                }`}
                                              />
                                              <span className="text-[11px] truncate">
                                                Retention Check · {betweenQuiz.questions.length} Qs
                                              </span>
                                            </div>
                                            {checkpointResult && (
                                              <span
                                                className={`text-[10px] font-mono tabular-nums font-bold shrink-0 ${
                                                  checkpointResult.passed
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : 'text-amber-600 dark:text-amber-400'
                                                }`}
                                              >
                                                {checkpointResult.score}%
                                              </span>
                                            )}
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

        {/* Right Column: Module Learning Workspace */}
        <div ref={moduleContentRef} className="lg:col-span-3 space-y-4">
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

          {/* Reading Progress & Resume Banner (hidden when in between-module checkpoint quiz or locked preview) */}
          {activeCheckpointAfterIndex === null && !isViewingLockedContent && (
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

          {/* Locked Curriculum Payment Gate for Student Mode */}
          {isViewingLockedContent ? (
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
                    setActiveCheckpointAfterIndex(null);
                    setActiveModuleIndex(0);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
                >
                  Back to Preview Module 1
                </button>
              </div>
            </div>
          ) : activeCheckpointAfterIndex !== null && activeCheckpointQuiz ? (
            <InteractiveQuiz
              quizKey={activeCheckpointQuiz.id}
              title={activeCheckpointQuiz.title}
              subtitle={activeCheckpointQuiz.subtitle}
              questions={activeCheckpointQuiz.questions}
              passingScore={
                course.modules[activeCheckpointAfterIndex]?.checkpointQuiz?.passingScore ??
                course.gradingCriteria?.quizPassingScore ??
                activeCheckpointQuiz.passingScore
              }
              mode="checkpoint"
              previousModuleTitle={course.modules[activeCheckpointAfterIndex]?.title}
              nextModuleTitle={course.modules[activeCheckpointAfterIndex + 1]?.title}
              previousResult={checkpointStore[course.id]?.[activeCheckpointQuiz.id] || null}
              allowRetakes={course.gradingCriteria?.allowQuizRetakes ?? true}
              onComplete={(result) => {
                saveQuizResult(activeCheckpointQuiz.id, result);
              }}
              onContinue={() => {
                const targetIdx = activeCheckpointAfterIndex + 1;
                setActiveCheckpointAfterIndex(null);
                if (targetIdx < course.modules.length) {
                  setActiveModuleIndex(targetIdx);
                }
              }}
              onSkip={() => {
                const targetIdx = activeCheckpointAfterIndex + 1;
                setActiveCheckpointAfterIndex(null);
                if (targetIdx < course.modules.length) {
                  setActiveModuleIndex(targetIdx);
                }
              }}
              onBackToModule={() => {
                setActiveModuleIndex(activeCheckpointAfterIndex);
                setActiveCheckpointAfterIndex(null);
              }}
            />
          ) : (
            <>
              {/* Theory Module */}
              {activeModule.type === 'theory' && (
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {activeModule.title}
              </h1>

              <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-sans whitespace-pre-wrap">
                {activeModule.contentMarkdown}
              </div>
            </div>
          )}

          {/* Video Module */}
          {activeModule.type === 'video' && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {activeModule.title}
              </h1>

              {/* Video Player Frame */}
              <div className="relative aspect-video w-full rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                <div className="text-center p-6 space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-blue-600/80 hover:bg-blue-600 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-blue-500/30 transition-transform hover:scale-105">
                    <Play className="w-8 h-8 ml-1" />
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    Video Walkthrough • Duration: {activeModule.videoDuration || '22:15'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    High-Definition 1080p60 • Stream Encrypted
                  </p>
                </div>
              </div>

              {activeModule.contentMarkdown && (
                <div className="text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                  {activeModule.contentMarkdown}
                </div>
              )}
            </div>
          )}

          {/* Lab Module (Cisco IOS Terminal + Topology) */}
          {activeModule.type === 'lab' && (
            <InteractiveCliTerminal
              module={activeModule}
              courseId={course.id}
              onCompleted={() => {
                if (!isStudentPaymentRequired) {
                  completeModule(course.id, activeModule.id);
                }
              }}
            />
          )}

          {/* Wireshark PCAP Module */}
          {activeModule.type === 'pcap' && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {activeModule.title}
                </h1>
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

              <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {activeModule.contentMarkdown}
              </div>
            </div>
          )}

              {/* Quiz Module (Powered by InteractiveQuiz with immediate feedback & scoring) */}
              {activeModule.type === 'quiz' && activeModule.quiz && (
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
              )}

              {/* Quick Between-Module Retention Prompt at Bottom of Module */}
              {currentModuleCheckpointQuiz && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-cyan-400 shrink-0">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                        <span>{currentModuleCheckpointQuiz.title}</span>
                        {checkpointStore[course.id]?.[currentModuleCheckpointQuiz.id] && (
                          <span
                            className={`font-mono text-[11px] tabular-nums ${
                              checkpointStore[course.id][currentModuleCheckpointQuiz.id].passed
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            · Best {checkpointStore[course.id][currentModuleCheckpointQuiz.id].score}%
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {currentModuleCheckpointQuiz.questions.length} quick questions with instant feedback before Module {activeModuleIndex + 2}.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenCheckpoint(activeModuleIndex)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 dark:border-cyan-800 bg-white dark:bg-slate-800 text-xs font-semibold text-blue-700 dark:text-cyan-300 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors duration-150 motion-reduce:transition-none whitespace-nowrap shrink-0"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>
                      {checkpointStore[course.id]?.[currentModuleCheckpointQuiz.id]
                        ? 'Retake Retention Check'
                        : 'Take Retention Check'}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Bottom Next/Previous Step Bar */}
          {!isViewingLockedContent && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
              <button
                onClick={handlePrevModule}
                disabled={activeModuleIndex === 0 && activeCheckpointAfterIndex === null}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>
                  {activeCheckpointAfterIndex !== null
                    ? `Back to Module ${activeCheckpointAfterIndex + 1}`
                    : 'Previous Module'}
                </span>
              </button>

              <button
                onClick={handleNextModule}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all whitespace-nowrap shrink-0"
              >
                <span>
                  {isStudentPaymentRequired
                    ? `Pay $${course.price} & Unlock Next Modules`
                    : activeCheckpointAfterIndex !== null
                    ? `Proceed to Module ${activeCheckpointAfterIndex + 2}`
                    : activeModuleIndex === course.modules.length - 1
                    ? 'Finish & Generate Certificate'
                    : 'Complete & Next Module'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
