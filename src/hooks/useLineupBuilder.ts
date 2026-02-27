import { useState } from 'react';
import { EnhancedCard } from '@/types';

export function useLineupBuilder() {
    const [lineup, setLineup] = useState<EnhancedCard[]>([]);

    const addCard = (card: EnhancedCard): { success: boolean; error?: string } => {
        const isScheme = card.cardType === 'SCHEME';
        const currentSchemes = lineup.filter(c => c.cardType === 'SCHEME').length;

        if (isScheme && currentSchemes >= 1) {
            return { success: false, error: "Only 1 Scheme Card per Lineup!" };
        }

        const currentMokis = lineup.filter(c => c.cardType !== 'SCHEME').length;
        if (!isScheme && currentMokis >= 4) {
            return { success: false, error: "Maximum 4 Mokis per Lineup!" };
        }

        if (!isScheme) {
            const hasSameMoki = lineup.some(c => c.cardType !== 'SCHEME' && c.image === card.image);
            if (hasSameMoki) {
                return { success: false, error: "Only 1 Moki of the same type per Lineup!" };
            }
        }

        setLineup(prev => [...prev, card]);
        return { success: true };
    };

    const removeCard = (index: number) => {
        setLineup(prev => {
            const newLineup = [...prev];
            newLineup.splice(index, 1);
            return newLineup;
        });
    };

    const clearLineup = () => {
        setLineup([]);
    };

    return {
        lineup,
        setLineup, // Exposed for operations like 'locking' after save
        addCard,
        removeCard,
        clearLineup
    };
}
