import React, { useEffect, useState } from 'react';
import { Play, Repeat, Trash2, VideoOff, VolumeX } from 'lucide-react';
import {
  parseMarkdownVideoModifiers,
  ParsedMarkdownVideoModifiers,
  resolveVideoEmbed
} from './MarkdownVideoModal';

export interface MarkdownVideoEmbedProps {
  src: string;
  rawMeta: string;
  editable?: boolean;
  videoIndex?: number;
  compactPreview?: boolean;
  onUpdateVideo?: (
    videoIndex: number,
    nextMeta: ParsedMarkdownVideoModifiers | null
  ) => void;
}

export const MarkdownVideoEmbed: React.FC<MarkdownVideoEmbedProps> = ({
  src,
  rawMeta,
  editable = false,
  videoIndex,
  compactPreview = false,
  onUpdateVideo
}) => {
  const [hasError, setHasError] = useState(false);
  const meta = parseMarkdownVideoModifiers(rawMeta);
  const resolved = resolveVideoEmbed(src, {
    autoplay: compactPreview ? false : meta.autoplay,
    loop: meta.loop,
    muted: meta.muted
  });

  useEffect(() => {
    setHasError(false);
  }, [src, rawMeta]);

  if (!resolved || hasError) {
    return (
      <div className="clear-both my-3 flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2.5 min-w-0">
          <VideoOff className="w-4 h-4 shrink-0 text-slate-400" />
          <span className="truncate">
            {meta.title || 'Embedded video unavailable — verify YouTube, Vimeo, or MP4 URL.'}
          </span>
        </div>
        {editable && typeof videoIndex === 'number' && (
          <button
            type="button"
            onClick={() => onUpdateVideo?.(videoIndex, null)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-semibold whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        )}
      </div>
    );
  }

  const toggleFlag = (key: 'autoplay' | 'loop' | 'muted') => {
    if (!editable || typeof videoIndex !== 'number') return;
    const nextValue = !meta[key];
    const nextMeta: ParsedMarkdownVideoModifiers = {
      ...meta,
      [key]: nextValue,
      ...(key === 'autoplay' && nextValue ? { muted: true } : {})
    };
    onUpdateVideo?.(videoIndex, nextMeta);
  };

  return (
    <figure
      className={`clear-both ${
        compactPreview ? 'my-0' : 'my-4'
      } rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 overflow-hidden shadow-2xs`}
    >
      {editable && typeof videoIndex === 'number' && (
        <div className="px-3 py-2 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {resolved.providerLabel}
          </span>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => toggleFlag('autoplay')}
              aria-pressed={meta.autoplay}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border font-semibold transition-colors whitespace-nowrap ${
                meta.autoplay
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-400'
              }`}
              title="Toggle auto-play on lesson load"
            >
              <Play className="w-3 h-3" />
              <span>Auto-play</span>
            </button>
            <button
              type="button"
              onClick={() => toggleFlag('loop')}
              aria-pressed={meta.loop}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border font-semibold transition-colors whitespace-nowrap ${
                meta.loop
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-400'
              }`}
              title="Toggle continuous loop"
            >
              <Repeat className="w-3 h-3" />
              <span>Loop</span>
            </button>
            <button
              type="button"
              onClick={() => toggleFlag('muted')}
              aria-pressed={meta.muted}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border font-semibold transition-colors whitespace-nowrap ${
                meta.muted
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-400'
              }`}
              title="Toggle start muted"
            >
              <VolumeX className="w-3 h-3" />
              <span>Muted</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdateVideo?.(videoIndex, null)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-semibold transition-colors whitespace-nowrap"
              title="Remove embedded video"
              aria-label="Remove embedded video"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove</span>
            </button>
          </div>
        </div>
      )}

      <div className="relative w-full aspect-video bg-slate-950">
        {resolved.provider === 'mp4' ? (
          <video
            key={`${resolved.embedUrl}-${meta.autoplay}-${meta.loop}-${meta.muted}`}
            src={resolved.embedUrl}
            controls
            playsInline
            autoPlay={!compactPreview && meta.autoplay}
            loop={meta.loop}
            muted={meta.muted}
            preload="metadata"
            onError={() => setHasError(true)}
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <iframe
            key={resolved.embedUrl}
            src={resolved.embedUrl}
            title={meta.title || `${resolved.providerLabel} educational video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0"
          />
        )}
      </div>

      {(meta.title || (!editable && (meta.autoplay || meta.loop))) && !compactPreview && (
        <figcaption className="px-4 py-2.5 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {meta.title || `${resolved.providerLabel} Video`}
          </span>
          {(meta.autoplay || meta.loop) && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {[meta.autoplay ? 'Auto-play' : '', meta.loop ? 'Loop' : '']
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
};
