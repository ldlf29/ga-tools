import { EnhancedCard, FilterState, TRAIT_GROUPS } from '@/types';

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

    // 1. Card Type Filter (always applied)
    if (card.cardType !== filters.cardType) return false;

    // 4. Scheme Name Filter
    if (filters.schemeName.length > 0) {
        // Scheme Name filter should ALWAYS apply, regardless of mode
        if (!filters.schemeName.includes(card.name)) return false;
    }

    // 5. Custom Filters (Moki)
    // General filters (Rarity, Class, Fur, etc.) do NOT apply to Scheme cards when in SCHEME mode.

    // Check if we are in Scheme mode
    const isSchemeMode = filters.cardType === 'SCHEME';

    if (card.cardType === 'SCHEME') {
        if (isSchemeMode) {
            return true; // Bypass all Moki-specific checks in Scheme Mode
        }
        // In MOKI mode, Scheme cards are filtered out by the Card Type Filter (line 19)
    }

    // --- EVERYTHING BELOW APPLIES ONLY TO MOKI CARDS ---

    // 2. Rarity Filter
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
    // SPECIALIZATION (Sorting + Threshold Filtering)
    if (filters.specialization.length > 0) {
        const limit = filters.matchLimit;

        for (const spec of filters.specialization) {
            if (spec === 'Gacha') {
                if (card.custom.class === 'Defender' || card.custom.class === 'Bruiser') return false;
                let val = card.custom.deposits || 0;
                if (limit === 10) val = card.custom.avgDeposits10 || 0;
                if (limit === 20) val = card.custom.avgDeposits20 || 0;
                if (limit === 30) val = card.custom.avgDeposits30 || 0;
                if (val <= 4) return false;
            } else if (spec === 'Killer') {
                if (card.custom.class === 'Striker' || card.custom.class === 'Defender') return false;
                let val = card.custom.eliminations || 0;
                if (limit === 10) val = card.custom.avgEliminations10 || 0;
                if (limit === 20) val = card.custom.avgEliminations20 || 0;
                if (limit === 30) val = card.custom.avgEliminations30 || 0;
                if (val <= 1.25) return false;
            } else if (spec === 'Wart Rider') {
                if (card.custom.class === 'Striker' || card.custom.class === 'Bruiser') return false;
                let val = card.custom.wartDistance || 0;
                if (limit === 10) val = card.custom.avgWartDistance10 || 0;
                if (limit === 20) val = card.custom.avgWartDistance20 || 0;
                if (limit === 30) val = card.custom.avgWartDistance30 || 0;
                if (val <= 150) return false;
            }
        }
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
                const isTargetOnesie = t.toLowerCase() === 'onesie';
                const isActualOnesie = ct.toLowerCase().includes('onesie');

                const regex = new RegExp(`\\b${t}\\b`, 'i');
                const matches = regex.test(ct);

                // If it matches but we're looking for a name (like Kappa) 
                // and the physical trait is an Onesie, we skip to avoid false positive.
                if (matches && !isTargetOnesie && isActualOnesie) {
                    return false;
                }
                return matches;
            })
        );
        if (!hasTrait) return false;
    }

    return true;
};
