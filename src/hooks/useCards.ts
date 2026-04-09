/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import useSWR from 'swr';
import { fetchLiteCollection } from '@/utils/cardService';
import { EnhancedCard } from '@/types';

export function useCards(forceRefresh = false) {
  const {
    data: allCards = [],
    isLoading,
    mutate,
  } = useSWR<EnhancedCard[]>('liteCollection', fetchLiteCollection, {
    revalidateOnFocus: false,
    revalidateIfStale: true,
    fallbackData: [],
    // If forceRefresh is on, we ignore deduplication
    dedupingInterval: forceRefresh ? 0 : 2000,
  });

  // Handle Hydration: Load cache only if SWR hasn't fetched yet
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (forceRefresh) {
      localStorage.removeItem('cachedCards_v3');
      return;
    }
    if (allCards.length > 0) return; // SWR already has data, don't overwrite

    const cached = localStorage.getItem('cachedCards_v3');
    if (cached) {
      try {
        const fixed = cached.replace(/season1-launch/gi, 'season1-v2');
        const parsed = JSON.parse(fixed);
        // Validate cache has train field (added recently)
        const hasTrainField =
          parsed.length > 0 &&
          parsed.some(
            (c: Record<string, any>) => c.cardType === 'MOKI' && c.custom?.train !== undefined
          );
        if (parsed.length > 0 && hasTrainField) {
          mutate(parsed, false);
        }
      } catch (e) {
        console.error('Failed to load cached cards', e);
      }
    }
  }, [mutate, allCards.length, forceRefresh]);

  // Keep localStorage in sync for next load
  useEffect(() => {
    if (allCards && allCards.length > 0 && !forceRefresh) {
      localStorage.setItem('cachedCards_v3', JSON.stringify(allCards));
    }
  }, [allCards, forceRefresh]);

  const handleRefresh = async () => {
    localStorage.removeItem('cachedCards_v3');
    await mutate();
  };

  return { allCards, isLoading, mutate, handleRefresh };
}
