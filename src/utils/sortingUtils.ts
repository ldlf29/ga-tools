import { EnhancedCard, FilterState } from '@/types';

export type SortOption = 'default' | 'name_asc' | 'name_desc' | 'rarity_desc' | 'rarity_asc' | 'stars_desc' | 'stars_asc';

export const getRarityValue = (rarity: string) => {
    switch (rarity.toLowerCase()) {
        case 'legendary': return 4;
        case 'epic': return 3;
        case 'rare': return 2;
        case 'common': case 'basic': return 1;
        case 'scheme': return 0;
        default: return 0;
    }
};

export const sortCardsByFilters = (
    cards: EnhancedCard[],
    filters: FilterState,
    sortOption: SortOption
): EnhancedCard[] => {
    return [...cards]
        .filter(c => {
            if (sortOption === 'stars_asc' || sortOption === 'stars_desc') {
                return c.cardType !== 'SCHEME';
            }
            return true;
        })
        .sort((a, b) => {
            // 1. Specialization Sorting (Takes highest priority if active)
            if (filters.specialization && filters.specialization.length > 0) {
                const activeSpecs = filters.specialization;
                const perfSpecs = ["Gacha", "Killer", "Wart Rider"];
                const contextSpecs = ["Winner", "Loser", "Bad Streak", "Good Streak"];
                const scoreSpecs = ["Score"];

                const activePerf = activeSpecs.find(s => perfSpecs.includes(s));
                const activeContext = activeSpecs.find(s => contextSpecs.includes(s));
                const activeScore = activeSpecs.find(s => scoreSpecs.includes(s));

                const activeCategories = [activePerf, activeContext, activeScore].filter(Boolean);

                // CASE: At least two are active - Calculation of Coeff
                if (activeCategories.length > 1) {
                    const getVal = (card: any, spec: string) => {
                        const limit = filters.matchLimit;
                        switch (spec) {
                            case 'Gacha':
                                if (limit === 10) return card.custom?.avgDeposits10 || 0;
                                if (limit === 20) return card.custom?.avgDeposits20 || 0;
                                if (limit === 30) return card.custom?.avgDeposits30 || 0;
                                return card.custom?.deposits || 0;
                            case 'Killer':
                                if (limit === 10) return card.custom?.avgEliminations10 || 0;
                                if (limit === 20) return card.custom?.avgEliminations20 || 0;
                                if (limit === 30) return card.custom?.avgEliminations30 || 0;
                                return card.custom?.eliminations || 0;
                            case 'Wart Rider':
                                if (limit === 10) return card.custom?.avgWartDistance10 || 0;
                                if (limit === 20) return card.custom?.avgWartDistance20 || 0;
                                if (limit === 30) return card.custom?.avgWartDistance30 || 0;
                                return card.custom?.wartDistance || 0;
                            case 'Winner':
                                if (limit === 10) return card.custom?.avgWinRate10 || 0;
                                if (limit === 20) return card.custom?.avgWinRate20 || 0;
                                if (limit === 30) return card.custom?.avgWinRate30 || 0;
                                return card.custom?.winRate || 0;
                            case 'Loser':
                                if (limit === 10) return 1 / (card.custom?.avgWinRate10 || 0.0001);
                                if (limit === 20) return 1 / (card.custom?.avgWinRate20 || 0.0001);
                                if (limit === 30) return 1 / (card.custom?.avgWinRate30 || 0.0001);
                                return 1 / (card.custom?.winRate || 0.0001);
                            case 'Bad Streak':
                                if (limit === 10) return (card.custom?.winRate || 0) - (card.custom?.avgWinRate10 || 0);
                                if (limit === 20) return (card.custom?.winRate || 0) - (card.custom?.avgWinRate20 || 0);
                                if (limit === 30) return (card.custom?.winRate || 0) - (card.custom?.avgWinRate30 || 0);
                                const streakPond = ((card.custom?.avgWinRate10 || 0) + (card.custom?.avgWinRate20 || 0) + (card.custom?.avgWinRate30 || 0)) / 3;
                                return (card.custom?.winRate || 0) - streakPond;
                            case 'Good Streak':
                                if (limit === 10) return (card.custom?.avgWinRate10 || 0) - (card.custom?.winRate || 0);
                                if (limit === 20) return (card.custom?.avgWinRate20 || 0) - (card.custom?.winRate || 0);
                                if (limit === 30) return (card.custom?.avgWinRate30 || 0) - (card.custom?.winRate || 0);
                                const goodStreakPond = ((card.custom?.avgWinRate10 || 0) + (card.custom?.avgWinRate20 || 0) + (card.custom?.avgWinRate30 || 0)) / 3;
                                return goodStreakPond - (card.custom?.winRate || 0);
                            case 'Score':
                                if (limit === 10) return card.custom?.avgScore10 || 0;
                                if (limit === 20) return card.custom?.avgScore20 || 0;
                                if (limit === 30) return card.custom?.avgScore30 || 0;
                                return card.custom?.score || 0;
                            default: return 0;
                        }
                    };

                    const calcCoeff = (card: any) => {
                        let coeff = 1;
                        activeCategories.forEach(spec => {
                            coeff *= getVal(card, spec!);
                        });
                        return coeff;
                    };

                    const coeffA = calcCoeff(a);
                    const coeffB = calcCoeff(b);
                    if (coeffB !== coeffA) return coeffB - coeffA;
                }

                // FALLBACK: Individual Sorting (if only one or coeff is same)
                const limit = filters.matchLimit;
                const getA = (spec: string, card: any) => {
                    switch (spec) {
                        case 'Gacha':
                            if (limit === 10) return card.custom?.avgDeposits10 || 0;
                            if (limit === 20) return card.custom?.avgDeposits20 || 0;
                            if (limit === 30) return card.custom?.avgDeposits30 || 0;
                            return card.custom?.deposits || 0;
                        case 'Killer':
                            if (limit === 10) return card.custom?.avgEliminations10 || 0;
                            if (limit === 20) return card.custom?.avgEliminations20 || 0;
                            if (limit === 30) return card.custom?.avgEliminations30 || 0;
                            return card.custom?.eliminations || 0;
                        case 'Wart Rider':
                            if (limit === 10) return card.custom?.avgWartDistance10 || 0;
                            if (limit === 20) return card.custom?.avgWartDistance20 || 0;
                            if (limit === 30) return card.custom?.avgWartDistance30 || 0;
                            return card.custom?.wartDistance || 0;
                        case 'Winner':
                            if (limit === 10) return card.custom?.avgWinRate10 || 0;
                            if (limit === 20) return card.custom?.avgWinRate20 || 0;
                            if (limit === 30) return card.custom?.avgWinRate30 || 0;
                            return card.custom?.winRate || 0;
                        case 'Loser':
                            if (limit === 10) return -(card.custom?.avgWinRate10 || 0);
                            if (limit === 20) return -(card.custom?.avgWinRate20 || 0);
                            if (limit === 30) return -(card.custom?.avgWinRate30 || 0);
                            return -(card.custom?.winRate || 0);
                        case 'Bad Streak':
                            if (limit === 10) return (card.custom?.winRate || 0) - (card.custom?.avgWinRate10 || 0);
                            if (limit === 20) return (card.custom?.winRate || 0) - (card.custom?.avgWinRate20 || 0);
                            if (limit === 30) return (card.custom?.winRate || 0) - (card.custom?.avgWinRate30 || 0);
                            const badStreakPond = ((card.custom?.avgWinRate10 || 0) + (card.custom?.avgWinRate20 || 0) + (card.custom?.avgWinRate30 || 0)) / 3;
                            return (card.custom?.winRate || 0) - badStreakPond;
                        case 'Good Streak':
                            if (limit === 10) return (card.custom?.avgWinRate10 || 0) - (card.custom?.winRate || 0);
                            if (limit === 20) return (card.custom?.avgWinRate20 || 0) - (card.custom?.winRate || 0);
                            if (limit === 30) return (card.custom?.avgWinRate30 || 0) - (card.custom?.winRate || 0);
                            const goodPondFallback = ((card.custom?.avgWinRate10 || 0) + (card.custom?.avgWinRate20 || 0) + (card.custom?.avgWinRate30 || 0)) / 3;
                            return goodPondFallback - (card.custom?.winRate || 0);
                        case 'Score':
                            if (limit === 10) return card.custom?.avgScore10 || 0;
                            if (limit === 20) return card.custom?.avgScore20 || 0;
                            if (limit === 30) return card.custom?.avgScore30 || 0;
                            return card.custom?.score || 0;
                        default: return 0;
                    }
                }

                for (let spec of activeSpecs) {
                    let diff = getA(spec, b) - getA(spec, a);
                    if (diff !== 0) return diff;
                }
            }

            // 2. Default Sort Option (Order by Menu)
            switch (sortOption) {
                case 'default': return 0;
                case 'name_asc': return a.name.localeCompare(b.name);
                case 'name_desc': return b.name.localeCompare(a.name);
                case 'rarity_desc': return getRarityValue(b.rarity) - getRarityValue(a.rarity);
                case 'rarity_asc': return getRarityValue(a.rarity) - getRarityValue(b.rarity);
                case 'stars_desc': return (b.custom?.stars || 0) - (a.custom?.stars || 0);
                case 'stars_asc': return (a.custom?.stars || 0) - (b.custom?.stars || 0);
                default: return 0;
            }
        });
};
