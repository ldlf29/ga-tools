import { useState, useEffect } from 'react';
import { SavedLineup, EnhancedCard } from '@/types';

export function useSavedLineups(storageKey: string = 'grandArenaLineups') {
    const [savedLineups, setSavedLineups] = useState<SavedLineup[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load from LocalStorage on mount or key change
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Reset initialization state when key changes
        setIsInitialized(false);

        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                setSavedLineups(JSON.parse(saved));
            } else {
                setSavedLineups([]);
            }
        } catch (e) {
            console.error(`Failed to parse saved lineups for key: ${storageKey}`, e);
            setSavedLineups([]);
        }

        setIsInitialized(true);
    }, [storageKey]);

    // Save to LocalStorage whenever savedLineups changes
    useEffect(() => {
        if (typeof window === 'undefined' || !isInitialized) return;
        localStorage.setItem(storageKey, JSON.stringify(savedLineups));
    }, [savedLineups, isInitialized, storageKey]);

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
        if (!name || name.trim() === "") throw new Error("Please name your lineup before saving!");

        const trimmedName = name.trim();
        const existingNames = savedLineups.map(l => l.name);
        const uniqueName = getUniqueName(trimmedName, existingNames);

        const newLineup: SavedLineup = {
            id: Date.now(),
            name: uniqueName,
            cards,
            createdAt: Date.now()
        };

        setSavedLineups(prev => [newLineup, ...prev]);
        return newLineup;
    };

    const deleteLineup = (id: number) => {
        setSavedLineups(prev => prev.filter(l => l.id !== id));
    };

    const renameLineup = (id: number, newName: string) => {
        if (!newName || newName.trim() === "") return;
        const existingNames = savedLineups.filter(l => l.id !== id).map(l => l.name);
        const uniqueName = getUniqueName(newName.trim(), existingNames);
        setSavedLineups(prev => prev.map(l => l.id === id ? { ...l, name: uniqueName } : l));
    };

    const toggleFavorite = (id: number) => {
        setSavedLineups(prev => prev.map(l => l.id === id ? { ...l, isFavorite: !l.isFavorite, favoritedAt: !l.isFavorite ? Date.now() : undefined } : l));
    };

    const rateLineup = (id: number, rating: number) => {
        setSavedLineups(prev => prev.map(l => l.id === id ? { ...l, rating } : l));
    };

    const updateBackground = (id: number, backgroundId: string) => {
        setSavedLineups(prev => prev.map(l => l.id === id ? { ...l, backgroundId } : l));
    };

    const bulkDelete = (ids: number[]) => {
        setSavedLineups(prev => prev.filter(l => !ids.includes(l.id)));
    };

    const updateLineup = (id: number, cards: EnhancedCard[]) => {
        setSavedLineups(prev => prev.map(l => l.id === id ? { ...l, cards } : l));
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
        updateLineup
    };
}
