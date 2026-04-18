/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import useSWR from 'swr';
import { fetchLiteCollection } from '@/utils/cardService';
import { EnhancedCard } from '@/types';

const EMPTY_CARDS: EnhancedCard[] = [];

export function useCards(forceRefresh = false) {
  const {
    data: allCards = EMPTY_CARDS,
    isLoading,
    mutate,
  } = useSWR<EnhancedCard[]>('liteCollection', fetchLiteCollection, {
    revalidateOnFocus: false,
    revalidateIfStale: true,
    fallbackData: EMPTY_CARDS,
    dedupingInterval: forceRefresh ? 0 : 10000,
  });

  // Handle Hydration
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (forceRefresh) {
      localStorage.removeItem('cachedCards_v3');
      return;
    }
    if (allCards.length > 0) return;

    const cached = localStorage.getItem('cachedCards_v3');
    if (cached) {
      try {
        const fixed = cached.replace(/season1-launch/gi, 'season1-v2');
        const parsed = JSON.parse(fixed);
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

  // Sync LocalStorage - only if data actually exists
  useEffect(() => {
    if (allCards && allCards.length > 0 && !forceRefresh) {
      const timer = setTimeout(() => {
        localStorage.setItem('cachedCards_v3', JSON.stringify(allCards));
      }, 1000); // Debounce to prevent CPU spikes during transitions
      return () => clearTimeout(timer);
    }
  }, [allCards, forceRefresh]);

  const handleRefresh = async () => {
    localStorage.removeItem('cachedCards_v3');
    await mutate();
  };

  return { allCards, isLoading, mutate, handleRefresh };
}
