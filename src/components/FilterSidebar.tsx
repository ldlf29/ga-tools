'use client';

import { useState } from 'react';
import styles from './FilterSidebar.module.css';
import StarRangeSlider from './StarRangeSlider';
import { motion, AnimatePresence } from 'framer-motion';
import { FilterState, TRAIT_GROUPS } from '@/types';

interface FilterSidebarProps {
    filters: FilterState;
    onFilterChange: (newFilters: FilterState) => void;
}

import { SCHEME_NAMES } from '@/data/schemes';

import { MOKI_CLASSES, MOKI_FURS } from '@/utils/constants';

const SERIES_OPTIONS = [
    "Long Moki", "Moki Parts", "Moki Madness", "Ice Cream",
    "Stickers", "Manga Stickers",
    "Random", "Doodle", "Loopy Lines", "Soft Noise",
    "Presale Promo", "Eggu Island", "Milky Way", "Chibi Kawaii", "Katai Beddo", "Fruity", "Hatching Field", "1-of-1"
];
const FUR_OPTIONS = [...MOKI_FURS];
const STAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const CLASS_OPTIONS = [...MOKI_CLASSES];

const SPECIALIZATION_CONFIG: { key: string, label: string }[] = [
    { key: "Gacha", label: "Gacha (+4.75)" },
    { key: "Killer", label: "Killer (+1.50)" },
    { key: "Wart Rider", label: "Wart Rider (+170)" },
    { key: "Winner", label: "Winner (+53.50%)" },
    { key: "Loser", label: "Loser (-47.50%)" }
];

export default function FilterSidebar({ filters, onFilterChange }: FilterSidebarProps) {

    const [filterSearch, setFilterSearch] = useState('');

    // -- Handlers --
    const updateFilter = (key: keyof FilterState, value: string | number) => {
        const currentValues = filters[key] as (string | number)[];
        const isSelected = currentValues.includes(value as never);

        let newValues;
        let newOrder = filters.insertionOrder ? [...filters.insertionOrder] : [];
        const orderKey = `${key}:${value}`;

        if (isSelected) {
            newValues = currentValues.filter((v) => v !== value);
            newOrder = newOrder.filter(k => k !== orderKey);
        } else {
            newValues = [...currentValues, value];
            if (!newOrder.includes(orderKey)) {
                newOrder.push(orderKey);
            }
        }

        onFilterChange({
            ...filters,
            [key]: newValues,
            insertionOrder: newOrder,
        });
    };

    const handleRarityChange = (val: string) => updateFilter('rarity', val);
    const handleSchemeChange = (val: string) => updateFilter('schemeName', val);
    const handleFurChange = (val: string) => updateFilter('fur', val);
    // handleStarChange is handled by slider now, but kept for safety if used elsewhere or if slider unmounts
    const handleStarChange = (val: number) => updateFilter('stars', val);
    const handleClassChange = (val: string) => updateFilter('customClass', val);
    const handleSpecializationChange = (val: string) => updateFilter('specialization', val);

    // Trait Group Logic
    const handleTraitGroupChange = (group: { label: string, traits: string[] }) => {
        // Traits are stored as strings in filters.traits
        updateFilter('traits', group.label);
    };


    const handleClearFilters = () => {
        onFilterChange({
            ...filters,
            rarity: [],
            schemeName: [],
            fur: [],
            stars: [],
            customClass: [],
            specialization: [],
            traits: [],
            insertionOrder: [] // Ensure order is cleared
            // Preserve cardType
        });
    };

    const hasActiveFilters =
        filters.rarity.length > 0 ||
        filters.schemeName.length > 0 ||
        filters.fur.length > 0 ||
        filters.customClass.length > 0 ||
        filters.specialization.length > 0 ||
        filters.traits.length > 0;


    // Helper to filter options that match the search
    const filterOptions = (options: string[]): string[] => {
        if (!filterSearch.trim()) return options;
        const query = filterSearch.toLowerCase();
        return options.filter(opt => opt.toLowerCase().includes(query));
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.headerGroup}>
                <h3 className={styles.sectionTitle}>Filters</h3>
                {hasActiveFilters && (
                    <button onClick={handleClearFilters} className={styles.clearFiltersButton}>
                        Clear Filters
                    </button>
                )}
            </div>

            {/* Card Type Toggle - Always Visible */}
            <div className={styles.filterGroup}>
                <div className={styles.toggleGroup}>
                    {['MOKI', 'SCHEME'].map(type => (
                        <button
                            key={type}
                            className={`${styles.toggleButton} ${filters.cardType === type ? styles.active : ''}`}
                            onClick={() => onFilterChange({
                                ...filters,
                                cardType: filters.cardType === type ? 'ALL' : type as 'MOKI' | 'SCHEME'
                            })}
                        >
                            {type === 'MOKI' ? 'MOKIS' : type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Epic / Legendary Filter Button */}
            <div className={styles.filterGroup}>
                <button
                    className={`${styles.epicLegendaryButton} ${filters.onlyEpicLegendary ? styles.active : ''}`}
                    onClick={() => {
                        const newState = !filters.onlyEpicLegendary;
                        onFilterChange({
                            ...filters,
                            onlyEpicLegendary: newState,
                            rarity: newState ? ['Epic', 'Legendary'] : [] // Clear on disable
                        });
                    }}
                >
                    ONLY EPIC / LEGENDARY
                </button>
            </div>

            {/* Filter Search Bar */}
            <div className={styles.filterGroup}>
                <input
                    type="text"
                    className={styles.filterSearchInput}
                    placeholder="Search filters..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                />
            </div>

            <div className={styles.scrollableContent}>
                {/* --- MOKI SECTION --- */}
                {filters.cardType !== 'SCHEME' && (
                    <>
                        {/* Rarity */}
                        {(() => {
                            const rarityOptions = filters.onlyEpicLegendary
                                ? ['Epic', 'Legendary']
                                : ['Basic', 'Rare', 'Epic', 'Legendary'];

                            return (
                                <FilterAccordion title="Rarity" isOpenDefault={false} forceOpen={!!filterSearch.trim()}>
                                    {filterOptions(rarityOptions).map(r => (
                                        <label key={r} className={styles.checkboxLabel}>
                                            <input
                                                type="checkbox"
                                                checked={filters.rarity.includes(r)}
                                                onChange={() => handleRarityChange(r)}
                                            />
                                            <span className={styles.labelText}>{r}</span>
                                        </label>
                                    ))}
                                </FilterAccordion>
                            );
                        })()}

                        {/* Class */}
                        <FilterAccordion title="Class" isOpenDefault={false} forceOpen={!!filterSearch.trim()}>
                            {filterOptions(CLASS_OPTIONS).map(c => (
                                <label key={c} className={styles.checkboxLabel}>
                                    <input type="checkbox" checked={filters.customClass.includes(c)} onChange={() => handleClassChange(c)} />
                                    <span className={styles.labelText}>{c}</span>
                                </label>
                            ))}
                        </FilterAccordion>

                        {/* Specialization */}
                        <FilterAccordion title="Specialization" isOpenDefault={false} forceOpen={!!filterSearch.trim()}>
                            {SPECIALIZATION_CONFIG.filter(s => {
                                if (!filterSearch.trim()) return true;
                                return s.label.toLowerCase().includes(filterSearch.toLowerCase());
                            }).map(s => (
                                <label key={s.key} className={styles.checkboxLabel}>
                                    <input type="checkbox" checked={filters.specialization.includes(s.key)} onChange={() => handleSpecializationChange(s.key)} />
                                    <span className={styles.labelText}>{s.label}</span>
                                </label>
                            ))}
                        </FilterAccordion>

                        {/* Stars */}
                        <FilterAccordion title="Stars" isOpenDefault={false} forceOpen={!!filterSearch.trim()}>
                            <div style={{ padding: '0 10px' }}>
                                <StarRangeSlider
                                    min={1}
                                    max={8}
                                    currentRange={{
                                        min: filters.stars.length > 0 ? Math.min(...filters.stars) : 1,
                                        max: filters.stars.length > 0 ? Math.max(...filters.stars) : 8
                                    }}
                                    onChange={({ min, max }) => {
                                        const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);
                                        let newOrder = filters.insertionOrder ? [...filters.insertionOrder] : [];
                                        if (!newOrder.includes('stars:ACTIVE')) {
                                            newOrder.push('stars:ACTIVE');
                                        }
                                        onFilterChange({ ...filters, stars: range, insertionOrder: newOrder });
                                    }}
                                />
                            </div>
                        </FilterAccordion>

                        {/* Fur */}
                        <FilterAccordion title="Fur" isOpenDefault={false} forceOpen={!!filterSearch.trim()}>
                            {filterOptions(FUR_OPTIONS).map(f => (
                                <label key={f} className={styles.checkboxLabel}>
                                    <input type="checkbox" checked={filters.fur.includes(f)} onChange={() => handleFurChange(f)} />
                                    <span className={styles.labelText}>{f}</span>
                                </label>
                            ))}
                        </FilterAccordion>

                        {/* Traits (Grouped) */}
                        <FilterAccordion title="Traits" isOpenDefault={false} forceOpen={!!filterSearch.trim()}>
                            {TRAIT_GROUPS.filter(group => {
                                if (!filterSearch.trim()) return true;
                                return group.label.toLowerCase().includes(filterSearch.toLowerCase());
                            }).map(group => {
                                const isChecked = filters.traits.includes(group.label);
                                return (
                                    <label key={group.label} className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleTraitGroupChange(group)}
                                        />
                                        <span className={styles.labelText}>{group.label}</span>
                                    </label>
                                );
                            })}
                        </FilterAccordion>

                    </>
                )}

                {/* --- SCHEME SECTION --- */}
                {filters.cardType === 'SCHEME' && (
                    <FilterAccordion title="Scheme Name" isOpenDefault={false} forceOpen={!!filterSearch.trim()}>
                        {filterOptions(SCHEME_NAMES).map(name => (
                            <label key={name} className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={filters.schemeName.includes(name)}
                                    onChange={() => handleSchemeChange(name)}
                                />
                                <span className={styles.labelText}>{name}</span>
                            </label>
                        ))}
                    </FilterAccordion>
                )}
            </div>

        </aside>
    );
}

// Internal Accordion Component
function FilterAccordion({ title, children, isOpenDefault = false, forceOpen = false }: { title: string, children: React.ReactNode, isOpenDefault?: boolean, forceOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(isOpenDefault);
    const shouldBeOpen = forceOpen || isOpen;

    return (
        <div className={styles.filterGroup}>
            <button
                className={styles.accordionHeader}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={styles.groupTitle}>{title}</span>
                <svg
                    className={styles.arrowIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                        transform: shouldBeOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>

            <AnimatePresence>
                {shouldBeOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeInOut" } }}
                        exit={{ opacity: 0, y: -10, transition: { duration: 0.15, ease: "easeInOut" } }}
                    >
                        <div className={styles.accordionContent}>
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
