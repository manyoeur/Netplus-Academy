import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Trash2,
  Download,
  History,
  Square,
  Circle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  X
} from 'lucide-react';
import {
  LabReplaySession,
  formatReplayTime,
  triggerReplayScriptDownload
} from '../../utils/labReplayStorage';

export type ReplayPlaybackSpeed = 0.5 | 1 | 2 | 4;

const SPEED_OPTIONS: ReplayPlaybackSpeed[] = [0.5, 1, 2, 4];

interface LabReplayHeaderButtonsProps {
  isRecording: boolean;
  recordingStepsCount: number;
  recordingElapsedMs: number;
  savedCount: number;
  isReplaying: boolean;
  isDrawerOpen: boolean;
  onStartRecording: () => void;
  onStopRecordingClick: () => void;
  onToggleDrawer: () => void;
  compact?: boolean;
  surface?: 'dark' | 'adaptive';
}

export const LabReplayHeaderButtons: React.FC<LabReplayHeaderButtonsProps> = ({
  isRecording,
  recordingStepsCount,
  recordingElapsedMs,
  savedCount,
  isReplaying,
  isDrawerOpen,
  onStartRecording,
  onStopRecordingClick,
  onToggleDrawer,
  compact = false,
  surface = 'dark'
}) => {
  const isAdaptive = surface === 'adaptive';
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {isRecording ? (
        <button
          type="button"
          onClick={onStopRecordingClick}
          title="Stop recording and save Lab Replay"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold transition-colors whitespace-nowrap shadow-xs"
        >
          <Square className="w-2.5 h-2.5 fill-current" />
          <span>Stop</span>
          <span className="font-mono text-[10px] text-red-100 tabular-nums">
            {formatReplayTime(recordingElapsedMs)} · {recordingStepsCount}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onStartRecording}
          disabled={isReplaying}
          title={
            isReplaying
              ? 'Exit Lab Replay before starting a new recording'
              : 'Record Cisco CLI configuration & troubleshooting steps'
          }
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors whitespace-nowrap ${
            isReplaying
              ? isAdaptive
                ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed'
              : isAdaptive
              ? 'border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300'
              : 'border-red-500/40 bg-red-950/40 hover:bg-red-900/50 text-red-300 hover:text-red-200'
          }`}
        >
          <Circle className="w-2.5 h-2.5 fill-red-500 text-red-500" />
          <span>{compact ? 'Rec' : 'Record'}</span>
        </button>
      )}

      <button
        type="button"
        onClick={onToggleDrawer}
        title="Open Lab Replay history & playback controls"
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors whitespace-nowrap ${
          isReplaying || isDrawerOpen
            ? isAdaptive
              ? 'border-blue-500 dark:border-cyan-500/60 bg-blue-50 dark:bg-cyan-950/60 text-blue-700 dark:text-cyan-300'
              : 'border-cyan-500/60 bg-cyan-950/60 text-cyan-300'
            : isAdaptive
            ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            : 'border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-slate-200'
        }`}
      >
        <History className={`w-3 h-3 ${isAdaptive ? 'text-blue-600 dark:text-cyan-400' : 'text-cyan-400'}`} />
        <span>Replay{savedCount > 0 ? ` (${savedCount})` : ''}</span>
        {isDrawerOpen ? (
          <ChevronUp className="w-3 h-3 opacity-75" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-75" />
        )}
      </button>
    </div>
  );
};

interface LabReplayControlsProps {
  sessions: LabReplaySession[];
  isRecording: boolean;
  recordingStepsCount: number;
  recordingElapsedMs: number;
  isSavePromptOpen: boolean;
  defaultSessionTitle: string;
  activeSession: LabReplaySession | null;
  replayCursor: number; // -1 = initial state before step 0, 0..N-1 = step applied
  isPlaying: boolean;
  playbackSpeed: ReplayPlaybackSpeed;
  isDrawerOpen: boolean;
  onConfirmSaveRecording: (title: string) => void;
  onCancelSavePrompt: () => void;
  onDiscardRecording: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onPlayPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onRestart: () => void;
  onSeekStep: (stepIndex: number) => void;
  onChangeSpeed: (speed: ReplayPlaybackSpeed) => void;
  onExitReplay: () => void;
  onResumeLiveFromStep: () => void;
  onCloseDrawer: () => void;
}

export const LabReplayControls: React.FC<LabReplayControlsProps> = ({
  sessions,
  isRecording,
  recordingStepsCount,
  recordingElapsedMs,
  isSavePromptOpen,
  defaultSessionTitle,
  activeSession,
  replayCursor,
  isPlaying,
  playbackSpeed,
  isDrawerOpen,
  onConfirmSaveRecording,
  onCancelSavePrompt,
  onDiscardRecording,
  onSelectSession,
  onDeleteSession,
  onPlayPause,
  onStepBack,
  onStepForward,
  onRestart,
  onSeekStep,
  onChangeSpeed,
  onExitReplay,
  onResumeLiveFromStep,
  onCloseDrawer
}) => {
  const [titleDraft, setTitleDraft] = useState(defaultSessionTitle);
  const activeStepItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isSavePromptOpen) {
      setTitleDraft(defaultSessionTitle);
    }
  }, [isSavePromptOpen, defaultSessionTitle]);

  useEffect(() => {
    activeStepItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [replayCursor, activeSession?.id]);

  if (!isDrawerOpen && !isRecording && !isSavePromptOpen && !activeSession) {
    return null;
  }

  const totalSteps = activeSession?.steps.length ?? 0;
  const currentStepNumber = activeSession ? replayCursor + 1 : 0;
  const errorCount = activeSession
    ? activeSession.steps.filter(s => s.hadError).length
    : 0;
  const activeStep =
    activeSession && replayCursor >= 0 && replayCursor < totalSteps
      ? activeSession.steps[replayCursor]
      : null;

  return (
    <div className="bg-slate-900/95 border-b border-slate-800 text-slate-200 px-3 py-2 space-y-2 shrink-0 font-sans">
      {/* Live Recording Strip */}
      {isRecording && !isSavePromptOpen && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-red-950/50 border border-red-500/40">
          <div className="flex items-center gap-2 text-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="font-semibold text-red-200">Recording Lab Steps</span>
            <span className="font-mono text-[11px] text-red-300 tabular-nums">
              {formatReplayTime(recordingElapsedMs)} · {recordingStepsCount}{' '}
              {recordingStepsCount === 1 ? 'command' : 'commands'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onDiscardRecording}
              className="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Inline Save Prompt */}
      {isSavePromptOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirmSaveRecording(titleDraft.trim() || defaultSessionTitle);
          }}
          className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-cyan-500/40"
        >
          <span className="text-[11px] font-semibold text-cyan-300 shrink-0">
            Save Replay ({recordingStepsCount} steps):
          </span>
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            autoFocus
            maxLength={80}
            placeholder="Name this troubleshooting session..."
            className="flex-1 min-w-[180px] px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onDiscardRecording}
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onCancelSavePrompt}
            className="px-2 py-1 rounded text-slate-400 hover:text-white text-[11px] transition-colors"
          >
            Keep Recording
          </button>
        </form>
      )}

      {/* Saved Recordings Selector + Replay Drawer */}
      {(isDrawerOpen || activeSession) && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 shrink-0">
                Lab Replay
              </span>
              {sessions.length === 0 ? (
                <span className="text-xs text-slate-400 truncate">
                  No saved recordings yet. Click Record to capture your CLI troubleshooting flow.
                </span>
              ) : (
                <select
                  aria-label="Select saved lab replay"
                  value={activeSession?.id || ''}
                  onChange={(e) => {
                    if (e.target.value) onSelectSession(e.target.value);
                  }}
                  className="max-w-xs sm:max-w-sm truncate px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                >
                  <option value="">Choose a recorded session ({sessions.length})...</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} · {s.steps.length} steps ({formatReplayTime(s.durationMs)})
                    </option>
                  ))}
                </select>
              )}
              {activeSession && errorCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-600/40 text-[10px] font-medium text-amber-300 shrink-0">
                  <AlertTriangle className="w-3 h-3" />
                  {errorCount} {errorCount === 1 ? 'CLI error' : 'CLI errors'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {activeSession && (
                <>
                  <button
                    type="button"
                    onClick={() => triggerReplayScriptDownload(activeSession)}
                    title="Export replay transcript as .txt"
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSession(activeSession.id)}
                    title="Delete saved replay"
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {!activeSession && (
                <button
                  type="button"
                  onClick={onCloseDrawer}
                  aria-label="Close Lab Replay panel"
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Active Replay Transport & Timeline */}
          {activeSession && (
            <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-2 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Transport buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onRestart}
                    title="Reset to initial state before step 1"
                    className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onStepBack}
                    disabled={replayCursor < 0}
                    title="Previous step"
                    className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onPlayPause}
                    disabled={totalSteps === 0}
                    title={isPlaying ? 'Pause replay' : 'Play replay'}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold disabled:opacity-40 transition-colors"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{replayCursor >= totalSteps - 1 ? 'Replay' : 'Play'}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onStepForward}
                    disabled={replayCursor >= totalSteps - 1}
                    title="Next step"
                    className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Scrubber slider */}
                <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                  <input
                    type="range"
                    aria-label="Replay step scrubber"
                    min={-1}
                    max={Math.max(-1, totalSteps - 1)}
                    value={replayCursor}
                    onChange={(e) => onSeekStep(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5"
                  />
                  <span className="font-mono text-[11px] text-slate-300 tabular-nums shrink-0">
                    {currentStepNumber}/{totalSteps}
                  </span>
                </div>

                {/* Speed & Action controls */}
                <div className="flex items-center gap-1.5">
                  <div className="inline-flex rounded border border-slate-700 overflow-hidden">
                    {SPEED_OPTIONS.map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => onChangeSpeed(spd)}
                        className={`px-1.5 py-0.5 text-[10px] font-mono transition-colors ${
                          playbackSpeed === spd
                            ? 'bg-cyan-600 text-white font-bold'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={onResumeLiveFromStep}
                    title="Continue configuring live starting from this replayed step"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-emerald-500/40 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 text-[11px] font-semibold transition-colors whitespace-nowrap"
                  >
                    <CornerDownRight className="w-3 h-3" />
                    <span>Resume Live Here</span>
                  </button>

                  <button
                    type="button"
                    onClick={onExitReplay}
                    title="Exit replay and restore your live terminal session"
                    className="px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors whitespace-nowrap"
                  >
                    Exit Replay
                  </button>
                </div>
              </div>

              {/* Active step callout + compact clickable step timeline */}
              {activeStep && (
                <div className="text-[11px] font-mono px-2 py-1 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="text-slate-400 mr-1.5">
                      [{formatReplayTime(activeStep.elapsedMs)}]
                    </span>
                    <span className="text-cyan-400 mr-1.5">{activeStep.deviceName}:</span>
                    <span className="text-amber-300">{activeStep.prompt}</span>{' '}
                    <span className="text-white font-semibold">{activeStep.command}</span>
                  </div>
                  {activeStep.hadError && (
                    <span className="text-amber-300 text-[10px] font-sans font-semibold shrink-0">
                      Error triggered
                    </span>
                  )}
                </div>
              )}

              {totalSteps > 0 && (
                <div className="max-h-24 overflow-y-auto space-y-0.5 pr-1">
                  {activeSession.steps.map((step, idx) => {
                    const isCurrent = idx === replayCursor;
                    const isExecuted = idx <= replayCursor;
                    return (
                      <button
                        key={step.id}
                        ref={isCurrent ? activeStepItemRef : null}
                        type="button"
                        onClick={() => onSeekStep(idx)}
                        className={`w-full text-left px-2 py-1 rounded flex items-center justify-between gap-2 text-[11px] font-mono transition-colors ${
                          isCurrent
                            ? 'bg-cyan-950/90 border border-cyan-500/50 text-white'
                            : isExecuted
                            ? 'bg-slate-900/60 text-slate-300 hover:bg-slate-800/80'
                            : 'text-slate-500 hover:bg-slate-900/60 hover:text-slate-300'
                        }`}
                      >
                        <span className="truncate">
                          <span className="text-slate-500 mr-1.5">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          <span className="text-slate-400 mr-1.5">
                            [{formatReplayTime(step.elapsedMs)}]
                          </span>
                          <span className="text-cyan-400 mr-1">{step.deviceName}</span>
                          <span className="text-amber-300/90 mr-1">{step.prompt}</span>
                          <span>{step.command}</span>
                        </span>
                        {step.hadError && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-600/40 text-[9px] font-sans shrink-0">
                            error
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
