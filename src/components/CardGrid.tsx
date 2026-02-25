'use client';

// ... imports
import { EnhancedCard, FilterState, SavedLineup } from '@/types';
import { getCardGroupKey, getCardCharacterImage } from '@/utils/cardService';
import styles from './CardGrid.module.css';
import NextImage from 'next/image';
import CardModal from './CardModal';
import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { List } from 'react-window';
import { AutoSizer as _AutoSizer, Size } from 'react-virtualized-auto-sizer';
import { getActiveFiltersDisplay } from '@/utils/filterDisplay';
const AutoSizer = _AutoSizer as any;

type SortOption = 'default' | 'name_asc' | 'name_desc' | 'rarity_desc' | 'rarity_asc' | 'stars_desc' | 'stars_asc';

// Interface for stacked display removed.

interface CardGridProps {
    cards: EnhancedCard[];
    onAddCard: (card: EnhancedCard) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    currentLineup: EnhancedCard[];
    savedLineups: SavedLineup[];
    filters: FilterState;
    onRemoveFilter: (key: keyof FilterState, value: string | number) => void;
    onRefresh?: () => Promise<void>;
    isUserMode?: boolean;
    userCardCount?: number;
    addToast?: (text: string, type: 'error' | 'success' | 'warning' | 'suggestion', force?: boolean) => void;
}

interface CardRowProps {
    cards: EnhancedCard[];
    itemsPerRow: number;
    colGap: number;
    viewMode: 'grid' | 'compact';
    onAddCard: (card: EnhancedCard) => void;
    setSelectedModalCard: (card: EnhancedCard | null) => void;
    currentLineup: EnhancedCard[];
    paddingX: number;
    isUserMode?: boolean;
}

// CardRow defined to accept props directly (merged rowProps)
const CardRow = ({ index, style, cards, itemsPerRow, colGap, viewMode, onAddCard, setSelectedModalCard, currentLineup, paddingX, isUserMode }: { index: number; style: CSSProperties } & CardRowProps) => {
    const startIndex = index * itemsPerRow;
    const rowCards = cards.slice(startIndex, startIndex + itemsPerRow);

    return (
        <div
            className={styles.cardRow}
            style={{
                ...style,
                display: 'grid',
                gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`,
                columnGap: `${colGap}px`,
                width: `calc(100% - ${paddingX}px)`,
                left: `${paddingX / 2}px`,
                height: (style.height as number),
                alignItems: 'flex-start',
                overflow: 'visible',
            }}
        >
            {rowCards.map((card, colIndex) => {
                const isInLineup = currentLineup.some(c => c.image === card.image);
                const isLocked = currentLineup.find(c => c.image === card.image)?.locked;
                const isOutOfStock = card.stackAvailable === 0;

                return (
                    <div
                        key={`${viewMode}-${card.name}-${card.id || index}-${colIndex}`}
                        className={viewMode === 'grid'
                            ? `${styles.cardItem} ${card.cardType === 'SCHEME' ? styles.scheme : (styles[card.rarity.toLowerCase()] || styles.basic)} ${isInLineup ? styles.inLineup : ''}`
                            : `${styles.compactCardItem} ${card.cardType === 'SCHEME' ? styles.compactScheme : (styles['compact' + (card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1).toLowerCase())] || styles.compactBasic)} ${isInLineup ? styles.inLineupCompact : ''}`
                        }
                        onClick={() => onAddCard(card)}
                    >
                        {viewMode === 'grid' ? (
                            <>
                                <div className={styles.imageWrapper}>
                                    <NextImage
                                        src={card.image}
                                        alt={card.name}
                                        fill
                                        sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 1400px) 33vw, 25vw"
                                        className={styles.cardImage}
                                        style={{ objectFit: 'cover' }}
                                        priority={index < 10}
                                    />
                                </div>

                                <div className={styles.cardInfo}>
                                    <div className={styles.cardHeader}>
                                        <span className={styles.cardName}>{card.name}</span>
                                    </div>
                                    <div className={styles.cardActions}>
                                        {card.custom.class && card.cardType !== 'SCHEME' && (
                                            <div className={styles.cardType}>{card.custom.class}</div>
                                        )}

                                        <button
                                            className={styles.infoButton}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setSelectedModalCard(card);
                                            }}
                                            title="View details"
                                            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {isUserMode && card.stackCount && (
                                    <div className={`${styles.stackBadge} ${card.stackAvailable === 0 ? styles.stackBadgeEmpty : ''}`}>
                                        {card.stackAvailable}/{card.stackCount}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className={styles.compactImageWrapper} style={{ position: 'relative', width: 60, height: 60, flexShrink: 0, marginRight: '1rem' }}>
                                    <NextImage
                                        src={getCardCharacterImage(card)}
                                        alt={card.name}
                                        width={60}
                                        height={60}
                                        className={styles.compactImage}
                                        style={{ objectFit: 'cover', borderRadius: '0.5rem' }}
                                        priority={index < 10}
                                    />
                                    {isUserMode && card.stackCount && (
                                        <div className={`${styles.compactStackBadge} ${card.stackAvailable === 0 ? styles.compactStackBadgeEmpty : ''}`}>
                                            {card.stackAvailable}/{card.stackCount}
                                        </div>
                                    )}
                                </div>
                                <div className={styles.compactInfo}>
                                    <div className={styles.compactName}>{card.name}</div>
                                    <div className={styles.compactSub}>
                                        {card.custom.stars > 0 && <span className={styles.compactStars}>{card.custom.stars} ★</span>}
                                        {card.custom.class && card.cardType !== 'SCHEME' && <span className={styles.compactClass}>{card.custom.class}</span>}
                                    </div>
                                </div>
                                <button
                                    className={styles.compactInfoButton}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedModalCard(card);
                                    }}
                                    title="View details"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="16" x2="12" y2="12"></line>
                                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                    </svg>
                                </button>
                                <div className={styles.compactRarityLabel}>{card.rarity}</div>
                            </>
                        )}
                        {isInLineup && (
                            <div className={`${styles.selectedOverlay} ${isLocked ? styles.lockedOverlay : ''}`}>
                                <div className={`${styles.selectedIcon} ${isLocked ? styles.lockedIcon : ''}`}>
                                    {isLocked ? (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                        </svg>
                                    ) : (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ... types imported
// ...
export default function CardGrid({
    cards,
    onAddCard,
    searchQuery,
    onSearchChange,
    currentLineup,
    savedLineups,
    filters,
    onRemoveFilter,
    onRefresh,
    isUserMode,
    userCardCount,
    addToast
}: CardGridProps) {
    const [mokiSortOption, setMokiSortOption] = useState<SortOption>('default');
    const [schemeSortOption, setSchemeSortOption] = useState<SortOption>('default');

    const sortOption = filters.cardType === 'SCHEME' ? schemeSortOption : mokiSortOption;

    const handleSortChange = (option: SortOption) => {
        if (filters.cardType === 'SCHEME') {
            setSchemeSortOption(option);
        } else {
            setMokiSortOption(option);
        }
        setDropdownOpen(false);
    };

    const [selectedModalCard, setSelectedModalCard] = useState<EnhancedCard | null>(null);
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
            // Fallback (omitted for brevity, assume same logic as before or use refactor)
            const defaultList: { key: keyof FilterState, label: string, value: string | number, displayValue?: string }[] = [
                ...filters.rarity.map(v => ({ key: 'rarity' as keyof FilterState, label: 'RARITY', value: v })),
                ...filters.schemeName.map(v => ({ key: 'schemeName' as keyof FilterState, label: 'SCHEME', value: v })),
                ...filters.fur.map(v => ({ key: 'fur' as keyof FilterState, label: 'FUR', value: v })),
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
            ].filter(f => f);
            return defaultList;
        }

        return filters.insertionOrder.map(orderKey => {
            if (orderKey === 'stars:ACTIVE') {
                if (filters.stars.length === 0) return null;
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
            const isNumeric = ['stars'].includes(key);
            const value: string | number = isNumeric ? parseInt(valStr) : valStr;

            let label = key.toUpperCase();
            if (key === 'schemeName') label = 'SCHEME';
            if (key === 'customClass') label = 'CLASS';
            if (key === 'traits') label = 'TRAIT';

            return { key, label, value };
        }).filter(f => f !== null) as { key: keyof FilterState, label: string, value: string | number, displayValue?: string }[];
    })();

    // Sorting Logic
    const getRarityValue = (rarity: string) => {
        switch (rarity.toLowerCase()) {
            case 'legendary': return 4;
            case 'epic': return 3;
            case 'rare': return 2;
            case 'common': case 'basic': return 1;
            case 'scheme': return 0;
            default: return 0;
        }
    };

    const sortedCards = useMemo(() => {
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
                    const contextSpecs = ["Winner", "Loser", "Score"];

                    const activePerf = activeSpecs.find(s => perfSpecs.includes(s));
                    const activeContext = activeSpecs.find(s => contextSpecs.includes(s));

                    // CASE: Both are active - Calculation of Coeff
                    if (activePerf && activeContext) {
                        const getVal = (card: any, spec: string) => {
                            const useLast10 = filters.useLast10Matches;
                            switch (spec) {
                                case 'Gacha': return useLast10 ? (card.custom?.avgDeposits || 0) : (card.custom?.deposits || 0);
                                case 'Killer': return useLast10 ? (card.custom?.avgEliminations || 0) : (card.custom?.eliminations || 0);
                                case 'Wart Rider': return useLast10 ? (card.custom?.avgWartDistance || 0) : (card.custom?.wartDistance || 0);
                                case 'Winner': return useLast10 ? (card.custom?.avgWinRate || 0) : (card.custom?.winRate || 0);
                                case 'Loser': return 1 / (useLast10 ? (card.custom?.avgWinRate || 0.0001) : (card.custom?.winRate || 0.0001));
                                case 'Score': return useLast10 ? (card.custom?.avgScore || 0) : (card.custom?.score || 0);
                                default: return 0;
                            }
                        };

                        const coeffA = getVal(a, activePerf) * getVal(a, activeContext);
                        const coeffB = getVal(b, activePerf) * getVal(b, activeContext);
                        if (coeffB !== coeffA) return coeffB - coeffA;
                    }

                    // FALLBACK: Individual Sorting (if only one or coeff is same)
                    const useLast10 = filters.useLast10Matches;
                    for (let spec of activeSpecs) {
                        let diff = 0;
                        switch (spec) {
                            case 'Gacha':
                                diff = (useLast10 ? (b.custom?.avgDeposits || 0) : (b.custom?.deposits || 0)) - (useLast10 ? (a.custom?.avgDeposits || 0) : (a.custom?.deposits || 0));
                                break;
                            case 'Killer':
                                diff = (useLast10 ? (b.custom?.avgEliminations || 0) : (b.custom?.eliminations || 0)) - (useLast10 ? (a.custom?.avgEliminations || 0) : (a.custom?.eliminations || 0));
                                break;
                            case 'Wart Rider':
                                diff = (useLast10 ? (b.custom?.avgWartDistance || 0) : (b.custom?.wartDistance || 0)) - (useLast10 ? (a.custom?.avgWartDistance || 0) : (a.custom?.wartDistance || 0));
                                break;
                            case 'Winner':
                                diff = (useLast10 ? (b.custom?.avgWinRate || 0) : (b.custom?.winRate || 0)) - (useLast10 ? (a.custom?.avgWinRate || 0) : (a.custom?.winRate || 0));
                                break;
                            case 'Loser':
                                diff = (useLast10 ? (a.custom?.avgWinRate || 0) : (a.custom?.winRate || 0)) - (useLast10 ? (b.custom?.avgWinRate || 0) : (b.custom?.winRate || 0));
                                break;
                            case 'Score':
                                diff = (useLast10 ? (b.custom?.avgScore || 0) : (b.custom?.score || 0)) - (useLast10 ? (a.custom?.avgScore || 0) : (a.custom?.score || 0));
                                break;
                        }
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
    }, [cards, sortOption]);

    const displayedCards = useMemo(() => {
        if (!isUserMode) return sortedCards;

        const groups = new Map<string, EnhancedCard>();

        sortedCards.forEach(card => {
            const key = card.image;
            if (!groups.has(key)) {
                groups.set(key, {
                    ...card,
                    stackCount: 1,
                    stackedIds: [card.id]
                });
            } else {
                const existing = groups.get(key)!;
                existing.stackCount = (existing.stackCount || 0) + 1;
                existing.stackedIds = [...(existing.stackedIds || []), card.id];
            }
        });

        return Array.from(groups.values()).map(cardStack => {
            const usedInCurrent = currentLineup.filter(c => c.image === cardStack.image).length;
            const usedInSaved = savedLineups.reduce((total, sl) => {
                return total + (sl.cards ? sl.cards.filter(c => c.image === cardStack.image).length : 0);
            }, 0);

            const totalUsed = usedInCurrent + usedInSaved;

            return {
                ...cardStack,
                stackAvailable: Math.max(0, (cardStack.stackCount || 1) - totalUsed)
            };
        });
    }, [sortedCards, currentLineup, savedLineups, isUserMode]);

    return (
        <div className={styles.gridContainer}>

            <div className={styles.headerContainer}>
                {/* ... Header contents (Title, Refresh, Order, Search, Toggles) ... */}
                <div className={styles.headerTopRow}>
                    <div className={styles.titleGroup}>
                        <h2 className={styles.resultsTitle}>
                            {filters.cardType === 'MOKI' ? 'MOKIS' : filters.cardType === 'SCHEME' ? 'SCHEME' : 'ALL CARDS'}
                            {isUserMode && (
                                <span style={{ fontSize: '0.8em', marginLeft: '8px' }}>
                                    ({displayedCards.reduce((acc, card) => acc + (card.stackCount || 1), 0)})
                                </span>
                            )}
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

                    <div className={styles.headerRight}>
                        <div className={styles.orderByContainer}>
                            <button
                                className={styles.orderByButton}
                                onClick={() => {
                                    if (filters.specialization && filters.specialization.length > 0) {
                                        if (addToast) addToast("Sorting is controlled by Specialization filter", 'suggestion');
                                        return;
                                    }
                                    setDropdownOpen(!dropdownOpen);
                                }}
                                style={{
                                    opacity: (filters.specialization && filters.specialization.length > 0) ? 0.7 : 1,
                                    cursor: (filters.specialization && filters.specialization.length > 0) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {(filters.specialization && filters.specialization.length > 0) ? `BY ${filters.specialization[0].toUpperCase()}` : 'ORDER BY...'}
                                {!(filters.specialization && filters.specialization.length > 0) && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                )}
                            </button>
                            {dropdownOpen && (!filters.specialization || filters.specialization.length === 0) && (
                                <ul className={styles.orderByMenu}>
                                    <li onClick={() => handleSortChange('default')} className={sortOption === 'default' ? styles.activeSort : ''}>Default</li>
                                    <li onClick={() => handleSortChange('name_asc')} className={sortOption === 'name_asc' ? styles.activeSort : ''}>Name A → Z</li>
                                    <li onClick={() => handleSortChange('name_desc')} className={sortOption === 'name_desc' ? styles.activeSort : ''}>Name Z → A</li>
                                    {filters.cardType !== 'SCHEME' && (
                                        <>
                                            <li onClick={() => handleSortChange('rarity_desc')} className={sortOption === 'rarity_desc' ? styles.activeSort : ''}>Rarity High → Low</li>
                                            <li onClick={() => handleSortChange('rarity_asc')} className={sortOption === 'rarity_asc' ? styles.activeSort : ''}>Rarity Low → High</li>
                                            <li onClick={() => handleSortChange('stars_desc')} className={sortOption === 'stars_desc' ? styles.activeSort : ''}>Stars High → Low</li>
                                            <li onClick={() => handleSortChange('stars_asc')} className={sortOption === 'stars_asc' ? styles.activeSort : ''}>Stars Low → High</li>
                                        </>
                                    )}
                                </ul>
                            )}
                        </div>

                        <input
                            type="text"
                            placeholder="Search card name..."
                            className={`${styles.searchInput} ${styles.desktopSearch}`}
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
                                    <line x1="8" y1="6" x2="21" y2="6"></line>
                                    <line x1="8" y1="12" x2="21" y2="12"></line>
                                    <line x1="8" y1="18" x2="21" y2="18"></line>
                                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className={styles.searchRow}>
                    <input
                        type="text"
                        placeholder="Search card name..."
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
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

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {sortedCards.length === 0 ? (
                    <div className={styles.noResults}>No cards found matching your filters.</div>
                ) : (
                    <AutoSizer
                        renderProp={({ height, width }: { height: number | undefined; width: number | undefined }) => {
                            const w = width || 0;
                            let itemsPerRow = 4;
                            if (viewMode === 'grid') {
                                if (w < 600) itemsPerRow = 3;
                                else if (w < 1200) itemsPerRow = 4;
                                else itemsPerRow = 5;
                            } else {
                                if (w < 768) itemsPerRow = 1;
                                else itemsPerRow = 2;
                            }

                            // Horizontal padding must match headerContainer padding (16px mobile, 24px desktop)
                            const paddingX = w < 600 ? 32 : 48;
                            const availableWidth = w - paddingX;
                            const colGap = w < 600 ? 8 : 16;
                            const rowGap = 2;
                            const colWidth = Math.max(0, (availableWidth - (colGap * (itemsPerRow - 1))) / itemsPerRow);

                            const rowHeight = viewMode === 'grid'
                                ? (colWidth * (4 / 3)) + 34
                                : 84;

                            const rowCount = Math.ceil(displayedCards.length / itemsPerRow);

                            return (
                                <List<CardRowProps>
                                    style={{
                                        height: height || 0,
                                        width: w,
                                        overflowX: 'visible',
                                        overflowY: 'auto',
                                    }}
                                    rowCount={rowCount}
                                    rowHeight={rowHeight + rowGap}
                                    rowProps={{
                                        cards: displayedCards,
                                        onAddCard,
                                        itemsPerRow,
                                        colGap,
                                        viewMode,
                                        setSelectedModalCard,
                                        currentLineup,
                                        paddingX,
                                        isUserMode
                                    }}
                                    rowComponent={CardRow}
                                    overscanCount={2}
                                />
                            );
                        }}
                    />
                )}
            </div>

            <CardModal
                card={selectedModalCard}
                onClose={() => setSelectedModalCard(null)}
                useLast10Matches={filters.useLast10Matches}
            />
        </div>
    );
}
