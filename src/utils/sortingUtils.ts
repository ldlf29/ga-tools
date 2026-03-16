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
                            case 'Gacha': {
                                let val = card.custom?.deposits || 0;
                                if (limit == 10) val = card.custom?.avgDeposits10 || 0;
                                if (limit == 20) val = card.custom?.avgDeposits20 || 0;
                                if (limit == 30) val = card.custom?.avgDeposits30 || 0;
                                return val - 4;
                            }
                            case 'Killer': {
                                let val = card.custom?.eliminations || 0;
                                if (limit == 10) val = card.custom?.avgEliminations10 || 0;
                                if (limit == 20) val = card.custom?.avgEliminations20 || 0;
                                if (limit == 30) val = card.custom?.avgEliminations30 || 0;
                                return (val - 1.25) / 0.75;
                            }
                            case 'Wart Rider': {
                                let val = card.custom?.wartDistance || 0;
                                if (limit == 10) val = card.custom?.avgWartDistance10 || 0;
                                if (limit == 20) val = card.custom?.avgWartDistance20 || 0;
                                if (limit == 30) val = card.custom?.avgWartDistance30 || 0;
                                return (val - 150) / 110;
                            }
                            case 'Winner': {
                                let winVal = card.custom?.winRate || 0;
                                if (limit == 10) winVal = card.custom?.avgWinRate10 || 0;
                                if (limit == 20) winVal = card.custom?.avgWinRate20 || 0;
                                if (limit == 30) winVal = card.custom?.avgWinRate30 || 0;
                                return ((winVal / 100) - 0.37) / 0.25;
                            }
                            case 'Loser': {
                                let lossVal = card.custom?.winRate || 0;
                                if (limit == 10) lossVal = card.custom?.avgWinRate10 || 0;
                                if (limit == 20) lossVal = card.custom?.avgWinRate20 || 0;
                                if (limit == 30) lossVal = card.custom?.avgWinRate30 || 0;
                                return ((lossVal / 100) - 0.37) / 0.25;
                            }
                            case 'Bad Streak': {
                                let global = card.custom?.winRate || 0;
                                let actual = global;
                                if (limit == 10) actual = card.custom?.avgWinRate10 || 0;
                                else if (limit == 20) actual = card.custom?.avgWinRate20 || 0;
                                else if (limit == 30) actual = card.custom?.avgWinRate30 || 0;
                                else {
                                    actual = ((card.custom?.avgWinRate10 || 0) + (card.custom?.avgWinRate20 || 0) + (card.custom?.avgWinRate30 || 0)) / 3;
                                }
                                const ratio = (global + 0.05) / (actual + 0.05);
                                return ratio - 1;
                            }
                            case 'Good Streak': {
                                let global = card.custom?.winRate || 0;
                                let actual = global;
                                if (limit == 10) actual = card.custom?.avgWinRate10 || 0;
                                else if (limit == 20) actual = card.custom?.avgWinRate20 || 0;
                                else if (limit == 30) actual = card.custom?.avgWinRate30 || 0;
                                else {
                                    actual = ((card.custom?.avgWinRate10 || 0) + (card.custom?.avgWinRate20 || 0) + (card.custom?.avgWinRate30 || 0)) / 3;
                                }
                                const ratio = (global + 0.05) / (actual + 0.05);
                                return 1 - ratio;
                            }
                            case 'Score': {
                                let val = card.custom?.score || 0;
                                if (limit == 10) val = card.custom?.avgScore10 || 0;
                                if (limit == 20) val = card.custom?.avgScore20 || 0;
                                if (limit == 30) val = card.custom?.avgScore30 || 0;
                                return (val - 300) / 100;
                            }
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
                    const isLoserActive = activeSpecs.includes('Loser');
                    if (coeffB !== coeffA) return isLoserActive ? coeffA - coeffB : coeffB - coeffA;
                }

                // FALLBACK: Individual Sorting (if only one or coeff is same)
                const limit = filters.matchLimit;
                const getA = (spec: string, card: any) => {
                    switch (spec) {
                        case 'Gacha': {
                            let val = card.custom?.deposits || 0;
                            if (limit == 10) val = card.custom?.avgDeposits10 || 0;
                            if (limit == 20) val = card.custom?.avgDeposits20 || 0;
                            if (limit == 30) val = card.custom?.avgDeposits30 || 0;
                            return val - 4;
                        }
                        case 'Killer': {
                            let val = card.custom?.eliminations || 0;
                            if (limit == 10) val = card.custom?.avgEliminations10 || 0;
                            if (limit == 20) val = card.custom?.avgEliminations20 || 0;
                            if (limit == 30) val = card.custom?.avgEliminations30 || 0;
                            return (val - 1.25) / 0.75;
                        }
                        case 'Wart Rider': {
                            let val = card.custom?.wartDistance || 0;
                            if (limit == 10) val = card.custom?.avgWartDistance10 || 0;
                            if (limit == 20) val = card.custom?.avgWartDistance20 || 0;
                            if (limit == 30) val = card.custom?.avgWartDistance30 || 0;
                            return (val - 150) / 110;
                        }
                        case 'Winner': {
                            let winVal = card.custom?.winRate || 0;
                            if (limit == 10) winVal = card.custom?.avgWinRate10 || 0;
                            if (limit == 20) winVal = card.custom?.avgWinRate20 || 0;
                            if (limit == 30) winVal = card.custom?.avgWinRate30 || 0;
                            return ((winVal / 100) - 0.37) / 0.25;
                        }
                        case 'Loser': {
                            let lossVal = card.custom?.winRate || 0;
                            if (limit == 10) lossVal = card.custom?.avgWinRate10 || 0;
                            if (limit == 20) lossVal = card.custom?.avgWinRate20 || 0;
                            if (limit == 30) lossVal = card.custom?.avgWinRate30 || 0;
                            return ((lossVal / 100) - 0.37) / 0.25;
                        }
                        case 'Bad Streak': {
                            let global = card.custom?.winRate || 0;
                            let actual = global;
                            if (limit == 10) actual = card.custom?.avgWinRate10 || 0;
                            else if (limit == 20) actual = card.custom?.avgWinRate20 || 0;
                            else if (limit == 30) actual = card.custom?.avgWinRate30 || 0;
                            else {
                                actual = ((card.custom?.avgWinRate10 || 0) + (card.custom?.avgWinRate20 || 0) + (card.custom?.avgWinRate30 || 0)) / 3;
                            }
                            const ratio = (global + 0.05) / (actual + 0.05);
                            return ratio - 1;
                        }
                        case 'Good Streak': {
                            let global = card.custom?.winRate || 0;
                            let actual = global;
                            if (limit == 10) actual = card.custom?.avgWinRate10 || 0;
                            else if (limit == 20) actual = card.custom?.avgWinRate20 || 0;
                            else if (limit == 30) actual = card.custom?.avgWinRate30 || 0;
                            else {
                                actual = ((card.custom?.avgWinRate10 || 0) + (card.custom?.avgWinRate20 || 0) + (card.custom?.avgWinRate30 || 0)) / 3;
                            }
                            const ratio = (global + 0.05) / (actual + 0.05);
                            return 1 - ratio;
                        }
                            const goodPondFallback = ((card.custom?.avgWinRate10 || 0) + (card.custom?.avgWinRate20 || 0) + (card.custom?.avgWinRate30 || 0)) / 3;
                            return goodPondFallback - (card.custom?.winRate || 0);
                        case 'Score': {
                            let val = card.custom?.score || 0;
                            if (limit == 10) val = card.custom?.avgScore10 || 0;
                            if (limit == 20) val = card.custom?.avgScore20 || 0;
                            if (limit == 30) val = card.custom?.avgScore30 || 0;
                            return (val - 300) / 100;
                        }
                        default: return 0;
                    }
                }

                for (let spec of activeSpecs) {
                    let diff = spec === 'Loser' ? getA(spec, a) - getA(spec, b) : getA(spec, b) - getA(spec, a);
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
