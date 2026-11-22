import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Play,
  Repeat,
  Video,
  VolumeX,
  X
} from 'lucide-react';
import { MarkdownVideoEmbed } from './MarkdownVideoEmbed';

export type VideoProviderKind = 'youtube' | 'vimeo' | 'mp4';

export interface ParsedMarkdownVideoModifiers {
  title: string;
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
}

export interface ResolvedVideoEmbed {
  provider: VideoProviderKind;
  providerLabel: string;
  embedUrl: string;
  originalUrl: string;
}

export const STANDALONE_VIDEO_RE = /^@video\[([^\]]*)\]\(([^)\s]+)\)$/;

export function isSafeVideoUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
  if (/^\/(?!\/)\S+$/.test(trimmed)) return true;
  return false;
}

function extractYouTubeId(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'youtu.be') {
      const seg = u.pathname.split('/').filter(Boolean)[0];
      return seg && /^[a-zA-Z0-9_-]{11}$/.test(seg) ? seg : null;
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const vParam = u.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;
      const parts = u.pathname.split('/').filter(Boolean);
      if (
        parts.length >= 2 &&
        (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') &&
        /^[a-zA-Z0-9_-]{11}$/.test(parts[1])
      ) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }
  return null;
}

function extractVimeoId(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i--) {
        if (/^\d{5,12}$/.test(parts[i])) {
          return parts[i];
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

function isDirectMp4VideoUrl(urlStr: string): boolean {
  const trimmed = urlStr.trim();
  if (/^\/(?!\/)\S+\.(mp4|webm|ogg|ogv|m4v)(\?.*)?$/i.test(trimmed)) {
    return true;
  }
  try {
    const u = new URL(trimmed);
    return /\.(mp4|webm|ogg|ogv|m4v)$/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function resolveVideoEmbed(
  rawUrl: string,
  options: { autoplay?: boolean; loop?: boolean; muted?: boolean } = {}
): ResolvedVideoEmbed | null {
  const trimmed = rawUrl.trim();
  if (!isSafeVideoUrl(trimmed)) return null;

  const { autoplay = false, loop = false, muted = false } = options;

  const youtubeId = extractYouTubeId(trimmed);
  if (youtubeId) {
    const params = new URLSearchParams();
    params.set('rel', '0');
    if (autoplay) params.set('autoplay', '1');
    if (loop) {
      params.set('loop', '1');
      params.set('playlist', youtubeId);
    }
    if (muted) params.set('mute', '1');

    return {
      provider: 'youtube',
      providerLabel: 'YouTube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`,
      originalUrl: trimmed
    };
  }

  const vimeoId = extractVimeoId(trimmed);
  if (vimeoId) {
    const params = new URLSearchParams();
    params.set('dnt', '1');
    if (autoplay) params.set('autoplay', '1');
    if (loop) params.set('loop', '1');
    if (muted) params.set('muted', '1');

    return {
      provider: 'vimeo',
      providerLabel: 'Vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?${params.toString()}`,
      originalUrl: trimmed
    };
  }

  if (isDirectMp4VideoUrl(trimmed)) {
    return {
      provider: 'mp4',
      providerLabel: 'Direct Video (MP4 / WebM)',
      embedUrl: trimmed,
      originalUrl: trimmed
    };
  }

  return null;
}

export function parseMarkdownVideoModifiers(rawMeta: string): ParsedMarkdownVideoModifiers {
  const parts = rawMeta
    .split('|')
    .map(p => p.trim())
    .filter(Boolean);

  let autoplay = false;
  let loop = false;
  let muted = false;
  const titleParts: string[] = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'autoplay') {
      autoplay = true;
    } else if (lower === 'loop') {
      loop = true;
    } else if (lower === 'muted' || lower === 'mute') {
      muted = true;
    } else {
      titleParts.push(part);
    }
  }

  return {
    title: titleParts.join(' ').trim(),
    autoplay,
    loop,
    muted
  };
}

export function formatMarkdownVideoMeta(meta: ParsedMarkdownVideoModifiers): string {
  const cleanTitle = meta.title.trim().replace(/[\r\n[\]|]/g, ' ').trim();
  const tokens: string[] = [];
  if (cleanTitle) tokens.push(cleanTitle);
  if (meta.autoplay) tokens.push('autoplay');
  if (meta.loop) tokens.push('loop');
  if (meta.muted) tokens.push('muted');
  return tokens.join('|');
}

export function formatMarkdownVideoTag(
  url: string,
  meta: ParsedMarkdownVideoModifiers
): string {
  return `@video[${formatMarkdownVideoMeta(meta)}](${url.trim()})`;
}

export function updateMarkdownVideoAtIndex(
  markdown: string,
  targetVideoIndex: number,
  updater: (current: ParsedMarkdownVideoModifiers) => ParsedMarkdownVideoModifiers | null
): string {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let currentIndex = 0;
  let inCodeFence = false;
  const output: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeFence = !inCodeFence;
      output.push(line);
      continue;
    }
    if (inCodeFence) {
      output.push(line);
      continue;
    }

    const match = line.trim().match(STANDALONE_VIDEO_RE);
    if (match) {
      const idx = currentIndex;
      currentIndex += 1;
      if (idx === targetVideoIndex) {
        const parsed = parseMarkdownVideoModifiers(match[1]);
        const next = updater(parsed);
        if (next === null) {
          // Remove this embedded video line
          continue;
        }
        output.push(formatMarkdownVideoTag(match[2], next));
        continue;
      }
    }

    output.push(line);
  }

  return output.join('\n');
}

interface MarkdownVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (videoMarkdown: string) => void;
}

export const MarkdownVideoModal: React.FC<MarkdownVideoModalProps> = ({
  isOpen,
  onClose,
  onInsert
}) => {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [autoplay, setAutoplay] = useState<boolean>(false);
  const [loop, setLoop] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setVideoUrl('');
    setTitle('');
    setAutoplay(false);
    setLoop(false);
    setMuted(false);
  }, [isOpen]);

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

  if (!isOpen) return null;

  const trimmedUrl = videoUrl.trim();
  const resolved = resolveVideoEmbed(trimmedUrl, { autoplay, loop, muted });
  const canSubmit = Boolean(resolved);

  const handleToggleAutoplay = (checked: boolean) => {
    setAutoplay(checked);
    // Browsers normally block unmuted autoplay; automatically suggest muted when enabling autoplay
    if (checked) {
      setMuted(true);
    }
  };

  const handleConfirm = () => {
    if (!resolved) return;
    const tag = formatMarkdownVideoTag(resolved.originalUrl, {
      title,
      autoplay,
      loop,
      muted
    });
    onInsert(tag);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="insert-video-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="insert-video-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-white"
              >
                Embed Educational Video
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Paste a YouTube, Vimeo, or direct MP4 URL with playback options
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close embed video dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Video URL */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor="embed-video-url-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Video URL
              </label>
              {resolved && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{resolved.providerLabel}</span>
                </span>
              )}
            </div>
            <input
              id="embed-video-url-input"
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (canSubmit) handleConfirm();
                }
              }}
              placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/... or https://.../lesson.mp4"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {trimmedUrl && !resolved && (
              <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/70 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Enter a valid <strong>YouTube</strong>, <strong>Vimeo</strong>, or direct{' '}
                  <code className="font-mono">.mp4</code> / <code className="font-mono">.webm</code>{' '}
                  / <code className="font-mono">.ogg</code> video URL.
                </span>
              </div>
            )}
          </div>

          {/* Optional Video Title / Caption */}
          <div>
            <label
              htmlFor="embed-video-title-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Video Title / Caption <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="embed-video-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (canSubmit) handleConfirm();
                }
              }}
              placeholder="e.g., Packet Encapsulation & VLAN Tagging Demo"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Playback Settings */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Playback Settings
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleToggleAutoplay(!autoplay)}
                aria-pressed={autoplay}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                  autoplay
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 shrink-0" />
                  <span>Auto-play</span>
                </span>
                <span className="text-[10px] font-mono uppercase">
                  {autoplay ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLoop(!loop)}
                aria-pressed={loop}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                  loop
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 shrink-0" />
                  <span>Loop</span>
                </span>
                <span className="text-[10px] font-mono uppercase">
                  {loop ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMuted(!muted)}
                aria-pressed={muted}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                  muted
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <VolumeX className="w-3.5 h-3.5 shrink-0" />
                  <span>Start Muted</span>
                </span>
                <span className="text-[10px] font-mono uppercase">
                  {muted ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
            {autoplay && !muted && (
              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                Note: Most browsers require &ldquo;Start Muted&rdquo; to allow automatic playback on page load.
              </p>
            )}
          </div>

          {/* Live Player Preview */}
          {resolved && (
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Video Preview
              </span>
              <MarkdownVideoEmbed
                src={resolved.originalUrl}
                rawMeta={formatMarkdownVideoMeta({
                  title,
                  autoplay: false,
                  loop,
                  muted
                })}
                compactPreview
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-45 disabled:pointer-events-none text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Embed Video</span>
          </button>
        </div>
      </div>
    </div>
  );
};
