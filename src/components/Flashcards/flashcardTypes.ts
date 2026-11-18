export type FlashcardTopic = 'all' | 'terminology' | 'protocols' | 'ports';

export type FlashcardDifficulty = 'foundations' | 'certification' | 'advanced';

export type FlashcardCategory = 'Terminology' | 'Protocol' | 'Port Number' | 'Architecture';

export interface FlashcardItem {
  id: string;
  category: FlashcardCategory;
  term: string;
  question: string;
  answer: string;
  portNumber?: string;
  transportProtocol?: string;
  osiLayer?: string;
  explanation: string;
  memoryTip: string;
}

export interface FlashcardDeck {
  deckTitle: string;
  summary: string;
  topic: FlashcardTopic;
  difficulty: FlashcardDifficulty;
  generatedAt: string;
  cards: FlashcardItem[];
}

export interface GenerateFlashcardsParams {
  topic: FlashcardTopic;
  difficulty: FlashcardDifficulty;
  cardCount: number;
  customFocus?: string;
  avoidTerms?: string[];
}

export type CardMasteryStatus = 'unreviewed' | 'mastered' | 'review';

export interface PersonalFlashcard extends FlashcardItem {
  ownerUid: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  moduleId?: string;
  moduleTitle?: string;
  masteryStatus: CardMasteryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalFlashcardInput {
  id?: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  moduleId?: string;
  moduleTitle?: string;
  category: FlashcardCategory;
  term: string;
  question: string;
  answer: string;
  portNumber?: string;
  transportProtocol?: string;
  osiLayer?: string;
  explanation?: string;
  memoryTip?: string;
  masteryStatus?: CardMasteryStatus;
}

