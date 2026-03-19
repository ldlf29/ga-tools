import { EnhancedCard, FilterState } from '@/types';
import { getSpecializationCoefficient } from './specializationUtils';

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
      // 1. Specialization Sorting (Takes highest priority if active)
      if (filters.specialization && filters.specialization.length > 0) {
        const activeSpecs = filters.specialization;
        const perfSpecs = ['Gacha', 'Killer', 'Wart Rider'];
        const contextSpecs = ['Winner', 'Loser', 'Bad Streak', 'Good Streak'];
        const scoreSpecs = ['Score'];

        const activePerf = activeSpecs.find((s) => perfSpecs.includes(s));
        const activeContext = activeSpecs.find((s) => contextSpecs.includes(s));
        const activeScore = activeSpecs.find((s) => scoreSpecs.includes(s));

        const activeCategories = [
          activePerf,
          activeContext,
          activeScore,
        ].filter(Boolean);

        // CASE: At least two are active - Calculation of Coeff
        if (activeCategories.length > 1) {
          const calcCoeff = (card: EnhancedCard) => {
            let coeff = 1;
            activeCategories.forEach((spec) => {
              if (spec) {
                coeff *= getSpecializationCoefficient(
                  card,
                  spec,
                  filters.matchLimit
                );
              }
            });
            return coeff;
          };

          const coeffA = calcCoeff(a);
          const coeffB = calcCoeff(b);
          const isLoserActive = activeSpecs.includes('Loser');
          if (coeffB !== coeffA)
            return isLoserActive ? coeffA - coeffB : coeffB - coeffA;
        }

        // FALLBACK: Individual Sorting (if only one or coeff is same)
        for (const spec of activeSpecs) {
          const valA = getSpecializationCoefficient(a, spec, filters.matchLimit);
          const valB = getSpecializationCoefficient(b, spec, filters.matchLimit);
          const diff = spec === 'Loser' ? valA - valB : valB - valA;
          if (diff !== 0) return diff;
        }
      }

      // 2. Default Sort Option (Order by Menu)
      switch (sortOption) {
        case 'default':
          return 0;
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'rarity_desc':
          return getRarityValue(b.rarity) - getRarityValue(a.rarity);
        case 'rarity_asc':
          return getRarityValue(a.rarity) - getRarityValue(b.rarity);
        case 'stars_desc':
          return (b.custom?.stars || 0) - (a.custom?.stars || 0);
        case 'stars_asc':
          return (a.custom?.stars || 0) - (b.custom?.stars || 0);
        default:
          return 0;
      }
    });
};
