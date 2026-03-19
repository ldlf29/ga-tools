import { useState, useRef, useEffect } from 'react';
import { EnhancedCard, FilterState } from '@/types';

export function useWorkerFilter(
  allCards: EnhancedCard[],
  filters: FilterState,
  searchQuery: string
) {
  const [filteredCards, setFilteredCards] = useState<EnhancedCard[]>([]);
  const workerRef = useRef<Worker | null>(null);
  // Cache latest filter state so we can re-send after SET_CARDS
  const latestFilters = useRef({ filters, searchQuery });

  useEffect(() => {
    latestFilters.current = { filters, searchQuery };
  }, [filters, searchQuery]);

  useEffect(() => {
    // Initialize Worker
    workerRef.current = new Worker(
      new URL('../workers/filter.worker.ts', import.meta.url)
    );

    // Listen for results
    workerRef.current.onmessage = (event: MessageEvent) => {
      setFilteredCards(event.data);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Send cards to worker when they change, then trigger a filter
  useEffect(() => {
    if (workerRef.current && allCards.length > 0) {
      workerRef.current.postMessage({ type: 'SET_CARDS', allCards });
      // Immediately trigger filter with current state
      workerRef.current.postMessage({
        filters: latestFilters.current.filters,
        searchQuery: latestFilters.current.searchQuery,
      });
    }
  }, [allCards]);

  // Send only filters/search to worker (lightweight — no card serialization)
  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ filters, searchQuery });
    }
  }, [filters, searchQuery]);

  return filteredCards;
}
