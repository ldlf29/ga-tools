'use client';

import { EnhancedCard, getCardGroupKey } from '@/utils/cardService';
import styles from './CardGrid.module.css';

import { FilterState } from './FilterSidebar';
import { useState, useEffect } from 'react';

type SortOption = 'default' | 'name_asc' | 'name_desc' | 'rarity_desc' | 'rarity_asc' | 'stars_desc' | 'stars_asc';

interface CardGridProps {
    cards: EnhancedCard[];
    onAddCard: (card: EnhancedCard) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    currentLineup: EnhancedCard[];
    filters: FilterState;
    onRemoveFilter: (key: keyof FilterState, value: string | number) => void;
    onRefresh?: () => Promise<void>;
}

export default function CardGrid({ cards, onAddCard, searchQuery, onSearchChange, currentLineup, filters, onRemoveFilter, onRefresh }: CardGridProps) {
    const [sortOption, setSortOption] = useState<SortOption>('default');
    const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        if (!onRefresh || isRefreshing) return;
        setIsRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setIsRefreshing(false);
        }
    };

    // Click outside to close menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (dropdownOpen && !target.closest(`.${styles.orderByContainer}`)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    // Helper to extract active filters for display
    const activeFilters = (() => {
        if (!filters.insertionOrder || filters.insertionOrder.length === 0) {
            // Fallback for when insertionOrder is missing (e.g. init state) or empty
            const defaultList: { key: keyof FilterState, label: string, value: string | number, displayValue?: string }[] = [
                ...filters.rarity.map(v => ({ key: 'rarity' as keyof FilterState, label: 'RARITY', value: v })),
                ...filters.schemeName.map(v => ({ key: 'schemeName' as keyof FilterState, label: 'SCHEME', value: v })),
                ...filters.fur.map(v => ({ key: 'fur' as keyof FilterState, label: 'FUR', value: v })),
                // Combined Stars Logic for Fallback
                ...(filters.stars.length > 0 ? [{
                    key: 'stars' as keyof FilterState,
                    label: 'STARS',
                    value: 'ACTIVE',
                    displayValue: filters.stars.length > 0
                        ? (Math.min(...filters.stars) === Math.max(...filters.stars)
                            ? `${Math.min(...filters.stars)}`
                            : `${Math.min(...filters.stars)} - ${Math.max(...filters.stars)}`)
                        : ''
                }] : []),
                ...filters.customClass.map(v => ({ key: 'customClass' as keyof FilterState, label: 'CLASS', value: v })),
                ...filters.traits.map(v => ({ key: 'traits' as keyof FilterState, label: 'TRAIT', value: v })),
            ].filter(f => {
                if (filters.onlyEpicLegendary && f.key === 'rarity' && (f.value === 'Epic' || f.value === 'Legendary')) return false;
                return true;
            });
            return defaultList;
        }

        return filters.insertionOrder.map(orderKey => {
            // Special handling for Stars group
            if (orderKey === 'stars:ACTIVE') {
                if (filters.stars.length === 0) return null; // Should not happen if in order, but safe check
                const min = Math.min(...filters.stars);
                const max = Math.max(...filters.stars);
                return {
                    key: 'stars' as keyof FilterState,
                    label: 'STARS',
                    value: 'ACTIVE',
                    displayValue: min === max ? `${min}` : `${min} - ${max}`
                };
            }

            const [group, valStr] = orderKey.split(':');
            const key = group as keyof FilterState;
            // numeric conversion check
            const isNumeric = ['stars'].includes(key); // Should not really hit stars here anymore with new logic
            const value: string | number = isNumeric ? parseInt(valStr) : valStr;

            let label = key.toUpperCase();
            if (key === 'schemeName') label = 'SCHEME';
            if (key === 'customClass') label = 'CLASS';
            if (key === 'traits') label = 'TRAIT';

            return {
                key,
                label,
                value,
            };
        }).filter(f => {
            if (!f) return false;
            if (filters.onlyEpicLegendary && f.key === 'rarity' && (f.value === 'Epic' || f.value === 'Legendary')) return false;
            return true;
        }) as { key: keyof FilterState, label: string, value: string | number, displayValue?: string }[];
    })();

    // Grouping logic (Unique ID: Name + Rarity + Category + Series)
    const groupCards = (rawCards: EnhancedCard[]) => {
        const map = new Map<string, { card: EnhancedCard, count: number }>();

        rawCards.forEach(card => {
            const key = getCardGroupKey(card);
            if (map.has(key)) {
                map.get(key)!.count++;
            } else {
                map.set(key, { card, count: 1 });
            }
        });
        return Array.from(map.values());
    };

    // Sorting Logic
    const getRarityValue = (rarity: string) => {
        switch (rarity.toLowerCase()) {
            case 'legendary': return 4;
            case 'epic': return 3;
            case 'rare': return 2;
            case 'common': case 'basic': return 1;
            case 'scheme': return 0; // Or treat differently? Usually Scheme irrelevant for rarity sort or low
            default: return 0;
        }
    };

    const sortedCards = [...cards].sort((a, b) => {
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


    return (
        <div className={styles.gridContainer}>

            <div className={styles.headerContainer}>
                <div className={styles.headerTopRow}>
                    <div className={styles.titleGroup}>
                        <h2 className={styles.resultsTitle}>
                            {filters.cardType === 'MOKI' ? 'MOKI' : filters.cardType === 'SCHEME' ? 'SCHEME' : 'ALL CARDS'} ({cards.length})
                        </h2>
                        {onRefresh && (
                            <button
                                onClick={handleRefresh}
                                className={`${styles.refreshButton} ${isRefreshing ? styles.spinning : ''}`}
                                title="Refresh Collection"
                                disabled={isRefreshing}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="23 4 23 10 17 10"></polyline>
                                    <polyline points="1 20 1 14 7 14"></polyline>
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                </svg>
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div className={styles.orderByContainer}>
                            <button
                                className={styles.orderByButton}
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                            >
                                ORDER BY...
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            {dropdownOpen && (
                                <ul className={styles.orderByMenu}>
                                    <li onClick={() => { setSortOption('default'); setDropdownOpen(false); }} className={sortOption === 'default' ? styles.activeSort : ''}>Default</li>
                                    <li onClick={() => { setSortOption('name_asc'); setDropdownOpen(false); }} className={sortOption === 'name_asc' ? styles.activeSort : ''}>Name A → Z</li>
                                    <li onClick={() => { setSortOption('name_desc'); setDropdownOpen(false); }} className={sortOption === 'name_desc' ? styles.activeSort : ''}>Name Z → A</li>
                                    <li onClick={() => { setSortOption('rarity_desc'); setDropdownOpen(false); }} className={sortOption === 'rarity_desc' ? styles.activeSort : ''}>Rarity High → Low</li>
                                    <li onClick={() => { setSortOption('rarity_asc'); setDropdownOpen(false); }} className={sortOption === 'rarity_asc' ? styles.activeSort : ''}>Rarity Low → High</li>
                                    <li onClick={() => { setSortOption('stars_desc'); setDropdownOpen(false); }} className={sortOption === 'stars_desc' ? styles.activeSort : ''}>Stars High → Low</li>
                                    <li onClick={() => { setSortOption('stars_asc'); setDropdownOpen(false); }} className={sortOption === 'stars_asc' ? styles.activeSort : ''}>Stars Low → High</li>
                                </ul>
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="Search card name..."
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                        <div className={styles.viewToggle}>
                            <button
                                className={`${styles.toggleIcon} ${viewMode === 'grid' ? styles.toggleActive : ''}`}
                                onClick={() => setViewMode('grid')}
                                title="Gallery View"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="14" width="7" height="7"></rect>
                                    <rect x="3" y="14" width="7" height="7"></rect>
                                </svg>
                            </button>
                            <button
                                className={`${styles.toggleIcon} ${viewMode === 'compact' ? styles.toggleActive : ''}`}
                                onClick={() => setViewMode('compact')}
                                title="Compact View"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="3" y1="6" x2="21" y2="6"></line>
                                    <line x1="3" y1="12" x2="21" y2="12"></line>
                                    <line x1="3" y1="18" x2="21" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {activeFilters.length > 0 && (
                    <div className={styles.activeFilters}>
                        {activeFilters.map((f, i) => (
                            <div key={`${f.key}-${f.value}-${i}`} className={styles.filterChip}>
                                <span className={styles.filterLabel}>{f.label}: </span>
                                <span className={styles.filterValue}>
                                    {f.displayValue || f.value}
                                </span>
                                <button
                                    onClick={() => onRemoveFilter(f.key, f.value)}
                                    className={styles.removeFilterButton}
                                >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className={viewMode === 'grid' ? styles.grid : styles.compactGrid}>
                {sortedCards.length === 0 ? (
                    <div className={styles.noResults}>No cards found matching your filters.</div>
                ) : sortedCards.map((card, idx) => (
                    <div
                        key={`${card.name}-${card.rarity}-${card.category || 'Standard'}-${card.custom?.series || 'None'}-${idx}`}
                        className={viewMode === 'grid'
                            ? `${styles.cardItem} ${card.cardType === 'SCHEME' ? styles.scheme : (styles[card.rarity.toLowerCase()] || styles.basic)}`
                            : `${styles.compactCardItem} ${card.cardType === 'SCHEME' ? styles.compactScheme : (styles['compact' + (card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1).toLowerCase())] || styles.compactBasic)}`
                        }
                        onClick={() => onAddCard(card)}
                    >
                        {viewMode === 'grid' ? (
                            <>
                                <div className={styles.imageWrapper}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={card.image} alt={card.name} className={styles.cardImage} />
                                </div>

                                <div className={styles.cardInfo}>
                                    <div className={styles.cardHeader}>
                                        <span className={styles.cardName}>{card.name}</span>
                                    </div>
                                    {card.custom.class && (
                                        <div className={styles.cardType}>{card.custom.class}</div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <img src={card.custom.characterImage || card.image} alt={card.name} className={styles.compactImage} />
                                <div className={styles.compactInfo}>
                                    <div className={styles.compactName}>{card.name}</div>
                                    <div className={styles.compactSub}>
                                        {card.custom.stars > 0 && <span className={styles.compactStars}>{card.custom.stars} ★</span>}
                                        {card.custom.class && <span className={styles.compactClass}>{card.custom.class}</span>}
                                    </div>
                                </div>
                                <div className={styles.compactRarityLabel}>{card.rarity}</div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div >
    );
}
