import { EnhancedCard } from './cardService';
import { FilterState, TRAIT_GROUPS } from '@/components/FilterSidebar';

/**
 * Checks if a card matches the given filter criteria and search query.
 */
export const matchesFilter = (
    card: EnhancedCard,
    filters: FilterState,
    searchQuery: string = ''
): boolean => {
    // 0. Search Query (Name Match)
    if (searchQuery.length > 0) {
        const query = searchQuery.trim().toLowerCase();
        const cardName = card.name.trim().toLowerCase();
        if (!cardName.includes(query)) return false;
    }

    // 1. Card Type Filter
    if (filters.cardType !== 'ALL') {
        if (card.cardType !== filters.cardType) return false;
    }

    // 2. Rarity Filter
    if (filters.rarity.length > 0 && !filters.rarity.includes(card.rarity)) return false;

    // 3. Category Filter
    if (filters.category.length > 0) {
        if (!card.category || !filters.category.includes(card.category)) return false;
    }

    // 4. Scheme Name Filter
    if (filters.schemeName.length > 0) {
        if (!filters.schemeName.includes(card.name)) return false;
    }

    // 5. Custom Filters (Moki)
    if (filters.cardType !== 'SCHEME') {
        // FUR
        if (filters.fur.length > 0) {
            if (!card.custom.fur || !filters.fur.includes(card.custom.fur)) return false;
        }
        // STARS
        if (filters.stars.length > 0) {
            if (!filters.stars.includes(card.custom.stars)) return false;
        }
        // CLASS (Custom)
        if (filters.customClass.length > 0) {
            if (!card.custom.class || !filters.customClass.includes(card.custom.class)) return false;
        }
        // SPECIALIZATION
        if (filters.specialization.length > 0) {
            const hasSpec = filters.specialization.some(spec => {
                switch (spec) {
                    case 'Gacha':
                        return (card.custom.deposits ?? 0) >= 4.75;
                    case 'Killer':
                        return (card.custom.eliminations ?? 0) >= 1.50;
                    case 'Wart Rider':
                        return (card.custom.wartDistance ?? 0) >= 170;
                    case 'Winner':
                        return (card.custom.winRate ?? 0) >= 53.5;
                    case 'Loser':
                        // Note: User specified "menorigual" (<= 47.50)
                        // Make sure to handle null winRate as failing the check? 
                        // If winRate is null (0), 0 <= 47.5 is true. 
                        // Should we exclude cards with NO winRate data from "Loser"?
                        // Probably yes. (card.custom.winRate !== undefined && card.custom.winRate <= 47.5)
                        if (card.custom.winRate === undefined || card.custom.winRate === null) return false;
                        return card.custom.winRate <= 47.5;
                    default:
                        return false;
                }
            });
            if (!hasSpec) return false;
        }
        // TRAITS
        if (filters.traits.length > 0) {
            if (!card.custom.traits) return false;

            const activeTraits = filters.traits.flatMap(label => {
                const group = TRAIT_GROUPS.find(g => g.label === label);
                return group ? group.traits : [];
            });

            const hasTrait = activeTraits.some(t => card.custom.traits?.includes(t));
            if (!hasTrait) return false;
        }
        // SERIES
        if (filters.series.length > 0) {
            if (!card.custom.series) return false;
            // Logic: Check if card series explicitly matches selected Series Option or starts with it (for groupings)
            // Options: "Long Moki", "Moki Parts", "Moki Madness", "Ice Cream", "Stickers", "Manga Stickers"
            const cardSeries = card.custom.series;
            const hasMatch = filters.series.some(filterOpt => {
                // Exact Matches / Grouping Logic - Based on User Provided Metadata

                if (filterOpt === "Long Moki") {
                    // "Long Moki (A, B...)" -> startsWith "Long Moki"
                    return cardSeries.startsWith("Long Moki");
                }

                if (filterOpt === "Moki Parts") {
                    // Exact List: Moki Parts, Middle Finger A, Middle Finger B, Peace, Wart Frame
                    const values = ["Moki Parts", "Middle Finger A", "Middle Finger B", "Peace", "Wart Frame"];
                    return values.includes(cardSeries);
                }

                if (filterOpt === "Moki Madness") {
                    // Exact List: Dune, Moki Lick, Lemon Grab
                    const values = ["Dune", "Moki Lick", "Lemon Grab"];
                    return values.includes(cardSeries);
                }

                if (filterOpt === "Ice Cream") {
                    // Exact List: Ice Cream Chocolate, Ice Cream Gold, Ice Cream Rainbow
                    // startsWith("Ice Cream") covers all and is safe
                    return cardSeries.startsWith("Ice Cream");
                }

                if (filterOpt === "Stickers") {
                    // "Stickers (A, B...)" -> startsWith "Stickers"
                    // Also handle singular "Sticker" if data varies
                    // Exclude "Manga Stickers"
                    return (cardSeries.startsWith("Stickers") || cardSeries.startsWith("Sticker")) && !cardSeries.startsWith("Manga");
                }

                if (filterOpt === "Manga Stickers") {
                    // "Manga Stickers (A, B...)"
                    return cardSeries.startsWith("Manga Stickers") || cardSeries.startsWith("Manga Sticker");
                }

                // Border Series
                if (filterOpt === "Random") {
                    return cardSeries.startsWith("Random");
                }
                if (filterOpt === "Doodle") {
                    return cardSeries.startsWith("Doodle");
                }
                if (filterOpt === "Loopy Lines") {
                    return cardSeries.startsWith("Loopy Lines");
                }
                if (filterOpt === "Soft Noise") {
                    return cardSeries.startsWith("Soft Noise");
                }

                if (filterOpt === "Soft Noise") {
                    return cardSeries.startsWith("Soft Noise");
                }

                // Full Art Series
                if (filterOpt === "Presale Promo") {
                    return cardSeries.startsWith("Presale Promo");
                }
                if (filterOpt === "Eggu Island") {
                    return cardSeries.startsWith("Eggu Island");
                }
                if (filterOpt === "Milky Way") {
                    return cardSeries.startsWith("Milky Way");
                }
                if (filterOpt === "Chibi Kawaii") {
                    return cardSeries.startsWith("Chibi Kawaii");
                }
                if (filterOpt === "Katai Beddo") {
                    return cardSeries.startsWith("Katai Beddo");
                }
                if (filterOpt === "Fruity") {
                    return cardSeries.startsWith("Fruity");
                }
                if (filterOpt === "Hatching Field") {
                    return cardSeries.startsWith("Hatching Field");
                }
                if (filterOpt === "1-of-1") {
                    return cardSeries.startsWith("1-of-1");
                }

                // Default fallback
                return cardSeries === filterOpt;
            });

            if (!hasMatch) return false;
        }
    }

    return true;
};
