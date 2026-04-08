/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useEffect, Fragment } from 'react';
import styles from './FilterSidebar.module.css';
import StarRangeSlider from './StarRangeSlider';
import { m as motion, AnimatePresence } from 'framer-motion';
import { FilterState } from '@/types';

interface FilterSidebarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  onCardTypeChange?: (newCardType: 'MOKI' | 'SCHEME') => void;
  hideMatchPerformance?: boolean;
  hideRarity?: boolean;
  hideTypeToggle?: boolean;
  storagePrefix?: string;
}

import { SCHEME_NAMES } from '@/data/schemes';

import { MOKI_CLASSES, MOKI_FURS } from '@/utils/constants';


const FUR_OPTIONS = [...MOKI_FURS];

const CLASS_OPTIONS = [...MOKI_CLASSES];

const SPECIALIZATION_CONFIG: { key: string; label: string }[] = [
  { key: 'Gacha', label: 'Gacha' },
  { key: 'Killer', label: 'Killer' },
  { key: 'Wart Rider', label: 'Wart Rider' },
  { key: 'Winner', label: 'Winner' },
  { key: 'Loser', label: 'Loser' },
  { key: 'Good Streak', label: 'Good Streak' },
  { key: 'Bad Streak', label: 'Bad Streak' },
  { key: 'Score', label: 'Score' },
];

// Trait-based scheme options (NFT attributes → scheme categories)
const TRAIT_SCHEME_OPTIONS = [
  'Call to Arms',
  'Costume Party',
  'Dress to Impress',
  'Dungaree Duel',
  'Housekeeping',
  'Malicious Intent',
  'Shapeshifting',
  'Tear Jerking',
];

export default function FilterSidebar({
  filters,
  onFilterChange,
  onCardTypeChange,
  hideMatchPerformance,
  hideRarity = false,
  hideTypeToggle = false,
  storagePrefix = 'default',
}: FilterSidebarProps) {
  // Independent search state for each card type tab
  const [mokiSearch, setMokiSearch] = useState('');
  const [schemeSearch, setSchemeSearch] = useState('');

  // Use the appropriate search based on current tab
  const filterSearch = filters.cardType === 'MOKI' ? mokiSearch : schemeSearch;
  const setFilterSearch =
    filters.cardType === 'MOKI' ? setMokiSearch : setSchemeSearch;

  // -- Helpers --
  const filterOptions = (options: string[]): string[] => {
    if (!filterSearch.trim()) return options;
    const query = filterSearch.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(query));
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
      newOrder = newOrder.filter((k) => k !== orderKey);
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

  const handleClassChange = (val: string) => updateFilter('customClass', val);
  const handleSpecializationChange = (val: string) => {
    const perfSpecs = ['Gacha', 'Killer', 'Wart Rider'];
    const contextSpecs = ['Winner', 'Loser', 'Bad Streak', 'Good Streak'];
    const scoreSpecs = ['Score'];

    let newSpecialization = [...filters.specialization];
    const isSelected = newSpecialization.includes(val);

    if (isSelected) {
      newSpecialization = newSpecialization.filter((s) => s !== val);
    } else {
      if (perfSpecs.includes(val)) {
        newSpecialization = newSpecialization.filter(
          (s) => !perfSpecs.includes(s)
        );
      } else if (contextSpecs.includes(val)) {
        newSpecialization = newSpecialization.filter(
          (s) => !contextSpecs.includes(s)
        );
      } else if (scoreSpecs.includes(val)) {
        newSpecialization = newSpecialization.filter(
          (s) => !scoreSpecs.includes(s)
        );
      }
      newSpecialization.push(val);
    }

    let newOrder = filters.insertionOrder ? [...filters.insertionOrder] : [];
    newOrder = newOrder.filter((k) => {
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
      insertionOrder: newOrder,
    });
  };

  const handleTraitGroupChange = (group: {
    label: string;
    traits: string[];
  }) => {
    const isSelected = filters.traits.includes(group.label);
    const newTraits = isSelected ? [] : [group.label];

    // Remove ALL previous traits orders
    let newOrder = filters.insertionOrder ? [...filters.insertionOrder] : [];
    newOrder = newOrder.filter((k) => !k.startsWith('traits:'));

    if (!isSelected) {
      newOrder.push(`traits:${group.label}`);
    }

    onFilterChange({
      ...filters,
      traits: newTraits,
      insertionOrder: newOrder,
    });
  };

  const handleTraitSchemeChange = (scheme: string) =>
    updateFilter('traitScheme', scheme);

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
      traitScheme: [],
      insertionOrder: [],
      matchLimit: 'ALL',
    });
  };

  const hasActiveFilters =
    filters.rarity.length > 0 ||
    filters.schemeName.length > 0 ||
    filters.fur.length > 0 ||
    filters.customClass.length > 0 ||
    filters.specialization.length > 0 ||

    (filters.traitScheme?.length ?? 0) > 0 ||
    filters.stars.length > 0 ||
    (filters.matchLimit && filters.matchLimit !== 'ALL');

  // Pre-compute matches for each accordion
  const rarityOptions = ['Basic', 'Rare', 'Epic', 'Legendary'];
  const rarityMatches = hasMatches(rarityOptions);
  const classMatches = hasMatches(CLASS_OPTIONS);
  const specLabels = SPECIALIZATION_CONFIG.map((s) => s.label);
  const specMatches = hasMatches(specLabels);
  const starsMatches = starsHasMatch();
  const furMatches = hasMatches(FUR_OPTIONS);
  const traitSchemeMatches = hasMatches(TRAIT_SCHEME_OPTIONS);
  const schemeMatches = hasMatches(SCHEME_NAMES);
  const perfLabels = ['Last 10 Matches', 'Last 20 Matches'];
  const performanceMatches = hasMatches(perfLabels);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.headerGroup}>
        <h3 className={styles.sectionTitle}>Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className={styles.clearFiltersButton}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Card Type Toggle - Always Visible */}
      {!hideTypeToggle && (
        <div className={styles.filterGroup}>
          <div className={styles.toggleGroup}>
            {['MOKI', 'SCHEME'].map((type) => (
              <button
                key={type}
                className={`${styles.toggleButton} ${filters.cardType === type ? styles.active : ''}`}
                onClick={() => {
                  if (onCardTypeChange) {
                    onCardTypeChange(type as 'MOKI' | 'SCHEME');
                  } else {
                    onFilterChange({
                      ...filters,
                      cardType: type as 'MOKI' | 'SCHEME',
                    });
                  }
                }}
              >
                {type === 'MOKI' ? 'MOKIS' : type}
              </button>
            ))}
          </div>
        </div>
      )}

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
      </div>

      <div className={styles.scrollableContent}>
        {/* --- MOKI SECTION --- */}
        {filters.cardType !== 'SCHEME' && (
          <>
            {/* Rarity */}
            {!hideRarity && (!filterSearch.trim() || rarityMatches) && (
              <FilterAccordion
                storagePrefix={storagePrefix}
                title="Rarity"
                isOpenDefault={false}
                forceOpen={rarityMatches}
              >
                {filterOptions(rarityOptions).map((r) => (
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
              <FilterAccordion
                storagePrefix={storagePrefix}
                title="Class"
                isOpenDefault={false}
                forceOpen={classMatches}
              >
                {filterOptions(CLASS_OPTIONS).map((c) => (
                  <label key={c} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filters.customClass.includes(c)}
                      onChange={() => handleClassChange(c)}
                    />
                    <span className={styles.labelText}>{c}</span>
                  </label>
                ))}
              </FilterAccordion>
            )}

            {/* Fur */}
            {(!filterSearch.trim() || furMatches) && (
              <FilterAccordion
                storagePrefix={storagePrefix}
                title="Fur"
                isOpenDefault={false}
                forceOpen={furMatches}
              >
                {filterOptions(FUR_OPTIONS).map((f) => (
                  <label key={f} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filters.fur.includes(f)}
                      onChange={() => handleFurChange(f)}
                    />
                    <span className={styles.labelText}>{f}</span>
                  </label>
                ))}
              </FilterAccordion>
            )}


            {/* Trait Schemes */}
            {(!filterSearch.trim() || traitSchemeMatches) && (
              <FilterAccordion
                storagePrefix={storagePrefix}
                title="Trait Schemes"
                isOpenDefault={false}
                forceOpen={traitSchemeMatches}
              >
                {filterOptions(TRAIT_SCHEME_OPTIONS).map((scheme) => (
                  <label key={scheme} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={(filters.traitScheme ?? []).includes(scheme)}
                      onChange={() => handleTraitSchemeChange(scheme)}
                    />
                    <span className={styles.labelText}>{scheme}</span>
                  </label>
                ))}
              </FilterAccordion>
            )}

            {/* Specialization */}
            {(!filterSearch.trim() || specMatches) && (
              <FilterAccordion
                storagePrefix={storagePrefix}
                title="Specialization"
                isOpenDefault={false}
                forceOpen={specMatches}
              >
                {SPECIALIZATION_CONFIG.filter((s) => {
                  if (!filterSearch.trim()) return true;
                  return s.label
                    .toLowerCase()
                    .includes(filterSearch.toLowerCase());
                }).map((s) => (
                  <Fragment key={s.key}>
                    {(s.key === 'Winner' || s.key === 'Score') &&
                      !filterSearch.trim() && (
                        <div className={styles.accordionDivider} />
                      )}
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={filters.specialization.includes(s.key)}
                        onChange={() => handleSpecializationChange(s.key)}
                      />
                      <span className={styles.labelText}>{s.label}</span>
                    </label>
                  </Fragment>
                ))}
              </FilterAccordion>
            )}

            {/* Match Performance Data */}
            {!hideMatchPerformance && (!filterSearch.trim() || performanceMatches) && (
              <FilterAccordion
                storagePrefix={storagePrefix}
                title="Match Performance"
                isOpenDefault={false}
                forceOpen={performanceMatches}
              >
                {[
                  { label: 'Last 10 Matches', value: 10 },
                  { label: 'Last 20 Matches', value: 20 },
                ]
                  .filter(
                    (opt) =>
                      !filterSearch.trim() ||
                      opt.label
                        .toLowerCase()
                        .includes(filterSearch.toLowerCase())
                  )
                  .map((opt) => (
                    <label key={opt.value} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        name="matchLimitFilter"
                        checked={filters.matchLimit === opt.value}
                        onChange={() => {
                          const currentLimit = filters.matchLimit || 'ALL';
                          const newLimit =
                            currentLimit === opt.value
                              ? 'ALL'
                              : (opt.value as 10 | 20);

                          // Handle insertion order logic so the chip appears/disappears
                          let updatedOrder = filters.insertionOrder
                            ? [...filters.insertionOrder]
                            : [];
                          updatedOrder = updatedOrder.filter(
                            (k) =>
                              k !== 'matchLimit:10' &&
                              k !== 'matchLimit:20'
                          );
                          if (newLimit !== 'ALL') {
                            updatedOrder.push(`matchLimit:${newLimit}`);
                          }

                          const updatedExtraSort = newLimit === 'ALL' ? undefined : filters.extraSort;

                          if (newLimit === 'ALL') {
                            updatedOrder = updatedOrder.filter(k => !k.startsWith('extraSort:'));
                          }

                          onFilterChange({
                            ...filters,
                            matchLimit: newLimit,
                            extraSort: updatedExtraSort,
                            insertionOrder: updatedOrder,
                          });
                        }}
                      />
                      <span className={styles.labelText}>{opt.label}</span>
                    </label>
                  ))}
              </FilterAccordion>
            )}

            {/* Extra Sorting - Only if matchLimit is active */}
            {(filters.matchLimit === 10 || filters.matchLimit === 20) && (
              <FilterAccordion
                storagePrefix={storagePrefix}
                title="Extra"
                isOpenDefault={false}
                noAnimate={true}
                noStorage={true}
              >
                {[
                  { label: 'Ended', value: 'endedGame' },
                  { label: 'Deaths', value: 'deaths' },
                  { label: 'Wart Eat', value: 'eatingWhileRiding' },
                  { label: 'Buff Time', value: 'buffTime' },
                  { label: 'Wart Time', value: 'wartTime' },
                  { label: 'Pickups', value: 'looseBallPickups' },
                  { label: 'Eaten', value: 'eatenByWart' },
                  { label: 'Wart Closer', value: 'wartCloser' },
                ].map((opt) => (
                  <label key={opt.value} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filters.extraSort === opt.value}
                      onChange={() => {
                        const newExtraSort = filters.extraSort === opt.value ? undefined : opt.value;
                        
                        onFilterChange({
                          ...filters,
                          extraSort: newExtraSort,
                          // Remove previous extraSort from insertionOrder if any
                          insertionOrder: (filters.insertionOrder || []).filter(k => !k.startsWith('extraSort:'))
                            .concat(newExtraSort ? [`extraSort:${newExtraSort}`] : [])
                        });
                      }}
                    />
                    <span className={styles.labelText}>{opt.label}</span>
                  </label>
                ))}
              </FilterAccordion>
            )}

            {/* Stars - only show if no search or matches "star" or number 1-8 */}
            {(!filterSearch.trim() || starsMatches) && (
              <FilterAccordion
                storagePrefix={storagePrefix}
                title="Stars"
                isOpenDefault={false}
                forceOpen={starsMatches}
              >
                <div className={styles.sliderWrapper}>
                  <StarRangeSlider
                    min={1}
                    max={8}
                    currentRange={{
                      min:
                        filters.stars.length > 0
                          ? Math.min(...filters.stars)
                          : 1,
                      max:
                        filters.stars.length > 0
                          ? Math.max(...filters.stars)
                          : 8,
                    }}
                    onChange={({ min, max }) => {
                      const range = Array.from(
                        { length: max - min + 1 },
                        (_, i) => min + i
                      );
                      const newOrder = filters.insertionOrder
                        ? [...filters.insertionOrder]
                        : [];
                      if (!newOrder.includes('stars:ACTIVE')) {
                        newOrder.push('stars:ACTIVE');
                      }
                      onFilterChange({
                        ...filters,
                        stars: range,
                        insertionOrder: newOrder,
                      });
                    }}
                  />
                </div>
              </FilterAccordion>
            )}

          </>
        )}

        {/* --- SCHEME SECTION --- */}
        {filters.cardType === 'SCHEME' && (
          <>
            {(!filterSearch.trim() || schemeMatches) && (
              <FilterAccordion
                storagePrefix={storagePrefix}
                title="Scheme Name"
                isOpenDefault={false}
                forceOpen={schemeMatches}
              >
                {filterOptions(SCHEME_NAMES).map((name) => (
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
function FilterAccordion({
  title,
  children,
  isOpenDefault = false,
  forceOpen = false,
  storagePrefix = 'default',
  noAnimate = false,
  noStorage = false,
}: {
  title: string;
  children: React.ReactNode;
  isOpenDefault?: boolean;
  forceOpen?: boolean;
  storagePrefix?: string;
  noAnimate?: boolean;
  noStorage?: boolean;
}) {
  const key = `accordion_${storagePrefix}_${title}`;
  const [isOpen, setIsOpen] = useState<boolean>(isOpenDefault);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (!noStorage && typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) {
        setIsOpen(saved === 'true');
      }
    }
  }, [key, noStorage]);

  const shouldBeOpen = forceOpen || isOpen;

  const toggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (!noStorage && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(key, String(nextState));
    }
  };

  return (
    <div className={styles.filterGroup}>
      <button className={styles.accordionHeader} onClick={toggleOpen}>
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
            transform: (isMounted ? shouldBeOpen : isOpenDefault || forceOpen)
              ? 'rotate(180deg)'
              : 'rotate(0deg)',
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {(isMounted ? shouldBeOpen : isOpenDefault || forceOpen) && (
          noAnimate ? (
            <div className={styles.accordionContent}>{children}</div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { duration: 0.3, ease: 'easeInOut' },
              }}
              exit={{
                opacity: 0,
                y: -10,
                transition: { duration: 0.15, ease: 'easeInOut' },
              }}
            >
              <div className={styles.accordionContent}>{children}</div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
