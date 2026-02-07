import { useEffect } from 'react';
import useSWR from 'swr';
import { fetchLiteCollection } from '@/utils/cardService';
import { EnhancedCard } from '@/types';

export function useCards() {
    const { data: allCards = [], isLoading, mutate } = useSWR<EnhancedCard[]>('liteCollection', fetchLiteCollection, {
        revalidateOnFocus: false,
        revalidateIfStale: true,
        fallbackData: []
    });

    // Handle Hydration: Load cache only after mount
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const cached = localStorage.getItem('cachedCards');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.length > 0) {
                    mutate(parsed, false); // Update current data without re-fetching
                }
            } catch (e) {
                console.error("Failed to load cached cards", e);
            }
        }
    }, [mutate]);

    // Keep localStorage in sync for next load
    useEffect(() => {
        if (allCards && allCards.length > 0) {
            localStorage.setItem('cachedCards', JSON.stringify(allCards));
        }
    }, [allCards]);

    const handleRefresh = async () => {
        await mutate();
    };

    return { allCards, isLoading, mutate, handleRefresh };
}
