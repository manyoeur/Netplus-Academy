import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  GripVertical,
  Plus,
  CheckSquare,
  HelpCircle,
  FileText,
  Terminal,
  Video,
  Activity,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Save,
  Edit3,
  Award,
  Layers,
  FolderPlus,
  ChevronRight,
  Mouse,
  Clapperboard,
  SquarePen,
  Check,
  X,
  Pin,
  PinOff,
  SquareStack,
  Sparkles,
  Loader2
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import {
  getBetweenModuleQuiz,
  hasModuleBuiltinCheckpoint
} from '../../data/checkpointQuizzes';
import {
  resolveCourseHierarchy,
  getModuleSectionBreadcrumb,
  createStarterModule,
  toChapterConfigFromHierarchy
} from '../../utils/courseHierarchy';
import { RichMarkdownEditor } from '../Courses/HierarchyContentWorkspace';
import {
  FlashcardCategory,
  FlashcardItem
} from '../Flashcards/flashcardTypes';
import { generateFlashcardDeck } from '../../utils/flashcardApi';
import {
  Course,
  CourseChapterSection,
  CourseGradingCriteria,
  CourseModule,
  ModuleType,
  QuizQuestion
} from '../../types';

interface CourseModuleBuilderProps {
  course: Course;
  onClose: () => void;
  onEditFullModule: (courseId: string, mod: CourseModule) => void;
  onOpenHierarchyContentModal?: (courseId: string, chapterId: string, sectionId?: string) => void;
  onToast: (message: string) => void;
}

type PaletteItemKind = ModuleType | 'checkpoint';

type DragPayload =
  | { source: 'palette'; kind: PaletteItemKind }
  | { source: 'module'; moduleId: string; fromIndex: number };

type SelectedInspectorTarget =
  | { kind: 'grading' }
  | { kind: 'quiz-module'; moduleId: string }
  | { kind: 'flashcard-module'; moduleId: string }
  | { kind: 'checkpoint'; fromModuleId: string; toModuleId: string }
  | { kind: 'chapter-content'; chapterId: string }
  | { kind: 'section-content'; chapterId: string; sectionId: string };

const DEFAULT_GRADING_CRITERIA: CourseGradingCriteria = {
  overallPassingScore: 80,
  quizPassingScore: 75,
  requireAllModulesComplete: true,
  requireQuizPassForCertificate: true,
  allowQuizRetakes: true,
  maxQuizAttempts: 0,
  weights: {
    quizzes: 50,
    labs: 30,
    lessonsAndPcaps: 20
  }
};

const PALETTE_ITEMS: {
  kind: PaletteItemKind;
  label: string;
  description: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
}[] = [
  {
    kind: 'quiz',
    label: 'Quiz Module',
    description: 'Graded assessment with instant feedback & live scoring',
    badge: 'Assessment',
    icon: HelpCircle,
    accentClass: 'text-amber-600 dark:text-amber-400'
  },
  {
    kind: 'checkpoint',
    label: 'Retention Check',
    description: 'Drop between modules for quick knowledge verification',
    badge: 'Between Modules',
    icon: CheckSquare,
    accentClass: 'text-blue-600 dark:text-cyan-400'
  },
  {
    kind: 'theory',
    label: 'Theory Lesson',
    description: 'Structured markdown reading & diagrams',
    badge: 'Reading',
    icon: FileText,
    accentClass: 'text-indigo-600 dark:text-indigo-400'
  },
  {
    kind: 'lab',
    label: 'CLI Sandbox Lab',
    description: 'Hands-on Cisco IOS terminal & topology',
    badge: 'Hands-On',
    icon: Terminal,
    accentClass: 'text-cyan-600 dark:text-cyan-400'
  },
  {
    kind: 'video',
    label: 'Video Walkthrough',
    description: 'Streamed lecture & companion notes',
    badge: 'Media',
    icon: Video,
    accentClass: 'text-purple-600 dark:text-purple-400'
  },
  {
    kind: 'pcap',
    label: 'Wireshark PCAP',
    description: 'Packet header inspection & protocol analysis',
    badge: 'Forensics',
    icon: Activity,
    accentClass: 'text-emerald-600 dark:text-emerald-400'
  },
  {
    kind: 'flashcard',
    label: 'Flashcards',
    description: 'Interactive flip-card deck for section review & recall',
    badge: 'Review',
    icon: SquareStack,
    accentClass: 'text-cyan-600 dark:text-cyan-400'
  }
];

export const CourseModuleBuilder: React.FC<CourseModuleBuilderProps> = ({
  course,
  onClose,
  onEditFullModule,
  onOpenHierarchyContentModal,
  onToast
}) => {
  const {
    addModuleToCourse,
    updateModuleInCourse,
    deleteModuleFromCourse,
    reorderModuleInCourse,
    setCourseModulesOrder,
    updateCourse
  } = useAcademy();

  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const [activeCheckpointDropId, setActiveCheckpointDropId] = useState<string | null>(null);
  const [isPaletteFrozen, setIsPaletteFrozen] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('netpulse_builder_palette_frozen');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('netpulse_builder_palette_frozen', String(isPaletteFrozen));
    } catch {
      // ignore storage write failures
    }
  }, [isPaletteFrozen]);

  // Canvas mode: clean 3-level outline tree (default) OR flat drag-and-drop sequence
  const [canvasViewMode, setCanvasViewMode] = useState<'sequence' | 'hierarchy'>('hierarchy');
  const [newChapterTitle, setNewChapterTitle] = useState('');

  // Easy inline outline controls (mirroring clean NetAcad/DataCamp tree)
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [selectedSection, setSelectedSection] = useState<{
    chapterTitle: string;
    mainContentTitle: string;
  } | null>(null);
  const [addingSubToChapterId, setAddingSubToChapterId] = useState<string | null>(null);
  const [inlineSubTitle, setInlineSubTitle] = useState('');
  const [addingItemToSectionKey, setAddingItemToSectionKey] = useState<string | null>(null);
  const [inlineItemTitle, setInlineItemTitle] = useState('');
  const [inlineItemType, setInlineItemType] = useState<ModuleType>('theory');

  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingChapterDraft, setEditingChapterDraft] = useState('');
  const [editingMainKey, setEditingMainKey] = useState<string | null>(null);
  const [editingMainDraft, setEditingMainDraft] = useState('');
  const [dropSectionKey, setDropSectionKey] = useState<string | null>(null);
  const [dropOutlineSlotKey, setDropOutlineSlotKey] = useState<string | null>(null);

  const hierarchyTree = useMemo(() => resolveCourseHierarchy(course), [course]);

  // Keep selectedSection synced to a valid section in the course
  const activeTargetSection = useMemo(() => {
    if (selectedSection) {
      const ch = hierarchyTree.find(
        c => c.title.toLowerCase() === selectedSection.chapterTitle.toLowerCase()
      );
      const mc = ch?.mainContents.find(
        m => m.title.toLowerCase() === selectedSection.mainContentTitle.toLowerCase()
      );
      if (ch && mc) {
        return { chapterTitle: ch.title, mainContentTitle: mc.title, sectionNumber: mc.sectionNumber, chapterNumber: ch.chapterNumber };
      }
    }
    const firstCh = hierarchyTree[0];
    const firstMc = firstCh?.mainContents[0];
    if (firstCh && firstMc) {
      return {
        chapterTitle: firstCh.title,
        mainContentTitle: firstMc.title,
        sectionNumber: firstMc.sectionNumber,
        chapterNumber: firstCh.chapterNumber
      };
    }
    return null;
  }, [hierarchyTree, selectedSection]);

  const toChapterConfig = (): CourseChapterSection[] =>
    toChapterConfigFromHierarchy(hierarchyTree);

  const handleAddLevel1Chapter = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newChapterTitle.trim();
    if (!clean) return;
    const baseChapters = toChapterConfig();
    if (baseChapters.some(ch => ch.title.toLowerCase() === clean.toLowerCase())) {
      onToast(`Chapter "${clean}" already exists.`);
      return;
    }
    const newChapId = `chap-${Date.now()}`;
    const defaultSubTitle = 'Overview & Core Concepts';
    baseChapters.push({
      id: newChapId,
      title: clean,
      mainContents: [{ id: `sec-${Date.now()}`, title: defaultSubTitle }]
    });
    updateCourse(course.id, { chapters: baseChapters });
    setNewChapterTitle('');
    setExpandedChapters(prev => ({ ...prev, [newChapId]: true }));
    setSelectedSection({ chapterTitle: clean, mainContentTitle: defaultSubTitle });
    onToast(`Added ${baseChapters.length}.0 ${clean}`);
  };

  const addSubSectionToChapter = (
    chapterId: string,
    chapterTitle: string,
    openEditorAfter = false
  ) => {
    const clean = inlineSubTitle.trim();
    if (!clean) return;
    const baseChapters = toChapterConfig();
    const chap = baseChapters.find(ch => ch.id === chapterId || ch.title.toLowerCase() === chapterTitle.toLowerCase());
    if (!chap) return;
    if (chap.mainContents.some(mc => mc.title.toLowerCase() === clean.toLowerCase())) {
      onToast(`Section "${clean}" already exists.`);
      return;
    }
    const newSecId = `sec-${Date.now()}`;
    chap.mainContents.push({ id: newSecId, title: clean });
    updateCourse(course.id, { chapters: baseChapters });
    setInlineSubTitle('');
    setAddingSubToChapterId(null);
    setSelectedSection({ chapterTitle: chap.title, mainContentTitle: clean });
    onToast(`Added section "${clean}" under ${chap.title}`);
    if (openEditorAfter) {
      setInspectorTarget({
        kind: 'section-content',
        chapterId: chap.id,
        sectionId: newSecId
      });
      onOpenHierarchyContentModal?.(course.id, chap.id, newSecId);
    }
  };

  const handleAddSubSectionToChapter = (
    e: React.FormEvent,
    chapterId: string,
    chapterTitle: string
  ) => {
    e.preventDefault();
    addSubSectionToChapter(chapterId, chapterTitle, false);
  };

  const handleRenameChapter = (oldTitle: string) => {
    const clean = editingChapterDraft.trim();
    if (!clean || clean === oldTitle) {
      setEditingChapterId(null);
      return;
    }
    const baseChapters = toChapterConfig().map(ch =>
      ch.title.toLowerCase() === oldTitle.toLowerCase() ? { ...ch, title: clean } : ch
    );
    const updatedModules = course.modules.map(m =>
      (m.chapterTitle || '').trim().toLowerCase() === oldTitle.toLowerCase()
        ? { ...m, chapterTitle: clean }
        : m
    );
    updateCourse(course.id, { chapters: baseChapters, modules: updatedModules });
    if (selectedSection?.chapterTitle.toLowerCase() === oldTitle.toLowerCase()) {
      setSelectedSection({ ...selectedSection, chapterTitle: clean });
    }
    setEditingChapterId(null);
    onToast(`Renamed chapter to "${clean}"`);
  };

  const handleDeleteChapter = (chapterTitle: string) => {
    if (hierarchyTree.length <= 1) {
      onToast('A course must have at least one chapter.');
      return;
    }
    const baseChapters = toChapterConfig().filter(
      ch => ch.title.toLowerCase() !== chapterTitle.toLowerCase()
    );
    const fallbackCh = baseChapters[0];
    const fallbackMc = fallbackCh?.mainContents[0]?.title || 'Core Concepts';
    const updatedModules = course.modules.map(m =>
      (m.chapterTitle || '').trim().toLowerCase() === chapterTitle.toLowerCase()
        ? { ...m, chapterTitle: fallbackCh.title, mainContentTitle: fallbackMc }
        : m
    );
    updateCourse(course.id, { chapters: baseChapters, modules: updatedModules });
    setSelectedSection({ chapterTitle: fallbackCh.title, mainContentTitle: fallbackMc });
    onToast(`Removed chapter "${chapterTitle}"`);
  };

  const handleRenameMainContent = (chapterTitle: string, oldMainTitle: string) => {
    const clean = editingMainDraft.trim();
    if (!clean || clean === oldMainTitle) {
      setEditingMainKey(null);
      return;
    }
    const baseChapters = toChapterConfig().map(ch =>
      ch.title.toLowerCase() === chapterTitle.toLowerCase()
        ? {
            ...ch,
            mainContents: ch.mainContents.map(mc =>
              mc.title.toLowerCase() === oldMainTitle.toLowerCase()
                ? { ...mc, title: clean }
                : mc
            )
          }
        : ch
    );
    const updatedModules = course.modules.map(m =>
      (m.chapterTitle || '').trim().toLowerCase() === chapterTitle.toLowerCase() &&
      (m.mainContentTitle || '').trim().toLowerCase() === oldMainTitle.toLowerCase()
        ? { ...m, mainContentTitle: clean }
        : m
    );
    updateCourse(course.id, { chapters: baseChapters, modules: updatedModules });
    if (
      selectedSection?.chapterTitle.toLowerCase() === chapterTitle.toLowerCase() &&
      selectedSection?.mainContentTitle.toLowerCase() === oldMainTitle.toLowerCase()
    ) {
      setSelectedSection({ chapterTitle, mainContentTitle: clean });
    }
    setEditingMainKey(null);
    onToast(`Renamed section to "${clean}"`);
  };

  const handleDeleteMainContent = (chapterTitle: string, mainTitle: string) => {
    const baseChapters = toChapterConfig();
    const chap = baseChapters.find(ch => ch.title.toLowerCase() === chapterTitle.toLowerCase());
    if (!chap || chap.mainContents.length <= 1) {
      onToast('Each chapter needs at least one section.');
      return;
    }
    chap.mainContents = chap.mainContents.filter(
      mc => mc.title.toLowerCase() !== mainTitle.toLowerCase()
    );
    const fallbackMain = chap.mainContents[0].title;
    const updatedModules = course.modules.map(m =>
      (m.chapterTitle || '').trim().toLowerCase() === chapterTitle.toLowerCase() &&
      (m.mainContentTitle || '').trim().toLowerCase() === mainTitle.toLowerCase()
        ? { ...m, mainContentTitle: fallbackMain }
        : m
    );
    updateCourse(course.id, { chapters: baseChapters, modules: updatedModules });
    setSelectedSection({ chapterTitle, mainContentTitle: fallbackMain });
    onToast(`Removed section "${mainTitle}"`);
  };

  const createItemInSection = (
    chapterTitle: string,
    mainContentTitle: string,
    openEditorAfter = false
  ) => {
    const starter = createStarterModule(inlineItemType, course, gradingForm.quizPassingScore);
    const cleanTitle = inlineItemTitle.trim();
    const newMod: CourseModule = {
      ...starter,
      title: cleanTitle || starter.title.replace(/^Module \d+:\s*/, ''),
      chapterTitle,
      mainContentTitle
    };
    addModuleToCourse(course.id, newMod);
    setInlineItemTitle('');
    setAddingItemToSectionKey(null);
    setSelectedSection({ chapterTitle, mainContentTitle });
    if (newMod.type === 'quiz') {
      setInspectorTarget({ kind: 'quiz-module', moduleId: newMod.id });
    } else if (newMod.type === 'flashcard') {
      setInspectorTarget({ kind: 'flashcard-module', moduleId: newMod.id });
    }
    onToast(`Added "${newMod.title}" to ${mainContentTitle}`);
    if (openEditorAfter) {
      onEditFullModule(course.id, newMod);
    }
  };

  const handleQuickAddItemInSection = (
    e: React.FormEvent,
    chapterTitle: string,
    mainContentTitle: string
  ) => {
    e.preventDefault();
    createItemInSection(chapterTitle, mainContentTitle, false);
  };

  const handleAssignModuleSection = (
    moduleId: string,
    chapterTitle: string,
    mainContentTitle: string
  ) => {
    updateModuleInCourse(course.id, moduleId, {
      chapterTitle,
      mainContentTitle
    });
    onToast(`Moved to "${chapterTitle} › ${mainContentTitle}"`);
  };

  const handleDropInSectionAt = (
    e: React.DragEvent,
    chapterTitle: string,
    mainContentTitle: string,
    insertAtIndex: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDropSectionKey(null);
    setDropOutlineSlotKey(null);
    if (!dragPayload) return;

    if (dragPayload.source === 'module') {
      const { fromIndex, moduleId } = dragPayload;
      const nextModules = [...course.modules];
      const [moved] = nextModules.splice(fromIndex, 1);
      if (moved) {
        const adjustedTarget = fromIndex < insertAtIndex ? insertAtIndex - 1 : insertAtIndex;
        nextModules.splice(adjustedTarget, 0, {
          ...moved,
          chapterTitle,
          mainContentTitle
        });
        setCourseModulesOrder(course.id, nextModules);
        onToast(`Moved "${moved.title}" into "${mainContentTitle}"`);
      }
      setDragPayload(null);
      return;
    }

    if (dragPayload.source === 'palette') {
      if (dragPayload.kind === 'checkpoint') {
        handleInjectPaletteItem('checkpoint', insertAtIndex);
        setDragPayload(null);
        return;
      }
      const starter = createStarterModule(dragPayload.kind, course, gradingForm.quizPassingScore);
      const newMod: CourseModule = {
        ...starter,
        title: starter.title.replace(/^Module \d+:\s*/, ''),
        chapterTitle,
        mainContentTitle
      };
      addModuleToCourse(course.id, newMod, insertAtIndex);
      setSelectedSection({ chapterTitle, mainContentTitle });
      if (newMod.type === 'quiz') {
        setInspectorTarget({ kind: 'quiz-module', moduleId: newMod.id });
      } else if (newMod.type === 'flashcard') {
        setInspectorTarget({ kind: 'flashcard-module', moduleId: newMod.id });
      }
      onToast(`Inserted "${newMod.title}" into "${mainContentTitle}"`);
      setDragPayload(null);
    }
  };

  const handleDropOnSection = (
    e: React.DragEvent,
    chapterTitle: string,
    mainContentTitle: string
  ) => {
    e.preventDefault();
    setDropSectionKey(null);
    setDropOutlineSlotKey(null);
    if (!dragPayload) return;

    if (dragPayload.source === 'module') {
      handleAssignModuleSection(dragPayload.moduleId, chapterTitle, mainContentTitle);
      setDragPayload(null);
      return;
    }

    if (dragPayload.source === 'palette') {
      if (dragPayload.kind === 'checkpoint') {
        handleInjectPaletteItem('checkpoint');
      } else {
        const starter = createStarterModule(dragPayload.kind, course, gradingForm.quizPassingScore);
        const newMod: CourseModule = {
          ...starter,
          title: starter.title.replace(/^Module \d+:\s*/, ''),
          chapterTitle,
          mainContentTitle
        };
        addModuleToCourse(course.id, newMod);
        setSelectedSection({ chapterTitle, mainContentTitle });
        if (newMod.type === 'quiz') {
          setInspectorTarget({ kind: 'quiz-module', moduleId: newMod.id });
        } else if (newMod.type === 'flashcard') {
          setInspectorTarget({ kind: 'flashcard-module', moduleId: newMod.id });
        }
        onToast(`Added "${newMod.title}" into "${mainContentTitle}"`);
      }
      setDragPayload(null);
    }
  };

  const [inspectorTarget, setInspectorTarget] = useState<SelectedInspectorTarget>({
    kind: 'grading'
  });

  // Automated Grading Criteria Form State (synced cleanly per course)
  const [gradingForm, setGradingForm] = useState<CourseGradingCriteria>(
    () => course.gradingCriteria || DEFAULT_GRADING_CRITERIA
  );

  useEffect(() => {
    setGradingForm(course.gradingCriteria || DEFAULT_GRADING_CRITERIA);
  }, [course.id, course.gradingCriteria]);

  // Inline Quiz / Checkpoint Draft State inside Inspector
  const selectedQuizModule = useMemo(() => {
    if (inspectorTarget.kind !== 'quiz-module') return null;
    return course.modules.find(m => m.id === inspectorTarget.moduleId) || null;
  }, [course.modules, inspectorTarget]);

  const selectedFlashcardModule = useMemo(() => {
    if (inspectorTarget.kind !== 'flashcard-module') return null;
    return course.modules.find(m => m.id === inspectorTarget.moduleId) || null;
  }, [course.modules, inspectorTarget]);

  const selectedCheckpointPair = useMemo(() => {
    if (inspectorTarget.kind !== 'checkpoint') return null;
    const fromMod = course.modules.find(m => m.id === inspectorTarget.fromModuleId);
    const toMod = course.modules.find(m => m.id === inspectorTarget.toModuleId);
    if (!fromMod || !toMod) return null;
    return { fromMod, toMod };
  }, [course.modules, inspectorTarget]);

  const [quizDraft, setQuizDraft] = useState<{
    title: string;
    passingScore: number;
    questions: QuizQuestion[];
  }>({
    title: '',
    passingScore: 75,
    questions: []
  });

  const [flashcardDraft, setFlashcardDraft] = useState<{
    title: string;
    deckTitle: string;
    summary: string;
    cards: FlashcardItem[];
  }>({
    title: '',
    deckTitle: '',
    summary: '',
    cards: []
  });
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);

  const selectedHierarchyChapter = useMemo(() => {
    if (
      inspectorTarget.kind !== 'chapter-content' &&
      inspectorTarget.kind !== 'section-content'
    ) {
      return null;
    }
    return (
      hierarchyTree.find(c => c.id === inspectorTarget.chapterId) ||
      hierarchyTree[0] ||
      null
    );
  }, [hierarchyTree, inspectorTarget]);

  const selectedHierarchySection = useMemo(() => {
    if (inspectorTarget.kind !== 'section-content' || !selectedHierarchyChapter) return null;
    return (
      selectedHierarchyChapter.mainContents.find(
        mc => mc.id === inspectorTarget.sectionId
      ) || null
    );
  }, [inspectorTarget, selectedHierarchyChapter]);

  const [hierarchyContentDraft, setHierarchyContentDraft] = useState<{
    title: string;
    summary: string;
    contentMarkdown: string;
  }>({
    title: '',
    summary: '',
    contentMarkdown: ''
  });

  useEffect(() => {
    if (inspectorTarget.kind === 'quiz-module' && selectedQuizModule) {
      setQuizDraft({
        title: selectedQuizModule.title,
        passingScore: selectedQuizModule.quiz?.passingScore ?? gradingForm.quizPassingScore,
        questions: (selectedQuizModule.quiz?.questions || []).map(q => ({
          ...q,
          options: [...q.options]
        }))
      });
    } else if (inspectorTarget.kind === 'checkpoint' && selectedCheckpointPair) {
      const { fromMod, toMod } = selectedCheckpointPair;
      const resolved = getBetweenModuleQuiz(course, fromMod, toMod);
      const sourceQuestions = fromMod.checkpointQuiz?.questions?.length
        ? fromMod.checkpointQuiz.questions
        : resolved?.questions?.length
        ? resolved.questions
        : [
            {
              id: `cp-q-${Date.now()}`,
              question: `Quick retention check for ${fromMod.title}:`,
              options: ['Option A', 'Option B', 'Option C', 'Option D'],
              correctAnswerIndex: 0,
              explanation: 'Immediate explanation shown after answer selection.'
            }
          ];
      setQuizDraft({
        title: fromMod.checkpointQuiz?.title || resolved?.title || `Retention Check: ${fromMod.title}`,
        passingScore: fromMod.checkpointQuiz?.passingScore ?? resolved?.passingScore ?? gradingForm.quizPassingScore,
        questions: sourceQuestions.map(q => ({ ...q, options: [...q.options] }))
      });
    } else if (inspectorTarget.kind === 'chapter-content' && selectedHierarchyChapter) {
      setHierarchyContentDraft({
        title: selectedHierarchyChapter.title,
        summary: selectedHierarchyChapter.summary || '',
        contentMarkdown: selectedHierarchyChapter.contentMarkdown || ''
      });
    } else if (
      inspectorTarget.kind === 'section-content' &&
      selectedHierarchyChapter &&
      selectedHierarchySection
    ) {
      setHierarchyContentDraft({
        title: selectedHierarchySection.title,
        summary: selectedHierarchySection.summary || '',
        contentMarkdown: selectedHierarchySection.contentMarkdown || ''
      });
    } else if (inspectorTarget.kind === 'flashcard-module' && selectedFlashcardModule) {
      setFlashcardDraft({
        title: selectedFlashcardModule.title,
        deckTitle: selectedFlashcardModule.flashcards?.deckTitle || selectedFlashcardModule.title,
        summary:
          selectedFlashcardModule.flashcards?.summary ||
          selectedFlashcardModule.summary ||
          '',
        cards: (selectedFlashcardModule.flashcards?.cards || []).map(c => ({ ...c }))
      });
    }
  }, [
    course,
    gradingForm.quizPassingScore,
    inspectorTarget,
    selectedCheckpointPair,
    selectedFlashcardModule,
    selectedHierarchyChapter,
    selectedHierarchySection,
    selectedQuizModule
  ]);

  const weightsTotal =
    gradingForm.weights.quizzes +
    gradingForm.weights.labs +
    gradingForm.weights.lessonsAndPcaps;
  const weightsValid = weightsTotal === 100;

  const moduleBreakdown = useMemo(() => {
    let quizzes = 0;
    let labs = 0;
    let lessons = 0;
    let retentionChecks = 0;
    let hasRestorableChecks = false;
    let totalMinutes = 0;

    course.modules.forEach((mod, idx) => {
      totalMinutes += mod.durationMin || 0;
      if (mod.type === 'quiz') quizzes += 1;
      else if (mod.type === 'lab') labs += 1;
      else lessons += 1;

      if (idx < course.modules.length - 1) {
        const next = course.modules[idx + 1];
        if (getBetweenModuleQuiz(course, mod, next)) {
          retentionChecks += 1;
        }
        if (
          mod.type !== 'quiz' &&
          next.type !== 'quiz' &&
          (Boolean(mod.checkpointQuiz?.questions?.length) || hasModuleBuiltinCheckpoint(mod.id))
        ) {
          hasRestorableChecks = true;
        }
      }
    });

    return { quizzes, labs, lessons, retentionChecks, hasRestorableChecks, totalMinutes };
  }, [course]);

  const handleSaveGradingCriteria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!weightsValid) {
      onToast('Category weights must equal 100% before saving');
      return;
    }
    updateCourse(course.id, { gradingCriteria: gradingForm });
    onToast(`Saved automated grading criteria for ${course.code}`);
  };

  const handleApplyQuizThresholdToAll = () => {
    const targetScore = gradingForm.quizPassingScore;
    const updatedModules = course.modules.map(mod => {
      let next = mod;
      if (mod.type === 'quiz' && mod.quiz) {
        next = { ...next, quiz: { ...mod.quiz, passingScore: targetScore } };
      }
      if (mod.checkpointQuiz) {
        next = {
          ...next,
          checkpointQuiz: { ...mod.checkpointQuiz, passingScore: targetScore }
        };
      }
      return next;
    });
    setCourseModulesOrder(course.id, updatedModules);
    updateCourse(course.id, { gradingCriteria: gradingForm });
    onToast(`Applied ${targetScore}% passing benchmark to all quizzes in ${course.code}`);
  };

  const handleBalanceWeights = () => {
    const q = gradingForm.weights.quizzes;
    const l = gradingForm.weights.labs;
    const remaining = Math.max(0, 100 - q - l);
    if (q + l > 100) {
      setGradingForm(prev => ({
        ...prev,
        weights: { quizzes: 50, labs: 30, lessonsAndPcaps: 20 }
      }));
    } else {
      setGradingForm(prev => ({
        ...prev,
        weights: { ...prev.weights, lessonsAndPcaps: remaining }
      }));
    }
  };

  const handleInjectPaletteItem = (kind: PaletteItemKind, insertAtIndex?: number) => {
    if (kind === 'checkpoint') {
      // Find a valid between-module boundary (around insertAtIndex or first non-quiz pair)
      const candidateIdx =
        typeof insertAtIndex === 'number'
          ? Math.max(0, Math.min(course.modules.length - 2, insertAtIndex - 1))
          : course.modules.findIndex(
              (m, idx) =>
                idx < course.modules.length - 1 &&
                m.type !== 'quiz' &&
                course.modules[idx + 1].type !== 'quiz'
            );

      const fromMod = candidateIdx >= 0 ? course.modules[candidateIdx] : undefined;
      const toMod =
        candidateIdx >= 0 && candidateIdx + 1 < course.modules.length
          ? course.modules[candidateIdx + 1]
          : undefined;

      if (!fromMod || !toMod || fromMod.type === 'quiz' || toMod.type === 'quiz') {
        onToast('Drop a Retention Check between two non-quiz modules');
        return;
      }

      const existingOrBank = getBetweenModuleQuiz(course, fromMod, toMod);
      updateModuleInCourse(course.id, fromMod.id, {
        disableCheckpoint: false,
        checkpointQuiz: {
          title: fromMod.checkpointQuiz?.title || `Retention Check: ${fromMod.title}`,
          passingScore: gradingForm.quizPassingScore,
          questions:
            fromMod.checkpointQuiz?.questions?.length
              ? fromMod.checkpointQuiz.questions
              : existingOrBank?.questions || [
                  {
                    id: `cp-q-${Date.now()}`,
                    question: `Key concept check for ${fromMod.title}:`,
                    options: ['Option A', 'Option B', 'Option C', 'Option D'],
                    correctAnswerIndex: 0,
                    explanation: 'Immediate explanation displayed to the learner.'
                  }
                ]
        }
      });
      setInspectorTarget({ kind: 'checkpoint', fromModuleId: fromMod.id, toModuleId: toMod.id });
      onToast(`Injected interactive retention check after "${fromMod.title}"`);
      return;
    }

    const starter = createStarterModule(kind, course, gradingForm.quizPassingScore);
    const newMod: CourseModule = activeTargetSection
      ? {
          ...starter,
          title: starter.title.replace(/^Module \d+:\s*/, ''),
          chapterTitle: activeTargetSection.chapterTitle,
          mainContentTitle: activeTargetSection.mainContentTitle
        }
      : starter;
    const targetIdx = typeof insertAtIndex === 'number' ? insertAtIndex : course.modules.length;
    addModuleToCourse(course.id, newMod, targetIdx);
    if (newMod.type === 'quiz') {
      setInspectorTarget({ kind: 'quiz-module', moduleId: newMod.id });
    } else if (newMod.type === 'flashcard') {
      setInspectorTarget({ kind: 'flashcard-module', moduleId: newMod.id });
    }
    onToast(
      activeTargetSection
        ? `Added "${newMod.title}" under ${activeTargetSection.sectionNumber} ${activeTargetSection.mainContentTitle}`
        : `Injected "${newMod.title}" at position #${targetIdx + 1}`
    );
  };

  const handleDropAtSlot = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    setActiveDropIndex(null);
    setActiveCheckpointDropId(null);

    if (!dragPayload) return;

    if (dragPayload.source === 'palette') {
      handleInjectPaletteItem(dragPayload.kind, slotIndex);
      setDragPayload(null);
      return;
    }

    if (dragPayload.source === 'module') {
      const { fromIndex } = dragPayload;
      if (fromIndex === slotIndex || fromIndex + 1 === slotIndex) {
        setDragPayload(null);
        return;
      }
      const nextModules = [...course.modules];
      const [moved] = nextModules.splice(fromIndex, 1);
      const adjustedTarget = fromIndex < slotIndex ? slotIndex - 1 : slotIndex;
      nextModules.splice(adjustedTarget, 0, moved);
      setCourseModulesOrder(course.id, nextModules);
      setDragPayload(null);
      onToast(`Moved "${moved.title}" to position #${adjustedTarget + 1}`);
    }
  };

  const handleDropOnCheckpointSlot = (
    e: React.DragEvent,
    fromMod: CourseModule,
    toMod: CourseModule
  ) => {
    e.preventDefault();
    setActiveDropIndex(null);
    setActiveCheckpointDropId(null);

    if (!dragPayload) return;

    if (dragPayload.source === 'palette' && dragPayload.kind === 'checkpoint') {
      const existingOrBank = getBetweenModuleQuiz(course, fromMod, toMod);
      updateModuleInCourse(course.id, fromMod.id, {
        disableCheckpoint: false,
        checkpointQuiz: {
          title: fromMod.checkpointQuiz?.title || `Retention Check: ${fromMod.title}`,
          passingScore: gradingForm.quizPassingScore,
          questions:
            fromMod.checkpointQuiz?.questions?.length
              ? fromMod.checkpointQuiz.questions
              : existingOrBank?.questions || [
                  {
                    id: `cp-q-${Date.now()}`,
                    question: `Quick retention check for ${fromMod.title}:`,
                    options: ['Option A', 'Option B', 'Option C', 'Option D'],
                    correctAnswerIndex: 0,
                    explanation: 'Immediate explanation shown after answer selection.'
                  }
                ]
        }
      });
      setInspectorTarget({ kind: 'checkpoint', fromModuleId: fromMod.id, toModuleId: toMod.id });
      setDragPayload(null);
      onToast(`Injected interactive retention quiz before "${toMod.title}"`);
      return;
    }

    // If dragging a regular module or quiz onto this divider slot, insert between fromMod and toMod
    const fromIdx = course.modules.findIndex(m => m.id === fromMod.id);
    if (fromIdx >= 0) {
      handleDropAtSlot(e, fromIdx + 1);
    }
  };

  const handleRemoveModuleCheckpoint = (moduleId: string, moduleTitle: string) => {
    updateModuleInCourse(course.id, moduleId, { disableCheckpoint: true });
    if (
      inspectorTarget.kind === 'checkpoint' &&
      inspectorTarget.fromModuleId === moduleId
    ) {
      setInspectorTarget({ kind: 'grading' });
    }
    onToast(`Removed retention check after "${moduleTitle}"`);
  };

  const handleRestoreModuleCheckpoint = (fromMod: CourseModule, toMod: CourseModule) => {
    const needsCustomQuestions =
      !fromMod.checkpointQuiz?.questions?.length && !hasModuleBuiltinCheckpoint(fromMod.id);
    updateModuleInCourse(course.id, fromMod.id, {
      disableCheckpoint: false,
      ...(needsCustomQuestions
        ? {
            checkpointQuiz: {
              title: `Retention Check: ${fromMod.title}`,
              passingScore: gradingForm.quizPassingScore,
              questions: [
                {
                  id: `cp-q-${Date.now()}`,
                  question: `Quick retention check for ${fromMod.title}:`,
                  options: ['Option A', 'Option B', 'Option C', 'Option D'],
                  correctAnswerIndex: 0,
                  explanation: 'Immediate explanation shown after answer selection.'
                }
              ]
            }
          }
        : {})
    });
    setInspectorTarget({ kind: 'checkpoint', fromModuleId: fromMod.id, toModuleId: toMod.id });
    onToast(`Enabled retention check between "${fromMod.title}" and "${toMod.title}"`);
  };

  const handleClearCheckpointsInSection = (moduleIds: string[], sectionLabel: string) => {
    const idSet = new Set(moduleIds);
    const updatedModules = course.modules.map(m =>
      idSet.has(m.id) ? { ...m, disableCheckpoint: true } : m
    );
    updateCourse(course.id, { modules: updatedModules });
    if (
      inspectorTarget.kind === 'checkpoint' &&
      idSet.has(inspectorTarget.fromModuleId)
    ) {
      setInspectorTarget({ kind: 'grading' });
    }
    onToast(`Removed retention checks in "${sectionLabel}"`);
  };

  const handleToggleAllRetentionChecks = (disableAll: boolean) => {
    updateCourse(course.id, {
      disableRetentionChecks: disableAll,
      modules: course.modules.map(m => ({ ...m, disableCheckpoint: disableAll }))
    });
    if (disableAll && inspectorTarget.kind === 'checkpoint') {
      setInspectorTarget({ kind: 'grading' });
    }
    onToast(
      disableAll
        ? `Removed all Interactive Retention Checks for ${course.code}`
        : `Restored Interactive Retention Checks for ${course.code}`
    );
  };

  const handleSaveQuizDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (quizDraft.questions.length === 0) return;

    if (inspectorTarget.kind === 'quiz-module' && selectedQuizModule) {
      updateModuleInCourse(course.id, selectedQuizModule.id, {
        title: quizDraft.title.trim() || selectedQuizModule.title,
        quiz: {
          passingScore: Number(quizDraft.passingScore) || 70,
          questions: quizDraft.questions
        }
      });
      onToast(`Updated quiz "${quizDraft.title.trim() || selectedQuizModule.title}"`);
    } else if (inspectorTarget.kind === 'checkpoint' && selectedCheckpointPair) {
      updateModuleInCourse(course.id, selectedCheckpointPair.fromMod.id, {
        disableCheckpoint: false,
        checkpointQuiz: {
          title: quizDraft.title.trim() || `Retention Check: ${selectedCheckpointPair.fromMod.title}`,
          passingScore: Number(quizDraft.passingScore) || 70,
          questions: quizDraft.questions
        }
      });
      onToast(`Updated retention check after "${selectedCheckpointPair.fromMod.title}"`);
    }
  };

  const handleAddDraftQuestion = () => {
    setQuizDraft(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          id: `q-${Date.now()}-${prev.questions.length}`,
          question: 'New interactive question...',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswerIndex: 0,
          explanation: 'Explanation shown immediately when a student chooses an answer.'
        }
      ]
    }));
  };

  const handleUpdateDraftQuestion = (index: number, patch: Partial<QuizQuestion>) => {
    setQuizDraft(prev => ({
      ...prev,
      questions: prev.questions.map((q, idx) => (idx === index ? { ...q, ...patch } : q))
    }));
  };

  const handleRemoveDraftQuestion = (index: number) => {
    setQuizDraft(prev => ({
      ...prev,
      questions: prev.questions.filter((_, idx) => idx !== index)
    }));
  };

  const handleSaveFlashcardDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (inspectorTarget.kind !== 'flashcard-module' || !selectedFlashcardModule) return;
    const cleanedCards = flashcardDraft.cards
      .map(c => ({
        ...c,
        term: c.term.trim() || 'Key Term',
        question: c.question.trim() || 'Prompt question',
        answer: c.answer.trim() || 'Answer'
      }))
      .filter(c => c.question && c.answer);

    updateModuleInCourse(course.id, selectedFlashcardModule.id, {
      title: flashcardDraft.title.trim() || selectedFlashcardModule.title,
      summary: flashcardDraft.summary.trim() || selectedFlashcardModule.summary,
      flashcards: {
        deckTitle: flashcardDraft.deckTitle.trim() || flashcardDraft.title.trim() || selectedFlashcardModule.title,
        summary: flashcardDraft.summary.trim(),
        cards: cleanedCards
      }
    });
    onToast(`Saved ${cleanedCards.length} flashcards for "${flashcardDraft.title.trim() || selectedFlashcardModule.title}"`);
  };

  const handleAddFlashcardItem = () => {
    setFlashcardDraft(prev => ({
      ...prev,
      cards: [
        ...prev.cards,
        {
          id: `fc-${Date.now()}-${prev.cards.length}`,
          category: 'Terminology',
          term: 'New Term',
          question: 'What is the key role or behavior of this concept?',
          answer: 'Concise definition or command answer',
          explanation: 'Supporting technical details shown after flipping.',
          memoryTip: ''
        }
      ]
    }));
  };

  const handleUpdateFlashcardItem = (index: number, patch: Partial<FlashcardItem>) => {
    setFlashcardDraft(prev => ({
      ...prev,
      cards: prev.cards.map((c, idx) => (idx === index ? { ...c, ...patch } : c))
    }));
  };

  const handleRemoveFlashcardItem = (index: number) => {
    setFlashcardDraft(prev => ({
      ...prev,
      cards: prev.cards.filter((_, idx) => idx !== index)
    }));
  };

  const handleGenerateFlashcardCards = async () => {
    if (isGeneratingFlashcards) return;
    setIsGeneratingFlashcards(true);
    try {
      const focusLabel = `${course.code} ${course.title}: ${flashcardDraft.title || 'Chapter Review'}`;
      const deck = await generateFlashcardDeck({
        topic: 'all',
        difficulty: 'certification',
        cardCount: 6,
        customFocus: focusLabel
      });
      setFlashcardDraft(prev => ({
        ...prev,
        deckTitle: prev.deckTitle || deck.deckTitle,
        summary: prev.summary || deck.summary,
        cards: [...prev.cards, ...deck.cards]
      }));
      onToast(`Added ${deck.cards.length} AI-generated cards to deck`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not generate AI flashcards right now');
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const handleSaveHierarchyContentDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHierarchyChapter) return;
    const baseChapters = toChapterConfig();
    const cleanTitle = hierarchyContentDraft.title.trim();
    const cleanSummary = hierarchyContentDraft.summary.trim();

    if (inspectorTarget.kind === 'chapter-content') {
      const targetTitle = cleanTitle || selectedHierarchyChapter.title;
      const oldTitle = selectedHierarchyChapter.title;
      const nextChapters = baseChapters.map(ch =>
        ch.id === selectedHierarchyChapter.id
          ? {
              ...ch,
              title: targetTitle,
              summary: cleanSummary || undefined,
              contentMarkdown: hierarchyContentDraft.contentMarkdown
            }
          : ch
      );
      const updatedModules =
        oldTitle.toLowerCase() !== targetTitle.toLowerCase()
          ? course.modules.map(m =>
              (m.chapterTitle || '').trim().toLowerCase() === oldTitle.toLowerCase()
                ? { ...m, chapterTitle: targetTitle }
                : m
            )
          : course.modules;
      updateCourse(course.id, { chapters: nextChapters, modules: updatedModules });
      onToast(`Saved content for ${selectedHierarchyChapter.chapterNumber} ${targetTitle}`);
    } else if (inspectorTarget.kind === 'section-content' && selectedHierarchySection) {
      const targetSecTitle = cleanTitle || selectedHierarchySection.title;
      const oldSecTitle = selectedHierarchySection.title;
      const nextChapters = baseChapters.map(ch =>
        ch.id === selectedHierarchyChapter.id
          ? {
              ...ch,
              mainContents: ch.mainContents.map(mc =>
                mc.id === selectedHierarchySection.id
                  ? {
                      ...mc,
                      title: targetSecTitle,
                      summary: cleanSummary || undefined,
                      contentMarkdown: hierarchyContentDraft.contentMarkdown
                    }
                  : mc
              )
            }
          : ch
      );
      const updatedModules =
        oldSecTitle.toLowerCase() !== targetSecTitle.toLowerCase()
          ? course.modules.map(m =>
              (m.chapterTitle || '').trim().toLowerCase() ===
                selectedHierarchyChapter.title.toLowerCase() &&
              (m.mainContentTitle || '').trim().toLowerCase() === oldSecTitle.toLowerCase()
                ? { ...m, mainContentTitle: targetSecTitle }
                : m
            )
          : course.modules;
      updateCourse(course.id, { chapters: nextChapters, modules: updatedModules });
      onToast(`Saved content for ${selectedHierarchySection.sectionNumber} ${targetSecTitle}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Builder Header Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Courses</span>
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                {course.code}
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                Drag &amp; Drop Module Builder
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
              {course.title} · {course.modules.length} Modules · {moduleBreakdown.quizzes} Quiz Modules ·{' '}
              {moduleBreakdown.retentionChecks} Retention Checks · {moduleBreakdown.totalMinutes} min
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {course.modules.length > 1 &&
            (moduleBreakdown.retentionChecks > 0 || moduleBreakdown.hasRestorableChecks) && (
              <button
                type="button"
                onClick={() => handleToggleAllRetentionChecks(moduleBreakdown.retentionChecks > 0)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  moduleBreakdown.retentionChecks > 0
                    ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-blue-600 dark:text-cyan-400 hover:border-blue-400'
                }`}
                title={
                  moduleBreakdown.retentionChecks > 0
                    ? 'Remove all between-module Interactive Retention Checks'
                    : 'Restore between-module Interactive Retention Checks'
                }
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="tabular-nums">
                  {moduleBreakdown.retentionChecks > 0
                    ? `Clear All Checks (${moduleBreakdown.retentionChecks})`
                    : 'Restore Checks'}
                </span>
              </button>
            )}
          <button
            type="button"
            onClick={() => setInspectorTarget({ kind: 'grading' })}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              inspectorTarget.kind === 'grading'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="tabular-nums">Grading Criteria · Pass {gradingForm.overallPassingScore}%</span>
          </button>
        </div>
      </div>

      {/* 3-Zone Studio Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Zone 1: Component Palette */}
        <aside
          className={`xl:col-span-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 ${
            isPaletteFrozen
              ? 'xl:sticky xl:top-[4.5rem] xl:z-20 xl:max-h-[calc(100vh-5.5rem)] xl:overflow-y-auto'
              : ''
          }`}
        >
          <div className="pb-2 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700 dark:text-slate-200">
                Component Palette
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Drag any block onto the syllabus canvas or click + to inject.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPaletteFrozen(prev => !prev)}
              aria-pressed={isPaletteFrozen}
              title={
                isPaletteFrozen
                  ? 'Palette is frozen while scrolling — click to unfreeze'
                  : 'Freeze Component Palette while scrolling'
              }
              className={`hidden xl:inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                isPaletteFrozen
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-cyan-800 text-blue-700 dark:text-cyan-300 hover:bg-blue-100 dark:hover:bg-blue-950/70'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {isPaletteFrozen ? (
                <>
                  <Pin className="w-3 h-3" />
                  <span>Frozen</span>
                </>
              ) : (
                <>
                  <PinOff className="w-3 h-3" />
                  <span>Freeze</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-2">
            {PALETTE_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.kind}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', `palette:${item.kind}`);
                    setDragPayload({ source: 'palette', kind: item.kind });
                  }}
                  onDragEnd={() => {
                    setDragPayload(null);
                    setActiveDropIndex(null);
                    setActiveCheckpointDropId(null);
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-blue-400 dark:hover:border-cyan-500 cursor-grab active:cursor-grabbing transition-colors duration-150 motion-reduce:transition-none flex items-start justify-between gap-2 group"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <GripVertical className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${item.accentClass}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleInjectPaletteItem(item.kind)}
                    title={`Inject ${item.label}`}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 hover:border-blue-400 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Zone 2: Clean 3-Level Course Outline & Drag-and-Drop Canvas */}
        <section
          aria-label="Curriculum drop canvas"
          className="xl:col-span-5 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                <span>Course Outline</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {canvasViewMode === 'hierarchy'
                  ? 'Click any section to highlight it, then add or drag items directly into place.'
                  : 'Drag blocks vertically to change sequential module order.'}
              </p>
            </div>
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setCanvasViewMode('hierarchy')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  canvasViewMode === 'hierarchy'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Outline Tree
              </button>
              <button
                type="button"
                onClick={() => setCanvasViewMode('sequence')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  canvasViewMode === 'sequence'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Sequence ({course.modules.length})
              </button>
            </div>
          </div>

          {canvasViewMode === 'hierarchy' ? (
            <div className="space-y-3">
              {/* Simple Single-Bar Add Chapter Input */}
              <form onSubmit={handleAddLevel1Chapter} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder={`New chapter ${hierarchyTree.length + 1}.0 title...`}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Add Chapter</span>
                </button>
              </form>

              {/* Clean Minimal Outline Tree (Matching Reference Screenshot: 1.0 -> 1.1 -> 1.1.1) */}
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {hierarchyTree.map((ch) => {
                  const isExpanded = expandedChapters[ch.id] !== false;
                  const isEditingThisChapter = editingChapterId === ch.id;
                  const isAddingSubHere = addingSubToChapterId === ch.id;

                  return (
                    <div key={ch.id} className="py-3 first:pt-1 last:pb-1">
                      {/* Level 1: Chapter Header (e.g. "1.0 Profiling and Cleansing Data   ^") */}
                      {isEditingThisChapter ? (
                        <div className="flex items-center gap-1.5 py-1">
                          <span className="text-sm font-bold text-slate-500 tabular-nums shrink-0">
                            {ch.chapterNumber}
                          </span>
                          <input
                            type="text"
                            autoFocus
                            value={editingChapterDraft}
                            onChange={(e) => setEditingChapterDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleRenameChapter(ch.title);
                              } else if (e.key === 'Escape') {
                                setEditingChapterId(null);
                              }
                            }}
                            className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-blue-400 text-sm font-semibold text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameChapter(ch.title)}
                            className="p-1.5 rounded-lg bg-blue-600 text-white"
                            title="Save chapter name"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingChapterId(null)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="group flex items-center justify-between gap-2 py-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedChapters(prev => ({ ...prev, [ch.id]: !isExpanded }))
                            }
                            aria-expanded={isExpanded}
                            className="flex-1 min-w-0 text-left flex items-center gap-2 text-[14px] font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-cyan-400 transition-colors"
                          >
                            <span className="tabular-nums shrink-0">{ch.chapterNumber}</span>
                            <span className="truncate">{ch.title}</span>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            {(() => {
                              const chapterModIds = ch.mainContents.flatMap(sec =>
                                sec.items.map(item => item.module.id)
                              );
                              const hasChapterChecks = ch.mainContents.some(sec =>
                                sec.items.some(item => {
                                  const nextM = course.modules[item.flatIndex + 1];
                                  return Boolean(nextM && getBetweenModuleQuiz(course, item.module, nextM));
                                })
                              );
                              return hasChapterChecks ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleClearCheckpointsInSection(chapterModIds, ch.title)
                                  }
                                  className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                                  title="Remove all Interactive Retention Checks in this chapter"
                                >
                                  Clear Checks
                                </button>
                              ) : null;
                            })()}
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedChapters(prev => ({ ...prev, [ch.id]: true }));
                                setAddingSubToChapterId(isAddingSubHere ? null : ch.id);
                                setInlineSubTitle('');
                              }}
                              className="px-2 py-1 rounded-md text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                              title="Add Level-2 sub-section"
                            >
                              + Section
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setInspectorTarget({ kind: 'chapter-content', chapterId: ch.id })
                              }
                              className={`p-1 rounded-md transition-colors ${
                                inspectorTarget.kind === 'chapter-content' &&
                                inspectorTarget.chapterId === ch.id
                                  ? 'bg-blue-600 text-white'
                                  : ch.contentMarkdown?.trim()
                                  ? 'text-blue-600 dark:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  : 'text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 opacity-70 group-hover:opacity-100'
                              }`}
                              title="Write chapter content"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingChapterId(ch.id);
                                setEditingChapterDraft(ch.title);
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 opacity-70 group-hover:opacity-100"
                              title="Rename chapter"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {hierarchyTree.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteChapter(ch.title)}
                                className="p-1 rounded-md text-slate-400 hover:text-red-500 opacity-70 group-hover:opacity-100"
                                title="Delete chapter"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedChapters(prev => ({ ...prev, [ch.id]: !isExpanded }))
                              }
                              className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                              aria-label={isExpanded ? 'Collapse chapter' : 'Expand chapter'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {isExpanded && (
                        <div className="mt-1.5 space-y-2.5 pl-1">
                          {/* Inline Sub-section Creator when "+ Section" is clicked */}
                          {isAddingSubHere && (
                            <form
                              onSubmit={(e) => handleAddSubSectionToChapter(e, ch.id, ch.title)}
                              className="flex items-center gap-2 pl-3 py-1"
                            >
                              <span className="text-xs font-semibold text-slate-400 tabular-nums shrink-0">
                                {ch.chapterIndex}.{ch.mainContents.length + 1}
                              </span>
                              <input
                                type="text"
                                autoFocus
                                value={inlineSubTitle}
                                onChange={(e) => setInlineSubTitle(e.target.value)}
                                placeholder="Sub-section title (e.g. Profile Data)..."
                                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                              />
                              <button
                                type="submit"
                                className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-semibold whitespace-nowrap"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => addSubSectionToChapter(ch.id, ch.title, true)}
                                className="px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-cyan-800 text-blue-600 dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[11px] font-semibold whitespace-nowrap"
                                title="Create section and immediately open content editor"
                              >
                                Add &amp; Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setAddingSubToChapterId(null)}
                                className="p-1 text-slate-400 hover:text-slate-700"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </form>
                          )}

                          {/* Level 2: Main Content Sections (e.g. "1.1 Profile Data") */}
                          {ch.mainContents.map((mc) => {
                            const secKey = `${ch.id}::${mc.id}`;
                            const isSelectedTarget =
                              activeTargetSection?.chapterTitle.toLowerCase() === ch.title.toLowerCase() &&
                              activeTargetSection?.mainContentTitle.toLowerCase() === mc.title.toLowerCase();
                            const isDropHover = dropSectionKey === secKey;
                            const isEditingThisMain = editingMainKey === secKey;
                            const isAddingItemHere = addingItemToSectionKey === secKey;

                            return (
                              <div
                                key={mc.id}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setDropSectionKey(secKey);
                                }}
                                onDragLeave={() => {
                                  if (dropSectionKey === secKey) setDropSectionKey(null);
                                }}
                                onDrop={(e) => handleDropOnSection(e, ch.title, mc.title)}
                                className="space-y-1"
                              >
                                {isEditingThisMain ? (
                                  <div className="flex items-center gap-1.5 pl-3 py-1">
                                    <span className="text-xs font-semibold text-slate-500 tabular-nums shrink-0">
                                      {mc.sectionNumber}
                                    </span>
                                    <input
                                      type="text"
                                      autoFocus
                                      value={editingMainDraft}
                                      onChange={(e) => setEditingMainDraft(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleRenameMainContent(ch.title, mc.title);
                                        } else if (e.key === 'Escape') {
                                          setEditingMainKey(null);
                                        }
                                      }}
                                      className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-blue-400 text-xs font-semibold text-slate-900 dark:text-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRenameMainContent(ch.title, mc.title)}
                                      className="p-1 rounded-md bg-blue-600 text-white"
                                      title="Save section name"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingMainKey(null)}
                                      className="p-1 text-slate-400 hover:text-slate-700"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div
                                    onClick={() =>
                                      setSelectedSection({
                                        chapterTitle: ch.title,
                                        mainContentTitle: mc.title
                                      })
                                    }
                                    className={`group/sec flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                      isDropHover
                                        ? 'bg-blue-50 dark:bg-blue-950/60 ring-1 ring-blue-400'
                                        : isSelectedTarget
                                        ? 'bg-slate-100 dark:bg-slate-800/80'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                                        {mc.sectionNumber}
                                      </span>
                                      <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">
                                        {mc.title}
                                      </span>
                                    </div>

                                    <div
                                      className="flex items-center gap-1 shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {mc.items.some(item => {
                                        const nextM = course.modules[item.flatIndex + 1];
                                        return Boolean(nextM && getBetweenModuleQuiz(course, item.module, nextM));
                                      }) && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleClearCheckpointsInSection(
                                              mc.items.map(i => i.module.id),
                                              mc.title
                                            )
                                          }
                                          className="px-1.5 py-0.5 rounded-md text-[10px] font-medium text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-900 whitespace-nowrap opacity-75 group-hover/sec:opacity-100"
                                          title="Remove retention checks for all modules in this section"
                                        >
                                          Clear Checks
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedSection({
                                            chapterTitle: ch.title,
                                            mainContentTitle: mc.title
                                          });
                                          setAddingItemToSectionKey(isAddingItemHere ? null : secKey);
                                          setInlineItemTitle('');
                                        }}
                                        className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:bg-white dark:hover:bg-slate-900 whitespace-nowrap"
                                        title="Add course content directly into this section"
                                      >
                                        + Item
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedSection({
                                            chapterTitle: ch.title,
                                            mainContentTitle: mc.title
                                          });
                                          setInspectorTarget({
                                            kind: 'section-content',
                                            chapterId: ch.id,
                                            sectionId: mc.id
                                          });
                                        }}
                                        className={`p-1 rounded transition-colors ${
                                          inspectorTarget.kind === 'section-content' &&
                                          inspectorTarget.sectionId === mc.id
                                            ? 'bg-blue-600 text-white'
                                            : mc.contentMarkdown?.trim()
                                            ? 'text-blue-600 dark:text-cyan-400 hover:bg-white dark:hover:bg-slate-900'
                                            : 'text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 opacity-60 group-hover/sec:opacity-100'
                                        }`}
                                        title="Write section content"
                                      >
                                        <FileText className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingMainKey(secKey);
                                          setEditingMainDraft(mc.title);
                                        }}
                                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 opacity-60 group-hover/sec:opacity-100"
                                        title="Rename sub-section"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                      {ch.mainContents.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteMainContent(ch.title, mc.title)}
                                          className="p-1 rounded text-slate-400 hover:text-red-500 opacity-60 group-hover/sec:opacity-100"
                                          title="Remove sub-section"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Quick Inline Add Course Content Item directly under Level 2 */}
                                {isAddingItemHere && (
                                  <form
                                    onSubmit={(e) => handleQuickAddItemInSection(e, ch.title, mc.title)}
                                    className="ml-7 mr-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-wrap sm:flex-nowrap items-center gap-1.5"
                                  >
                                    <select
                                      value={inlineItemType}
                                      onChange={(e) => setInlineItemType(e.target.value as ModuleType)}
                                      className="px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-200"
                                    >
                                      <option value="theory">Reading</option>
                                      <option value="lab">Live Lab</option>
                                      <option value="video">Video</option>
                                      <option value="quiz">Quiz Review</option>
                                      <option value="pcap">PCAP Lab</option>
                                      <option value="flashcard">Flashcards</option>
                                    </select>
                                    <input
                                      type="text"
                                      autoFocus
                                      value={inlineItemTitle}
                                      onChange={(e) => setInlineItemTitle(e.target.value)}
                                      placeholder={`${mc.sectionNumber}.${mc.items.length + 1} Lesson or Lab title...`}
                                      className="flex-1 min-w-0 px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                                    />
                                    <button
                                      type="submit"
                                      className="px-2.5 py-1 rounded-md bg-blue-600 text-white text-[11px] font-semibold whitespace-nowrap"
                                    >
                                      Add
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        createItemInSection(ch.title, mc.title, true)
                                      }
                                      className="px-2.5 py-1 rounded-md border border-blue-200 dark:border-cyan-800 text-blue-600 dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[11px] font-semibold whitespace-nowrap"
                                      title="Create module immediately and open the full rich content editor"
                                    >
                                      Add &amp; Edit
                                    </button>
                                  </form>
                                )}

                                {/* Level 3: Course Content Items (e.g. "1.1.1 Steps of Data Profiling") */}
                                <div className="pl-7 space-y-0.5">
                                  {mc.items.length === 0 ? (
                                    <p className="px-2 py-1.5 text-[11px] text-slate-400">
                                      No items yet — click <span className="font-semibold">+ Item</span> or drag a block here.
                                    </p>
                                  ) : (
                                    mc.items.map(({ module: mod, flatIndex, itemNumber }, secItemIdx) => {
                                      const isSelectedQuiz =
                                        inspectorTarget.kind === 'quiz-module' &&
                                        inspectorTarget.moduleId === mod.id;
                                      const isSelectedFlashcard =
                                        inspectorTarget.kind === 'flashcard-module' &&
                                        inspectorTarget.moduleId === mod.id;

                                      const ItemIcon =
                                        mod.type === 'lab'
                                          ? Mouse
                                          : mod.type === 'video'
                                          ? Clapperboard
                                          : mod.type === 'quiz'
                                          ? SquarePen
                                          : mod.type === 'pcap'
                                          ? Activity
                                          : mod.type === 'flashcard'
                                          ? SquareStack
                                          : FileText;

                                      const nextSequentialMod =
                                        flatIndex < course.modules.length - 1
                                          ? course.modules[flatIndex + 1]
                                          : undefined;
                                      const betweenCheck = nextSequentialMod
                                        ? getBetweenModuleQuiz(course, mod, nextSequentialMod)
                                        : null;
                                      const beforeSlotKey = `${secKey}::before::${mod.id}`;
                                      const afterSlotKey = `${secKey}::after::${mod.id}`;
                                      const isBeforeDropActive = dropOutlineSlotKey === beforeSlotKey;
                                      const isAfterDropActive = dropOutlineSlotKey === afterSlotKey;

                                      return (
                                        <React.Fragment key={mod.id}>
                                          {secItemIdx === 0 && dragPayload && (
                                            <div
                                              onDragOver={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDropOutlineSlotKey(beforeSlotKey);
                                              }}
                                              onDragLeave={() => {
                                                if (dropOutlineSlotKey === beforeSlotKey) {
                                                  setDropOutlineSlotKey(null);
                                                }
                                              }}
                                              onDrop={(e) =>
                                                handleDropInSectionAt(e, ch.title, mc.title, flatIndex)
                                              }
                                              className={`rounded-md border border-dashed px-2 py-1 text-center font-mono text-[10px] transition-colors ${
                                                isBeforeDropActive
                                                  ? 'border-blue-500 dark:border-cyan-400 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-300 font-semibold'
                                                  : 'border-slate-300 dark:border-slate-700 text-slate-400'
                                              }`}
                                            >
                                              Drop here · Start of {mc.sectionNumber}
                                            </div>
                                          )}

                                          <div
                                            draggable
                                            onDragStart={(e) => {
                                              e.dataTransfer.effectAllowed = 'move';
                                              e.dataTransfer.setData('text/plain', `module:${mod.id}`);
                                              setDragPayload({
                                                source: 'module',
                                                moduleId: mod.id,
                                                fromIndex: flatIndex
                                              });
                                            }}
                                            onDragEnd={() => {
                                              setDragPayload(null);
                                              setDropSectionKey(null);
                                              setDropOutlineSlotKey(null);
                                            }}
                                            className={`group/item flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg transition-colors ${
                                              isSelectedQuiz || isSelectedFlashcard
                                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                                            }`}
                                          >
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedSection({
                                                  chapterTitle: ch.title,
                                                  mainContentTitle: mc.title
                                                });
                                                if (mod.type === 'quiz') {
                                                  setInspectorTarget({
                                                    kind: 'quiz-module',
                                                    moduleId: mod.id
                                                  });
                                                } else if (mod.type === 'flashcard') {
                                                  setInspectorTarget({
                                                    kind: 'flashcard-module',
                                                    moduleId: mod.id
                                                  });
                                                } else {
                                                  onEditFullModule(course.id, mod);
                                                }
                                              }}
                                              className="flex items-start gap-2.5 min-w-0 flex-1 text-left"
                                            >
                                              <ItemIcon className={`w-4 h-4 mt-0.5 shrink-0 ${
                                                mod.type === 'flashcard'
                                                  ? 'text-cyan-600 dark:text-cyan-400'
                                                  : 'text-slate-500 dark:text-slate-400'
                                              }`} />
                                              <span className="text-[13px] leading-snug text-slate-800 dark:text-slate-200">
                                                <span className="tabular-nums mr-1.5 font-medium text-slate-600 dark:text-slate-400">
                                                  {itemNumber}
                                                </span>
                                                {mod.title}
                                                {mod.type === 'flashcard' && (
                                                  <span className="ml-1.5 text-[10px] font-mono text-cyan-600 dark:text-cyan-400 tabular-nums">
                                                    ({mod.flashcards?.cards?.length || 0} cards)
                                                  </span>
                                                )}
                                              </span>
                                            </button>

                                            <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover/item:opacity-100 transition-opacity">
                                              <button
                                                type="button"
                                                onClick={() => onEditFullModule(course.id, mod)}
                                                className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400"
                                                title="Edit content & section"
                                              >
                                                <Edit3 className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                disabled={course.modules.length <= 1}
                                                onClick={() => {
                                                  deleteModuleFromCourse(course.id, mod.id);
                                                  if (isSelectedQuiz || isSelectedFlashcard) {
                                                    setInspectorTarget({ kind: 'grading' });
                                                  }
                                                  onToast(`Removed "${mod.title}"`);
                                                }}
                                                className="p-1 rounded text-slate-400 hover:text-red-500 disabled:opacity-30"
                                                title="Delete item"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </div>

                                          {betweenCheck && nextSequentialMod && (
                                            <div className="group/cp ml-6 px-2.5 py-1 rounded-md border border-dashed border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setInspectorTarget({
                                                    kind: 'checkpoint',
                                                    fromModuleId: mod.id,
                                                    toModuleId: nextSequentialMod.id
                                                  })
                                                }
                                                className="flex items-center gap-1.5 truncate hover:text-blue-600 dark:hover:text-cyan-400 text-left flex-1"
                                              >
                                                <CheckSquare className="w-3 h-3 text-blue-600 dark:text-cyan-400 shrink-0" />
                                                <span className="truncate">
                                                  Retention Check · {betweenCheck.questions.length} Qs
                                                </span>
                                              </button>
                                              <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover/cp:opacity-100 transition-opacity">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setInspectorTarget({
                                                      kind: 'checkpoint',
                                                      fromModuleId: mod.id,
                                                      toModuleId: nextSequentialMod.id
                                                    })
                                                  }
                                                  className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400"
                                                  title={`Edit retention check after "${mod.title}"`}
                                                  aria-label={`Edit retention check after ${mod.title}`}
                                                >
                                                  <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveModuleCheckpoint(mod.id, mod.title)}
                                                  className="p-1 rounded text-slate-400 hover:text-red-500"
                                                  title={`Remove retention check after "${mod.title}"`}
                                                  aria-label={`Remove retention check after ${mod.title}`}
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {dragPayload && (
                                            <div
                                              onDragOver={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDropOutlineSlotKey(afterSlotKey);
                                              }}
                                              onDragLeave={() => {
                                                if (dropOutlineSlotKey === afterSlotKey) {
                                                  setDropOutlineSlotKey(null);
                                                }
                                              }}
                                              onDrop={(e) =>
                                                handleDropInSectionAt(e, ch.title, mc.title, flatIndex + 1)
                                              }
                                              className={`rounded-md border border-dashed px-2 py-1 text-center font-mono text-[10px] transition-colors ${
                                                isAfterDropActive
                                                  ? 'border-blue-500 dark:border-cyan-400 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-300 font-semibold'
                                                  : 'border-slate-300 dark:border-slate-700 text-slate-400'
                                              }`}
                                            >
                                              Drop here · After {itemNumber}
                                            </div>
                                          )}
                                        </React.Fragment>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {course.modules.map((mod, idx) => {
                const crumb = getModuleSectionBreadcrumb(course, mod.id);
              const nextMod = idx < course.modules.length - 1 ? course.modules[idx + 1] : undefined;
              const betweenQuiz = nextMod ? getBetweenModuleQuiz(course, mod, nextMod) : null;
              const isSelectedQuiz =
                inspectorTarget.kind === 'quiz-module' && inspectorTarget.moduleId === mod.id;
              const isSelectedFlashcard =
                inspectorTarget.kind === 'flashcard-module' && inspectorTarget.moduleId === mod.id;
              const isDraggingSelf =
                dragPayload?.source === 'module' && dragPayload.moduleId === mod.id;
              const isDropActiveBefore = activeDropIndex === idx;

              return (
                <React.Fragment key={mod.id}>
                  {/* Drop Slot Before Module idx */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setActiveDropIndex(idx);
                    }}
                    onDragLeave={() => {
                      if (activeDropIndex === idx) setActiveDropIndex(null);
                    }}
                    onDrop={(e) => handleDropAtSlot(e, idx)}
                    className={`rounded-lg border transition-all duration-150 motion-reduce:transition-none text-center font-mono text-[10px] ${
                      isDropActiveBefore
                        ? 'py-2.5 border-dashed border-blue-500 dark:border-cyan-400 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300 font-semibold'
                        : dragPayload
                        ? 'py-1.5 border-dashed border-slate-300 dark:border-slate-700 text-slate-400'
                        : 'h-1.5 border-transparent'
                    }`}
                  >
                    {(isDropActiveBefore || dragPayload) &&
                      `Drop here · Position ${idx + 1}`}
                  </div>

                  {/* Draggable Module Row */}
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', `module:${mod.id}`);
                      setDragPayload({ source: 'module', moduleId: mod.id, fromIndex: idx });
                    }}
                    onDragEnd={() => {
                      setDragPayload(null);
                      setActiveDropIndex(null);
                      setActiveCheckpointDropId(null);
                    }}
                    className={`p-3 rounded-xl border transition-colors duration-150 motion-reduce:transition-none flex items-center justify-between gap-2 ${
                      isDraggingSelf
                        ? 'opacity-45 border-blue-400 bg-blue-50/40 dark:bg-blue-950/20'
                        : isSelectedQuiz
                        ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30'
                        : isSelectedFlashcard
                        ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        title="Drag to reorder"
                        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0"
                      >
                        <GripVertical className="w-4 h-4" />
                      </span>

                      <span className="font-mono text-[11px] font-bold tabular-nums text-slate-400 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      {mod.type === 'lab' ? (
                        <Terminal className="w-4 h-4 text-cyan-500 shrink-0" />
                      ) : mod.type === 'video' ? (
                        <Video className="w-4 h-4 text-purple-500 shrink-0" />
                      ) : mod.type === 'quiz' ? (
                        <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : mod.type === 'pcap' ? (
                        <Activity className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : mod.type === 'flashcard' ? (
                        <SquareStack className="w-4 h-4 text-cyan-500 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (mod.type === 'quiz') {
                            setInspectorTarget({ kind: 'quiz-module', moduleId: mod.id });
                          } else if (mod.type === 'flashcard') {
                            setInspectorTarget({ kind: 'flashcard-module', moduleId: mod.id });
                          } else {
                            onEditFullModule(course.id, mod);
                          }
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate hover:text-blue-600 dark:hover:text-cyan-400">
                          {mod.title}
                        </p>
                        <p className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 truncate">
                          {crumb ? `${crumb.chapterLabel} › ${crumb.sectionNumber} ${crumb.itemNumber} · ` : ''}
                          <span className="capitalize">{mod.type}</span> · {mod.durationMin}m
                          {mod.type === 'quiz' && mod.quiz
                            ? ` · Pass ${mod.quiz.passingScore}% · ${mod.quiz.questions.length} Qs`
                            : mod.type === 'flashcard'
                            ? ` · ${mod.flashcards?.cards?.length || 0} Cards`
                            : ''}
                        </p>
                      </button>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
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
                        onClick={() => {
                          if (mod.type === 'quiz') {
                            setInspectorTarget({ kind: 'quiz-module', moduleId: mod.id });
                          } else if (mod.type === 'flashcard') {
                            setInspectorTarget({ kind: 'flashcard-module', moduleId: mod.id });
                          } else {
                            onEditFullModule(course.id, mod);
                          }
                        }}
                        className="p-1 rounded text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-cyan-400"
                        title={
                          mod.type === 'quiz'
                            ? 'Edit Quiz in Inspector'
                            : mod.type === 'flashcard'
                            ? 'Edit Flashcards in Inspector'
                            : 'Edit Module Content'
                        }
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={course.modules.length <= 1}
                        onClick={() => {
                          deleteModuleFromCourse(course.id, mod.id);
                          if (isSelectedQuiz || isSelectedFlashcard) setInspectorTarget({ kind: 'grading' });
                          onToast(`Removed "${mod.title}"`);
                        }}
                        className="p-1 rounded text-red-400 hover:text-red-600 disabled:opacity-30"
                        title={course.modules.length <= 1 ? 'Course requires at least 1 module' : 'Delete Module'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Between-Module Retention Check Drop & Edit Slot */}
                  {nextMod && mod.type !== 'quiz' && nextMod.type !== 'quiz' && (
                    <div className="pl-5 relative">
                      <span
                        aria-hidden="true"
                        className="absolute left-2.5 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700"
                      />
                      {(() => {
                        const slotKey = `${mod.id}->${nextMod.id}`;
                        const isCheckpointHovered = activeCheckpointDropId === slotKey;
                        const isSelectedCheckpoint =
                          inspectorTarget.kind === 'checkpoint' &&
                          inspectorTarget.fromModuleId === mod.id &&
                          inspectorTarget.toModuleId === nextMod.id;
                        const hasCustom = Boolean(mod.checkpointQuiz?.questions?.length);

                        return (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setActiveCheckpointDropId(slotKey);
                            }}
                            onDragLeave={() => {
                              if (activeCheckpointDropId === slotKey) {
                                setActiveCheckpointDropId(null);
                              }
                            }}
                            onDrop={(e) => handleDropOnCheckpointSlot(e, mod, nextMod)}
                            className={`w-full px-3 py-2 rounded-lg border text-left transition-colors duration-150 motion-reduce:transition-none flex items-center justify-between gap-2 text-[11px] ${
                              isCheckpointHovered
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-cyan-200 font-semibold'
                                : isSelectedCheckpoint
                                ? 'border-blue-500 dark:border-cyan-400 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-cyan-200 font-semibold'
                                : betweenQuiz
                                ? 'border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-cyan-500'
                                : 'border-dashed border-slate-200/60 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-blue-300'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (betweenQuiz) {
                                  setInspectorTarget({
                                    kind: 'checkpoint',
                                    fromModuleId: mod.id,
                                    toModuleId: nextMod.id
                                  });
                                } else {
                                  handleRestoreModuleCheckpoint(mod, nextMod);
                                }
                              }}
                              className="flex items-center gap-1.5 truncate flex-1 text-left"
                            >
                              <CheckSquare
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  betweenQuiz ? 'text-blue-600 dark:text-cyan-400' : 'text-slate-400'
                                }`}
                              />
                              <span className="truncate tabular-nums">
                                {betweenQuiz
                                  ? `Retention Check · ${betweenQuiz.questions.length} Qs · Pass ${betweenQuiz.passingScore}%`
                                  : 'No Retention Check · Click or drop check here to add'}
                              </span>
                            </button>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {betweenQuiz ? (
                                <>
                                  {isCheckpointHovered ? (
                                    <span className="font-mono text-[10px] text-blue-600 dark:text-cyan-400 font-semibold whitespace-nowrap px-1">
                                      Drop to Inject
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setInspectorTarget({
                                          kind: 'checkpoint',
                                          fromModuleId: mod.id,
                                          toModuleId: nextMod.id
                                        })
                                      }
                                      className="p-1 rounded text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-cyan-400"
                                      title={
                                        hasCustom
                                          ? `Edit custom retention check after "${mod.title}"`
                                          : `Edit retention check after "${mod.title}"`
                                      }
                                      aria-label={`Edit retention check after ${mod.title}`}
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveModuleCheckpoint(mod.id, mod.title)}
                                    className="p-1 rounded text-red-400 hover:text-red-600"
                                    title={`Remove retention check after "${mod.title}"`}
                                    aria-label={`Remove retention check after ${mod.title}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreModuleCheckpoint(mod, nextMod)}
                                  className="font-mono text-[10px] text-blue-600 dark:text-cyan-400 hover:underline whitespace-nowrap"
                                >
                                  + Enable
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Final End-of-Syllabus Drop Slot */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setActiveDropIndex(course.modules.length);
              }}
              onDragLeave={() => {
                if (activeDropIndex === course.modules.length) setActiveDropIndex(null);
              }}
              onDrop={(e) => handleDropAtSlot(e, course.modules.length)}
              className={`rounded-xl border-2 border-dashed p-3 text-center font-mono text-[11px] transition-colors duration-150 motion-reduce:transition-none ${
                activeDropIndex === course.modules.length
                  ? 'border-blue-500 dark:border-cyan-400 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300 font-semibold'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'
              }`}
            >
              Drop component here to append at end of course
            </div>
          </div>
          )}
        </section>

        {/* Zone 3: Automated Grading Criteria & Inline Assessment Inspector */}
        <aside className="xl:col-span-4 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          {/* Inspector Mode Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setInspectorTarget({ kind: 'grading' })}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                inspectorTarget.kind === 'grading'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Grading
            </button>
            <button
              type="button"
              onClick={() => {
                const firstCh = hierarchyTree[0];
                const firstSec = firstCh?.mainContents[0];
                if (firstCh && firstSec) {
                  setInspectorTarget({
                    kind: 'section-content',
                    chapterId: firstCh.id,
                    sectionId: firstSec.id
                  });
                } else if (firstCh) {
                  setInspectorTarget({ kind: 'chapter-content', chapterId: firstCh.id });
                }
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                inspectorTarget.kind === 'chapter-content' ||
                inspectorTarget.kind === 'section-content'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Outline Content
            </button>
            <button
              type="button"
              onClick={() => {
                const firstQuiz = course.modules.find(m => m.type === 'quiz');
                if (firstQuiz) {
                  setInspectorTarget({ kind: 'quiz-module', moduleId: firstQuiz.id });
                } else if (course.modules.length >= 2) {
                  setInspectorTarget({
                    kind: 'checkpoint',
                    fromModuleId: course.modules[0].id,
                    toModuleId: course.modules[1].id
                  });
                }
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                inspectorTarget.kind === 'quiz-module' || inspectorTarget.kind === 'checkpoint'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Quiz Editor
            </button>
            <button
              type="button"
              onClick={() => {
                const firstFc = course.modules.find(m => m.type === 'flashcard');
                if (firstFc) {
                  setInspectorTarget({ kind: 'flashcard-module', moduleId: firstFc.id });
                } else {
                  setInspectorTarget({ kind: 'flashcard-module', moduleId: '' });
                }
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                inspectorTarget.kind === 'flashcard-module'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Flashcards
            </button>
          </div>

          {inspectorTarget.kind === 'grading' ? (
            <form onSubmit={handleSaveGradingCriteria} className="space-y-4 text-xs">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                  <span>Automated Grading Criteria</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Configure course-wide pass benchmarks, rubric weighting, and certificate eligibility rules.
                </p>
              </div>

              {/* Threshold Sliders */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3 tabular-nums">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="overall-pass-slider" className="font-semibold text-slate-700 dark:text-slate-200">
                      Overall Course Pass Threshold
                    </label>
                    <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                      {gradingForm.overallPassingScore}%
                    </span>
                  </div>
                  <input
                    id="overall-pass-slider"
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={gradingForm.overallPassingScore}
                    onChange={(e) =>
                      setGradingForm(prev => ({
                        ...prev,
                        overallPassingScore: Number(e.target.value)
                      }))
                    }
                    className="w-full accent-blue-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="quiz-pass-slider" className="font-semibold text-slate-700 dark:text-slate-200">
                      Quiz &amp; Retention Check Benchmark
                    </label>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      {gradingForm.quizPassingScore}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="quiz-pass-slider"
                      type="range"
                      min={50}
                      max={100}
                      step={5}
                      value={gradingForm.quizPassingScore}
                      onChange={(e) =>
                        setGradingForm(prev => ({
                          ...prev,
                          quizPassingScore: Number(e.target.value)
                        }))
                      }
                      className="flex-1 accent-amber-600"
                    />
                    <button
                      type="button"
                      onClick={handleApplyQuizThresholdToAll}
                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 whitespace-nowrap shrink-0"
                    >
                      Apply to All Quizzes
                    </button>
                  </div>
                </div>
              </div>

              {/* Weight Distribution */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3 tabular-nums">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Grade Weight Distribution
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold ${
                      weightsValid
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {weightsValid ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Total: 100%</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Total: {weightsTotal}%</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-1">
                      Quizzes (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={gradingForm.weights.quizzes}
                      onChange={(e) =>
                        setGradingForm(prev => ({
                          ...prev,
                          weights: { ...prev.weights, quizzes: Math.max(0, Number(e.target.value) || 0) }
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-1">
                      CLI Labs (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={gradingForm.weights.labs}
                      onChange={(e) =>
                        setGradingForm(prev => ({
                          ...prev,
                          weights: { ...prev.weights, labs: Math.max(0, Number(e.target.value) || 0) }
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-1">
                      Lessons (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={gradingForm.weights.lessonsAndPcaps}
                      onChange={(e) =>
                        setGradingForm(prev => ({
                          ...prev,
                          weights: {
                            ...prev.weights,
                            lessonsAndPcaps: Math.max(0, Number(e.target.value) || 0)
                          }
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {!weightsValid && (
                  <button
                    type="button"
                    onClick={handleBalanceWeights}
                    className="w-full py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-[11px] font-semibold"
                  >
                    Auto-Balance Weights to 100%
                  </button>
                )}
              </div>

              {/* Certificate & Retake Policies */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <span className="block font-bold text-slate-800 dark:text-slate-200">
                  Completion &amp; Retake Automation
                </span>

                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gradingForm.requireAllModulesComplete}
                    onChange={(e) =>
                      setGradingForm(prev => ({
                        ...prev,
                        requireAllModulesComplete: e.target.checked
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Require all modules completed for certificate</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gradingForm.requireQuizPassForCertificate}
                    onChange={(e) =>
                      setGradingForm(prev => ({
                        ...prev,
                        requireQuizPassForCertificate: e.target.checked
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Require passing quiz benchmark ({gradingForm.quizPassingScore}%)</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gradingForm.allowQuizRetakes}
                    onChange={(e) =>
                      setGradingForm(prev => ({
                        ...prev,
                        allowQuizRetakes: e.target.checked
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Allow students to retake quizzes after feedback</span>
                </label>

                {gradingForm.allowQuizRetakes && (
                  <div className="flex items-center justify-between gap-2 pt-1 tabular-nums">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Max attempts (0 = Unlimited)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={gradingForm.maxQuizAttempts}
                      onChange={(e) =>
                        setGradingForm(prev => ({
                          ...prev,
                          maxQuizAttempts: Math.max(0, Number(e.target.value) || 0)
                        }))
                      }
                      className="w-20 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!weightsValid}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Automated Grading Criteria</span>
              </button>
            </form>
          ) : (inspectorTarget.kind === 'chapter-content' || inspectorTarget.kind === 'section-content') && selectedHierarchyChapter ? (
            /* Level 1 Chapter & Level 2 Section Content Editor */
            <form onSubmit={handleSaveHierarchyContentDraft} className="space-y-3.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-blue-600 dark:text-cyan-400 font-bold">
                    {inspectorTarget.kind === 'section-content'
                      ? `Second-Level Section · ${selectedHierarchySection?.sectionNumber || ''}`
                      : `First-Level Chapter · ${selectedHierarchyChapter.chapterNumber}`}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {inspectorTarget.kind === 'section-content' && selectedHierarchySection
                      ? `Writing content inside "${selectedHierarchyChapter.chapterNumber} ${selectedHierarchyChapter.title} › ${selectedHierarchySection.sectionNumber} ${selectedHierarchySection.title}"`
                      : `Writing chapter-level overview content for "${selectedHierarchyChapter.chapterNumber} ${selectedHierarchyChapter.title}"`}
                  </p>
                </div>
                {onOpenHierarchyContentModal && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenHierarchyContentModal(
                        course.id,
                        selectedHierarchyChapter.id,
                        inspectorTarget.kind === 'section-content'
                          ? selectedHierarchySection?.id
                          : undefined
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-cyan-800 bg-blue-50/70 dark:bg-blue-950/30 text-blue-600 dark:text-cyan-400 text-[11px] font-semibold whitespace-nowrap shrink-0 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
                    title="Open full side-by-side rich content workspace"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Full Editor</span>
                  </button>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {inspectorTarget.kind === 'section-content' ? 'Section Title' : 'Chapter Title'}
                </label>
                <input
                  type="text"
                  required
                  value={hierarchyContentDraft.title}
                  onChange={(e) =>
                    setHierarchyContentDraft(prev => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Summary
                </label>
                <input
                  type="text"
                  value={hierarchyContentDraft.summary}
                  onChange={(e) =>
                    setHierarchyContentDraft(prev => ({ ...prev, summary: e.target.value }))
                  }
                  placeholder="Concise summary for learners..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Content (Markdown, Tables, Images &amp; Videos)
                </label>
                <RichMarkdownEditor
                  compact
                  rows={10}
                  resetKey={`${inspectorTarget.kind}-${selectedHierarchyChapter.id}-${selectedHierarchySection?.id || 'ch'}`}
                  value={hierarchyContentDraft.contentMarkdown}
                  onChange={(nextContent) =>
                    setHierarchyContentDraft(prev => ({
                      ...prev,
                      contentMarkdown: nextContent
                    }))
                  }
                  placeholder="Write chapter or section notes, tables, diagrams, and videos..."
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  Save {inspectorTarget.kind === 'section-content' ? 'Section' : 'Chapter'} Content
                </span>
              </button>
            </form>
          ) : inspectorTarget.kind === 'flashcard-module' ? (
            selectedFlashcardModule ? (
              <form onSubmit={handleSaveFlashcardDraft} className="space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold flex items-center gap-1">
                      <SquareStack className="w-3 h-3" />
                      <span>Flashcard Deck Inspector</span>
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Editing "{selectedFlashcardModule.title}"
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateFlashcardCards}
                    disabled={isGeneratingFlashcards}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] font-bold whitespace-nowrap shrink-0 disabled:opacity-60"
                    title="Generate 6 flashcards for this module using AI"
                  >
                    {isGeneratingFlashcards ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    <span>{isGeneratingFlashcards ? 'Generating...' : 'AI Cards'}</span>
                  </button>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Module Title
                  </label>
                  <input
                    type="text"
                    required
                    value={flashcardDraft.title}
                    onChange={(e) => setFlashcardDraft(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Deck Description / Review Goal
                  </label>
                  <input
                    type="text"
                    value={flashcardDraft.summary}
                    onChange={(e) => setFlashcardDraft(prev => ({ ...prev, summary: e.target.value }))}
                    placeholder="Key terms & concepts to review in this section..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                    Cards ({flashcardDraft.cards.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddFlashcardItem}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Card</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {flashcardDraft.cards.length === 0 ? (
                    <p className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center text-[11px] text-slate-500 dark:text-slate-400">
                      No cards yet. Click "+ Add Card" or "AI Cards" to populate this deck.
                    </p>
                  ) : (
                    flashcardDraft.cards.map((card, cIdx) => (
                      <div
                        key={card.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold text-slate-500 tabular-nums">
                            Card {cIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFlashcardItem(cIdx)}
                            className="text-[11px] text-red-500 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            required
                            value={card.term}
                            onChange={(e) => handleUpdateFlashcardItem(cIdx, { term: e.target.value })}
                            placeholder="Term / Topic..."
                            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                          />
                          <select
                            value={card.category}
                            onChange={(e) =>
                              handleUpdateFlashcardItem(cIdx, {
                                category: e.target.value as FlashcardCategory
                              })
                            }
                            className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          >
                            <option value="Terminology">Terminology</option>
                            <option value="Protocol">Protocol</option>
                            <option value="Port Number">Port Number</option>
                            <option value="Architecture">Architecture</option>
                          </select>
                        </div>

                        <input
                          type="text"
                          required
                          value={card.question}
                          onChange={(e) => handleUpdateFlashcardItem(cIdx, { question: e.target.value })}
                          placeholder="Front (Question / Prompt)..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />

                        <input
                          type="text"
                          required
                          value={card.answer}
                          onChange={(e) => handleUpdateFlashcardItem(cIdx, { answer: e.target.value })}
                          placeholder="Back (Answer)..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-700 dark:text-cyan-300 font-semibold"
                        />

                        <input
                          type="text"
                          value={card.explanation}
                          onChange={(e) => handleUpdateFlashcardItem(cIdx, { explanation: e.target.value })}
                          placeholder="Explanation (optional)..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px]"
                        />

                        <input
                          type="text"
                          value={card.memoryTip}
                          onChange={(e) => handleUpdateFlashcardItem(cIdx, { memoryTip: e.target.value })}
                          placeholder="Memory tip / mnemonic (optional)..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px]"
                        />
                      </div>
                    ))
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Flashcard Deck</span>
                </button>
              </form>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-3 text-xs">
                <SquareStack className="w-7 h-7 mx-auto text-cyan-500" />
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  No Flashcard deck selected yet
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Drag &ldquo;Flashcards&rdquo; from the Component Palette into any section or between modules, or inject one directly into the selected section.
                </p>
                <button
                  type="button"
                  onClick={() => handleInjectPaletteItem('flashcard')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Flashcard Deck</span>
                </button>
              </div>
            )
          ) : (
            /* Inline Quiz & Retention Check Question Editor */
            <form onSubmit={handleSaveQuizDraft} className="space-y-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-blue-600 dark:text-cyan-400 font-bold">
                  {inspectorTarget.kind === 'quiz-module'
                    ? 'Quiz Module Inspector'
                    : 'Between-Module Retention Check'}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {inspectorTarget.kind === 'quiz-module' && selectedQuizModule
                    ? `Editing graded module "${selectedQuizModule.title}"`
                    : selectedCheckpointPair
                    ? `Between "${selectedCheckpointPair.fromMod.title}" and "${selectedCheckpointPair.toMod.title}"`
                    : 'Select a quiz or retention check on the canvas to edit.'}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assessment Title
                </label>
                <input
                  type="text"
                  required
                  value={quizDraft.title}
                  onChange={(e) => setQuizDraft(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between gap-3 tabular-nums">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Passing Score Threshold (%)
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={quizDraft.passingScore}
                  onChange={(e) =>
                    setQuizDraft(prev => ({
                      ...prev,
                      passingScore: Math.min(100, Math.max(10, Number(e.target.value) || 70))
                    }))
                  }
                  className="w-20 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                  Questions ({quizDraft.questions.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddDraftQuestion}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Question</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {quizDraft.questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-500 tabular-nums">
                        Question {qIdx + 1}
                      </span>
                      <button
                        type="button"
                        disabled={quizDraft.questions.length <= 1}
                        onClick={() => handleRemoveDraftQuestion(qIdx)}
                        className="text-[11px] text-red-500 hover:text-red-600 disabled:opacity-30"
                      >
                        Remove
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      value={q.question}
                      onChange={(e) => handleUpdateDraftQuestion(qIdx, { question: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      placeholder="Question prompt..."
                    />

                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-1.5">
                          <input
                            type="radio"
                            name={`builder-correct-${q.id}`}
                            checked={q.correctAnswerIndex === optIdx}
                            onChange={() =>
                              handleUpdateDraftQuestion(qIdx, { correctAnswerIndex: optIdx })
                            }
                            title="Mark as correct option"
                          />
                          <input
                            type="text"
                            required
                            value={opt}
                            onChange={(e) => {
                              const nextOpts = [...q.options];
                              nextOpts[optIdx] = e.target.value;
                              handleUpdateDraftQuestion(qIdx, { options: nextOpts });
                            }}
                            className="flex-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          />
                        </div>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) =>
                        handleUpdateDraftQuestion(qIdx, { explanation: e.target.value })
                      }
                      placeholder="Immediate explanation shown to learners..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px]"
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={quizDraft.questions.length === 0}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Assessment Changes</span>
              </button>

              {inspectorTarget.kind === 'checkpoint' && selectedCheckpointPair && (
                <button
                  type="button"
                  onClick={() =>
                    handleRemoveModuleCheckpoint(
                      selectedCheckpointPair.fromMod.id,
                      selectedCheckpointPair.fromMod.title
                    )
                  }
                  className="w-full py-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60 font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove This Retention Check</span>
                </button>
              )}
            </form>
          )}
        </aside>
      </div>
    </div>
  );
};
