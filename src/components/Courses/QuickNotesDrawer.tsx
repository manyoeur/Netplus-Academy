import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Edit3,
  NotebookPen,
  Plus,
  Save,
  Search,
  Sparkles,
  Tag,
  Trash2,
  UserCheck,
  Video,
  X,
} from 'lucide-react';
import { Course, CourseModule } from '../../types';
import {
  QUICK_NOTE_TAGS,
  QuickNote,
  QuickNoteInput,
  formatVideoTimestamp,
} from '../../utils/quickNotes';

interface QuickNotesDrawerProps {
  isOpen: boolean;
  userName: string;
  notes: QuickNote[];
  courses: Course[];
  activeCourse?: Course;
  activeModule?: CourseModule;
  currentVideoSeconds?: number;
  onSeekVideo?: (seconds: number) => void;
  onNavigateToModule?: (courseId: string, moduleId: string) => void;
  onSaveNote: (input: QuickNoteInput) => QuickNote;
  onDeleteNote: (noteId: string) => void;
  onClose: () => void;
}

type NotesScope = 'module' | 'course' | 'all';

export const QuickNotesDrawer: React.FC<QuickNotesDrawerProps> = ({
  isOpen,
  userName,
  notes,
  courses,
  activeCourse,
  activeModule,
  currentVideoSeconds = 0,
  onSeekVideo,
  onNavigateToModule,
  onSaveNote,
  onDeleteNote,
  onClose,
}) => {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Concept']);
  const [includeTimestamp, setIncludeTimestamp] = useState<boolean>(true);
  const [capturedTimestamp, setCapturedTimestamp] = useState<number | undefined>(undefined);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(activeCourse?.id || '');
  const [selectedModuleId, setSelectedModuleId] = useState<string>(activeModule?.id || '');

  const [scope, setScope] = useState<NotesScope>(activeModule ? 'module' : 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isVideoContext = activeModule?.type === 'video';

  // Sync target course/module when drawer opens or active lesson changes
  useEffect(() => {
    if (!isOpen) return;
    if (!editingNoteId) {
      if (activeCourse) {
        setSelectedCourseId(activeCourse.id);
      } else if (courses.length > 0 && !selectedCourseId) {
        setSelectedCourseId(courses[0].id);
      }
      if (activeModule) {
        setSelectedModuleId(activeModule.id);
        setScope('module');
      } else {
        setScope('all');
      }
    }
  }, [isOpen, activeCourse?.id, activeModule?.id, editingNoteId, courses]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && !editingNoteId) {
      const focusTimer = window.setTimeout(() => {
        textareaRef.current?.focus();
      }, 120);
      return () => window.clearTimeout(focusTimer);
    }
  }, [isOpen, editingNoteId]);

  const targetCourse = useMemo(
    () => courses.find(c => c.id === selectedCourseId) || activeCourse || courses[0],
    [courses, selectedCourseId, activeCourse]
  );

  const targetModule = useMemo(() => {
    if (activeModule && targetCourse?.id === activeCourse?.id && selectedModuleId === activeModule.id) {
      return activeModule;
    }
    return targetCourse?.modules.find(m => m.id === selectedModuleId) || targetCourse?.modules[0];
  }, [activeModule, activeCourse?.id, targetCourse, selectedModuleId]);

  const moduleNotesCount = useMemo(
    () =>
      activeModule && activeCourse
        ? notes.filter(n => n.courseId === activeCourse.id && n.moduleId === activeModule.id).length
        : 0,
    [notes, activeCourse, activeModule]
  );

  const courseNotesCount = useMemo(
    () => (activeCourse ? notes.filter(n => n.courseId === activeCourse.id).length : 0),
    [notes, activeCourse]
  );

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes.filter(note => {
      if (scope === 'module' && activeCourse && activeModule) {
        if (note.courseId !== activeCourse.id || note.moduleId !== activeModule.id) return false;
      } else if (scope === 'course' && activeCourse) {
        if (note.courseId !== activeCourse.id) return false;
      }
      if (!q) return true;
      return (
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q) ||
        note.moduleTitle.toLowerCase().includes(q) ||
        (note.courseCode || '').toLowerCase().includes(q) ||
        note.tags.some(t => t.toLowerCase().includes(q))
      );
    });
  }, [notes, scope, activeCourse, activeModule, searchQuery]);

  if (!isOpen) return null;

  const resetComposer = () => {
    setEditingNoteId(null);
    setTitle('');
    setContent('');
    setSelectedTags(['Concept']);
    setIncludeTimestamp(true);
    setCapturedTimestamp(undefined);
    setValidationError(null);
    if (activeCourse) setSelectedCourseId(activeCourse.id);
    if (activeModule) setSelectedModuleId(activeModule.id);
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : prev.length < 6
        ? [...prev, tag]
        : prev
    );
  };

  const handleCaptureCurrentTimestamp = () => {
    const sec = Math.max(0, Math.floor(currentVideoSeconds));
    setCapturedTimestamp(sec);
    setIncludeTimestamp(true);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanContent = content.trim();
    if (!cleanContent) {
      setValidationError('Enter a technical concept or note before saving.');
      return;
    }

    const effectiveTimestamp = editingNoteId
      ? includeTimestamp
        ? capturedTimestamp
        : undefined
      : isVideoContext && includeTimestamp
      ? typeof capturedTimestamp === 'number'
        ? capturedTimestamp
        : Math.max(0, Math.floor(currentVideoSeconds))
      : undefined;

    const saved = onSaveNote({
      id: editingNoteId || undefined,
      courseId: targetCourse?.id || 'general',
      courseCode: targetCourse?.code,
      courseTitle: targetCourse?.title,
      moduleId: targetModule?.id || 'module-general',
      moduleTitle: targetModule?.title || 'General Study Notes',
      title: title.trim(),
      content: cleanContent,
      videoTimestampSeconds: effectiveTimestamp,
      tags: selectedTags,
    });

    setSavedBanner(
      editingNoteId
        ? `Updated "${saved.title}" in your profile`
        : `Saved "${saved.title}" to your profile`
    );
    window.setTimeout(() => setSavedBanner(null), 2600);
    resetComposer();
  };

  const handleStartEdit = (note: QuickNote) => {
    setEditingNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setSelectedTags(note.tags.length > 0 ? note.tags : []);
    setSelectedCourseId(note.courseId);
    setSelectedModuleId(note.moduleId);
    setCapturedTimestamp(note.videoTimestampSeconds);
    setIncludeTimestamp(typeof note.videoTimestampSeconds === 'number');
    setValidationError(null);
    textareaRef.current?.focus();
  };

  const handleCopyNote = async (note: QuickNote) => {
    const prefix =
      typeof note.videoTimestampSeconds === 'number'
        ? `[${formatVideoTimestamp(note.videoTimestampSeconds)}] `
        : '';
    const text = `${prefix}${note.title}\n${note.content}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNoteId(note.id);
      window.setTimeout(() => setCopiedNoteId(null), 1800);
    } catch {
      // Ignore clipboard failures in restricted environments
    }
  };

  const liveCaptureSeconds =
    typeof capturedTimestamp === 'number'
      ? capturedTimestamp
      : Math.max(0, Math.floor(currentVideoSeconds));

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex justify-end"
      role="dialog"
      aria-modal="false"
      aria-label="Quick Notes slide-out panel"
    >
      {/* Mobile backdrop only so desktop students can watch course videos simultaneously */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-[1px] lg:hidden pointer-events-auto"
        aria-hidden="true"
      />

      {/* Slide-out Panel */}
      <aside className="relative z-10 pointer-events-auto w-full max-w-md h-full bg-white dark:bg-[#0c1220] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-cyan-500/15 border border-blue-500/25 dark:border-cyan-400/25 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <NotebookPen className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Quick Notes</span>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tabular-nums">
                  {notes.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                <UserCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                <span className="truncate">Saved to {userName}&apos;s profile</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quick Notes panel"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Active Lesson / Video Context */}
          <form
            onSubmit={handleSubmit}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {editingNoteId ? 'Edit Saved Note' : 'Jot Technical Concept'}
              </span>
              {editingNoteId && (
                <button
                  type="button"
                  onClick={resetComposer}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancel edit
                </button>
              )}
            </div>

            {/* Course & Module selector when opened from Dashboard without an active module, or compact context chip */}
            {activeModule && activeCourse && !editingNoteId ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800">
                <div className="min-w-0 flex items-center gap-1.5 truncate">
                  <span className="font-mono font-bold text-blue-600 dark:text-cyan-400 shrink-0">
                    {activeCourse.code}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="text-slate-700 dark:text-slate-200 font-medium truncate">
                    {activeModule.title}
                  </span>
                </div>
                {isVideoContext && (
                  <button
                    type="button"
                    onClick={() => {
                      if (includeTimestamp) {
                        handleCaptureCurrentTimestamp();
                      } else {
                        setIncludeTimestamp(true);
                        handleCaptureCurrentTimestamp();
                      }
                    }}
                    title="Capture current video timestamp"
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold transition-colors shrink-0 ${
                      includeTimestamp
                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-cyan-300 border border-blue-200 dark:border-blue-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Video className="w-3 h-3" />
                    <span>@{formatVideoTimestamp(liveCaptureSeconds)}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={targetCourse?.id || ''}
                  onChange={e => {
                    const nextCourse = courses.find(c => c.id === e.target.value);
                    setSelectedCourseId(e.target.value);
                    setSelectedModuleId(nextCourse?.modules[0]?.id || '');
                  }}
                  aria-label="Course for quick note"
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.title}
                    </option>
                  ))}
                </select>
                <select
                  value={targetModule?.id || ''}
                  onChange={e => setSelectedModuleId(e.target.value)}
                  aria-label="Module for quick note"
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(targetCourse?.modules || []).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={140}
              placeholder="Concept title (e.g., OSPF LSA Types, TCP 3-Way Handshake)"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => {
                setContent(e.target.value);
                if (validationError) setValidationError(null);
              }}
              onKeyDown={e => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={4}
              maxLength={4000}
              placeholder="Write technical concepts, CLI syntax, port numbers, or protocol rules while watching... (Ctrl/Cmd + Enter to save)"
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-sans"
            />

            {/* Video Timestamp Toggle */}
            {(isVideoContext || typeof capturedTimestamp === 'number') && (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeTimestamp}
                    onChange={e => setIncludeTimestamp(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    Stamp video time (
                    <span className="font-mono font-semibold text-blue-600 dark:text-cyan-400">
                      {formatVideoTimestamp(liveCaptureSeconds)}
                    </span>
                    )
                  </span>
                </label>

                {isVideoContext && includeTimestamp && (
                  <button
                    type="button"
                    onClick={handleCaptureCurrentTimestamp}
                    className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline"
                  >
                    Sync to player ({formatVideoTimestamp(currentVideoSeconds)})
                  </button>
                )}
              </div>
            )}

            {/* Quick Tag Chips */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Tag className="w-3 h-3" />
                <span>Tags</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_NOTE_TAGS.map(tag => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors ${
                        active
                          ? 'bg-blue-600 border-blue-600 text-white dark:bg-cyan-500 dark:border-cyan-500 dark:text-slate-950'
                          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {validationError && (
              <p className="text-[11px] font-medium text-red-600 dark:text-red-400">
                {validationError}
              </p>
            )}

            {savedBanner && (
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{savedBanner}</span>
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                {content.length}/4000
              </span>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                {editingNoteId ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingNoteId ? 'Update Note' : 'Save to Profile'}</span>
              </button>
            </div>
          </form>

          {/* Saved Notes Filter & Search */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
                {activeModule && activeCourse && (
                  <button
                    type="button"
                    onClick={() => setScope('module')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      scope === 'module'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    This Lesson ({moduleNotesCount})
                  </button>
                )}
                {activeCourse && (
                  <button
                    type="button"
                    onClick={() => setScope('course')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      scope === 'course'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Course ({courseNotesCount})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                    scope === 'all'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  All Profile ({notes.length})
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search your saved concepts, protocols, or CLI commands..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Notes List */}
            {filteredNotes.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1.5">
                <Sparkles className="w-5 h-5 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {notes.length === 0
                    ? 'No quick notes saved to your profile yet'
                    : 'No matching notes in this view'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Jot down key networking concepts above—they stay synced to your profile across sessions.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredNotes.map(note => {
                  const isCurrentVideoMatch =
                    isVideoContext &&
                    activeCourse?.id === note.courseId &&
                    activeModule?.id === note.moduleId;
                  const canJumpTimestamp =
                    typeof note.videoTimestampSeconds === 'number' &&
                    isCurrentVideoMatch &&
                    Boolean(onSeekVideo);

                  return (
                    <article
                      key={note.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {note.courseCode && (
                              <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-cyan-400">
                                {note.courseCode}
                              </span>
                            )}
                            {typeof note.videoTimestampSeconds === 'number' && (
                              <button
                                type="button"
                                disabled={!canJumpTimestamp}
                                onClick={() => {
                                  if (canJumpTimestamp && typeof note.videoTimestampSeconds === 'number') {
                                    onSeekVideo?.(note.videoTimestampSeconds);
                                  }
                                }}
                                title={
                                  canJumpTimestamp
                                    ? `Jump video to ${formatVideoTimestamp(note.videoTimestampSeconds)}`
                                    : `Captured at ${formatVideoTimestamp(note.videoTimestampSeconds)}`
                                }
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold tabular-nums ${
                                  canJumpTimestamp
                                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-default'
                                }`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                <span>{formatVideoTimestamp(note.videoTimestampSeconds)}</span>
                              </button>
                            )}
                          </div>
                          <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                            {note.title}
                          </h3>
                          {scope !== 'module' && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {note.moduleTitle}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyNote(note)}
                            title="Copy note"
                            aria-label={`Copy ${note.title}`}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            {copiedNoteId === note.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(note)}
                            title="Edit note"
                            aria-label={`Edit ${note.title}`}
                            className="p-1 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteNote(note.id)}
                            title="Delete note"
                            aria-label={`Delete ${note.title}`}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed break-words">
                        {note.content}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-1">
                          {note.tags.map(tag => (
                            <span
                              key={`${note.id}-${tag}`}
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                          {onNavigateToModule && note.courseId !== 'general' && (
                            <button
                              type="button"
                              onClick={() => onNavigateToModule(note.courseId, note.moduleId)}
                              className="text-[10px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline"
                            >
                              Open lesson
                            </button>
                          )}
                          <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                            {note.updatedAt.slice(0, 10)}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};
