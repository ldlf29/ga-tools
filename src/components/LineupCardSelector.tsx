import React from 'react';
import styles from '@/components/MyLineups.module.css';
import FilterSidebar from '@/components/FilterSidebar';
import CardGrid from '@/components/CardGrid';
import { EnhancedCard, FilterState, SavedLineup } from '@/types';

interface LineupCardSelectorProps {
    selectorFilters: FilterState;
    setSelectorFilters: (filters: FilterState) => void;
    filteredSelectorCards: EnhancedCard[];
    handleCardSelect: (card: EnhancedCard) => void;
    selectorSearch: string;
    setSelectorSearch: (search: string) => void;
    localCards: (EnhancedCard | null)[];
    lineups: SavedLineup[];
    handleSelectorRemoveFilter: (key: keyof FilterState, value: string | number) => void;
    setSelectorSlot: (slot: number | null) => void;
    selectorMobileFiltersOpen: boolean;
    setSelectorMobileFiltersOpen: (open: boolean) => void;
}

export const LineupCardSelector: React.FC<LineupCardSelectorProps> = ({
    selectorFilters,
    setSelectorFilters,
    filteredSelectorCards,
    handleCardSelect,
    selectorSearch,
    setSelectorSearch,
    localCards,
    lineups,
    handleSelectorRemoveFilter,
    setSelectorSlot,
    selectorMobileFiltersOpen,
    setSelectorMobileFiltersOpen
}) => {
    return (
        <div className={styles.selectorBackdrop} onClick={() => setSelectorSlot(null)}>
            <div className={styles.selectorOverlay} onClick={(e) => e.stopPropagation()}>
                <div className={styles.selectorHeader}>
                    <span>SELECT A CARD</span>
                    <div className={styles.selectorHeaderActions}>
                        <button
                            className={styles.selectorCloseButton}
                            onClick={() => setSelectorSlot(null)}
                            title="Close"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                <div className={styles.selectorBody}>
                    <div className={styles.selectorSidebar}>
                        <FilterSidebar
                            filters={selectorFilters}
                            onFilterChange={setSelectorFilters}
                            onCardTypeChange={() => { }}
                            storagePrefix="selector"
                        />
                    </div>
                    <div className={styles.selectorGridWrapper}>
                        <CardGrid
                            cards={filteredSelectorCards}
                            onAddCard={handleCardSelect}
                            searchQuery={selectorSearch}
                            onSearchChange={setSelectorSearch}
                            currentLineup={localCards.filter(c => c) as EnhancedCard[]}
                            savedLineups={lineups}
                            filters={selectorFilters}
                            onRemoveFilter={handleSelectorRemoveFilter}
                            isUserMode={true}
                        />
                    </div>
                </div>
            </div>

            {/* Floating Filter Button (Mobile only) */}
            <button
                className={styles.selectorFabFilters}
                onClick={(e) => {
                    e.stopPropagation();
                    setSelectorMobileFiltersOpen(true);
                }}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
            </button>

            {/* Mobile Filters Drawer */}
            <div
                className={`${styles.selectorMobileDrawer} ${selectorMobileFiltersOpen ? styles.selectorMobileDrawerOpen : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className={styles.selectorDrawerCloseButton}
                    onClick={() => setSelectorMobileFiltersOpen(false)}
                    aria-label="Close Filters"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <div className={styles.selectorMobileDrawerContent}>
                    <FilterSidebar
                        filters={selectorFilters}
                        onFilterChange={setSelectorFilters}
                        onCardTypeChange={() => { }}
                        storagePrefix="selector"
                    />
                </div>
            </div>

            {/* Backdrop for selector mobile drawer */}
            {selectorMobileFiltersOpen && (
                <div
                    className={styles.selectorMobileDrawerBackdrop}
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectorMobileFiltersOpen(false);
                    }}
                />
            )}
        </div>
    );
};
