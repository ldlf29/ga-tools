'use client';

import { useState } from 'react';
import styles from './FilterSidebar.module.css';
import StarRangeSlider from './StarRangeSlider';
import { motion, AnimatePresence } from 'framer-motion';

export interface FilterState {
    rarity: string[];
    cardType: 'ALL' | 'MOKI' | 'SCHEME';
    category: string[];
    schemeName: string[];
    fur: string[];
    stars: number[];
    customClass: string[];
    specialization: string[];
    traits: string[];
    series: string[];
    insertionOrder?: string[];
}

interface FilterSidebarProps {
    filters: FilterState;
    onFilterChange: (newFilters: FilterState) => void;
}

const SCHEME_NAMES = [
    "Aggressive Specialization", "Baiting the Trap", "Beat the Buzzer", "Big Game Hunt", "Cage Match",
    "Call to Arms", "Collect 'Em All", "Collective Specialization", "Costume Party", "Cursed Dinner",
    "Divine Intervention", "Dress to Impress", "Dungaree Duel", "Enforcing the Naughty List", "Final Blow",
    "Flexing", "Gacha Gouging", "Gacha Hoarding", "Golden Shower", "Grabbing Balls",
    "Housekeeping", "Litter Collection", "Malicious Intent", "Midnight Strike", "Moki Smash",
    "Rainbow Riot", "Running Interference", "Saccing", "Shapeshifting", "Taking a Dive",
    "Tear Jerking", "Touching the Wart", "Victory Lap", "Wart Rodeo", "Whale Watching"
];

const SERIES_OPTIONS = [
    "Long Moki", "Moki Parts", "Moki Madness", "Ice Cream",
    "Stickers", "Manga Stickers",
    "Random", "Doodle", "Loopy Lines", "Soft Noise",
    "Presale Promo", "Eggu Island", "Milky Way", "Chibi Kawaii", "Katai Beddo", "Fruity", "Hatching Field", "1-of-1"
];
const FUR_OPTIONS = ["Common", "Rainbow", "Gold", "Shadow", "Spirit", "1 of 1"];
const STAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const CLASS_OPTIONS = ["Striker", "Grinder", "Bruiser", "Defender", "Sprinter", "Foward", "Anchor", "Center", "Flanker", "Support"];

const SPECIALIZATION_CONFIG: { key: string, label: string }[] = [
    { key: "Gacha", label: "Gacha (+4.75)" },
    { key: "Killer", label: "Killer (+1.50)" },
    { key: "Wart Rider", label: "Wart Rider (+170)" },
    { key: "Winner", label: "Winner (+53.50%)" },
    { key: "Loser", label: "Loser (-47.50%)" }
];

// Grouped Traits Mapping
// Label -> Array of individual traits it includes
// Grouped Traits Mapping
// Label -> Array of individual traits it includes
export const TRAIT_GROUPS: { label: string, traits: string[] }[] = [
    { label: "Ronin or Samurai", traits: ["Ronin", "Samurai"] },
    { label: "Pink, Blue or Green Overalls", traits: ["Pink Overalls", "Blue Overalls", "Green Overalls"] },
    { label: "Tongue Out", traits: ["Tongue Out"] },
    { label: "Tanuki, Kitsune or Cat Mask", traits: ["Tanuki", "Kitsune", "Cat Mask"] },
    { label: "Devious Mouth", traits: ["Devious Mouth"] },
    { label: "Oni, Tengu or Skull Mask", traits: ["Oni", "Tengu", "Skull Mask"] },
    { label: "Apron, Garbage/Gold Can or Toilet Paper", traits: ["Apron", "Garbage Can", "Gold Can", "Toilet Paper"] },
    { label: "Crying Eye", traits: ["Crying Eye"] },
    { label: "Onesie", traits: ["Onesie"] },
    { label: "Lemon, Kappa, Tomato, Bear, Frog or Blob Head", traits: ["Lemon", "Kappa", "Tomato", "Bear", "Frog", "Blob Head"] },
    { label: "Kimono", traits: ["Kimono"] }
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
    const handleCategoryChange = (val: string) => updateFilter('category', val);
    const handleSchemeChange = (val: string) => updateFilter('schemeName', val);
    const handleFurChange = (val: string) => updateFilter('fur', val);
    const handleSeriesChange = (val: string) => updateFilter('series', val);
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
            category: [],
            schemeName: [],
            fur: [],
            stars: [],
            customClass: [],
            specialization: [],
            traits: [],
            series: [],
            insertionOrder: [] // Ensure order is cleared
            // Preserve cardType
        });
    };

    const hasActiveFilters =
        filters.rarity.length > 0 ||
        filters.category.length > 0 ||
        filters.schemeName.length > 0 ||
        filters.fur.length > 0 ||
        filters.customClass.length > 0 ||
        filters.specialization.length > 0 ||
        filters.traits.length > 0 ||
        filters.series.length > 0;

    // Helper function to check if a filter section matches the search query
    const matchesSearch = (sectionTitle: string, options: string[] = []): boolean => {
        if (!filterSearch.trim()) return true; // Show all if no search
        const query = filterSearch.toLowerCase();
        if (sectionTitle.toLowerCase().includes(query)) return true;
        return options.some(opt => opt.toLowerCase().includes(query));
    };

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
                            {type}
                        </button>
                    ))}
                </div>
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
                        {matchesSearch('Rarity', ['Basic', 'Rare', 'Epic', 'Legendary']) && (
                            <FilterAccordion title="Rarity" isOpenDefault={false} forceOpen={!!filterSearch.trim()}>
                                {filterOptions(['Basic', 'Rare', 'Epic', 'Legendary']).map(r => (
                                    <label key={r} className={styles.checkboxLabel}>
                                        <input type="checkbox" checked={filters.rarity.includes(r)} onChange={() => handleRarityChange(r)} />
                                        <span className={styles.labelText}>{r}</span>
                                    </label>
                                ))}
                            </FilterAccordion>
                        )}

                        {/* Class */}
                        {matchesSearch('Class', CLASS_OPTIONS) && (
                            <FilterAccordion title="Class" isOpenDefault={false} forceOpen={!!filterSearch.trim()}>
                                {filterOptions(CLASS_OPTIONS).map(c => (
                                    <label key={c} className={styles.checkboxLabel}>
                                        <input type="checkbox" checked={filters.customClass.includes(c)} onChange={() => handleClassChange(c)} />
                                        <span className={styles.labelText}>{c}</span>
                                    </label>
                                ))}
                            </FilterAccordion>
                        )}

                        {/* Specialization */}
                        {matchesSearch('Specialization', SPECIALIZATION_CONFIG.map(s => s.label)) && (
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
                        )}

                        {/* Stars */}
                        {matchesSearch('Stars') && (
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
                        )}

                        {/* Fur */}
                        {matchesSearch('Fur', FUR_OPTIONS) && (
                            <FilterAccordion title="Fur" isOpenDefault={false} forceOpen={!!filterSearch.trim()}>
                                {filterOptions(FUR_OPTIONS).map(f => (
                                    <label key={f} className={styles.checkboxLabel}>
                                        <input type="checkbox" checked={filters.fur.includes(f)} onChange={() => handleFurChange(f)} />
                                        <span className={styles.labelText}>{f}</span>
                                    </label>
                                ))}
                            </FilterAccordion>
                        )}

                        {/* Traits (Grouped) */}
                        {matchesSearch('Traits', TRAIT_GROUPS.map(g => g.label)) && (
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
                        )}

                        {/* Category */}
                        {matchesSearch('Category', ['Full Art', 'Overlay', 'Border']) && (
                            <FilterAccordion title="Category" isOpenDefault={false} forceOpen={!!filterSearch.trim()}>
                                {filterOptions(['Full Art', 'Overlay', 'Border']).map(c => (
                                    <label key={c} className={styles.checkboxLabel}>
                                        <input type="checkbox" checked={filters.category.includes(c)} onChange={() => handleCategoryChange(c)} />
                                        <span className={styles.labelText}>{c}</span>
                                    </label>
                                ))}
                            </FilterAccordion>
                        )}

                        {/* Series */}
                        {matchesSearch('Series', SERIES_OPTIONS) && (
                            <FilterAccordion title="Series" isOpenDefault={false} forceOpen={!!filterSearch.trim()}>
                                {filterOptions(SERIES_OPTIONS).map(s => (
                                    <label key={s} className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={filters.series.includes(s)}
                                            onChange={() => handleSeriesChange(s)}
                                        />
                                        <span className={styles.labelText}>{s}</span>
                                    </label>
                                ))}
                            </FilterAccordion>
                        )}
                    </>
                )}

                {/* --- SCHEME SECTION --- */}
                {filters.cardType === 'SCHEME' && matchesSearch('Scheme Name', SCHEME_NAMES) && (
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
