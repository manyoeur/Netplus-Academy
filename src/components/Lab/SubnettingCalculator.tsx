import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Calculator,
  Binary,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Copy,
  Award,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  BookOpen,
  Lightbulb,
  Target,
  Flame,
  Trophy,
  XCircle,
  ArrowUpRight
} from 'lucide-react';
import {
  explainSubnetCalculation,
  SubnetExplainResponse
} from '../../utils/subnetExplainApi';
import {
  generateSubnetPracticeQuiz,
  SubnetQuizQuestion
} from '../../utils/subnetQuizGenerator';
import { SubnetQuickReferenceModal } from './SubnetQuickReferenceModal';
import { VlsmHierarchyTree } from './VlsmHierarchyTree';

type ExplainWalkthroughMode = 'all' | 'stepper';

interface SubnetQuizStats {
  totalScore: number;
  streak: number;
  bestStreak: number;
  quizzesCompleted: number;
  bestRoundCorrect: number;
}

const QUIZ_STATS_STORAGE_KEY = 'netpulse_subnet_quiz_stats';

function loadSavedQuizStats(): SubnetQuizStats {
  try {
    const raw = window.localStorage.getItem(QUIZ_STATS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        totalScore: Number(parsed.totalScore) || 0,
        streak: Number(parsed.streak) || 0,
        bestStreak: Number(parsed.bestStreak) || 0,
        quizzesCompleted: Number(parsed.quizzesCompleted) || 0,
        bestRoundCorrect: Number(parsed.bestRoundCorrect) || 0
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    totalScore: 0,
    streak: 0,
    bestStreak: 0,
    quizzesCompleted: 0,
    bestRoundCorrect: 0
  };
}

export const SubnettingCalculator: React.FC = () => {
  const [ipInput, setIpInput] = useState('192.168.10.0');
  const [cidrInput, setCidrInput] = useState<number>(27);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Step-by-Step AI Subnet Explanation State
  const [explainPanelOpen, setExplainPanelOpen] = useState(false);
  const [quickRefOpen, setQuickRefOpen] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<SubnetExplainResponse | null>(null);
  const [walkthroughMode, setWalkthroughMode] = useState<ExplainWalkthroughMode>('all');
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const explainAbortRef = useRef<AbortController | null>(null);
  const explainSectionRef = useRef<HTMLDivElement | null>(null);
  const quizSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return () => {
      explainAbortRef.current?.abort();
    };
  }, []);

  // Gamified 5-Question Practice Quiz State
  const [quizStats, setQuizStats] = useState<SubnetQuizStats>(() => loadSavedQuizStats());
  const [quizQuestions, setQuizQuestions] = useState<SubnetQuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState<number>(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizRoundPoints, setQuizRoundPoints] = useState<number>(0);
  const [quizCompleted, setQuizCompleted] = useState<boolean>(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(QUIZ_STATS_STORAGE_KEY, JSON.stringify(quizStats));
    } catch {
      // Ignore storage write errors
    }
  }, [quizStats]);

  // Subnet calculations
  const subnetInfo = useMemo(() => {
    try {
      const cleanIp = ipInput.trim();
      const rawParts = cleanIp.split('.');
      if (rawParts.length !== 4 || rawParts.some(p => !/^\d{1,3}$/.test(p))) {
        return null;
      }
      const parts = rawParts.map(p => parseInt(p, 10));
      if (parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        return null;
      }

      const totalHostBits = 32 - cidrInput;
      const totalAddresses = Math.pow(2, totalHostBits);
      const usableHosts = cidrInput >= 31 ? (cidrInput === 31 ? 2 : 1) : totalAddresses - 2;

      // Mask integer
      let maskInt = 0;
      for (let i = 0; i < cidrInput; i++) {
        maskInt |= 1 << (31 - i);
      }
      maskInt = maskInt >>> 0;

      // Wildcard
      const wildcardInt = ~maskInt >>> 0;

      // IP int
      const ipInt = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;

      // Network & Broadcast ints
      const networkInt = (ipInt & maskInt) >>> 0;
      const broadcastInt = (networkInt | wildcardInt) >>> 0;

      const intToIp = (num: number) =>
        [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.');

      const intToBinary = (num: number) =>
        [
          ((num >>> 24) & 255).toString(2).padStart(8, '0'),
          ((num >>> 16) & 255).toString(2).padStart(8, '0'),
          ((num >>> 8) & 255).toString(2).padStart(8, '0'),
          (num & 255).toString(2).padStart(8, '0')
        ].join('.');

      const maskStr = intToIp(maskInt);
      const wildcardStr = intToIp(wildcardInt);
      const networkStr = intToIp(networkInt);
      const broadcastStr = intToIp(broadcastInt);

      const firstHost = cidrInput >= 31 ? networkStr : intToIp(networkInt + 1);
      const lastHost = cidrInput >= 31 ? broadcastStr : intToIp(broadcastInt - 1);

      return {
        cleanIp,
        cidr: cidrInput,
        networkBits: cidrInput,
        hostBits: totalHostBits,
        interestingOctet: Math.min(4, Math.floor(cidrInput / 8) + (cidrInput % 8 === 0 ? 0 : 1)) || 1,
        maskStr,
        wildcardStr,
        networkStr,
        broadcastStr,
        firstHost,
        lastHost,
        usableHosts,
        totalAddresses,
        binaryMask: intToBinary(maskInt),
        binaryIp: intToBinary(ipInt),
        binaryNetwork: intToBinary(networkInt),
        binaryBroadcast: intToBinary(broadcastInt)
      };
    } catch {
      return null;
    }
  }, [ipInput, cidrInput]);

  const currentTargetCidr = subnetInfo ? `${subnetInfo.cleanIp}/${subnetInfo.cidr}` : null;
  const isExplanationStale = Boolean(
    explanation && currentTargetCidr && explanation.targetCidr !== currentTargetCidr
  );

  const handleExplainSubnet = async () => {
    if (!subnetInfo) return;

    explainAbortRef.current?.abort();
    const controller = new AbortController();
    explainAbortRef.current = controller;

    setExplainPanelOpen(true);
    setExplainLoading(true);
    setExplainError(null);
    setActiveStepIndex(0);

    window.requestAnimationFrame(() => {
      explainSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    try {
      const result = await explainSubnetCalculation(
        {
          ipAddress: subnetInfo.cleanIp,
          cidr: subnetInfo.cidr,
          subnetMask: subnetInfo.maskStr,
          wildcardMask: subnetInfo.wildcardStr,
          networkId: subnetInfo.networkStr,
          broadcastAddress: subnetInfo.broadcastStr,
          firstHost: subnetInfo.firstHost,
          lastHost: subnetInfo.lastHost,
          usableHosts: subnetInfo.usableHosts,
          totalAddresses: subnetInfo.totalAddresses,
          binaryIp: subnetInfo.binaryIp,
          binaryMask: subnetInfo.binaryMask
        },
        controller.signal
      );

      setExplanation(result);
      setActiveStepIndex(0);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setExplainError(
        err instanceof Error ? err.message : 'Unable to generate subnet binary breakdown.'
      );
    } finally {
      if (explainAbortRef.current === controller) {
        setExplainLoading(false);
      }
    }
  };

  const copyVal = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleStartPracticeQuiz = (scrollToPanel = false) => {
    const generated = generateSubnetPracticeQuiz(5);
    setQuizQuestions(generated);
    setQuizIndex(0);
    setQuizAnswers({});
    setQuizRoundPoints(0);
    setQuizCompleted(false);

    if (scrollToPanel) {
      window.requestAnimationFrame(() => {
        quizSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const currentQuizQuestion = quizQuestions[quizIndex] || null;
  const currentQuizSelection = currentQuizQuestion
    ? quizAnswers[currentQuizQuestion.id] ?? null
    : null;

  const handleAnswerQuizQuestion = (option: string) => {
    if (!currentQuizQuestion || currentQuizSelection !== null) return;

    const isCorrect = option === currentQuizQuestion.correctAnswer;
    const nextAnswers = { ...quizAnswers, [currentQuizQuestion.id]: option };
    setQuizAnswers(nextAnswers);

    const isFinalQuestion = quizIndex >= quizQuestions.length - 1;
    const nextStreak = isCorrect ? quizStats.streak + 1 : 0;
    const earned = isCorrect ? 10 + (nextStreak >= 2 ? 5 : 0) : 0;

    if (earned > 0) {
      setQuizRoundPoints(prev => prev + earned);
    }

    const roundCorrectCount = quizQuestions.filter(
      q => nextAnswers[q.id] === q.correctAnswer
    ).length;

    setQuizStats(prev => ({
      totalScore: prev.totalScore + earned,
      streak: nextStreak,
      bestStreak: Math.max(prev.bestStreak, nextStreak),
      quizzesCompleted: isFinalQuestion ? prev.quizzesCompleted + 1 : prev.quizzesCompleted,
      bestRoundCorrect: isFinalQuestion
        ? Math.max(prev.bestRoundCorrect, roundCorrectCount)
        : prev.bestRoundCorrect
    }));
  };

  const handleAdvanceQuiz = () => {
    if (quizIndex < quizQuestions.length - 1) {
      setQuizIndex(prev => prev + 1);
    } else {
      setQuizCompleted(true);
    }
  };

  const renderBitOctets = (binaryStr: string, cidrBits: number) => {
    const octets = binaryStr.split('.');
    return (
      <div className="flex flex-nowrap items-center gap-1.5 font-mono text-xs tabular-nums shrink-0">
        {octets.map((octet, octetIdx) => (
          <React.Fragment key={octetIdx}>
            <span className="inline-flex items-center">
              {octet.split('').map((bit, bitIdx) => {
                const globalBitPos = octetIdx * 8 + bitIdx;
                const isNetworkBit = globalBitPos < cidrBits;
                return (
                  <span
                    key={bitIdx}
                    className={`w-4 text-center py-0.5 rounded-[3px] font-semibold ${
                      isNetworkBit
                        ? 'text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-cyan-950/60'
                        : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50'
                    }`}
                  >
                    {bit}
                  </span>
                );
              })}
            </span>
            {octetIdx < 3 && (
              <span className="text-slate-400 dark:text-slate-500 font-bold">.</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const visibleSteps = useMemo(() => {
    if (!explanation) return [];
    if (walkthroughMode === 'stepper') {
      const clampedIdx = Math.min(activeStepIndex, Math.max(0, explanation.steps.length - 1));
      return [explanation.steps[clampedIdx]].filter(Boolean);
    }
    return explanation.steps;
  }, [explanation, walkthroughMode, activeStepIndex]);

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1 text-xs text-slate-300 font-medium">
            <span className="font-mono text-cyan-300 font-semibold">
              Offline-Ready Utility
            </span>
            <span aria-hidden="true">·</span>
            <span>CCNA &amp; CCNP Certified</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Subnetting &amp; VLSM Architecture Workbench
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Real-time IPv4 CIDR breakdown, Cisco wildcard mask derivation, binary octet analysis, and AI-guided step-by-step binary math walkthroughs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0 self-start md:self-center">
          <button
            type="button"
            onClick={() => setQuickRefOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-4 h-4 shrink-0 text-cyan-300" />
            <span>Subnetting Quick Reference</span>
          </button>

          <button
            type="button"
            onClick={() => handleStartPracticeQuiz(true)}
            className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold shadow-md transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Target className="w-4 h-4 shrink-0" />
            <span>Practice Quiz</span>
          </button>

          <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
            <span className="text-[11px] text-slate-300 font-mono block">Quiz Score</span>
            <span className="text-lg font-bold font-mono tabular-nums text-cyan-300">
              {quizStats.totalScore} pts
            </span>
          </div>
        </div>
      </div>

      {/* Main CIDR Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
        {/* Input Parameters */}
        <div className="lg:col-span-5 xl:col-span-4 min-w-0 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-500" />
                <span>IP &amp; CIDR Parameters</span>
              </h2>
              <button
                type="button"
                onClick={() => setQuickRefOpen(true)}
                className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-3 h-3" />
                <span>Quick Ref</span>
              </button>
            </div>

            <div>
              <label
                htmlFor="subnet-ipv4-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                IPv4 Address:
              </label>
              <input
                id="subnet-ipv4-input"
                type="text"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                placeholder="e.g. 192.168.10.0"
                className={`w-full px-3 py-2 rounded-xl text-sm font-mono bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                  subnetInfo
                    ? 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
                    : 'border-red-400 dark:border-red-500 focus:ring-red-500'
                }`}
              />
              {!subnetInfo && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Enter a valid IPv4 address (four octets from 0 to 255).</span>
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                <span>Prefix Length (CIDR):</span>
                <span className="font-mono font-bold tabular-nums text-blue-600 dark:text-cyan-400">
                  /{cidrInput}
                </span>
              </div>
              <input
                type="range"
                min="8"
                max="32"
                value={cidrInput}
                onChange={(e) => setCidrInput(parseInt(e.target.value, 10))}
                aria-label="Prefix Length CIDR"
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between gap-1 text-[10px] sm:text-[11px] font-mono text-slate-400 mt-1">
                <span>/8 (Class A)</span>
                <span>/16 (Class B)</span>
                <span>/24 (Class C)</span>
                <span>/30 (WAN)</span>
              </div>
            </div>

            <div className="pt-1">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-2">
                Common Presets:
              </span>
              <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                {[24, 26, 28, 30].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCidrInput(c)}
                    className={`py-1.5 rounded-lg border text-center transition-all ${
                      cidrInput === c
                        ? 'bg-blue-600 text-white font-bold border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    /{c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Explain my subnet CTA */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <button
              type="button"
              disabled={!subnetInfo || explainLoading}
              onClick={handleExplainSubnet}
              className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 text-center"
            >
              {explainLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Breaking Down Binary Math...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>
                    {explanation && !isExplanationStale
                      ? 'Refresh Subnet Explanation'
                      : 'Explain my subnet'}
                  </span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              AI step-by-step binary math for{' '}
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                {currentTargetCidr || 'valid IPv4/CIDR'}
              </span>
            </p>
          </div>
        </div>

        {/* Calculated Results Cards */}
        {subnetInfo ? (
          <div className="lg:col-span-7 xl:col-span-8 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Network ID</span>
                <button
                  type="button"
                  onClick={() => copyVal(subnetInfo.networkStr, 'net')}
                  aria-label="Copy Network ID"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {copiedKey === 'net' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-lg font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {subnetInfo.networkStr}
              </p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">/{cidrInput} Subnet Boundary</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Broadcast Address</span>
                <button
                  type="button"
                  onClick={() => copyVal(subnetInfo.broadcastStr, 'bcast')}
                  aria-label="Copy Broadcast Address"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {copiedKey === 'bcast' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-lg font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {subnetInfo.broadcastStr}
              </p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">All host bits set to 1</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Subnet Mask</span>
                <button
                  type="button"
                  onClick={() => copyVal(subnetInfo.maskStr, 'mask')}
                  aria-label="Copy Subnet Mask"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {copiedKey === 'mask' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-lg font-mono font-bold tabular-nums text-blue-600 dark:text-cyan-400 mt-1">
                {subnetInfo.maskStr}
              </p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">Decimal Format</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cisco Wildcard Mask</span>
                <button
                  type="button"
                  onClick={() => copyVal(subnetInfo.wildcardStr, 'wild')}
                  aria-label="Copy Cisco Wildcard Mask"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {copiedKey === 'wild' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-lg font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                {subnetInfo.wildcardStr}
              </p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">For OSPF network &amp; ACLs</p>
            </div>

            <div className="sm:col-span-2 p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-2.5 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <span className="text-xs font-mono text-cyan-400 font-semibold">
                  Usable Host Range:
                </span>
                <span className="text-xs font-mono font-bold tabular-nums text-emerald-400">
                  {subnetInfo.usableHosts.toLocaleString()} Usable Hosts (Total{' '}
                  {subnetInfo.totalAddresses.toLocaleString()})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm tabular-nums">
                <span className="text-slate-300">{subnetInfo.firstHost}</span>
                <span className="text-slate-500">➔</span>
                <span className="text-slate-300">{subnetInfo.lastHost}</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
                <span>Binary Mask:</span>
                <span className="text-cyan-300/90 tabular-nums break-all">{subnetInfo.binaryMask}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-7 xl:col-span-8 min-w-0 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-2">
            <AlertTriangle className="w-7 h-7 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Invalid IPv4 Address Format
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
              Provide a standard dotted-decimal IPv4 address such as{' '}
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                192.168.10.0
              </span>{' '}
              or{' '}
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                10.24.0.5
              </span>{' '}
              to compute subnet boundaries and explain the binary math.
            </p>
          </div>
        )}
      </div>

      {/* Step-by-Step AI Subnet Binary Math Panel */}
      {explainPanelOpen && (
        <section
          ref={explainSectionRef}
          aria-label="Explain my subnet step-by-step binary math"
          className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 min-w-0 overflow-hidden"
        >
          {/* Section Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
                <Binary className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Step-by-Step Binary Subnet Math
                  </h2>
                  {(explanation?.targetCidr || currentTargetCidr) && (
                    <span className="text-xs font-mono font-semibold tabular-nums text-blue-600 dark:text-cyan-400">
                      {explanation?.targetCidr || currentTargetCidr}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  AI walkthrough breaking down network bits, host bits, bitwise AND, and address boundaries.
                </p>
              </div>
            </div>

            {explanation && !explainLoading && (
              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Explanation display mode"
                  className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <button
                    type="button"
                    onClick={() => setWalkthroughMode('all')}
                    aria-pressed={walkthroughMode === 'all'}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                      walkthroughMode === 'all'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>All Steps</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalkthroughMode('stepper')}
                    aria-pressed={walkthroughMode === 'stepper'}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                      walkthroughMode === 'stepper'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Step-by-Step</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!subnetInfo || explainLoading}
                  onClick={handleExplainSubnet}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-cyan-500 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-cyan-300 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate</span>
                </button>
              </div>
            )}
          </div>

          {/* Stale parameter banner when IP or CIDR changed after explanation was generated */}
          {isExplanationStale && !explainLoading && subnetInfo && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Calculator inputs changed to{' '}
                  <strong className="font-mono">{currentTargetCidr}</strong>. Update the breakdown to match your new CIDR calculation.
                </span>
              </div>
              <button
                type="button"
                onClick={handleExplainSubnet}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                Update Explanation
              </button>
            </div>
          )}

          {/* Live 32-Bit Alignment Strip */}
          {subnetInfo && (
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  32-Bit Boundary Alignment ({subnetInfo.cleanIp}/{subnetInfo.cidr})
                </span>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-[2px] bg-blue-500 shrink-0" />
                    <span>{subnetInfo.networkBits} Network Bits</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-[2px] bg-amber-500 shrink-0" />
                    <span>{subnetInfo.hostBits} Host Bits</span>
                  </span>
                </div>
              </div>

              <div className="space-y-2 overflow-x-auto max-w-full pb-1">
                <div className="flex items-center gap-3 sm:gap-4 min-w-max">
                  <span className="w-24 sm:w-28 text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    IPv4 Address
                  </span>
                  {renderBitOctets(subnetInfo.binaryIp, subnetInfo.cidr)}
                </div>

                <div className="flex items-center gap-3 sm:gap-4 min-w-max">
                  <span className="w-24 sm:w-28 text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    Subnet Mask
                  </span>
                  {renderBitOctets(subnetInfo.binaryMask, subnetInfo.cidr)}
                </div>

                <div className="flex items-center gap-3 sm:gap-4 min-w-max">
                  <span className="w-24 sm:w-28 text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    Network ID
                  </span>
                  {renderBitOctets(subnetInfo.binaryNetwork, subnetInfo.cidr)}
                </div>

                <div className="flex items-center gap-3 sm:gap-4 min-w-max">
                  <span className="w-24 sm:w-28 text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    Broadcast
                  </span>
                  {renderBitOctets(subnetInfo.binaryBroadcast, subnetInfo.cidr)}
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {explainLoading && (
            <div className="space-y-3" aria-busy="true" aria-label="Generating step-by-step binary math explanation">
              {[1, 2, 3, 4, 5].map(idx => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 animate-pulse space-y-2.5"
                >
                  <div className="h-4 w-56 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-full max-w-2xl rounded bg-slate-200/80 dark:bg-slate-800/80" />
                  <div className="h-9 w-full rounded-lg bg-slate-200/70 dark:bg-slate-800/70" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!explainLoading && explainError && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Unable to generate AI subnet explanation</p>
                  <p>{explainError}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={!subnetInfo}
                onClick={handleExplainSubnet}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Populated AI Steps */}
          {!explainLoading && !explainError && explanation && (
            <div className="space-y-4 min-w-0">
              {/* Overview & Formula Strip */}
              <div className="flex flex-col gap-2.5 pb-3.5 border-b border-slate-100 dark:border-slate-800 min-w-0">
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed max-w-4xl">
                  {explanation.summary}
                </p>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 min-w-0">
                  <span className="font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                    Interesting Octet {explanation.interestingOctet}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                  <span className="font-semibold text-blue-600 dark:text-cyan-400 break-words min-w-0">
                    {explanation.blockSizeFormula}
                  </span>
                </div>
              </div>

              {/* Stepper Controls when in Step-by-Step mode */}
              {walkthroughMode === 'stepper' && explanation.steps.length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-600 dark:text-slate-300">
                    Step {activeStepIndex + 1} of {explanation.steps.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={activeStepIndex === 0}
                      onClick={() => setActiveStepIndex(prev => Math.max(0, prev - 1))}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>
                    <button
                      type="button"
                      disabled={activeStepIndex >= explanation.steps.length - 1}
                      onClick={() =>
                        setActiveStepIndex(prev => Math.min(explanation.steps.length - 1, prev + 1))
                      }
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <span>Next Step</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Steps List */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden min-w-0">
                {visibleSteps.map(step => (
                  <div
                    key={step.stepNumber}
                    className="p-4 sm:p-5 bg-white dark:bg-[#0c1220] space-y-2.5 min-w-0"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5 sm:gap-3 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white min-w-0">
                        <span className="font-mono tabular-nums text-blue-600 dark:text-cyan-400 mr-2">
                          {String(step.stepNumber).padStart(2, '0')}.
                        </span>
                        {step.title}
                      </h3>
                      <span className="text-xs font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 break-words sm:text-right min-w-0">
                        {step.resultLabel}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {step.concept}
                    </p>

                    {step.binaryOperation && (
                      <pre className="p-3 rounded-lg bg-slate-950 text-cyan-300 border border-slate-800 font-mono text-xs tabular-nums max-w-full overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                        {step.binaryOperation}
                      </pre>
                    )}
                  </div>
                ))}
              </div>

              {/* Exam Shortcut Tip */}
              {explanation.examTip && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs">
                    <span className="font-semibold text-slate-900 dark:text-white block">
                      Certification Mental-Math Tip
                    </span>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {explanation.examTip}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* VLSM Hierarchy Tree Visualizer */}
      <VlsmHierarchyTree
        activeCalculatorIp={subnetInfo?.networkStr || null}
        activeCalculatorCidr={cidrInput}
        onLoadIntoCalculator={(ip, cidr) => {
          setIpInput(ip);
          setCidrInput(cidr);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Gamified 5-Question Practice Quiz Section */}
      <section
        ref={quizSectionRef}
        aria-label="Subnetting Practice Quiz"
        className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm min-w-0 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Subnetting Practice Quiz
                </h2>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  CIDR · Binary · Hosts
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                5 randomized subnetting challenges per round (+10 pts per correct answer, +5 pts streak bonus).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Streak {quizStats.streak}</span>
              </span>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span>Best {quizStats.bestRoundCorrect}/5</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleStartPracticeQuiz(false)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {quizQuestions.length > 0 ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>New 5-Question Quiz</span>
                </>
              ) : (
                <>
                  <Target className="w-3.5 h-3.5" />
                  <span>Practice Quiz</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Idle State before starting a 5-question round */}
        {quizQuestions.length === 0 && (
          <div className="p-5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Ready to test your IPv4 CIDR, binary math, and host sizing speed?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Click <strong className="text-slate-900 dark:text-white">Practice Quiz</strong> to generate 5 fresh questions with instant binary &amp; block-size explanations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleStartPracticeQuiz(false)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-center"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Start 5-Question Quiz</span>
            </button>
          </div>
        )}

        {/* Active Quiz Question */}
        {quizQuestions.length > 0 && !quizCompleted && currentQuizQuestion && (
          <div className="p-4 sm:p-5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
            {/* 5-Step Progress Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                <span className="font-bold text-slate-900 dark:text-white">
                  Question {quizIndex + 1} of {quizQuestions.length}
                </span>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                <span className="font-semibold text-blue-600 dark:text-cyan-400">
                  {currentQuizQuestion.category}
                </span>
              </div>

              <div className="flex items-center gap-1.5" aria-label="Quiz progress">
                {quizQuestions.map((q, idx) => {
                  const ans = quizAnswers[q.id];
                  let barColor = 'bg-slate-200 dark:bg-slate-700';
                  if (ans !== undefined) {
                    barColor =
                      ans === q.correctAnswer ? 'bg-emerald-500' : 'bg-red-500';
                  } else if (idx === quizIndex) {
                    barColor = 'bg-blue-600 dark:bg-cyan-400';
                  }
                  return (
                    <span
                      key={q.id}
                      className={`h-1.5 w-6 sm:w-8 rounded-full transition-colors ${barColor}`}
                    />
                  );
                })}
              </div>
            </div>

            <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
              {currentQuizQuestion.prompt}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentQuizQuestion.options.map((opt, idx) => {
                const isSelected = currentQuizSelection === opt;
                const isCorrectOption = opt === currentQuizQuestion.correctAnswer;
                let btnClass =
                  'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-500 dark:hover:border-cyan-400';

                if (currentQuizSelection !== null) {
                  if (isCorrectOption) {
                    btnClass =
                      'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold';
                  } else if (isSelected) {
                    btnClass =
                      'bg-red-50 dark:bg-red-950/60 border-red-500 text-red-800 dark:text-red-300';
                  } else {
                    btnClass =
                      'bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={currentQuizSelection !== null}
                    onClick={() => handleAnswerQuizQuestion(opt)}
                    className={`p-3 rounded-xl border text-left text-xs font-mono tabular-nums transition-all flex items-center justify-between gap-2 ${btnClass}`}
                  >
                    <span className="break-words min-w-0">{opt}</span>
                    {currentQuizSelection !== null && isCorrectOption && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                    {currentQuizSelection !== null && isSelected && !isCorrectOption && (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {currentQuizSelection !== null && (
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p
                    className={`text-xs font-semibold ${
                      currentQuizSelection === currentQuizQuestion.correctAnswer
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {currentQuizSelection === currentQuizQuestion.correctAnswer
                      ? `Correct! ${quizStats.streak >= 2 ? '+15 pts (Streak Bonus)' : '+10 pts'}`
                      : `Incorrect — Correct Answer: ${currentQuizQuestion.correctAnswer}`}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {currentQuizQuestion.explanation}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {currentQuizQuestion.referenceIp &&
                    typeof currentQuizQuestion.referenceCidr === 'number' && (
                      <button
                        type="button"
                        onClick={() => {
                          setIpInput(currentQuizQuestion.referenceIp!);
                          setCidrInput(currentQuizQuestion.referenceCidr!);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <span>Load in Calc</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                  <button
                    type="button"
                    onClick={handleAdvanceQuiz}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <span>
                      {quizIndex < quizQuestions.length - 1 ? 'Next Question' : 'View Results'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quiz Completed Scoreboard */}
        {quizQuestions.length > 0 && quizCompleted && (
          <div className="p-4 sm:p-5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-semibold text-blue-600 dark:text-cyan-400">
                  Quiz Complete · {quizStats.quizzesCompleted} Total Rounds Completed
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  You scored{' '}
                  <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {quizQuestions.filter(q => quizAnswers[q.id] === q.correctAnswer).length} / 5
                  </span>{' '}
                  ({Math.round((quizQuestions.filter(q => quizAnswers[q.id] === q.correctAnswer).length / 5) * 100)}%)
                  {' · '}
                  <span className="font-mono tabular-nums text-blue-600 dark:text-cyan-400">
                    +{quizRoundPoints} pts
                  </span>
                </h3>
              </div>

              <button
                type="button"
                onClick={() => handleStartPracticeQuiz(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Play Again (5 New Questions)</span>
              </button>
            </div>

            <div className="divide-y divide-slate-200/70 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] overflow-hidden">
              {quizQuestions.map((q, idx) => {
                const picked = quizAnswers[q.id];
                const correct = picked === q.correctAnswer;
                return (
                  <div
                    key={q.id}
                    className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {correct ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white">
                          <span className="font-mono text-slate-400 mr-1.5">
                            0{idx + 1}.
                          </span>
                          <span className="font-mono text-[11px] text-blue-600 dark:text-cyan-400 mr-1.5">
                            [{q.category}]
                          </span>
                          {q.prompt}
                        </p>
                        {!correct && (
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            Your answer: <span className="text-red-500">{picked}</span> · Correct:{' '}
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {q.correctAnswer}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`font-mono font-semibold tabular-nums shrink-0 ${
                        correct
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {correct ? q.correctAnswer : 'Missed'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Subnetting Quick Reference Modal */}
      <SubnetQuickReferenceModal
        isOpen={quickRefOpen}
        onClose={() => setQuickRefOpen(false)}
        activeCidr={cidrInput}
        onApplyCidr={(cidr) => setCidrInput(cidr)}
      />
    </div>
  );
};
