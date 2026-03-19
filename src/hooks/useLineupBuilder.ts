import { useState, useRef, useEffect } from 'react';
import { EnhancedCard } from '@/types';

export function useLineupBuilder() {
  const [lineup, setLineup] = useState<EnhancedCard[]>([]);

  // Use a ref to guarantee synchronous resolution during rapid clicks
  const lineupRef = useRef<EnhancedCard[]>(lineup);
  useEffect(() => {
    lineupRef.current = lineup;
  }, [lineup]);

  const addCard = (
    card: EnhancedCard
  ): { success: boolean; error?: string } => {
    const currentLineup = lineupRef.current;
    const isScheme = card.cardType === 'SCHEME';
    const currentSchemes = currentLineup.filter(
      (c) => c.cardType === 'SCHEME'
    ).length;

    if (isScheme && currentSchemes >= 1) {
      return { success: false, error: 'Only 1 Scheme Card per Lineup!' };
    }

    const currentMokis = currentLineup.filter(
      (c) => c.cardType !== 'SCHEME'
    ).length;
    if (!isScheme && currentMokis >= 4) {
      return { success: false, error: 'Maximum 4 Mokis per Lineup!' };
    }

    if (!isScheme) {
      const hasSameMoki = currentLineup.some(
        (c) => c.cardType !== 'SCHEME' && c.name === card.name
      );
      if (hasSameMoki) {
        return {
          success: false,
          error: 'Only 1 Moki of the same type per Lineup!',
        };
      }
    }

    const newLineup = [...currentLineup, card];
    lineupRef.current = newLineup; // Apply strictly first before state flush
    setLineup(newLineup);
    return { success: true };
  };

  const removeCard = (index: number) => {
    const currentLineup = [...lineupRef.current];
    currentLineup.splice(index, 1);
    lineupRef.current = currentLineup;
    setLineup(currentLineup);
  };

  const clearLineup = () => {
    lineupRef.current = [];
    setLineup([]);
  };

  return {
    lineup,
    setLineup, // Exposed for operations like 'locking' after save
    addCard,
    removeCard,
    clearLineup,
  };
}
