import { EnhancedCard } from '@/types';
import { matchesFilter } from '@/utils/filterUtils';

// Event Listener for the Worker
self.onmessage = (e: MessageEvent) => {
    const { allCards, filters, searchQuery } = e.data;

    // Perform Filtering
    const filtered = allCards.filter((card: EnhancedCard) => matchesFilter(card, filters, searchQuery));

    // Send back results
    self.postMessage(filtered);
};
