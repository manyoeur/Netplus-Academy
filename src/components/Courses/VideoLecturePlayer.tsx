import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  CheckSquare,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  SkipForward
} from 'lucide-react';
import { CourseModule } from '../../types';

interface VideoLecturePlayerProps {
  courseId: string;
  module: CourseModule;
  moduleIndex: number;
  passingScore: number;
  isQuizPassed: boolean;
  hasWatchedVideo: boolean;
  nextModuleTitle?: string;
  onLectureCompleted: () => void;
  onOpenPostQuiz: () => void;
  onStudyTimeTick?: (seconds: number, moduleId: string) => void;
}

interface LectureSlide {
  id: string;
  label: string;
  heading: string;
  points: string[];
  startRatio: number;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2] as const;

function parseDurationSeconds(durationStr?: string, fallbackMinutes = 18): number {
  if (!durationStr) return Math.max(120, fallbackMinutes * 60);
  const parts = durationStr.trim().split(':').map(Number);
  if (parts.some(n => Number.isNaN(n))) {
    return Math.max(120, fallbackMinutes * 60);
  }
  if (parts.length === 2) {
    return Math.max(30, parts[0] * 60 + parts[1]);
  }
  if (parts.length === 3) {
    return Math.max(30, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }
  return Math.max(120, fallbackMinutes * 60);
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function isDirectVideoFile(url?: string): boolean {
  if (!url) return false;
  return /\.(mp4|webm|ogg|m4v)(\?.*)?$/i.test(url.trim());
}

function extractLectureSlides(module: CourseModule): LectureSlide[] {
  const rawLines = (module.contentMarkdown || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const bulletPoints = rawLines
    .filter(l => l.startsWith('-') || l.startsWith('*') || /^\d+\./.test(l))
    .map(l => l.replace(/^[-*]\s*|\d+\.\s*/, '').replace(/\*\*/g, '').replace(/`/g, ''));

  const slides: LectureSlide[] = [
    {
      id: 'intro',
      label: '01. Architecture Overview',
      heading: module.title,
      points: [
        module.summary || 'Core operational concepts and architecture walkthrough.',
        bulletPoints[0] || 'Control plane and operational behavior fundamentals.'
      ],
      startRatio: 0
    },
    {
      id: 'mechanics',
      label: '02. Protocol Mechanics & CLI',
      heading: module.mainContentTitle || 'Configuration & Verification Flow',
      points:
        bulletPoints.length >= 2
          ? bulletPoints.slice(0, 3)
          : [
              'Step-by-step configuration syntax and hierarchy',
              'Verification commands and live state inspection',
              'Common misconfigurations to avoid in production'
            ],
      startRatio: 0.35
    },
    {
      id: 'verification',
      label: '03. Troubleshooting & Mastery Prep',
      heading: 'Production Verification & Key Takeaways',
      points:
        bulletPoints.length >= 3
          ? bulletPoints.slice(2, 5)
          : [
              'Interpret operational show outputs accurately',
              'Verify convergence, reachability, and persistence',
              'Prepare for the post-lecture mastery check'
            ],
      startRatio: 0.72
    }
  ];

  return slides;
}

export const VideoLecturePlayer: React.FC<VideoLecturePlayerProps> = ({
  courseId,
  module,
  moduleIndex,
  passingScore,
  isQuizPassed,
  hasWatchedVideo,
  nextModuleTitle,
  onLectureCompleted,
  onOpenPostQuiz,
  onStudyTimeTick
}) => {
  const isDirectVideo = useMemo(() => isDirectVideoFile(module.videoUrl), [module.videoUrl]);
  const totalSeconds = useMemo(
    () => parseDurationSeconds(module.videoDuration, module.durationMin),
    [module.videoDuration, module.durationMin]
  );
  const slides = useMemo(() => extractLectureSlides(module), [module]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completionFiredRef = useRef<boolean>(false);
  const studyAccumulatorRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [videoDuration, setVideoDuration] = useState(totalSeconds);

  // Reset player state when changing course or video module
  useEffect(() => {
    setIsPlaying(false);
    setCurrentSeconds(0);
    setVideoDuration(totalSeconds);
    completionFiredRef.current = false;
    studyAccumulatorRef.current = 0;
  }, [courseId, module.id, totalSeconds]);

  // Keep HTML5 video speed synced
  useEffect(() => {
    if (videoRef.current && isDirectVideo) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, isDirectVideo]);

  // Simulated lecture playback loop for non-direct video streams
  useEffect(() => {
    if (isDirectVideo || !isPlaying) return;

    const tickMs = 250;
    const timer = window.setInterval(() => {
      setCurrentSeconds(prev => {
        // Advance realistic lecture progress scaled smoothly for interactive review
        const step = (tickMs / 1000) * playbackSpeed;
        const next = Math.min(videoDuration, prev + step);

        studyAccumulatorRef.current += tickMs / 1000;
        if (studyAccumulatorRef.current >= 15) {
          const whole = Math.floor(studyAccumulatorRef.current);
          studyAccumulatorRef.current -= whole;
          onStudyTimeTick?.(whole, module.id);
        }

        if (next >= videoDuration && !completionFiredRef.current) {
          completionFiredRef.current = true;
          setIsPlaying(false);
          window.setTimeout(() => {
            onLectureCompleted();
          }, 250);
        }
        return next;
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [isDirectVideo, isPlaying, playbackSpeed, videoDuration, module.id, onLectureCompleted, onStudyTimeTick]);

  // Track study time when real HTML5 video plays
  useEffect(() => {
    if (!isDirectVideo || !isPlaying) return;
    const timer = window.setInterval(() => {
      onStudyTimeTick?.(15, module.id);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [isDirectVideo, isPlaying, module.id, onStudyTimeTick]);

  const progressRatio = videoDuration > 0 ? Math.min(1, currentSeconds / videoDuration) : 0;
  const progressPercent = Math.round(progressRatio * 100);

  const activeSlide = useMemo(() => {
    let chosen = slides[0];
    for (const slide of slides) {
      if (progressRatio >= slide.startRatio) {
        chosen = slide;
      }
    }
    return chosen;
  }, [slides, progressRatio]);

  const handleTogglePlay = () => {
    if (isDirectVideo && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    if (currentSeconds >= videoDuration) {
      completionFiredRef.current = false;
      setCurrentSeconds(0);
    }
    setIsPlaying(prev => !prev);
  };

  const handleSeek = (nextSeconds: number) => {
    const clamped = Math.max(0, Math.min(videoDuration, nextSeconds));
    setCurrentSeconds(clamped);
    if (isDirectVideo && videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    if (clamped < videoDuration) {
      completionFiredRef.current = false;
    }
  };

  const handleCompleteLectureNow = () => {
    setIsPlaying(false);
    setCurrentSeconds(videoDuration);
    if (isDirectVideo && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = videoDuration;
    }
    if (studyAccumulatorRef.current >= 1) {
      onStudyTimeTick?.(Math.round(studyAccumulatorRef.current), module.id);
      studyAccumulatorRef.current = 0;
    }
    completionFiredRef.current = true;
    onLectureCompleted();
  };

  const handleReplay = () => {
    completionFiredRef.current = false;
    setCurrentSeconds(0);
    if (isDirectVideo && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    setIsPlaying(true);
  };

  const handleCycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackSpeed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackSpeed(next);
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      {/* Header & Clean Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Module {moduleIndex + 1} Video Lecture</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{module.videoDuration || formatClock(videoDuration)}</span>
            <span aria-hidden="true">·</span>
            <span>Mastery threshold {passingScore}%</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white leading-snug">
            {module.title}
          </h1>
        </div>

        <div className="shrink-0">
          {isQuizPassed ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Unlock className="w-4 h-4 shrink-0" />
              <span>Mastery Verified</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Quiz Required to Unlock Next</span>
            </span>
          )}
        </div>
      </div>

      {/* Interactive 16:9 Video Lecture Stage */}
      <div className="relative aspect-video w-full rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden select-none">
        {isDirectVideo ? (
          <video
            ref={videoRef}
            src={module.videoUrl}
            muted={isMuted}
            playsInline
            onLoadedMetadata={() => {
              if (videoRef.current && Number.isFinite(videoRef.current.duration) && videoRef.current.duration > 0) {
                setVideoDuration(Math.round(videoRef.current.duration));
              }
            }}
            onTimeUpdate={() => {
              if (videoRef.current) {
                setCurrentSeconds(videoRef.current.currentTime);
              }
            }}
            onEnded={() => {
              setIsPlaying(false);
              if (!completionFiredRef.current) {
                completionFiredRef.current = true;
                onLectureCompleted();
              }
            }}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Interactive Studio Lecture Stage */
          <div
            onClick={handleTogglePlay}
            className="w-full h-full relative flex flex-col justify-between p-5 sm:p-8 cursor-pointer bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/60"
          >
            {/* Subtle Technical Grid Background */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(56, 189, 248, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.2) 1px, transparent 1px)',
                backgroundSize: '32px 32px'
              }}
            />

            {/* Top Lecture Chapter Indicator */}
            <div className="relative z-10 flex items-center justify-between gap-4 text-xs text-slate-300">
              <span className="font-mono text-cyan-300 font-semibold truncate">
                {activeSlide.label}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-slate-400 shrink-0">
                1080p60 · {playbackSpeed}x
              </span>
            </div>

            {/* Center Slide Content */}
            <div className="relative z-10 max-w-2xl mx-auto w-full my-auto py-2 space-y-4">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePlay();
                  }}
                  aria-label={isPlaying ? 'Pause video lecture' : 'Play video lecture'}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 transition-transform duration-150 hover:scale-105 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5" />
                  )}
                </button>

                <div className="space-y-2 min-w-0">
                  <h2 className="text-base sm:text-xl font-bold text-white leading-snug">
                    {activeSlide.heading}
                  </h2>
                  <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300">
                    {activeSlide.points.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-cyan-400 font-mono text-xs mt-0.5 shrink-0">
                          {idx + 1}.
                        </span>
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Measured contrast scrim behind bottom player controls */}
            <div className="h-10" />
          </div>
        )}

        {/* Bottom Transport Bar with Measured Scrim */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-4 pt-6 pb-3 space-y-2"
        >
          {/* Scrubber Track */}
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={videoDuration}
              step={1}
              value={Math.floor(currentSeconds)}
              onChange={(e) => handleSeek(Number(e.target.value))}
              aria-label="Video lecture progress scrubber"
              className="w-full h-1.5 accent-cyan-400 cursor-pointer bg-slate-700 rounded-lg"
            />
          </div>

          {/* Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>{currentSeconds > 0 && currentSeconds < videoDuration ? 'Resume' : 'Play'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReplay}
                aria-label="Restart lecture"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {isDirectVideo && (
                <button
                  type="button"
                  onClick={() => setIsMuted(prev => !prev)}
                  aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              )}

              <span className="font-mono text-[11px] tabular-nums text-slate-300 ml-1">
                {formatClock(currentSeconds)} / {formatClock(videoDuration)} ({progressPercent}%)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCycleSpeed}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 font-mono text-[11px] font-semibold text-slate-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {playbackSpeed}x
              </button>

              <button
                type="button"
                onClick={handleCompleteLectureNow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>{hasWatchedVideo ? 'Launch Mastery Quiz' : 'Complete Lecture'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chapter Quick Jump & Post-Lecture Mastery Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {slides.map((slide, idx) => {
          const isCurrent = activeSlide.id === slide.id;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => handleSeek(Math.floor(slide.startRatio * videoDuration))}
              className={`p-3 rounded-xl border text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isCurrent
                  ? 'bg-blue-50/70 dark:bg-blue-950/35 border-blue-200 dark:border-blue-800 text-slate-900 dark:text-white'
                  : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                <span>Segment {idx + 1}</span>
                <span>{formatClock(slide.startRatio * videoDuration)}</span>
              </div>
              <p className="text-xs font-semibold mt-0.5 truncate">{slide.heading}</p>
            </button>
          );
        })}
      </div>

      {/* Post-Lecture Mastery Callout */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {isQuizPassed ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          ) : (
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          )}
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {isQuizPassed
                ? `Post-lecture mastery verified${nextModuleTitle ? ` — "${nextModuleTitle}" unlocked` : ''}`
                : 'Post-Lecture Mastery Quiz triggers automatically when this video finishes'}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              {isQuizPassed
                ? 'You may continue to the next module or retake the post-lecture quiz anytime to improve your score.'
                : `Score at least ${passingScore}% on the post-lecture quiz to unlock ${nextModuleTitle || 'the next segment'}.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={isQuizPassed ? onOpenPostQuiz : handleCompleteLectureNow}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            isQuizPassed
              ? 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>{isQuizPassed ? 'Review Mastery Quiz' : 'Finish Video & Start Quiz'}</span>
        </button>
      </div>

      {module.contentMarkdown && (
        <div className="text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800 whitespace-pre-wrap leading-relaxed">
          {module.contentMarkdown}
        </div>
      )}
    </div>
  );
};
