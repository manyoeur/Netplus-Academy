import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Layers, Lightbulb, Save, X } from 'lucide-react';
import { Course } from '../../types';
import { GENERAL_COURSE_ID } from '../../utils/personalFlashcards';
import {
  FlashcardCategory,
  PersonalFlashcard,
  PersonalFlashcardInput,
} from './flashcardTypes';

interface PersonalFlashcardModalProps {
  isOpen: boolean;
  courses: Course[];
  initialCard?: PersonalFlashcard | null;
  defaultCourseId?: string;
  defaultModuleId?: string;
  onSave: (input: PersonalFlashcardInput) => void;
  onClose: () => void;
}

const CATEGORY_OPTIONS: FlashcardCategory[] = [
  'Terminology',
  'Protocol',
  'Port Number',
  'Architecture',
];

const OSI_LAYER_OPTIONS = [
  '',
  'Layer 1 - Physical',
  'Layer 2 - Data Link',
  'Layer 3 - Network',
  'Layer 4 - Transport',
  'Layer 5 - Session',
  'Layer 6 - Presentation',
  'Layer 7 - Application',
  'Cross-Layer',
];

export const PersonalFlashcardModal: React.FC<PersonalFlashcardModalProps> = ({
  isOpen,
  courses,
  initialCard,
  defaultCourseId,
  defaultModuleId,
  onSave,
  onClose,
}) => {
  const [courseId, setCourseId] = useState<string>(GENERAL_COURSE_ID);
  const [moduleId, setModuleId] = useState<string>('');
  const [category, setCategory] = useState<FlashcardCategory>('Terminology');
  const [term, setTerm] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [portNumber, setPortNumber] = useState<string>('');
  const [transportProtocol, setTransportProtocol] = useState<string>('');
  const [osiLayer, setOsiLayer] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [memoryTip, setMemoryTip] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialCard) {
      setCourseId(initialCard.courseId || GENERAL_COURSE_ID);
      setModuleId(initialCard.moduleId || '');
      setCategory(initialCard.category || 'Terminology');
      setTerm(initialCard.term || '');
      setQuestion(initialCard.question || '');
      setAnswer(initialCard.answer || '');
      setPortNumber(initialCard.portNumber || '');
      setTransportProtocol(initialCard.transportProtocol || '');
      setOsiLayer(initialCard.osiLayer || '');
      setExplanation(initialCard.explanation || '');
      setMemoryTip(initialCard.memoryTip || '');
    } else {
      const initialCourse =
        defaultCourseId && defaultCourseId !== 'all'
          ? defaultCourseId
          : GENERAL_COURSE_ID;
      setCourseId(initialCourse);
      setModuleId(
        initialCourse !== GENERAL_COURSE_ID && defaultModuleId ? defaultModuleId : ''
      );
      setCategory('Terminology');
      setTerm('');
      setQuestion('');
      setAnswer('');
      setPortNumber('');
      setTransportProtocol('');
      setOsiLayer('');
      setExplanation('');
      setMemoryTip('');
    }
    setValidationError(null);
  }, [isOpen, initialCard, defaultCourseId, defaultModuleId]);

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

  const selectedCourse = useMemo(
    () =>
      courseId !== GENERAL_COURSE_ID
        ? courses.find((c) => c.id === courseId) || null
        : null,
    [courses, courseId]
  );

  const availableModules = selectedCourse?.modules || [];

  const handleCourseChange = (nextCourseId: string) => {
    setCourseId(nextCourseId);
    if (nextCourseId === GENERAL_COURSE_ID) {
      setModuleId('');
      return;
    }
    const targetCourse = courses.find((c) => c.id === nextCourseId);
    if (!targetCourse?.modules.some((m) => m.id === moduleId)) {
      setModuleId('');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTerm = term.trim();
    const cleanQuestion = question.trim();
    const cleanAnswer = answer.trim();

    if (!cleanTerm) {
      setValidationError('Enter a short concept or term title.');
      return;
    }
    if (!cleanQuestion) {
      setValidationError('Enter a question or prompt for the front of the card.');
      return;
    }
    if (!cleanAnswer) {
      setValidationError('Enter an answer for the back of the card.');
      return;
    }

    const chosenCourse =
      courseId !== GENERAL_COURSE_ID
        ? courses.find((c) => c.id === courseId)
        : undefined;
    const chosenModule =
      chosenCourse && moduleId
        ? chosenCourse.modules.find((m) => m.id === moduleId)
        : undefined;

    onSave({
      ...(initialCard ? { id: initialCard.id, masteryStatus: initialCard.masteryStatus } : {}),
      courseId: courseId || GENERAL_COURSE_ID,
      courseCode: chosenCourse?.code,
      courseTitle: chosenCourse?.title,
      moduleId: chosenModule ? chosenModule.id : undefined,
      moduleTitle: chosenModule ? chosenModule.title : undefined,
      category,
      term: cleanTerm,
      question: cleanQuestion,
      answer: cleanAnswer,
      portNumber: portNumber.trim() || undefined,
      transportProtocol: transportProtocol.trim() || undefined,
      osiLayer: osiLayer.trim() || undefined,
      explanation: explanation.trim(),
      memoryTip: memoryTip.trim(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="personal-flashcard-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="personal-flashcard-modal-title"
                className="text-base font-extrabold text-slate-900 dark:text-white truncate"
              >
                {initialCard ? 'Edit Personal Flashcard' : 'Create Personal Flashcard'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Tag your card to a course and optional module so it stays organized as you study.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close flashcard editor"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {validationError && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              {validationError}
            </div>
          )}

          {/* Course & Optional Module Tagging */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
            <div>
              <label
                htmlFor="pfc-course"
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span>Course Tag</span>
              </label>
              <select
                id="pfc-course"
                value={courseId}
                onChange={(e) => handleCourseChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
              >
                <option value={GENERAL_COURSE_ID}>General / Cross-Course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="pfc-module"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Module (Optional)
              </label>
              <select
                id="pfc-module"
                value={moduleId}
                disabled={courseId === GENERAL_COURSE_ID || availableModules.length === 0}
                onChange={(e) => setModuleId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
              >
                <option value="">
                  {courseId === GENERAL_COURSE_ID
                    ? 'Select a course first'
                    : 'All Modules in Course'}
                </option>
                {availableModules.map((m, idx) => (
                  <option key={m.id} value={m.id}>
                    M{idx + 1}: {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category & Concept Term */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="pfc-category"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Category
              </label>
              <select
                id="pfc-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as FlashcardCategory)}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="pfc-term"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Term / Concept <span className="text-rose-500">*</span>
              </label>
              <input
                id="pfc-term"
                type="text"
                maxLength={140}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g., OSPF Router ID, SSH Port 22, 802.1Q Trunk"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Front & Back */}
          <div>
            <label
              htmlFor="pfc-question"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
            >
              Front · Question <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="pfc-question"
              rows={2}
              maxLength={600}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What prompt do you want to test yourself with?"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
            />
          </div>

          <div>
            <label
              htmlFor="pfc-answer"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
            >
              Back · Answer <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="pfc-answer"
              rows={2}
              maxLength={800}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write the concise answer you want to recall."
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
            />
          </div>

          {/* Optional Technical Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="pfc-port"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Port (Optional)
              </label>
              <input
                id="pfc-port"
                type="text"
                maxLength={40}
                value={portNumber}
                onChange={(e) => setPortNumber(e.target.value)}
                placeholder="e.g., 22 or 80/443"
                className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
              />
            </div>

            <div>
              <label
                htmlFor="pfc-transport"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Transport (Optional)
              </label>
              <input
                id="pfc-transport"
                type="text"
                maxLength={40}
                value={transportProtocol}
                onChange={(e) => setTransportProtocol(e.target.value)}
                placeholder="e.g., TCP, UDP, ICMP"
                className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
              />
            </div>

            <div>
              <label
                htmlFor="pfc-osi"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                OSI Layer (Optional)
              </label>
              <select
                id="pfc-osi"
                value={osiLayer}
                onChange={(e) => setOsiLayer(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
              >
                <option value="">None specified</option>
                {OSI_LAYER_OPTIONS.filter(Boolean).map((layer) => (
                  <option key={layer} value={layer}>
                    {layer}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Explanation & Memory Tip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="pfc-explanation"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Explanation (Optional)
              </label>
              <textarea
                id="pfc-explanation"
                rows={2}
                maxLength={1200}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Why this works or how to verify in CLI..."
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
              />
            </div>

            <div>
              <label
                htmlFor="pfc-tip"
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                <span>Memory Tip (Optional)</span>
              </label>
              <textarea
                id="pfc-tip"
                rows={2}
                maxLength={600}
                value={memoryTip}
                onChange={(e) => setMemoryTip(e.target.value)}
                placeholder="Mnemonic or shortcut to remember faster..."
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{initialCard ? 'Save Changes' : 'Create Flashcard'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
