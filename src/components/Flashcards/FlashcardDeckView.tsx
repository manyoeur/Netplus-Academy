import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  Filter,
  FolderOpen,
  HelpCircle,
  Layers,
  LayoutGrid,
  Lightbulb,
  Loader2,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Shuffle,
  Sparkles,
  SquareStack,
  Terminal,
  Trash2,
  Trophy,
  WifiOff,
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { generateFlashcardDeck } from '../../utils/flashcardApi';
import { GENERAL_COURSE_ID } from '../../utils/personalFlashcards';
import { PersonalFlashcardModal } from './PersonalFlashcardModal';
import {
  CardMasteryStatus,
  FlashcardCategory,
  FlashcardDeck,
  FlashcardDifficulty,
  FlashcardItem,
  FlashcardTopic,
  PersonalFlashcard,
  PersonalFlashcardInput,
} from './flashcardTypes';

interface StoredFlashcardSession {
  deck: FlashcardDeck;
  masteryMap: Record<string, CardMasteryStatus>;
  currentIndex: number;
}

const TOPIC_OPTIONS: {
  id: FlashcardTopic;
  label: string;
  shortDesc: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'all',
    label: 'All Topics',
    shortDesc: 'Terminology, protocols & ports mix',
    icon: Sparkles,
  },
  {
    id: 'terminology',
    label: 'Terminology & OSI',
    shortDesc: 'Layers, switching, routing & core concepts',
    icon: BookOpen,
  },
  {
    id: 'protocols',
    label: 'Protocols',
    shortDesc: 'ARP, DHCP, DNS, OSPF, BGP, TCP, TLS & more',
    icon: Network,
  },
  {
    id: 'ports',
    label: 'Standard Ports',
    shortDesc: 'Well-known TCP/UDP port numbers & services',
    icon: Terminal,
  },
];

const DIFFICULTY_OPTIONS: { id: FlashcardDifficulty; label: string }[] = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'certification', label: 'Net+ / CCNA' },
  { id: 'advanced', label: 'Advanced' },
];

const CARD_COUNT_OPTIONS = [8, 12, 16];

const FOCUS_SUGGESTIONS: { label: string; topic: FlashcardTopic; focus: string }[] = [
  {
    label: 'Essential TCP/UDP Ports',
    topic: 'ports',
    focus: 'SSH, DNS, DHCP, HTTP/HTTPS, SMTP, SNMP, NTP, RDP, SMB, LDAPS',
  },
  {
    label: 'Routing (OSPF & BGP)',
    topic: 'protocols',
    focus: 'OSPF neighbor states, DR/BDR, BGP path attributes, administrative distance',
  },
  {
    label: 'Switching & VLANs',
    topic: 'terminology',
    focus: 'VLANs, 802.1Q trunking, STP port states, MAC learning, PoE',
  },
  {
    label: 'Security & VPN Ports',
    topic: 'ports',
    focus: 'TLS/HTTPS, SSH, SFTP, IPsec IKE/ESP, RADIUS, TACACS+, Kerberos, LDAPS',
  },
  {
    label: 'TCP/IP & Handshakes',
    topic: 'protocols',
    focus: 'TCP 3-way handshake, flags, windowing, UDP vs TCP, ICMP, ARP',
  },
];

function getCategoryStyles(category: FlashcardCategory): string {
  switch (category) {
    case 'Port Number':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/70';
    case 'Protocol':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/70';
    case 'Architecture':
      return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/70';
    case 'Terminology':
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/70';
  }
}

export const FlashcardDeckView: React.FC = () => {
  const {
    currentUser,
    courses,
    isOffline,
    recordLearningActivity,
    recordStudyTime,
    personalFlashcards,
    savePersonalFlashcard,
    deletePersonalFlashcard,
    updatePersonalFlashcardMastery,
  } = useAcademy();
  const storageKey = `netpulse_flashcards_session_v1_${currentUser.id}`;

  // Workspace Mode: Student Personal Course-Tagged Cards vs AI Deck Generator
  const [deckSource, setDeckSource] = useState<'personal' | 'ai'>('personal');

  // Personal Flashcards Filter, Order & Modal State
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('all');
  const [personalSearch, setPersonalSearch] = useState<string>('');
  const [personalOrderIds, setPersonalOrderIds] = useState<string[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<PersonalFlashcard | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Generator Configuration State
  const [topic, setTopic] = useState<FlashcardTopic>('all');
  const [difficulty, setDifficulty] = useState<FlashcardDifficulty>('certification');
  const [cardCount, setCardCount] = useState<number>(12);
  const [customFocus, setCustomFocus] = useState<string>('');

  // AI Deck & Study State
  const [deck, setDeck] = useState<FlashcardDeck | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return null;
      const parsed = JSON.parse(saved) as StoredFlashcardSession;
      return parsed?.deck?.cards?.length ? parsed.deck : null;
    } catch {
      return null;
    }
  });

  const [masteryMap, setMasteryMap] = useState<Record<string, CardMasteryStatus>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return {};
      const parsed = JSON.parse(saved) as StoredFlashcardSession;
      return parsed?.masteryMap || {};
    } catch {
      return {};
    }
  });

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return 0;
      const parsed = JSON.parse(saved) as StoredFlashcardSession;
      return typeof parsed?.currentIndex === 'number' ? parsed.currentIndex : 0;
    } catch {
      return 0;
    }
  });

  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [studyFilter, setStudyFilter] = useState<'all' | 'review'>('all');
  const [viewMode, setViewMode] = useState<'study' | 'list'>('study');
  const [revealAllInList, setRevealAllInList] = useState<boolean>(false);

  // Loading & Error State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset AI session state when active user changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        setDeck(null);
        setMasteryMap({});
        setCurrentIndex(0);
        return;
      }
      const parsed = JSON.parse(saved) as StoredFlashcardSession;
      setDeck(parsed?.deck?.cards?.length ? parsed.deck : null);
      setMasteryMap(parsed?.masteryMap || {});
      setCurrentIndex(typeof parsed?.currentIndex === 'number' ? parsed.currentIndex : 0);
    } catch {
      setDeck(null);
      setMasteryMap({});
      setCurrentIndex(0);
    }
  }, [storageKey]);

  // Persist active AI deck & study progress per student
  useEffect(() => {
    try {
      if (!deck) {
        localStorage.removeItem(storageKey);
        return;
      }
      const session: StoredFlashcardSession = {
        deck,
        masteryMap,
        currentIndex,
      };
      localStorage.setItem(storageKey, JSON.stringify(session));
    } catch {
      // Ignore storage quota errors
    }
  }, [deck, masteryMap, currentIndex, storageKey]);

  // Count personal flashcards per courseId
  const courseCardCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const card of personalFlashcards) {
      const cid = card.courseId || GENERAL_COURSE_ID;
      counts[cid] = (counts[cid] || 0) + 1;
    }
    return counts;
  }, [personalFlashcards]);

  const selectedCourseObj = useMemo(
    () =>
      selectedCourseFilter !== 'all' && selectedCourseFilter !== GENERAL_COURSE_ID
        ? courses.find((c) => c.id === selectedCourseFilter) || null
        : null,
    [courses, selectedCourseFilter]
  );

  // Reset module filter if selected course changes and no longer matches
  useEffect(() => {
    if (selectedCourseFilter === 'all' || selectedCourseFilter === GENERAL_COURSE_ID) {
      setSelectedModuleFilter('all');
      return;
    }
    if (
      selectedModuleFilter !== 'all' &&
      !selectedCourseObj?.modules.some((m) => m.id === selectedModuleFilter)
    ) {
      setSelectedModuleFilter('all');
    }
  }, [selectedCourseFilter, selectedModuleFilter, selectedCourseObj]);

  // Personal flashcards filtered by course, module, and search query
  const scopedPersonalCards = useMemo(() => {
    const q = personalSearch.trim().toLowerCase();
    let list = personalFlashcards.filter((card) => {
      if (selectedCourseFilter !== 'all' && card.courseId !== selectedCourseFilter) {
        return false;
      }
      if (selectedModuleFilter !== 'all' && card.moduleId !== selectedModuleFilter) {
        return false;
      }
      if (q) {
        const hay = `${card.term} ${card.question} ${card.answer} ${card.portNumber || ''} ${
          card.courseCode || ''
        } ${card.courseTitle || ''} ${card.moduleTitle || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (personalOrderIds.length > 0) {
      const posMap = new Map(personalOrderIds.map((id, i) => [id, i]));
      list = [...list].sort((a, b) => {
        const posA = posMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const posB = posMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return posA - posB;
      });
    }

    return list;
  }, [
    personalFlashcards,
    selectedCourseFilter,
    selectedModuleFilter,
    personalSearch,
    personalOrderIds,
  ]);

  // Helper to resolve course/module label cleanly even if mock/course title updated
  const resolveCourseMeta = useCallback(
    (card: PersonalFlashcard) => {
      if (card.courseId === GENERAL_COURSE_ID) {
        return { code: 'General', title: 'Cross-Course Deck', moduleLabel: '' };
      }
      const course = courses.find((c) => c.id === card.courseId);
      const modIndex =
        course && card.moduleId
          ? course.modules.findIndex((m) => m.id === card.moduleId)
          : -1;
      const modTitle =
        modIndex >= 0 && course
          ? `M${modIndex + 1}: ${course.modules[modIndex].title}`
          : card.moduleTitle || '';
      return {
        code: course?.code || card.courseCode || 'Course',
        title: course?.title || card.courseTitle || 'Tagged Course',
        moduleLabel: modTitle,
      };
    },
    [courses]
  );

  // Unified Visible Cards & Stats depending on deckSource
  const baseCards: FlashcardItem[] = useMemo(() => {
    if (deckSource === 'personal') {
      return scopedPersonalCards;
    }
    return deck?.cards || [];
  }, [deckSource, scopedPersonalCards, deck]);

  const getCardStatus = useCallback(
    (card: FlashcardItem): CardMasteryStatus => {
      if (deckSource === 'personal') {
        return (card as PersonalFlashcard).masteryStatus || 'unreviewed';
      }
      return masteryMap[card.id] || 'unreviewed';
    },
    [deckSource, masteryMap]
  );

  const visibleCards = useMemo<FlashcardItem[]>(() => {
    if (studyFilter === 'review') {
      return baseCards.filter((c) => getCardStatus(c) === 'review');
    }
    return baseCards;
  }, [baseCards, studyFilter, getCardStatus]);

  // Clamp index when filtering or shuffling
  useEffect(() => {
    if (visibleCards.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= visibleCards.length) {
      setCurrentIndex(visibleCards.length - 1);
    }
  }, [visibleCards.length, currentIndex]);

  const activeCard = visibleCards[currentIndex] || null;
  const activePersonalCard =
    deckSource === 'personal' && activeCard ? (activeCard as PersonalFlashcard) : null;

  const stats = useMemo(() => {
    let mastered = 0;
    let review = 0;
    let unreviewed = 0;
    for (const card of baseCards) {
      const status = getCardStatus(card);
      if (status === 'mastered') mastered += 1;
      else if (status === 'review') review += 1;
      else unreviewed += 1;
    }
    const total = baseCards.length;
    const masteryPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { total, mastered, review, unreviewed, masteryPct };
  }, [baseCards, getCardStatus]);

  const handleGenerateDeck = useCallback(
    async (overrides?: {
      topic?: FlashcardTopic;
      difficulty?: FlashcardDifficulty;
      cardCount?: number;
      customFocus?: string;
      avoidPrevious?: boolean;
    }) => {
      if (isGenerating) return;
      if (isOffline) {
        setErrorMessage(
          'You are currently in Offline Mode. Reconnect your network to generate a fresh AI flashcard deck.'
        );
        return;
      }

      const targetTopic = overrides?.topic ?? topic;
      const targetDifficulty = overrides?.difficulty ?? difficulty;
      const targetCount = overrides?.cardCount ?? cardCount;
      const targetFocus = overrides?.customFocus ?? customFocus;
      const avoidTerms =
        overrides?.avoidPrevious && deck
          ? deck.cards.map((c) => (c.portNumber ? `${c.term} (${c.portNumber})` : c.term))
          : [];

      if (overrides?.topic) setTopic(overrides.topic);
      if (overrides?.difficulty) setDifficulty(overrides.difficulty);
      if (overrides?.cardCount) setCardCount(overrides.cardCount);
      if (overrides?.customFocus !== undefined) setCustomFocus(overrides.customFocus);

      setIsGenerating(true);
      setErrorMessage(null);

      try {
        const generated = await generateFlashcardDeck({
          topic: targetTopic,
          difficulty: targetDifficulty,
          cardCount: targetCount,
          customFocus: targetFocus.trim() || undefined,
          avoidTerms,
        });

        setDeck(generated);
        setMasteryMap({});
        setCurrentIndex(0);
        setIsFlipped(false);
        setShowHint(false);
        setStudyFilter('all');
        setViewMode('study');
        setDeckSource('ai');
      } catch (err: any) {
        setErrorMessage(
          err?.message || 'Unable to generate flashcards right now. Please try again.'
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, isOffline, topic, difficulty, cardCount, customFocus, deck]
  );

  const goToIndex = useCallback(
    (nextIdx: number) => {
      if (visibleCards.length === 0) return;
      const bounded = (nextIdx + visibleCards.length) % visibleCards.length;
      setIsFlipped(false);
      setShowHint(false);
      setCurrentIndex(bounded);
    },
    [visibleCards.length]
  );

  const handleMarkCard = useCallback(
    (status: CardMasteryStatus) => {
      if (!activeCard) return;
      recordLearningActivity('Flashcard study');
      recordStudyTime(15, 'practice');

      if (deckSource === 'personal') {
        updatePersonalFlashcardMastery(activeCard.id, status);
      } else {
        setMasteryMap((prev) => ({ ...prev, [activeCard.id]: status }));
      }

      setIsFlipped(false);
      setShowHint(false);

      if (studyFilter === 'review' && status === 'mastered') {
        return;
      }

      if (visibleCards.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % visibleCards.length);
      }
    },
    [
      activeCard,
      deckSource,
      studyFilter,
      visibleCards.length,
      recordLearningActivity,
      recordStudyTime,
      updatePersonalFlashcardMastery,
    ]
  );

  const handleShuffleDeck = () => {
    if (deckSource === 'personal') {
      if (scopedPersonalCards.length < 2) return;
      const ids = scopedPersonalCards.map((c) => c.id);
      for (let i = ids.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      setPersonalOrderIds(ids);
      setCurrentIndex(0);
      setIsFlipped(false);
      setShowHint(false);
      return;
    }

    if (!deck || deck.cards.length < 2) return;
    const shuffled = [...deck.cards];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setDeck({ ...deck, cards: shuffled });
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
  };

  const handleResetProgress = () => {
    if (deckSource === 'personal') {
      for (const card of scopedPersonalCards) {
        if (card.masteryStatus !== 'unreviewed') {
          updatePersonalFlashcardMastery(card.id, 'unreviewed');
        }
      }
    } else {
      setMasteryMap({});
    }
    setStudyFilter('all');
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
  };

  const handleOpenCreateModal = (courseOverride?: string) => {
    setEditingCard(null);
    if (courseOverride) {
      setSelectedCourseFilter(courseOverride);
    }
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (card: PersonalFlashcard) => {
    setEditingCard(card);
    setIsEditorOpen(true);
  };

  const handleSaveModalCard = (input: PersonalFlashcardInput) => {
    const saved = savePersonalFlashcard(input);
    setDeckSource('personal');
    // Ensure saved card stays visible in active filter
    if (
      selectedCourseFilter !== 'all' &&
      selectedCourseFilter !== saved.courseId
    ) {
      setSelectedCourseFilter(saved.courseId);
      setSelectedModuleFilter(saved.moduleId || 'all');
    } else if (
      selectedModuleFilter !== 'all' &&
      selectedModuleFilter !== (saved.moduleId || '')
    ) {
      setSelectedModuleFilter('all');
    }
    setPersonalOrderIds((prev) =>
      prev.includes(saved.id) ? prev : [saved.id, ...prev]
    );
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
  };

  const handleConfirmDeleteCard = (cardId: string) => {
    deletePersonalFlashcard(cardId);
    setConfirmDeleteId(null);
    setIsFlipped(false);
    setShowHint(false);
  };

  // Keyboard shortcuts for study mode
  useEffect(() => {
    if (isEditorOpen || viewMode !== 'study' || visibleCards.length === 0) return;
    if (deckSource === 'ai' && !deck) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToIndex(currentIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToIndex(currentIndex - 1);
      } else if (e.key === '1') {
        e.preventDefault();
        handleMarkCard('review');
      } else if (e.key === '2') {
        e.preventDefault();
        handleMarkCard('mastered');
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowHint((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isEditorOpen,
    deckSource,
    deck,
    viewMode,
    visibleCards.length,
    currentIndex,
    goToIndex,
    handleMarkCard,
  ]);

  const activeCardStatus: CardMasteryStatus = activeCard
    ? getCardStatus(activeCard)
    : 'unreviewed';

  const hasHintData = Boolean(
    activeCard && (activeCard.osiLayer || activeCard.transportProtocol)
  );

  const showWorkspace =
    deckSource === 'personal'
      ? scopedPersonalCards.length > 0
      : Boolean(deck && !isGenerating);

  const coursesWithCards = useMemo(
    () => courses.filter((c) => (courseCardCounts[c.id] || 0) > 0),
    [courses, courseCardCounts]
  );

  return (
    <div className="space-y-6">
      {/* Top Workspace Header & Mode Switcher */}
      <section className="rounded-3xl bg-white dark:bg-[#0c1220] border border-slate-200/90 dark:border-slate-800/90 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-blue-50/70 via-white to-cyan-50/60 dark:from-blue-950/25 dark:via-[#0c1220] dark:to-cyan-950/20">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <SquareStack className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Networking Flashcards
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Build personal flashcards tagged by course and module, or generate AI practice decks for protocols, terminology, and port numbers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Personal Course Cards vs AI Deck Generator Switcher */}
            <div
              role="tablist"
              aria-label="Flashcard source mode"
              className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <button
                type="button"
                role="tab"
                aria-selected={deckSource === 'personal'}
                onClick={() => {
                  setDeckSource('personal');
                  setStudyFilter('all');
                  setCurrentIndex(0);
                  setIsFlipped(false);
                  setShowHint(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  deckSource === 'personal'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-cyan-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>My Course Cards</span>
                <span className="font-mono text-[11px] tabular-nums opacity-80">
                  ({personalFlashcards.length})
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={deckSource === 'ai'}
                onClick={() => {
                  setDeckSource('ai');
                  setStudyFilter('all');
                  setCurrentIndex(0);
                  setIsFlipped(false);
                  setShowHint(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  deckSource === 'ai'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-cyan-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Deck Generator</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Flashcard</span>
            </button>
          </div>
        </div>

        {/* Mode-Specific Controls Header */}
        {deckSource === 'personal' ? (
          <div className="p-5 sm:p-6 space-y-4">
            {/* Quick Course Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCourseFilter('all');
                  setSelectedModuleFilter('all');
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-colors ${
                  selectedCourseFilter === 'all'
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                    : 'bg-slate-50 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                All Courses <span className="font-mono tabular-nums ml-1">({personalFlashcards.length})</span>
              </button>

              {coursesWithCards.map((c) => {
                const count = courseCardCounts[c.id] || 0;
                const active = selectedCourseFilter === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCourseFilter(c.id);
                      setSelectedModuleFilter('all');
                      setCurrentIndex(0);
                      setIsFlipped(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-colors ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 dark:bg-cyan-500 dark:text-slate-950 dark:border-cyan-500'
                        : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-cyan-500'
                    }`}
                  >
                    <span className="font-mono mr-1">{c.code}</span>
                    <span className="font-mono tabular-nums opacity-80">({count})</span>
                  </button>
                );
              })}

              {(courseCardCounts[GENERAL_COURSE_ID] || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourseFilter(GENERAL_COURSE_ID);
                    setSelectedModuleFilter('all');
                    setCurrentIndex(0);
                    setIsFlipped(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-colors ${
                    selectedCourseFilter === GENERAL_COURSE_ID
                      ? 'bg-blue-600 text-white border-blue-600 dark:bg-cyan-500 dark:text-slate-950 dark:border-cyan-500'
                      : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-cyan-500'
                  }`}
                >
                  General <span className="font-mono tabular-nums ml-1">({courseCardCounts[GENERAL_COURSE_ID]})</span>
                </button>
              )}
            </div>

            {/* Course / Module Selectors & Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="personal-fc-course-filter"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
                >
                  Filter by Course
                </label>
                <select
                  id="personal-fc-course-filter"
                  value={selectedCourseFilter}
                  onChange={(e) => {
                    setSelectedCourseFilter(e.target.value);
                    setSelectedModuleFilter('all');
                    setCurrentIndex(0);
                    setIsFlipped(false);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
                >
                  <option value="all">
                    All Courses ({personalFlashcards.length})
                  </option>
                  <option value={GENERAL_COURSE_ID}>
                    General / Cross-Course ({courseCardCounts[GENERAL_COURSE_ID] || 0})
                  </option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.title} ({courseCardCounts[c.id] || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="personal-fc-module-filter"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
                >
                  Filter by Module
                </label>
                <select
                  id="personal-fc-module-filter"
                  value={selectedModuleFilter}
                  disabled={!selectedCourseObj || selectedCourseObj.modules.length === 0}
                  onChange={(e) => {
                    setSelectedModuleFilter(e.target.value);
                    setCurrentIndex(0);
                    setIsFlipped(false);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
                >
                  <option value="all">
                    {selectedCourseObj ? 'All Modules in Course' : 'Select a specific course'}
                  </option>
                  {selectedCourseObj?.modules.map((m, idx) => (
                    <option key={m.id} value={m.id}>
                      M{idx + 1}: {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="personal-fc-search"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
                >
                  Search Cards
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="personal-fc-search"
                    type="text"
                    value={personalSearch}
                    onChange={(e) => {
                      setPersonalSearch(e.target.value);
                      setCurrentIndex(0);
                    }}
                    placeholder="Search term, question, or port..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* AI Deck Configuration Form */
          <div className="p-5 sm:p-6 space-y-5">
            {deck && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Active AI Deck: <strong className="text-slate-800 dark:text-slate-200">{deck.deckTitle}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleGenerateDeck({ avoidPrevious: true })}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  Fresh Cards (No Repeats)
                </button>
              </div>
            )}

            {/* Topic Track Cards */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                Study Focus Track
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {TOPIC_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = topic === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTopic(opt.id)}
                      className={`text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                        selected
                          ? 'bg-blue-50/90 dark:bg-blue-950/45 border-blue-500 dark:border-cyan-400 ring-1 ring-blue-500/30 dark:ring-cyan-400/30 shadow-xs'
                          : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          selected
                            ? 'bg-blue-600 text-white dark:bg-cyan-500 dark:text-slate-950'
                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {opt.label}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {opt.shortDesc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty, Card Count & Custom Prompt Row */}
            <div className="flex flex-col lg:flex-row lg:items-end gap-3.5">
              <div className="shrink-0">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Difficulty Level
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDifficulty(opt.id)}
                      className={`px-3 py-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                        difficulty === opt.id
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-cyan-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="shrink-0">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Deck Size
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  {CARD_COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setCardCount(count)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold tabular-nums whitespace-nowrap transition-all ${
                        cardCount === count
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-cyan-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <label
                  htmlFor="flashcard-custom-focus"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2"
                >
                  Custom Focus (Optional)
                </label>
                <input
                  id="flashcard-custom-focus"
                  type="text"
                  value={customFocus}
                  onChange={(e) => setCustomFocus(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleGenerateDeck();
                    }
                  }}
                  placeholder="e.g., OSPF states, security ports, IPv6 neighbor discovery..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
                />
              </div>

              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => handleGenerateDeck()}
                  disabled={isGenerating}
                  className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/20 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Deck
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick-Pick Focus Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mr-1">
                Quick presets:
              </span>
              {FOCUS_SUGGESTIONS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  disabled={isGenerating}
                  onClick={() =>
                    handleGenerateDeck({
                      topic: preset.topic,
                      customFocus: preset.focus,
                    })
                  }
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 dark:bg-slate-800/80 dark:hover:bg-blue-950/60 text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-cyan-300 border border-slate-200/80 dark:border-slate-700/80 transition-colors disabled:opacity-50"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Offline Notice */}
      {isOffline && deckSource === 'ai' && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 p-4 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-200">
          <WifiOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            Offline Mode is active. Previously generated flashcards and all of your personal course cards remain available to study, while generating new AI decks requires network connectivity.
          </span>
        </div>
      )}

      {/* AI Error Alert Banner */}
      {deckSource === 'ai' && errorMessage && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                Could not generate AI flashcard deck
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                {errorMessage}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleGenerateDeck()}
            disabled={isGenerating}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors shrink-0 disabled:opacity-50"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Personal Cards Empty State */}
      {deckSource === 'personal' && scopedPersonalCards.length === 0 && (
        <section className="rounded-3xl bg-white dark:bg-[#0c1220] border border-slate-200/90 dark:border-slate-800/90 p-8 sm:p-10 text-center">
          <div className="max-w-xl mx-auto space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-cyan-400">
              <FolderOpen className="w-7 h-7" />
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
              {personalFlashcards.length === 0
                ? 'Create your first course-tagged flashcard'
                : 'No personal flashcards match this course filter'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {personalFlashcards.length === 0
                ? 'Write manual Q&A flashcards for commands, ports, subnetting rules, or troubleshooting steps, and tag each card to a course and optional module.'
                : 'Clear your course/search filter or add a new flashcard tagged directly to this course.'}
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenCreateModal()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Flashcard</span>
              </button>
              {personalFlashcards.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourseFilter('all');
                    setSelectedModuleFilter('all');
                    setPersonalSearch('');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  Show All My Cards ({personalFlashcards.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setDeckSource('ai')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                <span>Try AI Deck Generator</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* AI Empty Launchpad State */}
      {deckSource === 'ai' && !deck && !isGenerating && (
        <section className="rounded-3xl bg-white dark:bg-[#0c1220] border border-slate-200/90 dark:border-slate-800/90 p-8 sm:p-10 text-center">
          <div className="max-w-xl mx-auto space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-cyan-400">
              <Layers className="w-7 h-7" />
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
              Ready to build your AI study deck
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Choose a track above — <strong>All Topics</strong>, <strong>Terminology &amp; OSI</strong>, <strong>Protocols</strong>, or <strong>Standard Ports</strong> — and generate an interactive active-recall flashcard deck with mnemonics and instant self-grading.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleGenerateDeck({ topic: 'all', cardCount: 12 })}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/20 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Generate 12 Mixed Cards
              </button>
              <button
                type="button"
                onClick={() =>
                  handleGenerateDeck({
                    topic: 'ports',
                    cardCount: 12,
                    customFocus: 'Standard well-known TCP/UDP port numbers for CCNA & Network+',
                  })
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <Terminal className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                Drill Standard Port Numbers
              </button>
            </div>
          </div>
        </section>
      )}

      {/* AI Generating Skeleton State */}
      {deckSource === 'ai' && isGenerating && (
        <section className="rounded-3xl bg-white dark:bg-[#0c1220] border border-slate-200/90 dark:border-slate-800/90 p-10 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <Loader2 className="w-9 h-9 mx-auto text-blue-600 dark:text-cyan-400 animate-spin" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Crafting {cardCount} AI Networking Flashcards...
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generating questions, protocol/port tags, technical explanations, and memory hooks.
            </p>
          </div>
        </section>
      )}

      {/* Active Flashcard Study Workspace (Shared for Personal & AI) */}
      {showWorkspace && (
        <section className="space-y-5">
          {/* Deck Summary & Mastery Telemetry Strip */}
          <div className="rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200/90 dark:border-slate-800/90 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                  {deckSource === 'personal'
                    ? selectedCourseObj
                      ? `${selectedCourseObj.code} · ${selectedCourseObj.title}`
                      : selectedCourseFilter === GENERAL_COURSE_ID
                      ? 'General / Cross-Course Flashcards'
                      : 'My Course Flashcards'
                    : deck?.deckTitle}
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 tabular-nums">
                  {baseCards.length} {baseCards.length === 1 ? 'card' : 'cards'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {deckSource === 'personal'
                  ? 'Personal study cards synced to your account. Click Edit on any card to update text or reassign it to another course.'
                  : deck?.summary}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {/* Mastery Counts */}
              <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs tabular-nums">
                <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {stats.mastered} Mastered
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                  <RotateCcw className="w-3.5 h-3.5" />
                  {stats.review} Review
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  {stats.masteryPct}% Ready
                </span>
              </div>

              {/* View Mode Switcher */}
              <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('study')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    viewMode === 'study'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <SquareStack className="w-3.5 h-3.5" />
                  Study Stage
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  All Cards
                </button>
              </div>
            </div>
          </div>

          {/* Mastery Progress Bar */}
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${stats.masteryPct}%` }}
            />
          </div>

          {/* Deck Complete Celebration Callout */}
          {stats.total > 0 && stats.mastered === stats.total && (
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                    Deck Mastered! {stats.total} / {stats.total} cards confirmed
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {deckSource === 'personal'
                      ? 'Add another flashcard to this course or reset mastery to drill again.'
                      : 'Generate a fresh deck with new terms or reset mastery to drill again.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetProgress}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100/50 transition-colors"
                >
                  Reset &amp; Drill Again
                </button>
                {deckSource === 'personal' ? (
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal()}
                    className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                  >
                    + Add Another Card
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleGenerateDeck({ avoidPrevious: true })}
                    className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                  >
                    Next Fresh Deck
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STUDY STAGE MODE */}
          {viewMode === 'study' && (
            <div className="space-y-4">
              {/* Filter & Deck Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => {
                      setStudyFilter('all');
                      setCurrentIndex(0);
                      setIsFlipped(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      studyFilter === 'all'
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    All Cards ({baseCards.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStudyFilter('review');
                      setCurrentIndex(0);
                      setIsFlipped(false);
                    }}
                    disabled={stats.review === 0}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-45 ${
                      studyFilter === 'review'
                        ? 'bg-amber-600 text-white'
                        : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 border border-slate-200 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                    }`}
                  >
                    Needs Review ({stats.review})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleShuffleDeck}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Shuffle
                  </button>
                  <button
                    type="button"
                    onClick={handleResetProgress}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Mastery
                  </button>
                </div>
              </div>

              {activeCard ? (
                <div className="max-w-3xl mx-auto space-y-4">
                  {/* Card Counter & Personal Actions Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 px-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono font-bold tabular-nums">
                        Card {currentIndex + 1} of {visibleCards.length}
                      </span>
                      {activePersonalCard && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-blue-600 dark:text-cyan-400">
                            {(() => {
                              const meta = resolveCourseMeta(activePersonalCard);
                              return meta.moduleLabel
                                ? `${meta.code} · ${meta.moduleLabel}`
                                : `${meta.code} · ${meta.title}`;
                            })()}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {activePersonalCard && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(activePersonalCard)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-cyan-500 transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit / Course</span>
                          </button>

                          {confirmDeleteId === activePersonalCard.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleConfirmDeleteCard(activePersonalCard.id)
                                }
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(activePersonalCard.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </>
                      )}

                      <span className="hidden sm:inline font-mono text-[11px]">
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          Space
                        </kbd>{' '}
                        to flip
                      </span>
                    </div>
                  </div>

                  {/* 3D Flip Card */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={
                      isFlipped
                        ? 'Flashcard answer side. Click or press Space to flip to question.'
                        : 'Flashcard question side. Click or press Space to reveal answer.'
                    }
                    onClick={() => setIsFlipped((prev) => !prev)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.code === 'Space') {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsFlipped((prev) => !prev);
                      }
                    }}
                    className="perspective-[1400px] cursor-pointer select-none focus:outline-none group"
                  >
                    <div
                      className={`grid grid-cols-1 transform-3d transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                        isFlipped ? 'rotate-y-180' : ''
                      }`}
                    >
                      {/* FRONT FACE: QUESTION */}
                      <div className="col-start-1 row-start-1 backface-hidden rounded-3xl bg-white dark:bg-[#0d1526] border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-black/40 p-6 sm:p-8 min-h-[320px] flex flex-col justify-between group-hover:border-blue-300 dark:group-hover:border-cyan-700/80 transition-colors">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${getCategoryStyles(
                                activeCard.category
                              )}`}
                            >
                              {activeCard.category}
                            </span>
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              Question
                            </span>
                          </div>

                          {activeCardStatus !== 'unreviewed' && (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                activeCardStatus === 'mastered'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                              }`}
                            >
                              {activeCardStatus === 'mastered' ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Mastered
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Needs Review
                                </>
                              )}
                            </span>
                          )}
                        </div>

                        <div className="py-6 text-center space-y-4">
                          <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-snug">
                            {activeCard.question}
                          </p>

                          {showHint && hasHintData && (
                            <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-800 dark:text-amber-200">
                              <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="font-semibold">
                                Clue:
                                {activeCard.osiLayer ? ` ${activeCard.osiLayer}` : ''}
                                {activeCard.osiLayer && activeCard.transportProtocol
                                  ? ' •'
                                  : ''}
                                {activeCard.transportProtocol
                                  ? ` Transport: ${activeCard.transportProtocol}`
                                  : ''}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-400 dark:text-slate-500">
                          {hasHintData ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowHint((prev) => !prev);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              {showHint ? 'Hide Clue' : 'Show Clue (H)'}
                            </button>
                          ) : (
                            <span />
                          )}
                          <span className="font-semibold text-blue-600 dark:text-cyan-400">
                            Tap card to reveal answer →
                          </span>
                        </div>
                      </div>

                      {/* BACK FACE: ANSWER */}
                      <div className="col-start-1 row-start-1 backface-hidden rotate-y-180 rounded-3xl bg-gradient-to-br from-slate-900 via-[#0f172a] to-[#0a1328] dark:from-[#0f172a] dark:via-[#0b1222] dark:to-[#070d1a] text-white border border-slate-800 dark:border-cyan-900/50 shadow-xl p-6 sm:p-8 min-h-[320px] flex flex-col justify-between">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                              Answer · {activeCard.term}
                            </span>
                            {activeCard.portNumber && (
                              <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold tabular-nums bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                Port {activeCard.portNumber}
                              </span>
                            )}
                            {activeCard.transportProtocol && (
                              <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                                {activeCard.transportProtocol}
                              </span>
                            )}
                            {activeCard.osiLayer && (
                              <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/10 text-slate-200 border border-white/10">
                                {activeCard.osiLayer}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="py-5 space-y-4">
                          <p className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                            {activeCard.answer}
                          </p>

                          {activeCard.explanation && (
                            <p className="text-sm text-slate-300 leading-relaxed">
                              {activeCard.explanation}
                            </p>
                          )}

                          {activeCard.memoryTip && (
                            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-2.5">
                              <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                              <div className="text-xs text-slate-200 leading-relaxed">
                                <span className="font-bold text-amber-300">Memory Tip: </span>
                                {activeCard.memoryTip}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs text-slate-400">
                          <span>Self-grade below to track mastery</span>
                          <span className="font-semibold text-cyan-300">
                            ← Tap card to view question
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Recall Grading & Navigation Controls */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => goToIndex(currentIndex - 1)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl text-xs font-bold bg-white dark:bg-[#0c1220] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Prev
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMarkCard('review')}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl text-xs font-extrabold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Need Review (1)
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsFlipped((prev) => !prev)}
                      className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors"
                    >
                      {isFlipped ? 'Show Question' : 'Flip Card'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMarkCard('mastered')}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl text-xs font-extrabold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Mastered (2)
                    </button>

                    <button
                      type="button"
                      onClick={() => goToIndex(currentIndex + 1)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl text-xs font-bold bg-white dark:bg-[#0c1220] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      Next
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quick Dot Navigator */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                    {visibleCards.map((card, idx) => {
                      const status = getCardStatus(card);
                      const isCurrent = idx === currentIndex;
                      let colorCls = 'bg-slate-300 dark:bg-slate-700';
                      if (status === 'mastered') colorCls = 'bg-emerald-500';
                      else if (status === 'review') colorCls = 'bg-amber-500';

                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => goToIndex(idx)}
                          aria-label={`Jump to card ${idx + 1}: ${card.term}`}
                          title={`${idx + 1}. ${card.term}`}
                          className={`h-2.5 rounded-full transition-all ${colorCls} ${
                            isCurrent
                              ? 'w-7 ring-2 ring-blue-500/40 dark:ring-cyan-400/50'
                              : 'w-2.5 opacity-70 hover:opacity-100'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No cards remaining in &ldquo;Needs Review&rdquo;!
                  </p>
                  <button
                    type="button"
                    onClick={() => setStudyFilter('all')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                  >
                    Switch Back to All Cards
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ALL CARDS CRAM / LIST VIEW */}
          {viewMode === 'list' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Click any card to open it on the study stage, or toggle all answers for quick review.
                </p>
                <button
                  type="button"
                  onClick={() => setRevealAllInList((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {revealAllInList ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      Hide All Answers
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      Reveal All Answers
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {baseCards.map((card, idx) => {
                  const status = getCardStatus(card);
                  const personalMeta =
                    deckSource === 'personal'
                      ? resolveCourseMeta(card as PersonalFlashcard)
                      : null;
                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        setStudyFilter('all');
                        setCurrentIndex(idx);
                        setIsFlipped(false);
                        setViewMode('study');
                      }}
                      className="cursor-pointer rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-cyan-500/60 p-4 space-y-2.5 transition-all shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-mono font-bold text-slate-400 tabular-nums">
                            #{idx + 1}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getCategoryStyles(
                              card.category
                            )}`}
                          >
                            {card.category}
                          </span>
                          {card.portNumber && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-cyan-300">
                              Port {card.portNumber}{' '}
                              {card.transportProtocol ? `(${card.transportProtocol})` : ''}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {status === 'mastered' && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              Mastered
                            </span>
                          )}
                          {status === 'review' && (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              Needs Review
                            </span>
                          )}
                          {deckSource === 'personal' && (
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                aria-label={`Edit ${card.term}`}
                                onClick={() =>
                                  handleOpenEditModal(card as PersonalFlashcard)
                                }
                                className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {confirmDeleteId === card.id ? (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDeleteCard(card.id)}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white"
                                >
                                  Confirm
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  aria-label={`Delete ${card.term}`}
                                  onClick={() => setConfirmDeleteId(card.id)}
                                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {personalMeta && (
                        <p className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400">
                          {personalMeta.moduleLabel
                            ? `${personalMeta.code} · ${personalMeta.moduleLabel}`
                            : `${personalMeta.code} · ${personalMeta.title}`}
                        </p>
                      )}

                      <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {card.question}
                      </p>

                      {revealAllInList ? (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
                          <p className="text-xs font-bold text-blue-700 dark:text-cyan-300">
                            {card.answer}
                          </p>
                          {card.memoryTip && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Tip: {card.memoryTip}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Click to study card →
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Create / Edit / Reassign Personal Flashcard Modal */}
      <PersonalFlashcardModal
        isOpen={isEditorOpen}
        courses={courses}
        initialCard={editingCard}
        defaultCourseId={selectedCourseFilter}
        defaultModuleId={
          selectedModuleFilter !== 'all' ? selectedModuleFilter : undefined
        }
        onSave={handleSaveModalCard}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingCard(null);
        }}
      />
    </div>
  );
};
