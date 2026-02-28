'use client';

import { useState } from 'react';
import styles from './FilterSidebar.module.css';
import StarRangeSlider from './StarRangeSlider';
import { motion, AnimatePresence } from 'framer-motion';
import { FilterState, TRAIT_GROUPS } from '@/types';

interface FilterSidebarProps {
    filters: FilterState;
    onFilterChange: (newFilters: FilterState) => void;
    onCardTypeChange?: (newCardType: 'MOKI' | 'SCHEME') => void;
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
    { key: "Gacha", label: "Gacha" },
    { key: "Killer", label: "Killer" },
    { key: "Wart Rider", label: "Wart Rider" },
    { key: "Winner", label: "Winner" },
    { key: "Loser", label: "Loser" },
    { key: "Score", label: "Score" }
];

export default function FilterSidebar({ filters, onFilterChange, onCardTypeChange }: FilterSidebarProps) {

    // Independent search state for each card type tab
    const [mokiSearch, setMokiSearch] = useState('');
    const [schemeSearch, setSchemeSearch] = useState('');

    // Use the appropriate search based on current tab
    const filterSearch = filters.cardType === 'MOKI' ? mokiSearch : schemeSearch;
    const setFilterSearch = filters.cardType === 'MOKI' ? setMokiSearch : setSchemeSearch;

    // -- Helpers --
    const filterOptions = (options: string[]): string[] => {
        if (!filterSearch.trim()) return options;
        const query = filterSearch.toLowerCase();
        return options.filter(opt => opt.toLowerCase().includes(query));
    };

    // Check if search matches any option in the list
    const hasMatches = (options: string[]): boolean => {
        if (!filterSearch.trim()) return false;
        return filterOptions(options).length > 0;
    };

    // Special matching for Stars filter (matches "star", "stars", or numbers 1-8)
    const starsHasMatch = (): boolean => {
        if (!filterSearch.trim()) return false;
        const q = filterSearch.toLowerCase().trim();
        if (q.includes('star')) return true;
        // Check if search is a number 1-8
        const num = parseInt(q, 10);
        if (!isNaN(num) && num >= 1 && num <= 8) return true;
        return false;
    };

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
    const handleStarChange = (val: number) => updateFilter('stars', val);
    const handleClassChange = (val: string) => updateFilter('customClass', val);
    const handleSpecializationChange = (val: string) => {
        const perfSpecs = ["Gacha", "Killer", "Wart Rider"];
        const contextSpecs = ["Winner", "Loser", "Score"];

        let newSpecialization = [...filters.specialization];
        const isSelected = newSpecialization.includes(val);

        if (isSelected) {
            newSpecialization = newSpecialization.filter(s => s !== val);
        } else {
            if (perfSpecs.includes(val)) {
                newSpecialization = newSpecialization.filter(s => !perfSpecs.includes(s));
            } else if (contextSpecs.includes(val)) {
                newSpecialization = newSpecialization.filter(s => !contextSpecs.includes(s));
            }
            newSpecialization.push(val);
        }

        let newOrder = filters.insertionOrder ? [...filters.insertionOrder] : [];
        newOrder = newOrder.filter(k => {
            if (!k.startsWith('specialization:')) return true;
            const specVal = k.split(':')[1];
            return newSpecialization.includes(specVal);
        });

        if (!isSelected) {
            const orderKey = `specialization:${val}`;
            if (!newOrder.includes(orderKey)) {
                newOrder.push(orderKey);
            }
        }

        onFilterChange({
            ...filters,
            specialization: newSpecialization,
            insertionOrder: newOrder
        });
    };

    const handleTraitGroupChange = (group: { label: string, traits: string[] }) => {
        const isSelected = filters.traits.includes(group.label);
        const newTraits = isSelected ? [] : [group.label];

        // Remove ALL previous traits orders
        let newOrder = filters.insertionOrder ? [...filters.insertionOrder] : [];
        newOrder = newOrder.filter(k => !k.startsWith('traits:'));

        if (!isSelected) {
            newOrder.push(`traits:${group.label}`);
        }

        onFilterChange({
            ...filters,
            traits: newTraits,
            insertionOrder: newOrder
        });
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
            insertionOrder: [],
            useLast10Matches: false
        });
    };

    const hasActiveFilters =
        filters.rarity.length > 0 ||
        filters.schemeName.length > 0 ||
        filters.fur.length > 0 ||
        filters.customClass.length > 0 ||
        filters.specialization.length > 0 ||
        filters.traits.length > 0 ||
        filters.stars.length > 0;

    // Pre-compute matches for each accordion
    const rarityOptions = ['Basic', 'Rare', 'Epic', 'Legendary'];
    const rarityMatches = hasMatches(rarityOptions);
    const classMatches = hasMatches(CLASS_OPTIONS);
    const specLabels = SPECIALIZATION_CONFIG.map(s => s.label);
    const specMatches = hasMatches(specLabels);
    const starsMatches = starsHasMatch();
    const furMatches = hasMatches(FUR_OPTIONS);
    const traitLabels = TRAIT_GROUPS.map(g => g.label);
    const traitsMatches = hasMatches(traitLabels);
    const schemeMatches = hasMatches(SCHEME_NAMES);

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
                            onClick={() => {
                                if (onCardTypeChange) {
                                    onCardTypeChange(type as 'MOKI' | 'SCHEME');
                                } else {
                                    onFilterChange({
                                        ...filters,
                                        cardType: type as 'MOKI' | 'SCHEME'
                                    });
                                }
                            }}
                        >
                            {type === 'MOKI' ? 'MOKIS' : type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter Search Bar */}
            <div className={styles.filterGroup}>
                <input
                    type="text"
                    id="fncy_fltr_unq"
                    name="fncy_fltr_unq_123"
                    className={styles.filterSearchInput}
                    placeholder="Search filters..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    autoComplete="new-password"
                    spellCheck="false"
                />

                {filters.cardType === 'MOKI' && (
                    <div className={styles.last10ToggleWrapper}>
                        <label className={styles.toggleLabel}>
                            <input
                                type="checkbox"
                                checked={filters.useLast10Matches || false}
                                onChange={(e) => {
                                    onFilterChange({
                                        ...filters,
                                        useLast10Matches: e.target.checked
                                    });
                                }}
                            />
                            <span className={styles.toggleText}>Filter by the last 10 matches</span>
                        </label>
                    </div>
                )}
            </div>

            <div className={styles.scrollableContent}>
                {/* --- MOKI SECTION --- */}
                {filters.cardType !== 'SCHEME' && (
                    <>
                        {/* Rarity - only show if no search or has matches */}
                        {(!filterSearch.trim() || rarityMatches) && (
                            <FilterAccordion title="Rarity" isOpenDefault={false} forceOpen={rarityMatches}>
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
                        )}

                        {/* Class */}
                        {(!filterSearch.trim() || classMatches) && (
                            <FilterAccordion title="Class" isOpenDefault={false} forceOpen={classMatches}>
                                {filterOptions(CLASS_OPTIONS).map(c => (
                                    <label key={c} className={styles.checkboxLabel}>
                                        <input type="checkbox" checked={filters.customClass.includes(c)} onChange={() => handleClassChange(c)} />
                                        <span className={styles.labelText}>{c}</span>
                                    </label>
                                ))}
                            </FilterAccordion>
                        )}

                        {/* Specialization */}
                        {(!filterSearch.trim() || specMatches) && (
                            <FilterAccordion title="Specialization" isOpenDefault={false} forceOpen={specMatches}>
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
                        )}

                        {/* Stars - only show if no search or matches "star" or number 1-8 */}
                        {(!filterSearch.trim() || starsMatches) && (
                            <FilterAccordion title="Stars" isOpenDefault={false} forceOpen={starsMatches}>
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
                        )}

                        {/* Fur */}
                        {(!filterSearch.trim() || furMatches) && (
                            <FilterAccordion title="Fur" isOpenDefault={false} forceOpen={furMatches}>
                                {filterOptions(FUR_OPTIONS).map(f => (
                                    <label key={f} className={styles.checkboxLabel}>
                                        <input type="checkbox" checked={filters.fur.includes(f)} onChange={() => handleFurChange(f)} />
                                        <span className={styles.labelText}>{f}</span>
                                    </label>
                                ))}
                            </FilterAccordion>
                        )}

                        {/* Traits (Grouped) */}
                        {(!filterSearch.trim() || traitsMatches) && (
                            <FilterAccordion title="Traits" isOpenDefault={false} forceOpen={traitsMatches}>
                                {TRAIT_GROUPS.filter(group => {
                                    if (!filterSearch.trim()) return true;
                                    return group.label.toLowerCase().includes(filterSearch.toLowerCase());
                                }).map(group => {
                                    const isChecked = filters.traits.includes(group.label);
                                    return (
                                        <label key={group.label} className={styles.checkboxLabel}>
                                            <input
                                                type="checkbox" // Keep as checkbox visually so they can toggle it off, but logic handles it exclusively
                                                checked={isChecked}
                                                onChange={() => handleTraitGroupChange(group)}
                                            />
                                            <span className={styles.labelText}>{group.label}</span>
                                        </label>
                                    );
                                })}
                            </FilterAccordion>
                        )}

                    </>
                )}

                {/* --- SCHEME SECTION --- */}
                {filters.cardType === 'SCHEME' && (
                    <>
                        {(!filterSearch.trim() || schemeMatches) && (
                            <FilterAccordion title="Scheme Name" isOpenDefault={false} forceOpen={schemeMatches}>
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
                    </>
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
