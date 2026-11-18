import { FlashcardDeck, GenerateFlashcardsParams } from '../components/Flashcards/flashcardTypes';

export async function generateFlashcardDeck(
  params: GenerateFlashcardsParams
): Promise<FlashcardDeck> {
  const response = await fetch('/api/flashcards/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && typeof payload.error === 'string' && payload.error) ||
      `Failed to generate flashcard deck (HTTP ${response.status})`;
    throw new Error(message);
  }

  if (!payload || !Array.isArray(payload.cards) || payload.cards.length === 0) {
    throw new Error('The AI service returned an empty flashcard deck. Please try again.');
  }

  return payload as FlashcardDeck;
}
