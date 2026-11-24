import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  Copy,
  RotateCcw,
  Search,
  Terminal
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import {
  LAB_EXERCISES,
  LAB_EXERCISE_CATEGORIES,
  LabDifficulty,
  LabExerciseCategory
} from '../../data/labExercisesData';
import { LabExerciseTopology } from '../../data/labExerciseTopologies';
import { SimulatorTopologyLaunchPayload } from './networkSimTypes';
import {
  LAB_EXERCISE_TOPOLOGIES_UPDATED_EVENT,
  LabExerciseTopologyMap,
  deleteLocalLabExerciseTopology,
  getResolvedLabExerciseTopology,
  loadLocalLabExerciseTopologies,
  mergeLabExerciseTopologyMaps,
  saveLocalLabExerciseTopology
} from '../../utils/labExerciseTopologyStorage';
import {
  auth,
  deleteLabExerciseTopologyFromFirestore,
  fetchLabExerciseTopologiesFromFirestore,
  saveLabExerciseTopologyToFirestore
} from '../../firebase';
import { LabTopologyDiagramCard } from './LabTopologyDiagramCard';
import { LabTopologyEditorModal } from './LabTopologyEditorModal';

interface LabExercisesViewProps {
  onOpenSimulator?: () => void;
  onOpenSimulatorWithTopology?: (payload: SimulatorTopologyLaunchPayload) => void;
}

interface LabProgressStore {
  completedStepIds: Record<string, boolean>;
  completedLabIds: Record<string, boolean>;
}

const PROGRESS_STORAGE_PREFIX = 'netpulse_lab_exercises_progress_v1';

function loadLabProgress(userId: string): LabProgressStore {
  if (!userId) return { completedStepIds: {}, completedLabIds: {} };
  try {
    const raw = window.localStorage.getItem(`${PROGRESS_STORAGE_PREFIX}:${userId}`);
    if (!raw) return { completedStepIds: {}, completedLabIds: {} };
    const parsed = JSON.parse(raw);
    return {
      completedStepIds:
        parsed && typeof parsed.completedStepIds === 'object' && parsed.completedStepIds
          ? parsed.completedStepIds
          : {},
      completedLabIds:
        parsed && typeof parsed.completedLabIds === 'object' && parsed.completedLabIds
          ? parsed.completedLabIds
          : {}
    };
  } catch {
    return { completedStepIds: {}, completedLabIds: {} };
  }
}

export const LabExercisesView: React.FC<LabExercisesViewProps> = ({
  onOpenSimulator,
  onOpenSimulatorWithTopology
}) => {
  const { currentUser, authReady, isOffline } = useAcademy();
  const userId = currentUser.id || 'guest';
  const canEditTopology =
    currentUser.role === 'admin' || currentUser.role === 'instructor';

  const [progress, setProgress] = useState<LabProgressStore>(() => loadLabProgress(userId));
  const [selectedLabId, setSelectedLabId] = useState<string>(LAB_EXERCISES[0].id);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | LabExerciseCategory>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'All' | LabDifficulty>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customTopologyMap, setCustomTopologyMap] = useState<LabExerciseTopologyMap>(() =>
    loadLocalLabExerciseTopologies()
  );
  const [isTopologyEditorOpen, setIsTopologyEditorOpen] = useState<boolean>(false);
  const [topologyNotice, setTopologyNotice] = useState<{
    tone: 'success' | 'info';
    text: string;
  } | null>(null);
  const workspaceScrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setProgress(loadLabProgress(userId));
  }, [userId]);

  useEffect(() => {
    const syncLocal = () => {
      setCustomTopologyMap(loadLocalLabExerciseTopologies());
    };
    window.addEventListener(LAB_EXERCISE_TOPOLOGIES_UPDATED_EVENT, syncLocal);
    return () => {
      window.removeEventListener(LAB_EXERCISE_TOPOLOGIES_UPDATED_EVENT, syncLocal);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!authReady || isOffline) return;
    if (!auth.currentUser || !auth.currentUser.emailVerified) return;

    fetchLabExerciseTopologiesFromFirestore()
      .then(remoteList => {
        if (cancelled || !remoteList || remoteList.length === 0) return;
        const localMap = loadLocalLabExerciseTopologies();
        const merged = mergeLabExerciseTopologyMaps(localMap, remoteList);
        setCustomTopologyMap(merged);
      })
      .catch(() => {
        // Ignore if rules/offline unavailable; local overrides and defaults remain active
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, currentUser.id, isOffline]);

  useEffect(() => {
    if (!topologyNotice) return;
    const timer = window.setTimeout(() => setTopologyNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [topologyNotice]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `${PROGRESS_STORAGE_PREFIX}:${userId}`,
        JSON.stringify(progress)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [progress, userId]);

  const filteredLabs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return LAB_EXERCISES.filter(lab => {
      if (selectedCategory !== 'All' && lab.category !== selectedCategory) return false;
      if (selectedDifficulty !== 'All' && lab.difficulty !== selectedDifficulty) return false;
      if (!q) return true;
      return (
        lab.title.toLowerCase().includes(q) ||
        lab.summary.toLowerCase().includes(q) ||
        lab.category.toLowerCase().includes(q) ||
        `lab ${lab.labNumber}`.includes(q) ||
        `lab${lab.labNumber}`.includes(q) ||
        lab.steps.some(
          s =>
            s.title.toLowerCase().includes(q) ||
            s.commands.some(cmd => cmd.toLowerCase().includes(q))
        )
      );
    });
  }, [searchQuery, selectedCategory, selectedDifficulty]);

  const activeLab = useMemo(() => {
    return (
      LAB_EXERCISES.find(l => l.id === selectedLabId) ||
      filteredLabs[0] ||
      LAB_EXERCISES[0]
    );
  }, [selectedLabId, filteredLabs]);

  useEffect(() => {
    if (workspaceScrollRef.current) {
      workspaceScrollRef.current.scrollTop = 0;
    }
  }, [activeLab.id]);

  const activeLabIndex = LAB_EXERCISES.findIndex(l => l.id === activeLab.id);
  const prevLab = activeLabIndex > 0 ? LAB_EXERCISES[activeLabIndex - 1] : null;
  const nextLab =
    activeLabIndex >= 0 && activeLabIndex < LAB_EXERCISES.length - 1
      ? LAB_EXERCISES[activeLabIndex + 1]
      : null;

  const totalCompletedLabs = useMemo(
    () => LAB_EXERCISES.filter(lab => Boolean(progress.completedLabIds[lab.id])).length,
    [progress.completedLabIds]
  );

  const activeLabCompletedSteps = activeLab.steps.filter(
    step => progress.completedStepIds[step.id]
  ).length;
  const isActiveLabCompleted = Boolean(progress.completedLabIds[activeLab.id]);

  const handleToggleStep = (stepId: string) => {
    setProgress(prev => {
      const nextSteps = {
        ...prev.completedStepIds,
        [stepId]: !prev.completedStepIds[stepId]
      };
      const allDone = activeLab.steps.every(s => Boolean(nextSteps[s.id]));
      return {
        completedStepIds: nextSteps,
        completedLabIds: {
          ...prev.completedLabIds,
          [activeLab.id]: allDone
        }
      };
    });
  };

  const handleToggleCompleteLab = () => {
    setProgress(prev => {
      const nextDone = !prev.completedLabIds[activeLab.id];
      const nextSteps = { ...prev.completedStepIds };
      activeLab.steps.forEach(step => {
        nextSteps[step.id] = nextDone;
      });
      return {
        completedStepIds: nextSteps,
        completedLabIds: {
          ...prev.completedLabIds,
          [activeLab.id]: nextDone
        }
      };
    });
  };

  const handleResetActiveLab = () => {
    setProgress(prev => {
      const nextSteps = { ...prev.completedStepIds };
      activeLab.steps.forEach(step => {
        delete nextSteps[step.id];
      });
      const nextLabs = { ...prev.completedLabIds };
      delete nextLabs[activeLab.id];
      return {
        completedStepIds: nextSteps,
        completedLabIds: nextLabs
      };
    });
  };

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId(prev => (prev === id ? null : prev));
      }, 1800);
    } catch {
      // Ignore clipboard failures in restricted frames
    }
  };

  const completionPct = Math.round((totalCompletedLabs / LAB_EXERCISES.length) * 100);

  const activeTopology = useMemo(
    () => getResolvedLabExerciseTopology(activeLab.id, customTopologyMap),
    [activeLab.id, customTopologyMap]
  );

  const handleSaveEditedTopology = async (updated: LabExerciseTopology) => {
    const actorRole: 'admin' | 'instructor' =
      currentUser.role === 'admin' ? 'admin' : 'instructor';
    const enriched: LabExerciseTopology = {
      ...updated,
      labId: activeLab.id,
      updatedAt: new Date().toISOString(),
      updatedByName: currentUser.name || actorRole,
      updatedByRole: actorRole,
      isCustomized: true
    };
    const nextMap = saveLocalLabExerciseTopology(enriched);
    setCustomTopologyMap(nextMap);

    let syncedCloud = false;
    if (auth.currentUser && auth.currentUser.emailVerified && !isOffline) {
      try {
        syncedCloud = await saveLabExerciseTopologyToFirestore(enriched, {
          name: currentUser.name || actorRole,
          role: actorRole
        });
      } catch {
        syncedCloud = false;
      }
    }

    setIsTopologyEditorOpen(false);
    setTopologyNotice({
      tone: 'success',
      text: syncedCloud
        ? `Updated topology for Lab ${activeLab.labNumber} and synced to Firestore.`
        : `Updated topology for Lab ${activeLab.labNumber} locally.`
    });
  };

  const handleResetTopologyToDefault = async () => {
    const nextMap = deleteLocalLabExerciseTopology(activeLab.id);
    setCustomTopologyMap(nextMap);

    let deletedCloud = false;
    if (auth.currentUser && auth.currentUser.emailVerified && !isOffline) {
      try {
        deletedCloud = await deleteLabExerciseTopologyFromFirestore(activeLab.id);
      } catch {
        deletedCloud = false;
      }
    }

    setIsTopologyEditorOpen(false);
    setTopologyNotice({
      tone: 'info',
      text: deletedCloud
        ? `Restored default curriculum topology for Lab ${activeLab.labNumber} across cloud & local.`
        : `Restored default curriculum topology for Lab ${activeLab.labNumber}.`
    });
  };

  const handleLaunchTopologyInSimulator = () => {
    if (!onOpenSimulatorWithTopology) {
      onOpenSimulator?.();
      return;
    }
    onOpenSimulatorWithTopology({
      nonce: Date.now(),
      title: `Lab ${activeLab.labNumber}: ${activeLab.title}`,
      presetId: activeLab.id,
      canvasWidth: activeTopology.canvasWidth,
      canvasHeight: activeTopology.canvasHeight,
      devices: JSON.parse(JSON.stringify(activeTopology.devices)),
      links: JSON.parse(JSON.stringify(activeTopology.links)),
      shapes: JSON.parse(JSON.stringify(activeTopology.shapes)),
      labels: JSON.parse(JSON.stringify(activeTopology.labels))
    });
  };

  return (
    <div className="w-full min-w-0 flex flex-col gap-5 lg:h-[calc(100vh-6.75rem)] lg:min-h-[640px]">
      {/* Page Header & Overall Lab Workbook Progress */}
      <div className="shrink-0 p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Networking Lab Exercises &amp; Configuration Guides
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Step-by-step Cisco IOS lab workbooks covering initial device setup, SSH hardening, ROMMON recovery, VLANs, OSPF, NAT/PAT, and ACLs.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="text-left lg:text-right">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Workbook Completion
              </p>
              <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {totalCompletedLabs} / {LAB_EXERCISES.length} Labs · {completionPct}%
              </p>
            </div>
            {onOpenSimulator && (
              <button
                type="button"
                onClick={onOpenSimulator}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Launch CLI Simulator</span>
              </button>
            )}
          </div>
        </div>

        {/* Clean Progress Track + Filter Row */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-[210px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search labs, IOS commands, protocols..."
                aria-label="Search lab exercises"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              aria-label="Filter by difficulty"
              value={selectedDifficulty}
              onChange={e => setSelectedDifficulty(e.target.value as 'All' | LabDifficulty)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Levels</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          <div
            role="group"
            aria-label="Filter lab exercises by category"
            className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80"
          >
            {(['All', ...LAB_EXERCISE_CATEGORIES] as const).map(cat => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  aria-pressed={active}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main 2-Column Lab Workbook Layout with Independent Vertical Scrollbars */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-w-0 lg:flex-1 lg:min-h-0">
        {/* Left Directory: Lab Guidelines Index */}
        <aside
          aria-label="Lab Exercises Directory"
          className="lg:col-span-4 min-w-0 flex flex-col lg:h-full lg:min-h-0 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 overflow-hidden"
        >
          <div className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white">
              Lab Guidelines ({filteredLabs.length})
            </h2>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {totalCompletedLabs}/{LAB_EXERCISES.length} done
            </span>
          </div>

          {filteredLabs.length === 0 ? (
            <div className="p-6 text-center space-y-2.5 flex-1 flex flex-col items-center justify-center">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                No matching lab exercises found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Try clearing your search filter or selecting All categories.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setSelectedDifficulty('All');
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[380px] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto overscroll-contain">
              {filteredLabs.map(lab => {
                const isSelected = activeLab.id === lab.id;
                const doneSteps = lab.steps.filter(s => progress.completedStepIds[s.id]).length;
                const isDone = Boolean(progress.completedLabIds[lab.id]);

                return (
                  <button
                    key={lab.id}
                    type="button"
                    onClick={() => setSelectedLabId(lab.id)}
                    className={`w-full text-left px-4 py-3.5 transition-colors flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                      isSelected
                        ? 'bg-blue-50/75 dark:bg-blue-950/35'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="pt-0.5 shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-mono font-bold tabular-nums ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {lab.labNumber}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <p
                        className={`text-xs font-bold leading-snug ${
                          isSelected
                            ? 'text-blue-700 dark:text-cyan-300'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        Lab {lab.labNumber}: {lab.title}
                      </p>

                      {/* Zero-pill unboxed metadata with typographic separator */}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        <span>{lab.category}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{lab.difficulty}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono tabular-nums">{lab.estimatedMinutes}m</span>
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-200 ${
                              isDone
                                ? 'bg-emerald-500'
                                : 'bg-blue-600 dark:bg-cyan-400'
                            }`}
                            style={{
                              width: `${Math.round((doneSteps / lab.steps.length) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                          {doneSteps}/{lab.steps.length}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Right Workspace: Detailed Lab Manual & Interactive Steps */}
        <article
          ref={workspaceScrollRef}
          aria-label={`Lab ${activeLab.labNumber}: ${activeLab.title}`}
          className="lg:col-span-8 min-w-0 lg:h-full lg:min-h-0 lg:overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6"
        >
          {/* Lab Title & Actions */}
          <header className="space-y-3 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-mono text-blue-600 dark:text-cyan-400 font-semibold">
                Lab {activeLab.labNumber} · {activeLab.category} · {activeLab.difficulty} ·{' '}
                <span className="tabular-nums">~{activeLab.estimatedMinutes} min</span>
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {activeLabCompletedSteps > 0 && (
                  <button
                    type="button"
                    onClick={handleResetActiveLab}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleCompleteLab}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    isActiveLabCompleted
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <BookOpenCheck className="w-3.5 h-3.5" />
                  <span>{isActiveLabCompleted ? 'Lab Completed' : 'Mark Lab Complete'}</span>
                </button>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight text-balance">
              Lab {activeLab.labNumber}: {activeLab.title}
            </h2>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {activeLab.scenario}
            </p>
          </header>

          {/* Learning Objectives & Prerequisites */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                01. Lab Objectives
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeLab.objectives.map((obj, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono text-blue-600 dark:text-cyan-400 font-bold shrink-0">
                      {String(idx + 1).padStart(2, '0')}.
                    </span>
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Prerequisites &amp; Readiness
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {activeLab.prerequisites.map((req, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono text-slate-400 shrink-0">·</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Interactive Lab Simulation-Style Network Topology Diagram */}
          {topologyNotice && (
            <div
              className={`px-3.5 py-2 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
                topologyNotice.tone === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-blue-50 dark:bg-blue-950/35 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-cyan-300'
              }`}
            >
              <span>{topologyNotice.text}</span>
              <button
                type="button"
                onClick={() => setTopologyNotice(null)}
                className="text-[11px] font-semibold underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          <LabTopologyDiagramCard
            labNumber={activeLab.labNumber}
            labTitle={activeLab.title}
            topologySummary={activeLab.topologySummary}
            topology={activeTopology}
            canEdit={canEditTopology}
            onEditTopology={() => setIsTopologyEditorOpen(true)}
            onLaunchSimulator={handleLaunchTopologyInSimulator}
          />

          {/* Addressing Table */}
          <section className="space-y-2.5 pb-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              03. Addressing &amp; Interface Assignment Table
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Device</th>
                    <th className="py-2.5 px-3">Interface</th>
                    <th className="py-2.5 px-3">IPv4 Address</th>
                    <th className="py-2.5 px-3">Subnet Mask</th>
                    <th className="py-2.5 px-3">Role / VLAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeLab.addressingTable.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-200"
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {row.device}
                      </td>
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        {row.interfaceName}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-blue-600 dark:text-cyan-400 whitespace-nowrap">
                        {row.ipAddress}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                        {row.subnetMask}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                        {row.roleOrVlan}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Step-by-Step Interactive Tasks */}
          <section className="space-y-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                04. Step-by-Step Configuration Procedure
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {activeLabCompletedSteps} / {activeLab.steps.length} tasks checked
              </span>
            </div>

            <div className="space-y-5">
              {activeLab.steps.map(step => {
                const isChecked = Boolean(progress.completedStepIds[step.id]);
                const cliText = step.commands.join('\n');
                const copyKey = `step-${step.id}`;

                return (
                  <div
                    key={step.id}
                    className={`rounded-xl border p-4 space-y-3 transition-colors ${
                      isChecked
                        ? 'bg-emerald-50/35 dark:bg-emerald-950/15 border-emerald-200/80 dark:border-emerald-900/60'
                        : 'bg-slate-50/50 dark:bg-slate-900/35 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStep(step.id)}
                        className="flex items-start gap-3 text-left min-w-0 flex-1 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
                      >
                        <span className="pt-0.5 shrink-0">
                          {isChecked ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors" />
                          )}
                        </span>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            Task {step.stepNumber} · {step.device} · {step.promptHint}
                          </p>
                          <h4
                            className={`text-sm font-bold ${
                              isChecked
                                ? 'text-emerald-900 dark:text-emerald-200'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {step.title}
                          </h4>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyText(copyKey, cliText)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        title="Copy Cisco IOS commands"
                      >
                        {copiedId === copyKey ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy CLI</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-8">
                      {step.instructions}
                    </p>

                    <div className="pl-8">
                      <pre className="p-3 rounded-lg bg-slate-900 dark:bg-[#050811] text-slate-100 border border-slate-800 font-mono text-xs leading-relaxed overflow-x-auto">
                        <code>{cliText}</code>
                      </pre>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 pl-8">
                      <strong className="font-semibold text-slate-700 dark:text-slate-200">
                        Expected Result:
                      </strong>{' '}
                      {step.expectedOutcome}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Verification Checklist */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              05. Verification &amp; Audit Commands
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {activeLab.verificationChecklist.map((item, idx) => {
                const verifyCopyId = `verify-${activeLab.id}-${idx}`;
                return (
                  <div
                    key={idx}
                    className="p-3.5 bg-white dark:bg-[#0c1220] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-xs font-mono font-bold text-blue-600 dark:text-cyan-400">
                          {item.command}
                        </code>
                        <span className="text-[11px] font-mono text-slate-400">
                          on {item.device}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {item.whatToVerify}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyText(verifyCopyId, item.command)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-[11px] font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-center"
                    >
                      {copiedId === verifyCopyId ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Lab Pagination Footer */}
          <footer className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            {prevLab ? (
              <button
                type="button"
                onClick={() => setSelectedLabId(prevLab.id)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>
                  Lab {prevLab.labNumber}: {prevLab.title}
                </span>
              </button>
            ) : (
              <span />
            )}

            {nextLab && (
              <button
                type="button"
                onClick={() => setSelectedLabId(nextLab.id)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-2"
              >
                <span>
                  Next: Lab {nextLab.labNumber} · {nextLab.title}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </footer>
        </article>
      </div>

      {isTopologyEditorOpen && canEditTopology && (
        <LabTopologyEditorModal
          labNumber={activeLab.labNumber}
          labTitle={activeLab.title}
          initialTopology={activeTopology}
          onSave={handleSaveEditedTopology}
          onResetToDefault={handleResetTopologyToDefault}
          onClose={() => setIsTopologyEditorOpen(false)}
        />
      )}
    </div>
  );
};
