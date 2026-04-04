import { EnhancedCard, FilterState } from '@/types';
import { getSpecializationCoefficient, getStatValueByLimit } from './specializationUtils';

export type SortOption =
  | 'default'
  | 'name_asc'
  | 'name_desc'
  | 'rarity_desc'
  | 'rarity_asc'
  | 'stars_desc'
  | 'stars_asc';

export const getRarityValue = (rarity: string) => {
  switch (rarity.toLowerCase()) {
    case 'legendary':
      return 4;
    case 'epic':
      return 3;
    case 'rare':
      return 2;
    case 'common':
    case 'basic':
      return 1;
    case 'scheme':
      return 0;
    default:
      return 0;
  }
};

export const sortCardsByFilters = (
  cards: EnhancedCard[],
  filters: FilterState,
  sortOption: SortOption
): EnhancedCard[] => {
  return [...cards]
    .filter((c) => {
      if (sortOption === 'stars_asc' || sortOption === 'stars_desc') {
        return c.cardType !== 'SCHEME';
      }
      return true;
    })
    .sort((a, b) => {
      // Determine priority between specialization and extraSort based on insertionOrder
      const sortKeys = filters.insertionOrder?.filter(k => 
        k.startsWith('specialization:') || k.startsWith('extraSort:')
      ) || [];
      const lastSortKey = sortKeys[sortKeys.length - 1];

      // Priority 1: The last selected sidebar sort (Specialization or Extra)
      if (lastSortKey?.startsWith('specialization:') && filters.specialization && filters.specialization.length > 0) {
        const activeSpecs = filters.specialization;
        const perfSpecs = ['Gacha', 'Killer', 'Wart Rider'];
        const contextSpecs = ['Winner', 'Loser', 'Bad Streak', 'Good Streak'];
        const scoreSpecs = ['Score'];

        const activePerf = activeSpecs.find((s) => perfSpecs.includes(s));
        const activeContext = activeSpecs.find((s) => contextSpecs.includes(s));
        const activeScore = activeSpecs.find((s) => scoreSpecs.includes(s));
        const activeCategories = [activePerf, activeContext, activeScore].filter(Boolean);

        if (activeCategories.length > 1) {
          const calcCoeff = (card: EnhancedCard) => {
            let coeff = 1;
            activeCategories.forEach((spec) => {
              if (spec) coeff *= getSpecializationCoefficient(card, spec, filters.matchLimit);
            });
            return coeff;
          };
          const coeffA = calcCoeff(a);
          const coeffB = calcCoeff(b);
          const isLoserActive = activeSpecs.includes('Loser');
          if (coeffB !== coeffA) return isLoserActive ? coeffA - coeffB : coeffB - coeffA;
        }

        for (const spec of activeSpecs) {
          const valA = getSpecializationCoefficient(a, spec, filters.matchLimit);
          const valB = getSpecializationCoefficient(b, spec, filters.matchLimit);
          const diff = spec === 'Loser' ? valA - valB : valB - valA;
          if (diff !== 0) return diff;
        }
      }
      else if (lastSortKey?.startsWith('extraSort:') && filters.extraSort && (filters.matchLimit === 10 || filters.matchLimit === 20 || filters.matchLimit === 30)) {
        const valA = getStatValueByLimit(a, filters.extraSort, filters.matchLimit);
        const valB = getStatValueByLimit(b, filters.extraSort, filters.matchLimit);
        if (valB !== valA) return valB - valA;
      }
      // Priority 2: Manual dropdown sorting (if no sidebar sort is active or fallbacks)
      else if (sortOption !== 'default') {
        switch (sortOption) {
          case 'name_asc': return a.name.localeCompare(b.name);
          case 'name_desc': return b.name.localeCompare(a.name);
          case 'rarity_desc': return getRarityValue(b.rarity) - getRarityValue(a.rarity);
          case 'rarity_asc': return getRarityValue(a.rarity) - getRarityValue(b.rarity);
          case 'stars_desc': return (b.custom?.stars || 0) - (a.custom?.stars || 0);
          case 'stars_asc': return (a.custom?.stars || 0) - (b.custom?.stars || 0);
        }
      }
      // Fallbacks if insertionOrder is missing but filters are present
      else if (filters.extraSort && (filters.matchLimit === 10 || filters.matchLimit === 20 || filters.matchLimit === 30)) {
        const valA = getStatValueByLimit(a, filters.extraSort, filters.matchLimit);
        const valB = getStatValueByLimit(b, filters.extraSort, filters.matchLimit);
        if (valB !== valA) return valB - valA;
      }
      else if (filters.specialization && filters.specialization.length > 0) {
        const activeSpecs = filters.specialization;
        for (const spec of activeSpecs) {
          const valA = getSpecializationCoefficient(a, spec, filters.matchLimit);
          const valB = getSpecializationCoefficient(b, spec, filters.matchLimit);
          const diff = spec === 'Loser' ? valA - valB : valB - valA;
          if (diff !== 0) return diff;
        }
      }

      return 0;
    });
};
