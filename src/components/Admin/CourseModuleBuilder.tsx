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
  ChevronRight
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { getBetweenModuleQuiz } from '../../data/checkpointQuizzes';
import {
  resolveCourseHierarchy,
  getModuleSectionBreadcrumb
} from '../../utils/courseHierarchy';
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
  onToast: (message: string) => void;
}

type PaletteItemKind = ModuleType | 'checkpoint';

type DragPayload =
  | { source: 'palette'; kind: PaletteItemKind }
  | { source: 'module'; moduleId: string; fromIndex: number };

type SelectedInspectorTarget =
  | { kind: 'grading' }
  | { kind: 'quiz-module'; moduleId: string }
  | { kind: 'checkpoint'; fromModuleId: string; toModuleId: string };

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
  }
];

function createStarterModule(kind: ModuleType, course: Course, defaultQuizPass: number): CourseModule {
  const stamp = Date.now();
  const nextNum = course.modules.length + 1;

  if (kind === 'quiz') {
    return {
      id: `mod-${stamp}`,
      title: `Module ${nextNum}: Knowledge Verification Quiz`,
      type: 'quiz',
      durationMin: 20,
      summary: 'Interactive graded assessment with immediate explanations and automated scoring.',
      quiz: {
        passingScore: defaultQuizPass,
        questions: [
          {
            id: `q-${stamp}-1`,
            question: `Key concept verification for ${course.code}:`,
            options: ['Primary Best Practice', 'Deprecated Legacy Option', 'Unencrypted Fallback', 'None of the above'],
            correctAnswerIndex: 0,
            explanation: 'Immediate feedback explanation shown as soon as a learner selects an answer.'
          }
        ]
      }
    };
  }

  if (kind === 'lab') {
    return {
      id: `mod-${stamp}`,
      title: `Module ${nextNum}: Hands-On CLI Configuration Lab`,
      type: 'lab',
      durationMin: 40,
      summary: 'Interactive Cisco IOS CLI lab with automated command verification.',
      lab: {
        objective: 'Configure interface addressing and verify routing reachability.',
        nodes: course.modules.find(m => m.lab?.nodes?.length)?.lab?.nodes || [
          { id: 'R1', name: 'R1-Core', type: 'router', ip: '10.0.0.1', subnet: '/30', status: 'online', x: 140, y: 150 },
          { id: 'R2', name: 'R2-Edge', type: 'router', ip: '10.0.0.2', subnet: '/30', status: 'online', x: 360, y: 150 }
        ],
        links: course.modules.find(m => m.lab?.links?.length)?.lab?.links || [
          { from: 'R1', to: 'R2', interfaceFrom: 'Gig0/0/0', interfaceTo: 'Gig0/0/0', status: 'up' }
        ],
        initialConfigPrompt: 'R1-Core#',
        expectedCommands: ['configure terminal', 'interface GigabitEthernet0/0/0', 'no shutdown', 'end'],
        terminalHints: ['Enter global config mode with "configure terminal".'],
        verificationCheck: 'show ip interface brief'
      }
    };
  }

  if (kind === 'video') {
    return {
      id: `mod-${stamp}`,
      title: `Module ${nextNum}: Architecture Walkthrough Video`,
      type: 'video',
      durationMin: 25,
      summary: 'Guided instructor walkthrough covering key protocol design trade-offs.',
      videoUrl: 'https://stream.netplus.academy/walkthrough',
      videoDuration: '18:30',
      contentMarkdown: '### Companion Notes\n\nReview the CLI configuration sequences demonstrated in this session.'
    };
  }

  if (kind === 'pcap') {
    return {
      id: `mod-${stamp}`,
      title: `Module ${nextNum}: Packet Capture Inspection`,
      type: 'pcap',
      durationMin: 30,
      summary: 'Analyze captured control-plane and data-plane headers in Wireshark.',
      contentMarkdown: '### Packet Analysis Objectives\n\nInspect protocol flags, timers, and handshake state transitions.'
    };
  }

  return {
    id: `mod-${stamp}`,
    title: `Module ${nextNum}: Core Concepts & Design Notes`,
    type: 'theory',
    durationMin: 30,
    summary: 'Structured reading module covering protocol mechanics and deployment patterns.',
    contentMarkdown: `# Module ${nextNum}: Core Concepts\n\nOutline key protocol rules, timer defaults, and verification steps here.`
  };
}

export const CourseModuleBuilder: React.FC<CourseModuleBuilderProps> = ({
  course,
  onClose,
  onEditFullModule,
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

  // Canvas mode: flat drag-and-drop sequence OR 3-level multi-section organizer (L1 Chapter -> L2 Main Contents -> L3 Course Contents)
  const [canvasViewMode, setCanvasViewMode] = useState<'sequence' | 'hierarchy'>('hierarchy');
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newMainContentTitle, setNewMainContentTitle] = useState('');
  const [targetChapterForNewMain, setTargetChapterForNewMain] = useState('');

  const hierarchyTree = useMemo(() => resolveCourseHierarchy(course), [course]);

  const handleAddLevel1Chapter = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newChapterTitle.trim();
    if (!clean) return;
    const baseChapters: CourseChapterSection[] = hierarchyTree.map(ch => ({
      id: ch.id,
      title: ch.title,
      summary: ch.summary,
      mainContents: ch.mainContents.map(mc => ({ id: mc.id, title: mc.title, summary: mc.summary }))
    }));
    if (baseChapters.some(ch => ch.title.toLowerCase() === clean.toLowerCase())) {
      onToast(`Chapter "${clean}" already exists.`);
      return;
    }
    const newChapId = `chap-${Date.now()}`;
    baseChapters.push({
      id: newChapId,
      title: clean,
      mainContents: [{ id: `sec-${Date.now()}`, title: 'Core Topics & Lessons' }]
    });
    updateCourse(course.id, { chapters: baseChapters });
    setNewChapterTitle('');
    setTargetChapterForNewMain(clean);
    onToast(`Added Level-1 Chapter: "${clean}"`);
  };

  const handleAddLevel2MainContent = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newMainContentTitle.trim();
    const targetChapTitle = (targetChapterForNewMain || hierarchyTree[0]?.title || '').trim();
    if (!clean || !targetChapTitle) return;
    const baseChapters: CourseChapterSection[] = hierarchyTree.map(ch => ({
      id: ch.id,
      title: ch.title,
      summary: ch.summary,
      mainContents: ch.mainContents.map(mc => ({ id: mc.id, title: mc.title, summary: mc.summary }))
    }));
    const chap = baseChapters.find(ch => ch.title.toLowerCase() === targetChapTitle.toLowerCase());
    if (!chap) return;
    if (chap.mainContents.some(mc => mc.title.toLowerCase() === clean.toLowerCase())) {
      onToast(`Main content "${clean}" already exists in "${chap.title}".`);
      return;
    }
    chap.mainContents.push({ id: `sec-${Date.now()}`, title: clean });
    updateCourse(course.id, { chapters: baseChapters });
    setNewMainContentTitle('');
    onToast(`Added Level-2 Section "${clean}" inside "${chap.title}"`);
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
    onToast(`Assigned module to "${chapterTitle} › ${mainContentTitle}"`);
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
        : resolved?.questions || [];
      setQuizDraft({
        title: fromMod.checkpointQuiz?.title || resolved?.title || `Retention Check: ${fromMod.title}`,
        passingScore: fromMod.checkpointQuiz?.passingScore ?? resolved?.passingScore ?? gradingForm.quizPassingScore,
        questions: sourceQuestions.map(q => ({ ...q, options: [...q.options] }))
      });
    }
  }, [course, gradingForm.quizPassingScore, inspectorTarget, selectedCheckpointPair, selectedQuizModule]);

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
      }
    });

    return { quizzes, labs, lessons, retentionChecks, totalMinutes };
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

    const newMod = createStarterModule(kind, course, gradingForm.quizPassingScore);
    const targetIdx = typeof insertAtIndex === 'number' ? insertAtIndex : course.modules.length;
    addModuleToCourse(course.id, newMod, targetIdx);
    if (newMod.type === 'quiz') {
      setInspectorTarget({ kind: 'quiz-module', moduleId: newMod.id });
    }
    onToast(`Injected "${newMod.title}" at position #${targetIdx + 1}`);
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
        <aside className="xl:col-span-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700 dark:text-slate-200">
              Component Palette
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Drag any block onto the syllabus canvas or click + to inject.
            </p>
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

        {/* Zone 2: Drag-and-Drop & Multi-Level Curriculum Canvas */}
        <section
          aria-label="Curriculum drop canvas"
          className="xl:col-span-5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700 dark:text-slate-200">
                Curriculum Canvas
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Organize Level-1 Chapters, Level-2 Main Contents, and Level-3 Course Contents.
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
                3-Level Sections
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
                Drag &amp; Drop ({course.modules.length})
              </button>
            </div>
          </div>

          {canvasViewMode === 'hierarchy' ? (
            <div className="space-y-3">
              {/* Quick Section Creators (Level 1 Chapter & Level 2 Main Content) */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <form onSubmit={handleAddLevel1Chapter} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    placeholder="New Level-1 Chapter Title..."
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Add L1 Chapter</span>
                  </button>
                </form>

                <form onSubmit={handleAddLevel2MainContent} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <select
                    value={targetChapterForNewMain || hierarchyTree[0]?.title || ''}
                    onChange={(e) => setTargetChapterForNewMain(e.target.value)}
                    aria-label="Target Level 1 chapter"
                    className="w-full sm:w-40 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-200"
                  >
                    {hierarchyTree.map(ch => (
                      <option key={ch.id} value={ch.title}>
                        {ch.chapterLabel}: {ch.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newMainContentTitle}
                    onChange={(e) => setNewMainContentTitle(e.target.value)}
                    placeholder="New Level-2 Main Content..."
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-cyan-800 bg-blue-50 dark:bg-cyan-950/40 text-blue-700 dark:text-cyan-300 hover:bg-blue-100 dark:hover:bg-cyan-950/70 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add L2 Section</span>
                  </button>
                </form>
              </div>

              {/* 3-Level Nested Preview & Assignment Tree */}
              <div className="space-y-2.5">
                {hierarchyTree.map((ch) => (
                  <div
                    key={ch.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900"
                  >
                    {/* Level 1 */}
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                        <span className="font-mono text-[10px] font-bold uppercase text-blue-600 dark:text-cyan-400 shrink-0">
                          L1 · {ch.chapterLabel}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {ch.title}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] tabular-nums text-slate-500 shrink-0">
                        {ch.totalModules} items
                      </span>
                    </div>

                    {/* Level 2 */}
                    <div className="p-2.5 space-y-2">
                      {ch.mainContents.map((mc) => (
                        <div
                          key={mc.id}
                          className="pl-2.5 border-l border-slate-200 dark:border-slate-800 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                                L2 · {mc.sectionNumber}
                              </span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {mc.title}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] tabular-nums text-slate-400 shrink-0">
                              {mc.items.length} L3
                            </span>
                          </div>

                          {/* Level 3 items */}
                          <div className="pl-3 space-y-1.5">
                            {mc.items.length === 0 ? (
                              <p className="text-[10px] italic text-slate-400 py-1">
                                Assign any module below or switch to Drag &amp; Drop to reorder.
                              </p>
                            ) : (
                              mc.items.map(({ module: mod, itemNumber }) => (
                                <div
                                  key={mod.id}
                                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (mod.type === 'quiz') {
                                        setInspectorTarget({ kind: 'quiz-module', moduleId: mod.id });
                                      } else {
                                        onEditFullModule(course.id, mod);
                                      }
                                    }}
                                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                                  >
                                    <span className="font-mono text-[10px] font-bold text-slate-400 shrink-0">
                                      {itemNumber}
                                    </span>
                                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate hover:text-blue-600 dark:hover:text-cyan-400">
                                      {mod.title}
                                    </span>
                                  </button>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <select
                                      aria-label={`Move ${mod.title} to another section`}
                                      value={`${ch.title}:::${mc.title}`}
                                      onChange={(e) => {
                                        const [nextCh, nextMc] = e.target.value.split(':::');
                                        if (nextCh && nextMc) {
                                          handleAssignModuleSection(mod.id, nextCh, nextMc);
                                        }
                                      }}
                                      className="max-w-[170px] px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-300"
                                    >
                                      {hierarchyTree.map(optCh =>
                                        optCh.mainContents.map(optMc => (
                                          <option
                                            key={`${optCh.id}-${optMc.id}`}
                                            value={`${optCh.title}:::${optMc.title}`}
                                          >
                                            {optCh.chapterLabel} › {optMc.sectionNumber} {optMc.title}
                                          </option>
                                        ))
                                      )}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => onEditFullModule(course.id, mod)}
                                      className="p-1 rounded text-slate-500 hover:text-blue-600 dark:hover:text-cyan-400"
                                      title="Edit Course Content"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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
                      ) : (
                        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (mod.type === 'quiz') {
                            setInspectorTarget({ kind: 'quiz-module', moduleId: mod.id });
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
                          } else {
                            onEditFullModule(course.id, mod);
                          }
                        }}
                        className="p-1 rounded text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-cyan-400"
                        title={mod.type === 'quiz' ? 'Edit Quiz in Inspector' : 'Edit Module Content'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={course.modules.length <= 1}
                        onClick={() => {
                          deleteModuleFromCourse(course.id, mod.id);
                          if (isSelectedQuiz) setInspectorTarget({ kind: 'grading' });
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
                          <button
                            type="button"
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
                            onClick={() =>
                              setInspectorTarget({
                                kind: 'checkpoint',
                                fromModuleId: mod.id,
                                toModuleId: nextMod.id
                              })
                            }
                            className={`w-full px-3 py-2 rounded-lg border text-left transition-colors duration-150 motion-reduce:transition-none flex items-center justify-between gap-2 text-[11px] ${
                              isCheckpointHovered
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-cyan-200 font-semibold'
                                : isSelectedCheckpoint
                                ? 'border-blue-500 dark:border-cyan-400 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-cyan-200 font-semibold'
                                : 'border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-cyan-500'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                              <span className="truncate tabular-nums">
                                Retention Check · {betweenQuiz ? `${betweenQuiz.questions.length} Qs` : 'Inject Quiz'}
                                {betweenQuiz ? ` · Pass ${betweenQuiz.passingScore}%` : ''}
                              </span>
                            </span>
                            <span className="font-mono text-[10px] text-blue-600 dark:text-cyan-400 font-semibold whitespace-nowrap shrink-0">
                              {isCheckpointHovered
                                ? 'Drop to Inject'
                                : hasCustom
                                ? 'Custom · Edit'
                                : 'Configure'}
                            </span>
                          </button>
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
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setInspectorTarget({ kind: 'grading' })}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                inspectorTarget.kind === 'grading'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Automated Grading
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
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                inspectorTarget.kind !== 'grading'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Quiz Editor
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
            </form>
          )}
        </aside>
      </div>
    </div>
  );
};
