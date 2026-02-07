import { useState, useRef, useEffect } from 'react';
import { EnhancedCard, FilterState } from '@/types';

export function useWorkerFilter(
    allCards: EnhancedCard[],
    filters: FilterState,
    searchQuery: string
) {
    const [filteredCards, setFilteredCards] = useState<EnhancedCard[]>([]);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        // Initialize Worker
        workerRef.current = new Worker(new URL('../workers/filter.worker.ts', import.meta.url));

        // Listen for results
        workerRef.current.onmessage = (event: MessageEvent) => {
            setFilteredCards(event.data);
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    // Post message to worker when inputs change
    useEffect(() => {
        if (workerRef.current) {
            workerRef.current.postMessage({ allCards, filters, searchQuery });
        }
    }, [allCards, filters, searchQuery]);

    return filteredCards;
}
