import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Code2,
  Edit3,
  Eye,
  FileText,
  Heading2,
  ImageOff,
  ImagePlus,
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
import {
  isSafeMarkdownImageUrl,
  MarkdownImageModal,
  MarkdownImagePlacement,
  parseMarkdownImageAltAndPlacement,
  processImageFileToDataUrl
} from './MarkdownImageModal';

interface HierarchyContentWorkspaceProps {
  courseCode: string;
  chapter: ResolvedChapterSection;
  section?: ResolvedMainContentSection | null;
  canEdit?: boolean;
  startInEditMode?: boolean;
  onConsumeStartInEditMode?: () => void;
  onSelectSection: (chapterId: string, sectionId: string, openEditor?: boolean) => void;
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
}

const STANDALONE_IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

function applyMarkdownImageInsertion(
  prev: string,
  src: string,
  alt: string,
  placement: MarkdownImagePlacement | undefined,
  selection: { start: number; end: number } | null
): string {
  const cleanAlt = alt.trim().replace(/[\r\n[\]|]/g, ' ').trim();
  const tag = placement === 'left' || placement === 'right' ? `|${placement}` : '';
  const altWithTag = cleanAlt ? `${cleanAlt}${tag}` : tag || 'Course illustration';
  const markdown = `![${altWithTag}](${src})`;

  if (placement === 'top') {
    const trimmed = prev.replace(/^\n+/, '');
    return trimmed ? `${markdown}\n\n${trimmed}` : markdown;
  }

  if (placement === 'bottom') {
    const trimmed = prev.replace(/\n+$/, '');
    return trimmed ? `${trimmed}\n\n${markdown}` : markdown;
  }

  let start = selection?.start ?? prev.length;
  let end = selection?.end ?? prev.length;

  // For left/right placement, if cursor is at the very end after existing text,
  // place the image immediately before the current paragraph so text wraps beside it.
  if (
    (placement === 'left' || placement === 'right') &&
    prev.trim().length > 0 &&
    prev.slice(end).trim().length === 0
  ) {
    const trimmedEnd = prev.replace(/\s+$/, '');
    const lastBreak = trimmedEnd.lastIndexOf('\n\n');
    let blockStart = lastBreak >= 0 ? lastBreak + 2 : 0;
    // If the block starts with a Markdown heading line, place image right below the heading
    while (blockStart < trimmedEnd.length && trimmedEnd.slice(blockStart).startsWith('#')) {
      const nextNl = trimmedEnd.indexOf('\n', blockStart);
      if (nextNl === -1) {
        blockStart = 0;
        break;
      }
      blockStart = nextNl + 1;
    }
    start = blockStart;
    end = blockStart;
  }

  if ((placement === 'left' || placement === 'right') && prev.trim().length === 0) {
    return `${markdown}\n\n`;
  }

  const prefixNeedsNewline = start > 0 && prev[start - 1] !== '\n' ? '\n' : '';
  const suffixNeedsNewline = end < prev.length && prev[end] !== '\n' ? '\n' : '';
  return (
    prev.slice(0, start) +
    prefixNeedsNewline +
    markdown +
    suffixNeedsNewline +
    prev.slice(end)
  );
}

const MarkdownImage: React.FC<{ src: string; alt: string; inline?: boolean }> = ({
  src,
  alt: rawAlt,
  inline = false
}) => {
  const [hasError, setHasError] = useState(false);
  const { alt, align } = parseMarkdownImageAltAndPlacement(rawAlt);

  if (!isSafeMarkdownImageUrl(src) || hasError) {
    return (
      <span
        className={`my-2 flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400 ${
          align === 'left'
            ? 'sm:float-left sm:mr-6 sm:mb-3 w-full sm:w-[42%] sm:max-w-[340px]'
            : align === 'right'
            ? 'sm:float-right sm:ml-6 sm:mb-3 w-full sm:w-[42%] sm:max-w-[340px]'
            : 'clear-both'
        }`}
      >
        <ImageOff className="w-4 h-4 shrink-0 text-slate-400" />
        <span className="truncate">{alt || 'Image unavailable'}</span>
      </span>
    );
  }

  if (inline) {
    return (
      <img
        src={src}
        alt={alt || 'Course illustration'}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className="inline-block max-h-64 w-auto max-w-full rounded-lg border border-slate-200 dark:border-slate-700 align-middle my-1"
      />
    );
  }

  const figurePlacementClass =
    align === 'left'
      ? 'my-2 sm:my-1 sm:float-left sm:mr-6 sm:mb-3 w-full sm:w-[42%] sm:max-w-[340px]'
      : align === 'right'
      ? 'my-2 sm:my-1 sm:float-right sm:ml-6 sm:mb-3 w-full sm:w-[42%] sm:max-w-[340px]'
      : 'clear-both my-4';

  return (
    <figure
      className={`${figurePlacementClass} rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 overflow-hidden`}
    >
      <div className="flex items-center justify-center p-2 sm:p-3 bg-white/70 dark:bg-slate-900/40">
        <img
          src={src}
          alt={alt || 'Course illustration'}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className={`${
            align === 'block' ? 'max-h-[460px] w-auto' : 'max-h-[320px] w-full'
          } max-w-full rounded-lg object-contain`}
        />
      </div>
      {alt && (
        <figcaption className="px-3.5 py-2 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 text-center">
          {alt}
        </figcaption>
      )}
    </figure>
  );
};

function renderInlineFormatting(text: string): React.ReactNode[] {
  const tokens = text.split(/(!\[[^\]]*\]\([^)\s]+\)|`[^`]+`|\*\*[^*]+\*\*)/g);
  return tokens.map((token, idx) => {
    const imgMatch = token.match(STANDALONE_IMAGE_RE);
    if (imgMatch) {
      return <MarkdownImage key={idx} alt={imgMatch[1]} src={imgMatch[2]} inline />;
    }
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
          className="clear-both my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100"
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
        <h2 key={`h2-${i}`} className="clear-both text-base font-extrabold text-slate-900 dark:text-white mt-5 mb-2">
          {renderInlineFormatting(line.slice(3))}
        </h2>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(
        <h1 key={`h1-${i}`} className="clear-both text-lg font-extrabold text-slate-900 dark:text-white mt-5 mb-2">
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
        <ul key={`ul-${i}`} className="flow-root list-disc pl-5 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
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
        <ol key={`ol-${i}`} className="flow-root list-decimal pl-5 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Standalone Markdown image
    const standaloneImageMatch = line.trim().match(STANDALONE_IMAGE_RE);
    if (standaloneImageMatch) {
      blocks.push(
        <MarkdownImage
          key={`img-${i}`}
          alt={standaloneImageMatch[1]}
          src={standaloneImageMatch[2]}
        />
      );
      i += 1;
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
      !STANDALONE_IMAGE_RE.test(lines[i].trim()) &&
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

  return <div className="flow-root space-y-2.5">{blocks}</div>;
};

export const HierarchyContentWorkspace: React.FC<HierarchyContentWorkspaceProps> = ({
  chapter,
  section,
  canEdit = false,
  startInEditMode = false,
  onConsumeStartInEditMode,
  onSelectSection,
  onSaveContent,
  onBackToActiveModule,
  activeModuleTitle
}) => {
  const isSectionLevel = Boolean(section);
  const targetTitle = section ? section.title : chapter.title;
  const targetSummary = section ? section.summary || '' : chapter.summary || '';
  const targetContent = section ? section.contentMarkdown || '' : chapter.contentMarkdown || '';
  const targetNumber = section ? section.sectionNumber : chapter.chapterNumber;

  const targetKey = `${chapter.id}::${section?.id || 'chapter'}`;
  const prevTargetKeyRef = useRef<string>(targetKey);
  const consumeStartInEditModeRef = useRef(onConsumeStartInEditMode);
  useEffect(() => {
    consumeStartInEditModeRef.current = onConsumeStartInEditMode;
  }, [onConsumeStartInEditMode]);

  const [isEditing, setIsEditing] = useState<boolean>(canEdit && startInEditMode);
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [draftTitle, setDraftTitle] = useState<string>(targetTitle);
  const [draftSummary, setDraftSummary] = useState<string>(targetSummary);
  const [draftContent, setDraftContent] = useState<string>(targetContent);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [imageInsertError, setImageInsertError] = useState<string | null>(null);
  const [isTextareaDragOver, setIsTextareaDragOver] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);

  // Reset editor state only when navigating to a different chapter or section
  useEffect(() => {
    if (prevTargetKeyRef.current === targetKey) return;
    prevTargetKeyRef.current = targetKey;
    setDraftTitle(targetTitle);
    setDraftSummary(targetSummary);
    setDraftContent(targetContent);
    setEditorTab('write');
    setIsImageModalOpen(false);
    setImageInsertError(null);
    setIsEditing(canEdit && startInEditMode);
  }, [targetKey, targetTitle, targetSummary, targetContent, canEdit, startInEditMode]);

  // Keep drafts synced with external prop updates only when not actively editing
  useEffect(() => {
    if (isEditing) return;
    setDraftTitle(targetTitle);
    setDraftSummary(targetSummary);
    setDraftContent(targetContent);
  }, [isEditing, targetTitle, targetSummary, targetContent]);

  // Consume one-shot startInEditMode trigger without exiting edit mode once consumed
  useEffect(() => {
    if (!startInEditMode) return;
    if (canEdit) {
      setDraftTitle(targetTitle);
      setDraftSummary(targetSummary);
      setDraftContent(targetContent);
      setEditorTab('write');
      setIsImageModalOpen(false);
      setImageInsertError(null);
      setIsEditing(true);
    }
    consumeStartInEditModeRef.current?.();
  }, [startInEditMode, canEdit, targetTitle, targetSummary, targetContent]);

  useEffect(() => {
    if (!canEdit) {
      setIsEditing(false);
    }
  }, [canEdit]);

  const enterEditMode = () => {
    if (!canEdit) return;
    setDraftTitle(targetTitle);
    setDraftSummary(targetSummary);
    setDraftContent(targetContent);
    setEditorTab('write');
    setImageInsertError(null);
    setIsEditing(true);
  };

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

  const insertImageMarkdown = (
    src: string,
    alt: string,
    placement?: MarkdownImagePlacement
  ) => {
    const el = textareaRef.current;
    const sel = savedSelectionRef.current ?? (el
      ? {
          start: el.selectionStart ?? draftContent.length,
          end: el.selectionEnd ?? draftContent.length
        }
      : null);
    savedSelectionRef.current = null;

    setDraftContent(prev => applyMarkdownImageInsertion(prev, src, alt, placement, sel));
    setImageInsertError(null);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleOpenImageModal = () => {
    const el = textareaRef.current;
    if (el) {
      savedSelectionRef.current = {
        start: el.selectionStart ?? draftContent.length,
        end: el.selectionEnd ?? draftContent.length
      };
    } else {
      savedSelectionRef.current = {
        start: draftContent.length,
        end: draftContent.length
      };
    }
    setImageInsertError(null);
    setIsImageModalOpen(true);
  };

  const handleDirectImageFile = async (file: File) => {
    setImageInsertError(null);
    const el = textareaRef.current;
    if (el) {
      savedSelectionRef.current = {
        start: el.selectionStart ?? draftContent.length,
        end: el.selectionEnd ?? draftContent.length
      };
    }
    try {
      const processed = await processImageFileToDataUrl(file);
      insertImageMarkdown(processed.dataUrl, processed.suggestedAlt);
    } catch (err) {
      setImageInsertError(err instanceof Error ? err.message : 'Could not insert image.');
    }
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1 min-w-0">
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

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canEdit && (
              !isEditing ? (
                <button
                  type="button"
                  onClick={enterEditMode}
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
                    <button
                      type="button"
                      onClick={handleOpenImageModal}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 whitespace-nowrap"
                      title="Upload, drag/paste, or insert an image URL"
                    >
                      <ImagePlus className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                      <span>Insert Image</span>
                    </button>
                  </div>
                )}
              </div>

              {editorTab === 'write' ? (
                <div className="space-y-1.5">
                  <textarea
                    ref={textareaRef}
                    rows={12}
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      for (let idx = 0; idx < items.length; idx++) {
                        if (items[idx].type.startsWith('image/')) {
                          const file = items[idx].getAsFile();
                          if (file) {
                            e.preventDefault();
                            void handleDirectImageFile(file);
                            return;
                          }
                        }
                      }
                    }}
                    onDragOver={(e) => {
                      if (Array.from(e.dataTransfer.types || []).includes('Files')) {
                        e.preventDefault();
                        setIsTextareaDragOver(true);
                      }
                    }}
                    onDragLeave={() => setIsTextareaDragOver(false)}
                    onDrop={(e) => {
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        e.preventDefault();
                        setIsTextareaDragOver(false);
                        void handleDirectImageFile(file);
                      } else {
                        setIsTextareaDragOver(false);
                      }
                    }}
                    placeholder={`Write detailed ${isSectionLevel ? 'section' : 'chapter'} content here using Markdown or plain text...\n\nExample:\n## Key Objectives\n- Understand architectural planes and controller roles\n![Topology Diagram](https://example.com/topology.png)`}
                    className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border text-sm font-mono leading-relaxed text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      isTextareaDragOver
                        ? 'border-blue-500 ring-2 ring-blue-500/40 bg-blue-50/40 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {imageInsertError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{imageInsertError}</p>
                  )}
                </div>
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
                <code className="font-mono">**bold**</code>, code blocks, and images (upload, drag/paste, or URL).
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

            <MarkdownImageModal
              isOpen={isImageModalOpen}
              onClose={() => setIsImageModalOpen(false)}
              onInsert={({ src, alt, placement }) => insertImageMarkdown(src, alt, placement)}
            />
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
                      ? 'Use the Course Outline or the Next arrow above to explore lessons in '
                      : 'Use the Course Outline or the Next arrow above to explore sections in '}
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
                onClick={enterEditMode}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Write {isSectionLevel ? 'Section' : 'Chapter'} Content</span>
              </button>
            )}
          </div>
        )}
      </div>
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
  breadcrumb,
  module,
  moduleIndex,
  canEdit = false,
  startInEditMode = false,
  onConsumeStartInEditMode,
  onSaveModuleContent,
  children
}) => {
  const itemNumber = breadcrumb?.itemNumber || `M${moduleIndex + 1}`;
  const targetContent = module.contentMarkdown || '';

  const prevModuleIdRef = useRef<string>(module.id);
  const consumeStartInEditModeRef = useRef(onConsumeStartInEditMode);
  useEffect(() => {
    consumeStartInEditModeRef.current = onConsumeStartInEditMode;
  }, [onConsumeStartInEditMode]);

  const [isEditing, setIsEditing] = useState<boolean>(canEdit && startInEditMode);
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [draftTitle, setDraftTitle] = useState<string>(module.title);
  const [draftSummary, setDraftSummary] = useState<string>(module.summary || '');
  const [draftDurationMin, setDraftDurationMin] = useState<number>(module.durationMin || 20);
  const [draftVideoUrl, setDraftVideoUrl] = useState<string>(module.videoUrl || '');
  const [draftVideoDuration, setDraftVideoDuration] = useState<string>(module.videoDuration || '');
  const [draftContent, setDraftContent] = useState<string>(targetContent);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [imageInsertError, setImageInsertError] = useState<string | null>(null);
  const [isTextareaDragOver, setIsTextareaDragOver] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);

  // Reset editor state only when switching to a different lesson module
  useEffect(() => {
    if (prevModuleIdRef.current === module.id) return;
    prevModuleIdRef.current = module.id;
    setDraftTitle(module.title);
    setDraftSummary(module.summary || '');
    setDraftDurationMin(module.durationMin || 20);
    setDraftVideoUrl(module.videoUrl || '');
    setDraftVideoDuration(module.videoDuration || '');
    setDraftContent(targetContent);
    setEditorTab('write');
    setIsImageModalOpen(false);
    setImageInsertError(null);
    setIsEditing(canEdit && startInEditMode);
  }, [
    module.id,
    module.title,
    module.summary,
    module.durationMin,
    module.videoUrl,
    module.videoDuration,
    targetContent,
    canEdit,
    startInEditMode
  ]);

  // Keep drafts synced with external prop updates only when not actively editing
  useEffect(() => {
    if (isEditing) return;
    setDraftTitle(module.title);
    setDraftSummary(module.summary || '');
    setDraftDurationMin(module.durationMin || 20);
    setDraftVideoUrl(module.videoUrl || '');
    setDraftVideoDuration(module.videoDuration || '');
    setDraftContent(targetContent);
  }, [
    isEditing,
    module.title,
    module.summary,
    module.durationMin,
    module.videoUrl,
    module.videoDuration,
    targetContent
  ]);

  // Consume one-shot startInEditMode trigger without exiting edit mode once consumed
  useEffect(() => {
    if (!startInEditMode) return;
    if (canEdit) {
      setDraftTitle(module.title);
      setDraftSummary(module.summary || '');
      setDraftDurationMin(module.durationMin || 20);
      setDraftVideoUrl(module.videoUrl || '');
      setDraftVideoDuration(module.videoDuration || '');
      setDraftContent(targetContent);
      setEditorTab('write');
      setIsImageModalOpen(false);
      setImageInsertError(null);
      setIsEditing(true);
    }
    consumeStartInEditModeRef.current?.();
  }, [
    startInEditMode,
    canEdit,
    module.title,
    module.summary,
    module.durationMin,
    module.videoUrl,
    module.videoDuration,
    targetContent
  ]);

  useEffect(() => {
    if (!canEdit) {
      setIsEditing(false);
    }
  }, [canEdit]);

  const enterEditMode = () => {
    if (!canEdit) return;
    setDraftTitle(module.title);
    setDraftSummary(module.summary || '');
    setDraftDurationMin(module.durationMin || 20);
    setDraftVideoUrl(module.videoUrl || '');
    setDraftVideoDuration(module.videoDuration || '');
    setDraftContent(targetContent);
    setEditorTab('write');
    setImageInsertError(null);
    setIsEditing(true);
  };

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

  const insertImageMarkdown = (
    src: string,
    alt: string,
    placement?: MarkdownImagePlacement
  ) => {
    const el = textareaRef.current;
    const sel = savedSelectionRef.current ?? (el
      ? {
          start: el.selectionStart ?? draftContent.length,
          end: el.selectionEnd ?? draftContent.length
        }
      : null);
    savedSelectionRef.current = null;

    setDraftContent(prev => applyMarkdownImageInsertion(prev, src, alt, placement, sel));
    setImageInsertError(null);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleOpenImageModal = () => {
    const el = textareaRef.current;
    if (el) {
      savedSelectionRef.current = {
        start: el.selectionStart ?? draftContent.length,
        end: el.selectionEnd ?? draftContent.length
      };
    } else {
      savedSelectionRef.current = {
        start: draftContent.length,
        end: draftContent.length
      };
    }
    setImageInsertError(null);
    setIsImageModalOpen(true);
  };

  const handleDirectImageFile = async (file: File) => {
    setImageInsertError(null);
    const el = textareaRef.current;
    if (el) {
      savedSelectionRef.current = {
        start: el.selectionStart ?? draftContent.length,
        end: el.selectionEnd ?? draftContent.length
      };
    }
    try {
      const processed = await processImageFileToDataUrl(file);
      insertImageMarkdown(processed.dataUrl, processed.suggestedAlt);
    } catch (err) {
      setImageInsertError(err instanceof Error ? err.message : 'Could not insert image.');
    }
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
        {/* Header */}
        <div
          className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
            (canEdit && isEditing) || module.type === 'theory'
              ? 'pb-5 border-b border-slate-100 dark:border-slate-800'
              : ''
          }`}
        >
          <div className="space-y-1 min-w-0">
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

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={enterEditMode}
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
                    <button
                      type="button"
                      onClick={handleOpenImageModal}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 whitespace-nowrap"
                      title="Upload, drag/paste, or insert an image URL"
                    >
                      <ImagePlus className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                      <span>Insert Image</span>
                    </button>
                  </div>
                )}
              </div>

              {editorTab === 'write' ? (
                <div className="space-y-1.5">
                  <textarea
                    ref={textareaRef}
                    rows={12}
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      for (let idx = 0; idx < items.length; idx++) {
                        if (items[idx].type.startsWith('image/')) {
                          const file = items[idx].getAsFile();
                          if (file) {
                            e.preventDefault();
                            void handleDirectImageFile(file);
                            return;
                          }
                        }
                      }
                    }}
                    onDragOver={(e) => {
                      if (Array.from(e.dataTransfer.types || []).includes('Files')) {
                        e.preventDefault();
                        setIsTextareaDragOver(true);
                      }
                    }}
                    onDragLeave={() => setIsTextareaDragOver(false)}
                    onDrop={(e) => {
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        e.preventDefault();
                        setIsTextareaDragOver(false);
                        void handleDirectImageFile(file);
                      } else {
                        setIsTextareaDragOver(false);
                      }
                    }}
                    placeholder={`Write detailed lesson content or companion notes here using Markdown or plain text...\n\nExample:\n## Key Objectives\n- Understand architectural concepts and command syntax\n![Topology Diagram](https://example.com/topology.png)`}
                    className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border text-sm font-mono leading-relaxed text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      isTextareaDragOver
                        ? 'border-blue-500 ring-2 ring-blue-500/40 bg-blue-50/40 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {imageInsertError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{imageInsertError}</p>
                  )}
                </div>
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
                <code className="font-mono">**bold**</code>, code blocks, and images (upload, drag/paste, or URL).
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

            <MarkdownImageModal
              isOpen={isImageModalOpen}
              onClose={() => setIsImageModalOpen(false)}
              onInsert={({ src, alt, placement }) => insertImageMarkdown(src, alt, placement)}
            />
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
                  onClick={enterEditMode}
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
