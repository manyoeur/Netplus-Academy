import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Binary,
  CheckCircle2,
  Clock,
  Flame,
  Gamepad2,
  Heart,
  HelpCircle,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  XCircle,
  Zap,
  ArrowRight,
  Delete,
  Eye,
  EyeOff
} from 'lucide-react';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
type GameMode = 'builder' | 'decoder' | 'mixed';
type BitWidthMode = '4bit' | '8bit' | 'progressive';
type PaceMode = 'arcade' | 'practice';
type QuestionKind = 'dec-to-bin' | 'hex-to-bin' | 'bin-to-dec';

interface Question {
  id: number;
  kind: QuestionKind;
  bitCount: 4 | 8;
  targetValue: number;
  promptLabel: string;
  targetDisplay: string;
  binaryAnswer: string;
  hexDisplay: string;
  timeLimitSec: number;
}

interface RoundHistoryItem {
  round: number;
  kind: QuestionKind;
  bitCount: 4 | 8;
  targetDisplay: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  pointsEarned: number;
  timeSpentSec: number;
}

interface StoredStats {
  highScore: number;
  bestStreak: number;
  totalSolved: number;
  gamesPlayed: number;
}

const STORAGE_KEY = 'netpulse_binary_game_stats_v1';

const DEFAULT_STATS: StoredStats = {
  highScore: 0,
  bestStreak: 0,
  totalSolved: 0,
  gamesPlayed: 0
};

function loadStats(): StoredStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATS;
    const parsed = JSON.parse(raw) as Partial<StoredStats>;
    return {
      highScore: typeof parsed.highScore === 'number' ? parsed.highScore : 0,
      bestStreak: typeof parsed.bestStreak === 'number' ? parsed.bestStreak : 0,
      totalSolved: typeof parsed.totalSolved === 'number' ? parsed.totalSolved : 0,
      gamesPlayed: typeof parsed.gamesPlayed === 'number' ? parsed.gamesPlayed : 0
    };
  } catch {
    return DEFAULT_STATS;
  }
}

function saveStats(stats: StoredStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota or sandbox errors
  }
}

function formatBinaryGrouped(value: number, bits: 4 | 8): string {
  const padded = value.toString(2).padStart(bits, '0');
  if (bits === 4) return padded;
  return `${padded.slice(0, 4)} ${padded.slice(4)}`;
}

function getBitWeights(bits: 4 | 8): number[] {
  return bits === 4 ? [8, 4, 2, 1] : [128, 64, 32, 16, 8, 4, 2, 1];
}

function generateQuestion(
  round: number,
  gameMode: GameMode,
  widthMode: BitWidthMode,
  previousTarget: number | null
): Question {
  const bitCount: 4 | 8 =
    widthMode === '4bit'
      ? 4
      : widthMode === '8bit'
        ? 8
        : round <= 4
          ? 4
          : 8;

  const maxVal = bitCount === 4 ? 15 : 255;
  let targetValue = Math.floor(Math.random() * maxVal) + 1;
  // Avoid repeating identical target back-to-back
  if (previousTarget !== null && targetValue === previousTarget) {
    targetValue = targetValue === maxVal ? 1 : targetValue + 1;
  }

  let kind: QuestionKind = 'dec-to-bin';
  if (gameMode === 'builder') {
    kind = 'dec-to-bin';
  } else if (gameMode === 'decoder') {
    kind = 'bin-to-dec';
  } else {
    const mod = (round - 1) % 3;
    kind = mod === 0 ? 'dec-to-bin' : mod === 1 ? 'bin-to-dec' : 'hex-to-bin';
  }

  const hexChars = bitCount === 4 ? 1 : 2;
  const hexDisplay = `0x${targetValue.toString(16).toUpperCase().padStart(hexChars, '0')}`;
  const binaryAnswer = formatBinaryGrouped(targetValue, bitCount);

  // Ramps smoothly as rounds progress, always generous enough to solve thoughtfully
  const baseTime = bitCount === 4 ? 18 : 26;
  const reduction = Math.min(10, Math.floor((round - 1) / 3) * 1.5);
  const timeLimitSec = Math.max(bitCount === 4 ? 8 : 13, Math.round(baseTime - reduction));

  if (kind === 'dec-to-bin') {
    return {
      id: round,
      kind,
      bitCount,
      targetValue,
      promptLabel: `Flip bits to build Decimal ${targetValue}`,
      targetDisplay: String(targetValue),
      binaryAnswer,
      hexDisplay,
      timeLimitSec
    };
  }

  if (kind === 'hex-to-bin') {
    return {
      id: round,
      kind,
      bitCount,
      targetValue,
      promptLabel: `Flip bits to match Hex ${hexDisplay}`,
      targetDisplay: hexDisplay,
      binaryAnswer,
      hexDisplay,
      timeLimitSec: timeLimitSec + 2
    };
  }

  return {
    id: round,
    kind,
    bitCount,
    targetValue,
    promptLabel: `Decode this ${bitCount}-bit binary into Decimal`,
    targetDisplay: binaryAnswer,
    binaryAnswer,
    hexDisplay,
    timeLimitSec
  };
}

export const BinaryGame: React.FC = () => {
  // Persisted career stats
  const [stats, setStats] = useState<StoredStats>(() => loadStats());

  // Configuration state
  const [gameMode, setGameMode] = useState<GameMode>('builder');
  const [widthMode, setWidthMode] = useState<BitWidthMode>('8bit');
  const [paceMode, setPaceMode] = useState<PaceMode>('arcade');
  const [autoMatchBuilder, setAutoMatchBuilder] = useState<boolean>(true);
  const [showLiveSum, setShowLiveSum] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Core game state
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [round, setRound] = useState<number>(1);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestSessionStreak, setBestSessionStreak] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [isNewPersonalBest, setIsNewPersonalBest] = useState<boolean>(false);

  // Active round state
  const [question, setQuestion] = useState<Question>(() =>
    generateQuestion(1, 'builder', '8bit', null)
  );
  const [bits, setBits] = useState<number[]>(() => Array(8).fill(0));
  const [decoderInput, setDecoderInput] = useState<string>('');
  const [timeLeftMs, setTimeLeftMs] = useState<number>(26000);
  const [hintUsedThisRound, setHintUsedThisRound] = useState<boolean>(false);
  const [highlightedBitIndex, setHighlightedBitIndex] = useState<number | null>(null);
  const [showDecoderWeights, setShowDecoderWeights] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    status: 'correct' | 'wrong' | 'timeout';
    message: string;
    mathNote: string;
  } | null>(null);
  const [history, setHistory] = useState<RoundHistoryItem[]>([]);

  // Audio + timer refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const roundStartTimestampRef = useRef<number>(Date.now());
  const advanceTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const roundLockedRef = useRef<boolean>(false);
  const decoderInputRef = useRef<HTMLInputElement | null>(null);

  const playSound = useCallback(
    (type: 'flip' | 'correct' | 'streak' | 'wrong' | 'gameover') => {
      if (!soundEnabled) return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          void ctx.resume();
        }

        const now = ctx.currentTime;
        const scheduleNote = (
          freq: number,
          startOffset: number,
          duration: number,
          wave: OscillatorType,
          gainPeak: number
        ) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = wave;
          osc.frequency.setValueAtTime(freq, now + startOffset);
          gain.gain.setValueAtTime(0.0001, now + startOffset);
          gain.gain.exponentialRampToValueAtTime(gainPeak, now + startOffset + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + startOffset);
          osc.stop(now + startOffset + duration + 0.02);
        };

        if (type === 'flip') {
          scheduleNote(520, 0, 0.055, 'triangle', 0.08);
        } else if (type === 'correct') {
          scheduleNote(523.25, 0, 0.11, 'sine', 0.11);
          scheduleNote(659.25, 0.07, 0.14, 'sine', 0.11);
        } else if (type === 'streak') {
          scheduleNote(523.25, 0, 0.1, 'sine', 0.11);
          scheduleNote(659.25, 0.07, 0.1, 'sine', 0.11);
          scheduleNote(783.99, 0.14, 0.18, 'triangle', 0.12);
        } else if (type === 'wrong') {
          scheduleNote(220, 0, 0.14, 'sawtooth', 0.07);
          scheduleNote(175, 0.1, 0.18, 'sawtooth', 0.06);
        } else if (type === 'gameover') {
          scheduleNote(392, 0, 0.14, 'triangle', 0.09);
          scheduleNote(349.23, 0.13, 0.14, 'triangle', 0.09);
          scheduleNote(293.66, 0.26, 0.28, 'triangle', 0.09);
        }
      } catch {
        // Audio unavailable or blocked by browser policy
      }
    },
    [soundEnabled]
  );

  const clearAllTimers = useCallback(() => {
    if (tickTimerRef.current !== null) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const weights = useMemo(() => getBitWeights(question.bitCount), [question.bitCount]);

  const currentBitSum = useMemo(() => {
    return bits.reduce((acc, bit, idx) => acc + (bit === 1 ? weights[idx] : 0), 0);
  }, [bits, weights]);

  const activeAddendsFormula = useMemo(() => {
    const parts = weights.filter((_, idx) => bits[idx] === 1);
    if (parts.length === 0) return '0';
    return `${parts.join(' + ')} = ${currentBitSum}`;
  }, [bits, weights, currentBitSum]);

  const targetMathBreakdown = useMemo(() => {
    const qWeights = getBitWeights(question.bitCount);
    const bin = question.targetValue.toString(2).padStart(question.bitCount, '0');
    const active = qWeights.filter((_, i) => bin[i] === '1');
    return `${active.join(' + ')} = ${question.targetValue}`;
  }, [question]);

  const multiplier = useMemo(() => {
    if (streak >= 10) return 4;
    if (streak >= 6) return 3;
    if (streak >= 3) return 2;
    return 1;
  }, [streak]);

  const prepareRound = useCallback(
    (nextRound: number, prevTarget: number | null) => {
      const nextQ = generateQuestion(nextRound, gameMode, widthMode, prevTarget);
      roundLockedRef.current = false;
      setRound(nextRound);
      setQuestion(nextQ);
      setBits(Array(nextQ.bitCount).fill(0));
      setDecoderInput('');
      setTimeLeftMs(nextQ.timeLimitSec * 1000);
      setHintUsedThisRound(false);
      setHighlightedBitIndex(null);
      setShowDecoderWeights(paceMode === 'practice');
      setFeedback(null);
      roundStartTimestampRef.current = Date.now();
    },
    [gameMode, widthMode, paceMode]
  );

  const finalizeGameOver = useCallback(
    (finalScore: number, finalBestStreak: number, finalHistory: RoundHistoryItem[]) => {
      clearAllTimers();
      roundLockedRef.current = true;
      playSound('gameover');

      const solvedCount = finalHistory.filter((item) => item.isCorrect).length;
      const currentStats = loadStats();
      const beatBest = finalScore > currentStats.highScore && finalScore > 0;
      const updated: StoredStats = {
        highScore: Math.max(currentStats.highScore, finalScore),
        bestStreak: Math.max(currentStats.bestStreak, finalBestStreak),
        totalSolved: currentStats.totalSolved + solvedCount,
        gamesPlayed: currentStats.gamesPlayed + 1
      };
      saveStats(updated);
      setStats(updated);
      setIsNewPersonalBest(beatBest);
      setGameState('GAME_OVER');

      if (beatBest) {
        try {
          void confetti({
            particleCount: 70,
            spread: 65,
            origin: { y: 0.6 }
          });
        } catch {
          // Ignore confetti errors
        }
      }
    },
    [clearAllTimers, playSound]
  );

  const startGame = useCallback(() => {
    clearAllTimers();
    const initialQ = generateQuestion(1, gameMode, widthMode, null);
    roundLockedRef.current = false;
    setScore(0);
    setStreak(0);
    setBestSessionStreak(0);
    setLives(3);
    setHistory([]);
    setIsNewPersonalBest(false);
    setRound(1);
    setQuestion(initialQ);
    setBits(Array(initialQ.bitCount).fill(0));
    setDecoderInput('');
    setTimeLeftMs(initialQ.timeLimitSec * 1000);
    setHintUsedThisRound(false);
    setHighlightedBitIndex(null);
    setShowDecoderWeights(paceMode === 'practice');
    setFeedback(null);
    roundStartTimestampRef.current = Date.now();
    setGameState('PLAYING');
    playSound('flip');
  }, [clearAllTimers, gameMode, widthMode, paceMode, playSound]);

  // Focus decoder numeric input smoothly when entering a decoder round
  useEffect(() => {
    if (gameState === 'PLAYING' && question.kind === 'bin-to-dec') {
      const id = window.setTimeout(() => {
        decoderInputRef.current?.focus();
      }, 40);
      return () => window.clearTimeout(id);
    }
  }, [gameState, question]);

  const handleRoundResolution = useCallback(
    (
      isCorrect: boolean,
      reason: 'correct' | 'wrong' | 'timeout',
      userAnswerLabel: string
    ) => {
      if (roundLockedRef.current) return;
      roundLockedRef.current = true;
      if (tickTimerRef.current !== null) {
        window.clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }

      const elapsedSec = Math.max(
        0.2,
        Math.round(((Date.now() - roundStartTimestampRef.current) / 1000) * 10) / 10
      );

      let pointsEarned = 0;
      let nextScore = score;
      let nextStreak = streak;
      let nextBestStreak = bestSessionStreak;
      let nextLives = lives;

      if (isCorrect) {
        nextStreak = streak + 1;
        nextBestStreak = Math.max(bestSessionStreak, nextStreak);
        const speedBonus =
          paceMode === 'arcade'
            ? Math.round((timeLeftMs / (question.timeLimitSec * 1000)) * 50)
            : 25;
        const widthBonus = question.bitCount === 8 ? 100 : 60;
        const roundMultiplier =
          nextStreak >= 10 ? 4 : nextStreak >= 6 ? 3 : nextStreak >= 3 ? 2 : 1;
        const hintPenalty = hintUsedThisRound ? 0.65 : 1;
        pointsEarned = Math.round((widthBonus + speedBonus) * roundMultiplier * hintPenalty);
        nextScore = score + pointsEarned;

        setScore(nextScore);
        setStreak(nextStreak);
        setBestSessionStreak(nextBestStreak);

        playSound(nextStreak > 0 && nextStreak % 5 === 0 ? 'streak' : 'correct');
        setFeedback({
          status: 'correct',
          message: `+${pointsEarned} pts${nextStreak >= 3 ? ` · ${roundMultiplier}x Streak` : ''}`,
          mathNote: `${targetMathBreakdown} (${question.binaryAnswer})`
        });
      } else {
        nextStreak = 0;
        setStreak(0);
        if (paceMode === 'arcade') {
          nextLives = Math.max(0, lives - 1);
          setLives(nextLives);
        }
        playSound('wrong');
        setFeedback({
          status: reason,
          message:
            reason === 'timeout'
              ? 'Time expired on this byte'
              : `Incorrect (${userAnswerLabel || 'Empty'})`,
          mathNote:
            question.kind === 'bin-to-dec'
              ? `Answer: ${question.targetValue} (${targetMathBreakdown})`
              : `Answer: ${question.binaryAnswer} (${targetMathBreakdown})`
        });
      }

      const correctAnswerLabel =
        question.kind === 'bin-to-dec'
          ? String(question.targetValue)
          : question.binaryAnswer;

      const entry: RoundHistoryItem = {
        round,
        kind: question.kind,
        bitCount: question.bitCount,
        targetDisplay: question.targetDisplay,
        userAnswer: userAnswerLabel,
        correctAnswer: correctAnswerLabel,
        isCorrect,
        pointsEarned,
        timeSpentSec: elapsedSec
      };

      const nextHistory = [...history, entry];
      setHistory(nextHistory);

      const delayMs = isCorrect ? 850 : 1700;
      advanceTimerRef.current = window.setTimeout(() => {
        if (paceMode === 'arcade' && nextLives <= 0) {
          finalizeGameOver(nextScore, nextBestStreak, nextHistory);
        } else {
          prepareRound(round + 1, question.targetValue);
        }
      }, delayMs);
    },
    [
      score,
      streak,
      bestSessionStreak,
      lives,
      paceMode,
      timeLeftMs,
      question,
      hintUsedThisRound,
      playSound,
      targetMathBreakdown,
      round,
      history,
      finalizeGameOver,
      prepareRound
    ]
  );

  // Countdown tick in Arcade Timed mode
  useEffect(() => {
    if (gameState !== 'PLAYING' || paceMode !== 'arcade' || feedback !== null) {
      if (tickTimerRef.current !== null) {
        window.clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
      return;
    }

    let lastTick = Date.now();
    tickTimerRef.current = window.setInterval(() => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      setTimeLeftMs((prev) => {
        const next = prev - delta;
        if (next <= 0) {
          return 0;
        }
        return next;
      });
    }, 100);

    return () => {
      if (tickTimerRef.current !== null) {
        window.clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
    };
  }, [gameState, paceMode, feedback]);

  // Trigger timeout resolution cleanly when time hits 0
  useEffect(() => {
    if (
      gameState === 'PLAYING' &&
      paceMode === 'arcade' &&
      timeLeftMs <= 0 &&
      feedback === null &&
      !roundLockedRef.current
    ) {
      const userVal =
        question.kind === 'bin-to-dec'
          ? decoderInput.trim() || 'No input'
          : formatBinaryGrouped(currentBitSum, question.bitCount);
      handleRoundResolution(false, 'timeout', userVal);
    }
  }, [
    gameState,
    paceMode,
    timeLeftMs,
    feedback,
    question,
    decoderInput,
    currentBitSum,
    handleRoundResolution
  ]);

  // Toggle bit switch
  const toggleBit = useCallback(
    (index: number) => {
      if (gameState !== 'PLAYING' || feedback !== null || question.kind === 'bin-to-dec') {
        return;
      }
      playSound('flip');
      setHighlightedBitIndex(null);
      setBits((prev) => {
        const next = [...prev];
        next[index] = next[index] === 1 ? 0 : 1;

        if (autoMatchBuilder) {
          const nextSum = next.reduce((acc, b, idx) => acc + (b === 1 ? weights[idx] : 0), 0);
          if (nextSum === question.targetValue) {
            const grouped = formatBinaryGrouped(nextSum, question.bitCount);
            // Resolve on next microtask so bit state paints first
            window.setTimeout(() => {
              handleRoundResolution(true, 'correct', grouped);
            }, 60);
          }
        }

        return next;
      });
    },
    [
      gameState,
      feedback,
      question.kind,
      question.targetValue,
      question.bitCount,
      playSound,
      autoMatchBuilder,
      weights,
      handleRoundResolution
    ]
  );

  const handleSubmitBuilder = useCallback(() => {
    if (gameState !== 'PLAYING' || feedback !== null || question.kind === 'bin-to-dec') return;
    const isCorrect = currentBitSum === question.targetValue;
    const userLabel = formatBinaryGrouped(currentBitSum, question.bitCount);
    handleRoundResolution(isCorrect, isCorrect ? 'correct' : 'wrong', userLabel);
  }, [gameState, feedback, question, currentBitSum, handleRoundResolution]);

  const handleSubmitDecoder = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (gameState !== 'PLAYING' || feedback !== null || question.kind !== 'bin-to-dec') return;
      const trimmed = decoderInput.trim();
      if (!trimmed) return;
      const parsed = Number.parseInt(trimmed, 10);
      const isCorrect = !Number.isNaN(parsed) && parsed === question.targetValue;
      handleRoundResolution(isCorrect, isCorrect ? 'correct' : 'wrong', trimmed);
    },
    [gameState, feedback, question, decoderInput, handleRoundResolution]
  );

  const handleResetBits = useCallback(() => {
    if (gameState !== 'PLAYING' || feedback !== null) return;
    if (question.kind === 'bin-to-dec') {
      setDecoderInput('');
    } else {
      playSound('flip');
      setBits(Array(question.bitCount).fill(0));
      setHighlightedBitIndex(null);
    }
  }, [gameState, feedback, question.kind, question.bitCount, playSound]);

  const handleHint = useCallback(() => {
    if (gameState !== 'PLAYING' || feedback !== null) return;
    setHintUsedThisRound(true);
    playSound('flip');

    if (question.kind === 'bin-to-dec') {
      setShowDecoderWeights(true);
      return;
    }

    const targetBin = question.targetValue.toString(2).padStart(question.bitCount, '0');
    // Find first bit from MSB to LSB that doesn't match target
    for (let i = 0; i < question.bitCount; i++) {
      const targetBit = targetBin[i] === '1' ? 1 : 0;
      if (bits[i] !== targetBit) {
        setHighlightedBitIndex(i);
        return;
      }
    }
  }, [gameState, feedback, question, bits, playSound]);

  // Keyboard shortcuts during gameplay
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setGameState('PAUSED');
        return;
      }

      if (feedback !== null) return;

      if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleHint();
        return;
      }

      if (question.kind !== 'bin-to-dec') {
        // Keys 1..8 toggle bits left-to-right (or 1..4 for 4-bit)
        const num = Number.parseInt(e.key, 10);
        if (!Number.isNaN(num) && num >= 1 && num <= question.bitCount) {
          e.preventDefault();
          toggleBit(num - 1);
          return;
        }
        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          handleResetBits();
          return;
        }
        if (e.key === 'Enter' && !autoMatchBuilder) {
          e.preventDefault();
          handleSubmitBuilder();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    feedback,
    question.kind,
    question.bitCount,
    autoMatchBuilder,
    toggleBit,
    handleHint,
    handleResetBits,
    handleSubmitBuilder
  ]);

  const handleEndSessionEarly = () => {
    if (history.length > 0) {
      finalizeGameOver(score, bestSessionStreak, history);
    } else {
      clearAllTimers();
      setGameState('TITLE_MENU');
    }
  };

  const sessionAccuracy = useMemo(() => {
    if (history.length === 0) return 100;
    const correctCount = history.filter((item) => item.isCorrect).length;
    return Math.round((correctCount / history.length) * 100);
  }, [history]);

  const averageTimeSec = useMemo(() => {
    if (history.length === 0) return 0;
    const total = history.reduce((acc, item) => acc + item.timeSpentSec, 0);
    return Math.round((total / history.length) * 10) / 10;
  }, [history]);

  const timeProgressPct = useMemo(() => {
    if (paceMode !== 'arcade') return 100;
    return Math.max(0, Math.min(100, (timeLeftMs / (question.timeLimitSec * 1000)) * 100));
  }, [paceMode, timeLeftMs, question.timeLimitSec]);

  return (
    <div className="space-y-6">
      {/* Compact Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Binary Conversion Arena
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Practice building and decoding 4-bit nibbles, 8-bit IPv4 octets, and hex bytes under time pressure or at your own pace.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
            <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>
        </div>
      </div>

      {/* STATE 1: TITLE MENU */}
      {gameState === 'TITLE_MENU' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Configuration & Launch Card */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                1. Choose Challenge Mode
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'builder' as GameMode,
                    title: 'Bit Builder',
                    desc: 'Given Decimal, flip the 0/1 switches to match.',
                    example: '192 -> 1100 0000'
                  },
                  {
                    id: 'decoder' as GameMode,
                    title: 'Bit Decoder',
                    desc: 'Read the binary pattern and enter its Decimal value.',
                    example: '1010 1100 -> 172'
                  },
                  {
                    id: 'mixed' as GameMode,
                    title: 'Octet Blitz',
                    desc: 'Alternates Bit Builder, Decoder, and Hex bytes.',
                    example: 'Dec + Bin + 0xHex'
                  }
                ].map((opt) => {
                  const selected = gameMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setGameMode(opt.id)}
                      className={`text-left p-4 rounded-xl border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        selected
                          ? 'border-blue-600 dark:border-cyan-400 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-600/30 dark:ring-cyan-400/30'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {opt.title}
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            selected ? 'bg-blue-600 dark:bg-cyan-400' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                        {opt.desc}
                      </p>
                      <p className="text-[11px] font-mono text-blue-700 dark:text-cyan-300">
                        {opt.example}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Bit Width */}
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                  2. Bit Width
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '4bit' as BitWidthMode, label: '4-Bit', sub: '1–15' },
                    { id: '8bit' as BitWidthMode, label: '8-Bit', sub: '1–255' },
                    { id: 'progressive' as BitWidthMode, label: 'Ramp', sub: '4 → 8' }
                  ].map((w) => {
                    const active = widthMode === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setWidthMode(w.id)}
                        className={`p-3 rounded-xl border text-center transition-colors ${
                          active
                            ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-500'
                            : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="text-xs font-bold">{w.label}</div>
                        <div
                          className={`text-[11px] font-mono tabular-nums ${
                            active ? 'text-cyan-200' : 'text-slate-400'
                          }`}
                        >
                          {w.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pace */}
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                  3. Session Pace
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaceMode('arcade')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      paceMode === 'arcade'
                        ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-500'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Arcade Timed</span>
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        paceMode === 'arcade' ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      3 lives · Timer bonus
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaceMode('practice')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      paceMode === 'practice'
                        ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-500'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Zen Practice</span>
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        paceMode === 'practice' ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      No timer · Unlimited
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Assist Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-5">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoMatchBuilder}
                    onChange={(e) => setAutoMatchBuilder(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Auto-clear when bits match</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showLiveSum}
                    onChange={(e) => setShowLiveSum(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Show live running sum</span>
                </label>
              </div>

              <button
                type="button"
                onClick={startGame}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-bold shadow-md shadow-blue-600/20 transition-all whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Game</span>
              </button>
            </div>
          </div>

          {/* Right Panel: Career Stats & Controls Guide */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>Your Best Records</span>
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    High Score
                  </div>
                  <div className="text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                    {stats.highScore.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Best Streak
                  </div>
                  <div className="text-xl font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                    {stats.bestStreak}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Solved Total
                  </div>
                  <div className="text-xl font-extrabold font-mono tabular-nums text-blue-600 dark:text-cyan-400 mt-0.5">
                    {stats.totalSolved}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Sessions
                  </div>
                  <div className="text-xl font-extrabold font-mono tabular-nums text-slate-700 dark:text-slate-200 mt-0.5">
                    {stats.gamesPlayed}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Keyboard Shortcuts
              </h3>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center justify-between gap-2">
                  <span>Flip bits (left to right)</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                    1 – 8
                  </kbd>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span>Submit answer</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                    Enter
                  </kbd>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span>Reveal next helpful bit</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                    H
                  </kbd>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span>Clear switches</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                    C
                  </kbd>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span>Pause game</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                    Esc
                  </kbd>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* STATE 2 & 3: PLAYING / PAUSED */}
      {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
        <div className="relative bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Top HUD */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Score
                </div>
                <div className="text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                  {score.toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Streak
                </div>
                <div className="text-lg font-bold font-mono tabular-nums flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Flame className="w-4 h-4" />
                  <span>{streak}</span>
                  {multiplier > 1 && (
                    <span className="text-xs font-extrabold text-blue-600 dark:text-cyan-400 ml-0.5">
                      x{multiplier}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Round
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-slate-800 dark:text-slate-200">
                  #{round}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {paceMode === 'arcade' ? (
                <div className="flex items-center gap-1.5" aria-label={`Lives remaining: ${lives}`}>
                  {[0, 1, 2].map((heartIdx) => (
                    <Heart
                      key={heartIdx}
                      className={`w-5 h-5 transition-transform duration-200 ${
                        heartIdx < lives
                          ? 'text-rose-500 fill-rose-500 scale-100'
                          : 'text-slate-300 dark:text-slate-700 scale-90'
                      }`}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                  Zen Practice
                </span>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : 'PLAYING'))
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>

                <button
                  type="button"
                  onClick={handleEndSessionEarly}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Finish</span>
                </button>
              </div>
            </div>
          </div>

          {/* Timer Bar (Arcade Mode) */}
          {paceMode === 'arcade' && (
            <div className="px-5 pt-3">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Time Remaining</span>
                </span>
                <span
                  className={`font-bold ${
                    timeProgressPct < 22
                      ? 'text-rose-600 dark:text-rose-400'
                      : timeProgressPct < 45
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-blue-600 dark:text-cyan-400'
                  }`}
                >
                  {(timeLeftMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-[width,background-color] duration-100 ease-linear ${
                    timeProgressPct < 22
                      ? 'bg-rose-500'
                      : timeProgressPct < 45
                        ? 'bg-amber-500'
                        : 'bg-gradient-to-r from-blue-600 to-cyan-400'
                  }`}
                  style={{ width: `${timeProgressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Arena Stage */}
          <div className="p-5 sm:p-7 space-y-6">
            {/* Target Prompt */}
            <div className="text-center space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {question.promptLabel}
              </p>
              <div className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-3xl sm:text-4xl font-black font-mono tabular-nums tracking-wider text-slate-900 dark:text-white">
                  {question.targetDisplay}
                </span>
              </div>
            </div>

            {/* Interactive Mode A: Bit Builder (Decimal/Hex -> Binary) */}
            {question.kind !== 'bin-to-dec' && (
              <div className="space-y-5">
                <div
                  className={`grid gap-2.5 sm:gap-3 mx-auto ${
                    question.bitCount === 4
                      ? 'grid-cols-4 max-w-md'
                      : 'grid-cols-4 sm:grid-cols-8 max-w-4xl'
                  }`}
                >
                  {weights.map((weight, idx) => {
                    const isOn = bits[idx] === 1;
                    const isHinted = highlightedBitIndex === idx;
                    const power = question.bitCount - 1 - idx;

                    return (
                      <button
                        key={weight}
                        type="button"
                        onClick={() => toggleBit(idx)}
                        disabled={feedback !== null}
                        aria-pressed={isOn}
                        aria-label={`Bit ${power}, weight ${weight}, currently ${bits[idx]}`}
                        className={`relative flex flex-col items-center justify-between py-3 px-2 min-h-[108px] rounded-2xl border-2 transition-all duration-150 select-none active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          isOn
                            ? 'bg-gradient-to-b from-blue-600 to-indigo-600 dark:from-cyan-500 dark:to-blue-600 border-blue-500 dark:border-cyan-300 text-white shadow-md shadow-blue-500/20'
                            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-cyan-500/60'
                        } ${
                          isHinted
                            ? 'ring-4 ring-amber-400/80 border-amber-400'
                            : ''
                        }`}
                      >
                        <div className="w-full flex items-center justify-between text-[10px] font-mono opacity-75">
                          <span>2^{power}</span>
                          <span>[{idx + 1}]</span>
                        </div>

                        <span className="text-3xl font-black font-mono tabular-nums my-1">
                          {bits[idx]}
                        </span>

                        <span
                          className={`text-xs font-bold font-mono tabular-nums px-2 py-0.5 rounded-md ${
                            isOn
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-200/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {weight}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Live Sum & Helper Controls */}
                <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    <Binary className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                    {showLiveSum ? (
                      <span>
                        Current Value:{' '}
                        <strong className="text-sm text-slate-900 dark:text-white">
                          {activeAddendsFormula}
                        </strong>
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">
                        Live sum hidden (Pro mode)
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowLiveSum((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    {showLiveSum ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showLiveSum ? 'Hide Sum' : 'Show Sum'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Interactive Mode B: Bit Decoder (Binary -> Decimal) */}
            {question.kind === 'bin-to-dec' && (
              <div className="max-w-xl mx-auto space-y-5">
                {/* Optional Weight Reference Row */}
                {showDecoderWeights && (
                  <div
                    className={`grid gap-1.5 text-center ${
                      question.bitCount === 4 ? 'grid-cols-4' : 'grid-cols-8'
                    }`}
                  >
                    {weights.map((w, i) => {
                      const rawBin = question.targetValue
                        .toString(2)
                        .padStart(question.bitCount, '0');
                      const isOne = rawBin[i] === '1';
                      return (
                        <div
                          key={w}
                          className={`py-2 px-1 rounded-lg border font-mono text-xs tabular-nums ${
                            isOne
                              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-cyan-500/40 text-blue-700 dark:text-cyan-300 font-bold'
                              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400'
                          }`}
                        >
                          <div>{rawBin[i]}</div>
                          <div className="text-[10px] opacity-80">{w}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Numeric Entry + Keypad */}
                <form onSubmit={handleSubmitDecoder} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      ref={decoderInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={decoderInput}
                      disabled={feedback !== null}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setDecoderInput(digits);
                      }}
                      placeholder={`Enter Decimal (0–${question.bitCount === 4 ? 15 : 255})`}
                      className="flex-1 px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-center text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={feedback !== null || !decoderInput.trim()}
                      className="px-5 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition-colors whitespace-nowrap shrink-0"
                    >
                      Check
                    </button>
                  </div>

                  {/* Quick Tactile Keypad */}
                  <div className="grid grid-cols-6 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        disabled={feedback !== null}
                        onClick={() =>
                          setDecoderInput((prev) => (prev.length < 3 ? `${prev}${digit}` : prev))
                        }
                        className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 font-mono text-base font-bold text-slate-800 dark:text-slate-100 active:scale-95 transition-all"
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={feedback !== null}
                      onClick={() => setDecoderInput((prev) => prev.slice(0, -1))}
                      aria-label="Backspace"
                      className="col-span-2 py-2.5 rounded-xl bg-slate-200/70 dark:bg-slate-800/90 hover:bg-slate-300/70 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 active:scale-95 transition-all"
                    >
                      <Delete className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Action Toolbar */}
            <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleHint}
                  disabled={feedback !== null}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-amber-300 dark:border-amber-700/70 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Hint (H)</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetBits}
                  disabled={feedback !== null}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>

              {question.kind !== 'bin-to-dec' && !autoMatchBuilder && (
                <button
                  type="button"
                  onClick={handleSubmitBuilder}
                  disabled={feedback !== null}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Submit Binary</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {question.kind !== 'bin-to-dec' && autoMatchBuilder && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Auto-clears immediately when active bits match target
                </span>
              )}
            </div>

            {/* Reserved Feedback Slot (prevents vertical layout shift) */}
            <div className="max-w-4xl mx-auto min-h-[60px] flex items-center justify-center">
              {feedback ? (
                <div
                  role="status"
                  className={`w-full px-4 py-3 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 transition-all duration-150 ${
                    feedback.status === 'correct'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {feedback.status === 'correct' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                  <span className="text-xs font-mono tabular-nums opacity-90">
                    {feedback.mathNote}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  {question.kind === 'bin-to-dec'
                    ? 'Type the decimal value and press Enter to check.'
                    : `Toggle bit switches above (keys 1–${question.bitCount}) to build the target value.`}
                </p>
              )}
            </div>
          </div>

          {/* PAUSED OVERLAY (masks challenge so timer pause cannot be exploited) */}
          {gameState === 'PAUSED' && (
            <div className="absolute inset-0 z-20 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6">
              <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-5 shadow-2xl">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center mx-auto">
                  <Pause className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Game Paused
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Timer is frozen. Resume when ready to continue Round #{round}.
                  </p>
                </div>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGameState('PLAYING')}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
                  >
                    Resume Game
                  </button>
                  <button
                    type="button"
                    onClick={startGame}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-semibold transition-colors"
                  >
                    Restart Session
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearAllTimers();
                      setGameState('TITLE_MENU');
                    }}
                    className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    Return to Mode Select
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATE 4: GAME OVER / SUMMARY */}
      {gameState === 'GAME_OVER' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                  {isNewPersonalBest ? (
                    <>
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400">New Personal Best</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4" />
                      <span>Session Complete</span>
                    </>
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                  Final Score: {score.toLocaleString()}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Completed {history.length} round{history.length === 1 ? '' : 's'} in{' '}
                  {gameMode === 'builder'
                    ? 'Bit Builder'
                    : gameMode === 'decoder'
                      ? 'Bit Decoder'
                      : 'Octet Blitz'}{' '}
                  ({paceMode === 'arcade' ? 'Arcade Timed' : 'Zen Practice'}).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={startGame}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Play Again</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGameState('TITLE_MENU')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Change Mode</span>
                </button>
              </div>
            </div>

            {/* Session Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">Accuracy</div>
                <div className="text-2xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                  {sessionAccuracy}%
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">Best Streak</div>
                <div className="text-2xl font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                  {bestSessionStreak}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">Avg Speed</div>
                <div className="text-2xl font-extrabold font-mono tabular-nums text-blue-600 dark:text-cyan-400 mt-1">
                  {averageTimeSec}s
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">All-Time High</div>
                <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                  {stats.highScore.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Round-by-Round Review Table */}
          {history.length > 0 && (
            <div className="bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Conversion Review ({history.filter((h) => h.isCorrect).length}/{history.length} Correct)
                </h3>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-500 dark:text-slate-400 uppercase font-semibold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4">#</th>
                      <th className="py-2.5 px-4">Prompt</th>
                      <th className="py-2.5 px-4">Your Answer</th>
                      <th className="py-2.5 px-4">Correct Answer</th>
                      <th className="py-2.5 px-4 text-right">Time</th>
                      <th className="py-2.5 px-4 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {history.map((item) => (
                      <tr
                        key={item.round}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500">
                          {item.round}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {item.targetDisplay}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {item.userAnswer}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-blue-700 dark:text-cyan-300 font-semibold">
                          {item.correctAnswer}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-right text-slate-500">
                          {item.timeSpentSec.toFixed(1)}s
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold">
                          {item.isCorrect ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                              +{item.pointsEarned}
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400">Missed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
