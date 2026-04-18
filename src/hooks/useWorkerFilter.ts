import { useState, useRef, useEffect } from 'react';
import { EnhancedCard, FilterState } from '@/types';

export function useWorkerFilter(
  allCards: EnhancedCard[],
  filters: FilterState,
  searchQuery: string
) {
  const [filteredCards, setFilteredCards] = useState<EnhancedCard[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const latestFilters = useRef({ filters, searchQuery });
  
  // Track last cards processed to avoid duplicate SET_CARDS storms
  const lastCardsRef = useRef<EnhancedCard[] | null>(null);

  useEffect(() => {
    latestFilters.current = { filters, searchQuery };
  }, [filters, searchQuery]);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/filter.worker.ts', import.meta.url)
    );

    workerRef.current.onmessage = (event: MessageEvent) => {
      // Functional state update to avoid referencing outer scope
      setFilteredCards(event.data);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Update cards in worker ONLY if the array reference actually changed and has items
  useEffect(() => {
    if (!workerRef.current || allCards.length === 0) return;
    if (allCards === lastCardsRef.current) return; // Skip if same reference

    lastCardsRef.current = allCards;
    workerRef.current.postMessage({ type: 'SET_CARDS', allCards });

    // Trigger immediate filter with latest state
    workerRef.current.postMessage({
      filters: latestFilters.current.filters,
      searchQuery: latestFilters.current.searchQuery,
    });
  }, [allCards]);

  // Send filters to worker with a tiny debounce for the search query
  useEffect(() => {
    if (!workerRef.current) return;

    const timer = setTimeout(() => {
      workerRef.current?.postMessage({ filters, searchQuery });
    }, searchQuery ? 150 : 0); // Only debounce if typing

    return () => clearTimeout(timer);
  }, [filters, searchQuery]);

  return filteredCards;
}
