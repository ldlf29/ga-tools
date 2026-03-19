'use client';

// ... imports
import { EnhancedCard, FilterState, SavedLineup } from '@/types';
import { getCardCharacterImage } from '@/utils/cardService';
import styles from './CardGrid.module.css';
import NextImage from 'next/image';
import CardModal from './CardModal';
import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { List } from 'react-window';
import { AutoSizer as _AutoSizer } from 'react-virtualized-auto-sizer';
import { getActiveFiltersDisplay } from '@/utils/filterDisplay';
import { SortOption, sortCardsByFilters } from '@/utils/sortingUtils';
// Type workaround: react-virtualized-auto-sizer v2 has mismatched types
const AutoSizer = _AutoSizer as any; // eslint-disable-line @typescript-eslint/no-explicit-any

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
  addToast?: (
    text: string,
    type: 'error' | 'success' | 'warning' | 'suggestion',
    force?: boolean
  ) => void;
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
const CardRow = ({
  index,
  style,
  cards,
  itemsPerRow,
  colGap,
  viewMode,
  onAddCard,
  setSelectedModalCard,
  currentLineup,
  paddingX,
  isUserMode,
}: { index: number; style: CSSProperties } & CardRowProps) => {
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
        height: style.height as number,
        alignItems: 'flex-start',
        overflow: 'visible',
      }}
    >
      {rowCards.map((card, colIndex) => {
        const isInLineup = currentLineup.some((c) => c.image === card.image);
        const isLocked = currentLineup.find(
          (c) => c.image === card.image
        )?.locked;

        return (
          <div
            key={`${viewMode}-${card.name}-${card.id || index}-${colIndex}`}
            className={
              viewMode === 'grid'
                ? `${styles.cardItem} ${card.cardType === 'SCHEME' ? styles.scheme : styles[card.rarity.toLowerCase()] || styles.basic} ${isInLineup ? styles.inLineup : ''}`
                : `${styles.compactCardItem} ${card.cardType === 'SCHEME' ? styles.compactScheme : styles['compact' + (card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1).toLowerCase())] || styles.compactBasic} ${isInLineup ? styles.inLineupCompact : ''}`
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
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                      </svg>
                    </button>
                  </div>
                </div>

                {isUserMode && card.stackCount && (
                  <div
                    className={`${styles.stackBadge} ${card.stackAvailable === 0 ? styles.stackBadgeEmpty : ''}`}
                  >
                    {card.stackAvailable}/{card.stackCount}
                  </div>
                )}
              </>
            ) : (
              <>
                <div
                  className={styles.compactImageWrapper}
                  style={{
                    position: 'relative',
                    width: 60,
                    height: 60,
                    flexShrink: 0,
                    marginRight: '1rem',
                  }}
                >
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
                    <div
                      className={`${styles.compactStackBadge} ${card.stackAvailable === 0 ? styles.compactStackBadgeEmpty : ''}`}
                    >
                      {card.stackAvailable}/{card.stackCount}
                    </div>
                  )}
                </div>
                <div className={styles.compactInfo}>
                  <div className={styles.compactName}>{card.name}</div>
                  <div className={styles.compactSub}>
                    {card.custom.stars > 0 && (
                      <span className={styles.compactStars}>
                        {card.custom.stars} ★
                      </span>
                    )}
                    {card.custom.class && card.cardType !== 'SCHEME' && (
                      <span className={styles.compactClass}>
                        {card.custom.class}
                      </span>
                    )}
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
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </button>
                <div className={styles.compactRarityLabel}>{card.rarity}</div>
              </>
            )}
            {isInLineup && (
              <div
                className={`${styles.selectedOverlay} ${isLocked ? styles.lockedOverlay : ''}`}
              >
                <div
                  className={`${styles.selectedIcon} ${isLocked ? styles.lockedIcon : ''}`}
                >
                  {isLocked ? (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect
                        x="3"
                        y="11"
                        width="18"
                        height="11"
                        rx="2"
                        ry="2"
                      ></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  ) : (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
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
  addToast,
}: CardGridProps) {
  const [mokiSortOption, setMokiSortOption] = useState<SortOption>('default');
  const [schemeSortOption, setSchemeSortOption] =
    useState<SortOption>('default');

  const sortOption =
    filters.cardType === 'SCHEME' ? schemeSortOption : mokiSortOption;

  const handleSortChange = (option: SortOption) => {
    if (filters.cardType === 'SCHEME') {
      setSchemeSortOption(option);
    } else {
      setMokiSortOption(option);
    }
    setDropdownOpen(false);
  };

  const [selectedModalCard, setSelectedModalCard] =
    useState<EnhancedCard | null>(null);
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
  const activeFilters = getActiveFiltersDisplay(filters);

  // Sorting Logic
  const sortedCards = useMemo(() => {
    return sortCardsByFilters(cards, filters, sortOption);
  }, [cards, sortOption, filters]);

  const displayedCards = useMemo(() => {
    if (!isUserMode) return sortedCards;

    const groups = new Map<string, EnhancedCard>();

    sortedCards.forEach((card) => {
      const key = card.image;
      if (!groups.has(key)) {
        groups.set(key, {
          ...card,
          stackCount: 1,
          stackedIds: [card.id],
        });
      } else {
        const existing = groups.get(key)!;
        existing.stackCount = (existing.stackCount || 0) + 1;
        existing.stackedIds = [...(existing.stackedIds || []), card.id];
      }
    });

    return Array.from(groups.values()).map((cardStack) => {
      const usedInCurrent = currentLineup.filter(
        (c) => c.image === cardStack.image
      ).length;
      const usedInSaved = savedLineups.reduce((total, sl) => {
        return (
          total +
          (sl.cards
            ? sl.cards.filter((c) => c.image === cardStack.image).length
            : 0)
        );
      }, 0);

      const totalUsed = usedInCurrent + usedInSaved;

      return {
        ...cardStack,
        stackAvailable: Math.max(0, (cardStack.stackCount || 1) - totalUsed),
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
              {filters.cardType === 'MOKI'
                ? 'MOKIS'
                : filters.cardType === 'SCHEME'
                  ? 'SCHEME'
                  : 'ALL CARDS'}
              {isUserMode && (
                <span style={{ fontSize: '0.8em', marginLeft: '8px' }}>
                  (
                  {displayedCards.reduce(
                    (acc, card) => acc + (card.stackCount || 1),
                    0
                  )}
                  )
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
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
                  if (
                    filters.specialization &&
                    filters.specialization.length > 0
                  ) {
                    if (addToast)
                      addToast(
                        'Sorting is controlled by Specialization filter',
                        'suggestion'
                      );
                    return;
                  }
                  setDropdownOpen(!dropdownOpen);
                }}
                style={{
                  opacity:
                    filters.specialization && filters.specialization.length > 0
                      ? 0.7
                      : 1,
                  cursor:
                    filters.specialization && filters.specialization.length > 0
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {filters.specialization && filters.specialization.length > 0
                  ? `BY ${filters.specialization[0].toUpperCase()}`
                  : 'ORDER BY...'}
                {!(
                  filters.specialization && filters.specialization.length > 0
                ) && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: dropdownOpen
                        ? 'rotate(180deg)'
                        : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                )}
              </button>
              {dropdownOpen &&
                (!filters.specialization ||
                  filters.specialization.length === 0) && (
                  <ul className={styles.orderByMenu}>
                    <li
                      onClick={() => handleSortChange('default')}
                      className={
                        sortOption === 'default' ? styles.activeSort : ''
                      }
                    >
                      Default
                    </li>
                    <li
                      onClick={() => handleSortChange('name_asc')}
                      className={
                        sortOption === 'name_asc' ? styles.activeSort : ''
                      }
                    >
                      Name A → Z
                    </li>
                    <li
                      onClick={() => handleSortChange('name_desc')}
                      className={
                        sortOption === 'name_desc' ? styles.activeSort : ''
                      }
                    >
                      Name Z → A
                    </li>
                    {filters.cardType !== 'SCHEME' && (
                      <>
                        <li
                          onClick={() => handleSortChange('rarity_desc')}
                          className={
                            sortOption === 'rarity_desc'
                              ? styles.activeSort
                              : ''
                          }
                        >
                          Rarity High → Low
                        </li>
                        <li
                          onClick={() => handleSortChange('rarity_asc')}
                          className={
                            sortOption === 'rarity_asc' ? styles.activeSort : ''
                          }
                        >
                          Rarity Low → High
                        </li>
                        <li
                          onClick={() => handleSortChange('stars_desc')}
                          className={
                            sortOption === 'stars_desc' ? styles.activeSort : ''
                          }
                        >
                          Stars High → Low
                        </li>
                        <li
                          onClick={() => handleSortChange('stars_asc')}
                          className={
                            sortOption === 'stars_asc' ? styles.activeSort : ''
                          }
                        >
                          Stars Low → High
                        </li>
                      </>
                    )}
                  </ul>
                )}
            </div>

            <input
              type="text"
              id="cards_srch_dsk"
              name="cards_srch_dsk_unq_123"
              placeholder="Search card name..."
              className={`${styles.searchInput} ${styles.desktopSearch}`}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              autoComplete="new-password"
              spellCheck="false"
            />

            <div className={styles.viewToggle}>
              <button
                className={`${styles.toggleIcon} ${viewMode === 'grid' ? styles.toggleActive : ''}`}
                onClick={() => setViewMode('grid')}
                title="Gallery View"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
            id="cards_srch_mob"
            name="cards_srch_mob_unq_123"
            placeholder="Search card name..."
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="new-password"
            spellCheck="false"
          />
        </div>

        {activeFilters.length > 0 && (
          <div className={styles.activeFilters}>
            {activeFilters.map((f, i) => (
              <div
                key={`${f.key}-${f.value}-${i}`}
                className={styles.filterChip}
              >
                <span className={styles.filterLabel}>{f.label}: </span>
                <span className={styles.filterValue}>
                  {f.displayValue || f.value}
                </span>
                <button
                  onClick={() => onRemoveFilter(f.key, f.value)}
                  className={styles.removeFilterButton}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
          <div className={styles.noResults}>
            No cards found matching your filters.
          </div>
        ) : (
          <AutoSizer
            renderProp={({
              height,
              width,
            }: {
              height: number | undefined;
              width: number | undefined;
            }) => {
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
              const colWidth = Math.max(
                0,
                (availableWidth - colGap * (itemsPerRow - 1)) / itemsPerRow
              );

              const rowHeight =
                viewMode === 'grid' ? colWidth * (4 / 3) + 34 : 84;

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
                    isUserMode,
                  }}
                  rowComponent={CardRow}
                  overscanCount={2}
                />
              );
            }}
          />
        )}
      </div>

      {selectedModalCard && (
        <CardModal
          card={selectedModalCard}
          onClose={() => setSelectedModalCard(null)}
          matchLimit={filters.matchLimit}
        />
      )}
    </div>
  );
}
