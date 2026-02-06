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

    // 4. Scheme Name Filter
    if (filters.schemeName.length > 0) {
        // Scheme Name filter should ALWAYS apply, regardless of mode
        if (!filters.schemeName.includes(card.name)) return false;
    }

    // 5. Custom Filters (Moki)
    // User Request: General filters (Rarity, Class, Fur, etc.) do NOT apply to Scheme cards IF we are in SCHEME Mode.
    // If we are in ALL Mode, we want general filters to APPLY (so if I filter "Rainbow", schemes - which aren't rainbow - hide).

    // Check if we are in strict Scheme mode
    const isSchemeMode = filters.cardType === 'SCHEME';

    if (card.cardType === 'SCHEME') {
        if (isSchemeMode) {
            return true; // Bypass all checks in Scheme Mode
        }
        // If not Scheme Mode (meaning ALL), fall through and let Rarity/Fur checks happen.
        // Most Schemes will fail these checks (e.g. no Fur), which is desired behavior for "ALL" mode filtering.
    }

    // --- EVERYTHING BELOW APPLIES ONLY TO MOKI CARDS ---

    // 1.5 Enforce Epic/Legendary Universe if "Only Epic/Legendary" is active
    if (filters.onlyEpicLegendary) {
        if (card.rarity !== 'Epic' && card.rarity !== 'Legendary') return false;
    }

    // 2. Rarity Filter (Moved here to exempt Schemes)
    if (filters.rarity.length > 0 && !filters.rarity.includes(card.rarity)) return false;


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

        const hasTrait = activeTraits.some(t =>
            card.custom.traits?.some(ct => {
                const regex = new RegExp(`\\b${t}\\b`, 'i');
                return regex.test(ct);
            })
        );
        if (!hasTrait) return false;
    }

    return true;
};
