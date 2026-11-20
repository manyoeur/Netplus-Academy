import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Code2,
  Edit3,
  Eye,
  FileText,
  Heading2,
  Layers,
  List,
  Plus,
  Save,
  Type,
  X
} from 'lucide-react';
import {
  CourseModule
} from '../../types';
import {
  ModuleSectionBreadcrumb,
  ResolvedChapterSection,
  ResolvedMainContentSection
} from '../../utils/courseHierarchy';

interface HierarchyContentWorkspaceProps {
  courseCode: string;
  chapter: ResolvedChapterSection;
  section?: ResolvedMainContentSection | null;
  canEdit?: boolean;
  startInEditMode?: boolean;
  onConsumeStartInEditMode?: () => void;
  onSelectChapter: (chapterId: string, openEditor?: boolean) => void;
  onSelectSection: (chapterId: string, sectionId: string, openEditor?: boolean) => void;
  onOpenModule: (flatIndex: number) => void;
  onSaveContent: (payload: {
    level: 'chapter' | 'section';
    chapterId: string;
    sectionId?: string;
    title: string;
    summary: string;
    contentMarkdown: string;
  }) => void;
  onBackToActiveModule: () => void;
  activeModuleTitle?: string;
  previousChapter?: { id: string; chapterNumber: string; title: string } | null;
  nextChapter?: { id: string; chapterNumber: string; title: string } | null;
  nextSection?: { chapterId: string; id: string; sectionNumber: string; title: string } | null;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[12px] text-blue-700 dark:text-cyan-300 border border-slate-200/80 dark:border-slate-700/80"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <strong key={idx} className="font-bold text-slate-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

export const MarkdownProse: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <div
          key={`code-${i}`}
          className="my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100"
        >
          {lang && (
            <div className="px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              {lang}
            </div>
          )}
          <pre className="p-3.5 overflow-x-auto font-mono text-xs leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      blocks.push(
        <h3 key={`h3-${i}`} className="text-sm font-bold text-slate-900 dark:text-white mt-4 mb-1.5">
          {renderInlineFormatting(line.slice(4))}
        </h3>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={`h2-${i}`} className="text-base font-extrabold text-slate-900 dark:text-white mt-5 mb-2">
          {renderInlineFormatting(line.slice(3))}
        </h2>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(
        <h1 key={`h1-${i}`} className="text-lg font-extrabold text-slate-900 dark:text-white mt-5 mb-2">
          {renderInlineFormatting(line.slice(2))}
        </h1>
      );
      i += 1;
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph (combine contiguous non-empty, non-special lines)
    const paraLines: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {renderInlineFormatting(paraLines.join(' '))}
      </p>
    );
  }

  return <div className="space-y-2.5">{blocks}</div>;
};

export const HierarchyContentWorkspace: React.FC<HierarchyContentWorkspaceProps> = ({
  courseCode,
  chapter,
  section,
  canEdit = false,
  startInEditMode = false,
  onConsumeStartInEditMode,
  onSelectChapter,
  onSelectSection,
  onOpenModule,
  onSaveContent,
  onBackToActiveModule,
  activeModuleTitle,
  previousChapter = null,
  nextChapter = null,
  nextSection = null
}) => {
  const isSectionLevel = Boolean(section);
  const targetTitle = section ? section.title : chapter.title;
  const targetSummary = section ? section.summary || '' : chapter.summary || '';
  const targetContent = section ? section.contentMarkdown || '' : chapter.contentMarkdown || '';
  const targetNumber = section ? section.sectionNumber : chapter.chapterNumber;
  const levelLabel = isSectionLevel ? 'Second-Level Section' : 'First-Level Chapter';

  const [isEditing, setIsEditing] = useState<boolean>(canEdit && startInEditMode);
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [draftTitle, setDraftTitle] = useState<string>(targetTitle);
  const [draftSummary, setDraftSummary] = useState<string>(targetSummary);
  const [draftContent, setDraftContent] = useState<string>(targetContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraftTitle(targetTitle);
    setDraftSummary(targetSummary);
    setDraftContent(targetContent);
    setEditorTab('write');
    if (canEdit && startInEditMode) {
      setIsEditing(true);
      onConsumeStartInEditMode?.();
    } else {
      if (startInEditMode) {
        onConsumeStartInEditMode?.();
      }
      setIsEditing(false);
    }
  }, [
    chapter.id,
    section?.id,
    targetTitle,
    targetSummary,
    targetContent,
    canEdit,
    startInEditMode,
    onConsumeStartInEditMode
  ]);

  const insertSnippet = (before: string, after = '', placeholder = '') => {
    const el = textareaRef.current;
    if (!el) {
      setDraftContent(prev => `${prev}${prev && !prev.endsWith('\n') ? '\n' : ''}${before}${placeholder}${after}`);
      return;
    }
    const start = el.selectionStart ?? draftContent.length;
    const end = el.selectionEnd ?? draftContent.length;
    const selected = draftContent.slice(start, end) || placeholder;
    const nextValue =
      draftContent.slice(0, start) + before + selected + after + draftContent.slice(end);
    setDraftContent(nextValue);
    window.requestAnimationFrame(() => {
      el.focus();
      const cursorPos = start + before.length + selected.length;
      el.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = draftTitle.trim() || targetTitle;
    onSaveContent({
      level: isSectionLevel ? 'section' : 'chapter',
      chapterId: chapter.id,
      sectionId: section?.id,
      title: cleanTitle,
      summary: draftSummary.trim(),
      contentMarkdown: draftContent
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setDraftTitle(targetTitle);
    setDraftSummary(targetSummary);
    setDraftContent(targetContent);
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      {/* Main Chapter / Section Workspace Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        {/* Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span className="font-bold text-blue-600 dark:text-cyan-400">{courseCode}</span>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <button
                type="button"
                onClick={() => onSelectChapter(chapter.id, false)}
                className={`hover:text-blue-600 dark:hover:text-cyan-400 transition-colors text-left ${
                  !isSectionLevel ? 'font-bold text-slate-800 dark:text-slate-200' : ''
                }`}
              >
                {chapter.chapterNumber} {chapter.title}
              </button>
              {section && (
                <>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {section.sectionNumber} {section.title}
                  </span>
                </>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-mono uppercase tracking-wider font-semibold text-blue-600 dark:text-cyan-400">
                {levelLabel} · {targetNumber}
              </p>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                <span className="tabular-nums mr-2 text-slate-500 dark:text-slate-400">
                  {targetNumber}
                </span>
                {targetTitle}
              </h1>
              {!isEditing && targetSummary && (
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                  {targetSummary}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canEdit && (
              !isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{targetContent.trim() ? 'Edit Content' : 'Write Content'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              )
            )}

            {activeModuleTitle && (
              <button
                type="button"
                onClick={onBackToActiveModule}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-cyan-500 transition-colors whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span>Resume Active Lesson</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline Editor OR Rendered Content */}
        {canEdit && isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isSectionLevel ? 'Section Title (Level 2)' : 'Chapter Title (Level 1)'}
                </label>
                <input
                  type="text"
                  required
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder={isSectionLevel ? 'Enter section title...' : 'Enter chapter title...'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Summary / Learning Focus
                </label>
                <input
                  type="text"
                  value={draftSummary}
                  onChange={(e) => setDraftSummary(e.target.value)}
                  placeholder={
                    isSectionLevel
                      ? 'Short overview of concepts covered in this section...'
                      : 'Short overview of chapter outcomes and scope...'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setEditorTab('write')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      editorTab === 'write'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Write</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('preview')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      editorTab === 'preview'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                </div>

                {editorTab === 'write' && (
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => insertSnippet('## ', '', 'Section Heading')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 whitespace-nowrap"
                      title="Insert Heading"
                    >
                      <Heading2 className="w-3.5 h-3.5" />
                      <span>Heading</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('**', '**', 'important term')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 whitespace-nowrap"
                      title="Bold text"
                    >
                      <Type className="w-3.5 h-3.5" />
                      <span>Bold</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('- ', '', 'Key point')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 whitespace-nowrap"
                      title="Insert bullet list item"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>List</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('\n```bash\n', '\n```\n', '# CLI or architecture snippet')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 whitespace-nowrap"
                      title="Insert code block"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Code Block</span>
                    </button>
                  </div>
                )}
              </div>

              {editorTab === 'write' ? (
                <textarea
                  ref={textareaRef}
                  rows={12}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder={`Write detailed ${isSectionLevel ? 'section' : 'chapter'} content here using Markdown or plain text...\n\nExample:\n## Key Objectives\n- Understand architectural planes and controller roles\n- Review real-world deployment patterns`}
                  className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 text-sm font-mono leading-relaxed text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <div className="min-h-[260px] p-5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                  {draftContent.trim() ? (
                    <MarkdownProse content={draftContent} />
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Nothing written yet. Switch back to Write to compose content.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Supports Markdown headings (<code className="font-mono">##</code>), lists,{' '}
                <code className="font-mono">**bold**</code>, and fenced CLI code blocks.
              </p>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save {isSectionLevel ? 'Section' : 'Chapter'} Content</span>
                </button>
              </div>
            </div>
          </form>
        ) : targetContent.trim() ? (
          <div className="pt-1">
            <MarkdownProse content={targetContent} />
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-3">
            <div className="w-11 h-11 mx-auto rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-cyan-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                No {isSectionLevel ? 'section' : 'chapter'} content written yet
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {canEdit ? (
                  <>
                    Add introductory notes, architecture diagrams summary, protocol rules, or study guidance directly inside{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {targetNumber} {targetTitle}
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    {isSectionLevel
                      ? 'Use the Course Outline or click Next below to explore lessons in '
                      : 'Select a section below to explore '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {targetNumber} {targetTitle}
                    </strong>
                    .
                  </>
                )}
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Write {isSectionLevel ? 'Section' : 'Chapter'} Content</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Child Outline Navigation Cards (Level-1 Chapter only) */}
      {!section && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>Sections in Chapter {chapter.chapterNumber}</span>
            </h3>
            <span className="text-[11px] font-mono tabular-nums text-slate-400">
              {chapter.mainContents.length} sections
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {chapter.mainContents.map((mc) => (
              <div
                key={mc.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 hover:border-blue-400 dark:hover:border-cyan-500 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectSection(chapter.id, mc.id, false)}
                  className="flex-1 min-w-0 text-left space-y-1"
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="font-mono tabular-nums text-blue-600 dark:text-cyan-400">
                      {mc.sectionNumber}
                    </span>
                    <span className="truncate">{mc.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {mc.summary ||
                      (mc.contentMarkdown?.trim()
                        ? 'Section notes available · Click to read.'
                        : `${mc.items.length} lesson${mc.items.length === 1 ? '' : 's'} · Click to open section.`)}
                  </p>
                </button>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onSelectSection(chapter.id, mc.id, true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-slate-800 shrink-0"
                    title={`Write content in ${mc.sectionNumber} ${mc.title}`}
                    aria-label={`Write content in ${mc.sectionNumber} ${mc.title}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Chapter / Section Navigation Bar */}
      {(() => {
        const firstSection = !section ? chapter.mainContents[0] || null : null;
        const firstLesson = section ? section.items[0] || null : null;

        type NextTarget =
          | { kind: 'section'; chapterId: string; sectionId: string; label: string; title: string }
          | { kind: 'module'; flatIndex: number; label: string; title: string }
          | { kind: 'chapter'; chapterId: string; label: string; title: string }
          | null;

        let nextTarget: NextTarget = null;
        if (!section) {
          if (firstSection) {
            nextTarget = {
              kind: 'section',
              chapterId: chapter.id,
              sectionId: firstSection.id,
              label: `Next · ${firstSection.sectionNumber}`,
              title: `${firstSection.sectionNumber} ${firstSection.title}`
            };
          } else if (nextChapter) {
            nextTarget = {
              kind: 'chapter',
              chapterId: nextChapter.id,
              label: `Next Chapter · ${nextChapter.chapterNumber}`,
              title: `${nextChapter.chapterNumber} ${nextChapter.title}`
            };
          }
        } else {
          if (firstLesson) {
            nextTarget = {
              kind: 'module',
              flatIndex: firstLesson.flatIndex,
              label: `Next · ${firstLesson.itemNumber}`,
              title: `${firstLesson.itemNumber} ${firstLesson.module.title}`
            };
          } else if (nextSection) {
            nextTarget = {
              kind: 'section',
              chapterId: nextSection.chapterId,
              sectionId: nextSection.id,
              label: `Next · ${nextSection.sectionNumber}`,
              title: `${nextSection.sectionNumber} ${nextSection.title}`
            };
          } else if (nextChapter) {
            nextTarget = {
              kind: 'chapter',
              chapterId: nextChapter.id,
              label: `Next Chapter · ${nextChapter.chapterNumber}`,
              title: `${nextChapter.chapterNumber} ${nextChapter.title}`
            };
          }
        }

        const handleNextClick = () => {
          if (!nextTarget) return;
          if (nextTarget.kind === 'section') {
            onSelectSection(nextTarget.chapterId, nextTarget.sectionId, false);
          } else if (nextTarget.kind === 'module') {
            onOpenModule(nextTarget.flatIndex);
          } else {
            onSelectChapter(nextTarget.chapterId, false);
          }
        };

        return (
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
            {section ? (
              <button
                type="button"
                onClick={() => onSelectChapter(chapter.id, false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to {chapter.chapterNumber} Chapter</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!previousChapter}
                onClick={() => previousChapter && onSelectChapter(previousChapter.id, false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous Chapter</span>
              </button>
            )}

            <button
              type="button"
              disabled={!nextTarget}
              onClick={handleNextClick}
              title={nextTarget ? nextTarget.title : 'No next item available'}
              className="ml-auto inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-xs font-semibold shadow-md transition-all whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span>{nextTarget ? nextTarget.label : 'Next'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        );
      })()}
    </div>
  );
};

interface ModuleContentWorkspaceProps {
  courseCode: string;
  breadcrumb: ModuleSectionBreadcrumb | null;
  module: CourseModule;
  moduleIndex: number;
  canEdit?: boolean;
  startInEditMode?: boolean;
  onConsumeStartInEditMode?: () => void;
  onSelectChapter: (chapterId: string) => void;
  onSelectSection: (chapterId: string, sectionId: string) => void;
  onSaveModuleContent: (moduleId: string, updated: Partial<CourseModule>) => void;
  children?: React.ReactNode;
}

export const ModuleContentWorkspace: React.FC<ModuleContentWorkspaceProps> = ({
  courseCode,
  breadcrumb,
  module,
  moduleIndex,
  canEdit = false,
  startInEditMode = false,
  onConsumeStartInEditMode,
  onSelectChapter,
  onSelectSection,
  onSaveModuleContent,
  children
}) => {
  const itemNumber = breadcrumb?.itemNumber || `M${moduleIndex + 1}`;
  const targetContent = module.contentMarkdown || '';

  const [isEditing, setIsEditing] = useState<boolean>(canEdit && startInEditMode);
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [draftTitle, setDraftTitle] = useState<string>(module.title);
  const [draftSummary, setDraftSummary] = useState<string>(module.summary || '');
  const [draftDurationMin, setDraftDurationMin] = useState<number>(module.durationMin || 20);
  const [draftVideoUrl, setDraftVideoUrl] = useState<string>(module.videoUrl || '');
  const [draftVideoDuration, setDraftVideoDuration] = useState<string>(module.videoDuration || '');
  const [draftContent, setDraftContent] = useState<string>(targetContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraftTitle(module.title);
    setDraftSummary(module.summary || '');
    setDraftDurationMin(module.durationMin || 20);
    setDraftVideoUrl(module.videoUrl || '');
    setDraftVideoDuration(module.videoDuration || '');
    setDraftContent(targetContent);
    setEditorTab('write');
    if (canEdit && startInEditMode) {
      setIsEditing(true);
      onConsumeStartInEditMode?.();
    } else {
      if (startInEditMode) {
        onConsumeStartInEditMode?.();
      }
      setIsEditing(false);
    }
  }, [
    module.id,
    module.title,
    module.summary,
    module.durationMin,
    module.videoUrl,
    module.videoDuration,
    targetContent,
    canEdit,
    startInEditMode,
    onConsumeStartInEditMode
  ]);

  const insertSnippet = (before: string, after = '', placeholder = '') => {
    const el = textareaRef.current;
    if (!el) {
      setDraftContent(
        prev => `${prev}${prev && !prev.endsWith('\n') ? '\n' : ''}${before}${placeholder}${after}`
      );
      return;
    }
    const start = el.selectionStart ?? draftContent.length;
    const end = el.selectionEnd ?? draftContent.length;
    const selected = draftContent.slice(start, end) || placeholder;
    const nextValue =
      draftContent.slice(0, start) + before + selected + after + draftContent.slice(end);
    setDraftContent(nextValue);
    window.requestAnimationFrame(() => {
      el.focus();
      const cursorPos = start + before.length + selected.length;
      el.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = draftTitle.trim() || module.title;
    const payload: Partial<CourseModule> = {
      title: cleanTitle,
      summary: draftSummary.trim(),
      durationMin: Math.max(1, Number(draftDurationMin) || module.durationMin || 20),
      contentMarkdown: draftContent
    };
    if (module.type === 'video') {
      payload.videoUrl = draftVideoUrl.trim();
      payload.videoDuration = draftVideoDuration.trim();
    }
    onSaveModuleContent(module.id, payload);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setDraftTitle(module.title);
    setDraftSummary(module.summary || '');
    setDraftDurationMin(module.durationMin || 20);
    setDraftVideoUrl(module.videoUrl || '');
    setDraftVideoDuration(module.videoDuration || '');
    setDraftContent(targetContent);
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      {/* Level-3 Header & Inline Editor Card (Mirrors Chapter & Section Editing Experience) */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        {/* Header & Breadcrumb */}
        <div
          className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
            (canEdit && isEditing) || module.type === 'theory'
              ? 'pb-5 border-b border-slate-100 dark:border-slate-800'
              : ''
          }`}
        >
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span className="font-bold text-blue-600 dark:text-cyan-400">{courseCode}</span>
              {breadcrumb && (
                <>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  <button
                    type="button"
                    onClick={() => onSelectChapter(breadcrumb.chapterId)}
                    className="hover:text-blue-600 dark:hover:text-cyan-400 transition-colors text-left"
                  >
                    {breadcrumb.chapterNumber} {breadcrumb.chapterTitle}
                  </button>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  <button
                    type="button"
                    onClick={() => onSelectSection(breadcrumb.chapterId, breadcrumb.mainContentId)}
                    className="hover:text-blue-600 dark:hover:text-cyan-400 transition-colors text-left"
                  >
                    {breadcrumb.sectionNumber} {breadcrumb.mainContentTitle}
                  </button>
                </>
              )}
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {itemNumber} {module.title}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-mono uppercase tracking-wider font-semibold text-blue-600 dark:text-cyan-400">
                Third-Level Content · {itemNumber} · {module.type}
              </p>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                <span className="tabular-nums mr-2 text-slate-500 dark:text-slate-400">
                  {itemNumber}
                </span>
                {module.title}
              </h1>
              {!isEditing && module.summary && (
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                  {module.summary}
                </p>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{targetContent.trim() ? 'Edit Content' : 'Write Content'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Inline Editor OR Theory Rendered Content */}
        {canEdit && isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Lesson Title (Level 3)
                </label>
                <input
                  type="text"
                  required
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Enter lesson title..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Summary / Learning Focus
                </label>
                <input
                  type="text"
                  value={draftSummary}
                  onChange={(e) => setDraftSummary(e.target.value)}
                  placeholder="Short overview of concepts covered in this lesson..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className={`grid grid-cols-1 ${module.type === 'video' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={draftDurationMin}
                  onChange={(e) => setDraftDurationMin(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {module.type === 'video' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Video Stream URL
                    </label>
                    <input
                      type="text"
                      value={draftVideoUrl}
                      onChange={(e) => setDraftVideoUrl(e.target.value)}
                      placeholder="https://.../lecture.mp4"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Video Length (mm:ss)
                    </label>
                    <input
                      type="text"
                      value={draftVideoDuration}
                      onChange={(e) => setDraftVideoDuration(e.target.value)}
                      placeholder="18:30"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setEditorTab('write')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      editorTab === 'write'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Write</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('preview')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      editorTab === 'preview'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                </div>

                {editorTab === 'write' && (
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => insertSnippet('## ', '', 'Section Heading')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 whitespace-nowrap"
                      title="Insert Heading"
                    >
                      <Heading2 className="w-3.5 h-3.5" />
                      <span>Heading</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('**', '**', 'important term')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 whitespace-nowrap"
                      title="Bold text"
                    >
                      <Type className="w-3.5 h-3.5" />
                      <span>Bold</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('- ', '', 'Key point')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 whitespace-nowrap"
                      title="Insert bullet list item"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>List</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSnippet('\n```bash\n', '\n```\n', '# CLI or architecture snippet')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 whitespace-nowrap"
                      title="Insert code block"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Code Block</span>
                    </button>
                  </div>
                )}
              </div>

              {editorTab === 'write' ? (
                <textarea
                  ref={textareaRef}
                  rows={12}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder={`Write detailed lesson content or companion notes here using Markdown or plain text...\n\nExample:\n## Key Objectives\n- Understand architectural concepts and command syntax\n- Review real-world deployment verification`}
                  className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 text-sm font-mono leading-relaxed text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <div className="min-h-[260px] p-5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                  {draftContent.trim() ? (
                    <MarkdownProse content={draftContent} />
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Nothing written yet. Switch back to Write to compose content.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Supports Markdown headings (<code className="font-mono">##</code>), lists,{' '}
                <code className="font-mono">**bold**</code>, and fenced CLI code blocks.
              </p>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Lesson Content</span>
                </button>
              </div>
            </div>
          </form>
        ) : module.type === 'theory' ? (
          targetContent.trim() ? (
            <div className="pt-1">
              <MarkdownProse content={targetContent} />
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-3">
              <div className="w-11 h-11 mx-auto rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-cyan-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  No lesson content written yet
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {canEdit ? (
                    <>
                      Add lesson explanations, CLI examples, protocol rules, or study notes directly inside{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {itemNumber} {module.title}
                      </strong>
                      .
                    </>
                  ) : (
                    <>
                      Lesson content for{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {itemNumber} {module.title}
                      </strong>{' '}
                      has not been published yet.
                    </>
                  )}
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Write Lesson Content</span>
                </button>
              )}
            </div>
          )
        ) : null}
      </div>

      {/* Render Interactive Module Body (Video / Lab / PCAP / Quiz) when not editing */}
      {!(canEdit && isEditing) && module.type !== 'theory' && children}
    </div>
  );
};
