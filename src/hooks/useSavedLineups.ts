import { useState, useEffect } from 'react';
import { SavedLineup, EnhancedCard } from '@/types';

export function useSavedLineups(storageKey: string = 'grandArenaLineups') {
  const [savedLineups, setSavedLineups] = useState<SavedLineup[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Load from LocalStorage on mount or key change
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const fixed = saved.replace(/season1-launch/gi, 'season1-v2');
        setSavedLineups(JSON.parse(fixed));
      } else {
        setSavedLineups([]);
      }
    } catch (e) {
      console.error(`Failed to parse saved lineups for key: ${storageKey}`, e);
      setSavedLineups([]);
    }

    setLoadedKey(storageKey);
  }, [storageKey]);

  // Save to LocalStorage whenever savedLineups changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // MUST check if the data corresponds to the current key, otherwise when switching tabs it cross-saves old data to the new key
    if (loadedKey !== storageKey) return;

    localStorage.setItem(storageKey, JSON.stringify(savedLineups));
  }, [savedLineups, loadedKey, storageKey]);

  const getUniqueName = (baseName: string, existingNames: string[]) => {
    let name = baseName;
    let counter = 1;
    while (existingNames.includes(name)) {
      name = `${baseName} (${counter})`;
      counter++;
    }
    return name;
  };

  const saveLineup = (name: string, cards: EnhancedCard[]) => {
    if (!name || name.trim() === '')
      throw new Error('Please name your lineup before saving!');

    const trimmedName = name.trim();
    const existingNames = savedLineups.map((lineup) => lineup.name);
    const uniqueName = getUniqueName(trimmedName, existingNames);

    const newLineup: SavedLineup = {
      id: Date.now(),
      name: uniqueName,
      cards,
      createdAt: Date.now(),
    };

    setSavedLineups((prev) => [newLineup, ...prev]);
    return newLineup;
  };

  const deleteLineup = (id: number) => {
    setSavedLineups((prev) => prev.filter((lineup) => lineup.id !== id));
  };

  const renameLineup = (id: number, newName: string) => {
    if (!newName || newName.trim() === '') return;
    const existingNames = savedLineups
      .filter((lineup) => lineup.id !== id)
      .map((lineup) => lineup.name);
    const uniqueName = getUniqueName(newName.trim(), existingNames);
    setSavedLineups((prev) =>
      prev.map((lineup) =>
        lineup.id === id ? { ...lineup, name: uniqueName } : lineup
      )
    );
  };

  const toggleFavorite = (id: number) => {
    setSavedLineups((prev) =>
      prev.map((lineup) =>
        lineup.id === id
          ? {
              ...lineup,
              isFavorite: !lineup.isFavorite,
              favoritedAt: !lineup.isFavorite ? Date.now() : undefined,
            }
          : lineup
      )
    );
  };

  const rateLineup = (id: number, rating: number) => {
    setSavedLineups((prev) =>
      prev.map((lineup) =>
        lineup.id === id ? { ...lineup, rating } : lineup
      )
    );
  };

  const updateBackground = (id: number, backgroundId: string) => {
    setSavedLineups((prev) =>
      prev.map((lineup) =>
        lineup.id === id ? { ...lineup, backgroundId } : lineup
      )
    );
  };

  const bulkDelete = (ids: number[]) => {
    setSavedLineups((prev) =>
      prev.filter((lineup) => !ids.includes(lineup.id))
    );
  };

  const updateLineup = (id: number, cards: EnhancedCard[]) => {
    setSavedLineups((prev) =>
      prev.map((lineup) => (lineup.id === id ? { ...lineup, cards } : lineup))
    );
  };

  return {
    savedLineups,
    saveLineup,
    deleteLineup,
    renameLineup,
    toggleFavorite,
    rateLineup,
    updateBackground,
    bulkDelete,
    updateLineup,
  };
}
