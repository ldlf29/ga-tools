import { EnhancedCard } from '@/types';
import { matchesFilter } from '@/utils/filterUtils';

// Cache cards in the worker so we don't re-serialize on every filter change
let cachedCards: EnhancedCard[] = [];

self.onmessage = (e: MessageEvent) => {
  const { type, allCards, filters, searchQuery } = e.data;

  // Update cached cards when they change
  if (type === 'SET_CARDS') {
    cachedCards = allCards;
    return;
  }

  // Filter using cached cards
  const cards = allCards || cachedCards;
  const filtered = cards.filter((card: EnhancedCard) =>
    matchesFilter(card, filters, searchQuery)
  );

  self.postMessage(filtered);
};
