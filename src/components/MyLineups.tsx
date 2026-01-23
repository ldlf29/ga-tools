'use client';

import { EnhancedCard, getCardGroupKey } from '@/utils/cardService';
import { matchesFilter } from '@/utils/filterUtils';
import { FilterState } from './FilterSidebar';
import styles from './MyLineups.module.css';
import RatingSlider from './RatingSlider';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';

export interface SavedLineup {
    id: number;
    name: string;
    cards: EnhancedCard[];
    createdAt: number;
    isFavorite?: boolean;
    favoritedAt?: number;
    rating?: number;
    backgroundId?: string;
}

interface MyLineupsProps {
    lineups: SavedLineup[];
    onDelete: (id: number) => void;
    onRename: (id: number, newName: string) => void;
    onToggleFavorite: (id: number) => void;
    onRate: (id: number, rating: number) => void;
    onUpdateBackground: (id: number, backgroundId: string) => void;
    onBulkDelete: (ids: number[]) => void;
    onError: (message: string) => void;
    filters?: FilterState;
    onRemoveFilter?: (key: keyof FilterState, value: string | number) => void;
    usageMap?: Record<string, number>;
    ownedMap?: Record<string, number>;
}

type SortOption = 'default' | 'name_asc' | 'name_desc' | 'rating_desc' | 'rating_asc';

export default function MyLineups({ lineups, onDelete, onRename, onToggleFavorite, onRate, onUpdateBackground, onBulkDelete, onError, filters, onRemoveFilter, usageMap = {}, ownedMap = {} }: MyLineupsProps) {
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [tempName, setTempName] = useState('');
    const [favoritesOpen, setFavoritesOpen] = useState(true);
    const [allLineupsOpen, setAllLineupsOpen] = useState(true);

    const [favoritesSort, setFavoritesSort] = useState<SortOption>('default');
    const [othersSort, setOthersSort] = useState<SortOption>('default');
    const [activeDropdown, setActiveDropdown] = useState<'favorites' | 'others' | null>(null);
    const [activeBackground, setActiveBackground] = useState<string>('default');

    const BACKGROUND_OPTIONS = [
        { id: 'default', label: 'Default', color: '#5097FF', image: null },
        { id: 'egg_field', label: 'Egg Field', color: '#7BCF5C', image: '/backgrounds/Egg_field .jpg' },
        { id: 'eggu_island', label: 'Eggu Island', color: '#FF4D88', image: '/backgrounds/Eggu_Island.jpg' },
        { id: 'colorful_stars', label: 'Colorful Stars', color: '#4BE3F5', image: '/backgrounds/Colorful_Stars.png' },
        { id: 'moki_universe', label: 'Moki Universe', color: '#6A3DE8', image: '/backgrounds/Moki_Universe.jpg' }
    ];

    const [deleteConfirmSection, setDeleteConfirmSection] = useState<'favorites' | 'others' | null>(null);

    // Sync activeBackground with available lineup data when expanded
    useEffect(() => {
        if (expandedId !== null) {
            const lineup = lineups.find(l => l.id === expandedId);
            if (lineup) {
                // Initialize with saved background or default
                setActiveBackground(lineup.backgroundId || 'default');
            }
        }
    }, [expandedId, lineups]);


    const activeFilters = (() => {
        if (!filters || !filters.insertionOrder || filters.insertionOrder.length === 0) {
            // Fallback
            const defaultList: { key: keyof FilterState, label: string, value: string | number, displayValue?: string }[] = filters ? [
                ...filters.rarity.map(v => ({ key: 'rarity' as keyof FilterState, label: 'RARITY', value: v })),
                ...filters.category.map(v => ({ key: 'category' as keyof FilterState, label: 'CATEGORY', value: v })),
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
            ] : [];
            return defaultList;
        }

        return filters.insertionOrder.map(orderKey => {
            // Special handling for Stars group
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
        }).filter(Boolean) as { key: keyof FilterState, label: string, value: string | number, displayValue?: string }[];
    })();



    // Click outside to close menus
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (activeDropdown && !target.closest(`.${styles.orderByContainer}`)) {
                setActiveDropdown(null);
            }
            if (deleteConfirmSection && !target.closest(`.${styles.deleteAllContainer}`)) {
                setDeleteConfirmSection(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown, deleteConfirmSection]);

    const sortLineups = (items: SavedLineup[], sort: SortOption, isFavorites: boolean) => {
        return [...items].sort((a, b) => {
            switch (sort) {
                case 'name_asc':
                    return a.name.localeCompare(b.name);
                case 'name_desc':
                    return b.name.localeCompare(a.name);
                case 'rating_desc':
                    return (b.rating || 0) - (a.rating || 0);
                case 'rating_asc':
                    return (a.rating || 0) - (b.rating || 0);
                case 'default':
                default:
                    if (isFavorites) {
                        // Favorites: Oldest add first (append order) -> favoritedAt ASC
                        return (a.favoritedAt || 0) - (b.favoritedAt || 0);
                    } else {
                        // Others: Newest first -> createdAt DESC
                        return b.createdAt - a.createdAt;
                    }
            }
        });
    };

    const filteredLineups = lineups.filter(l => {
        const nameMatch = l.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (!nameMatch) return false;

        if (filters) {
            const hasMatchingCard = l.cards.some(card => matchesFilter(card, filters, ''));
            if (!hasMatchingCard) return false;
        }

        return true;
    });

    const rawFavorites = filteredLineups.filter(l => l.isFavorite);
    const rawRecent = filteredLineups.filter(l => !l.isFavorite);

    const favoriteLineups = sortLineups(rawFavorites, favoritesSort, true);
    const recentLineups = sortLineups(rawRecent, othersSort, false);


    const startEditing = (e: React.MouseEvent, id: number, currentName: string) => {
        e.stopPropagation();
        setEditingId(id);
        setTempName(currentName);
    };

    const saveName = (id: number) => {
        if (tempName.length > 20) {
            onError("Maximum 20 characters.");
            return;
        }

        const lineup = lineups.find(l => l.id === id);
        if (lineup && tempName.trim() !== "" && tempName.trim() !== lineup.name) {
            onRename(id, tempName.trim());
        }
        setEditingId(null);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setTempName('');
    };

    // Lock body scroll when modal is open and handle ESC
    useEffect(() => {
        if (expandedId !== null) {
            document.body.style.overflow = 'hidden';
            const handleEsc = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    // Copied from saveName validation to ensure consistency
                    if (editingId !== null && tempName.length > 20) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        onError("Maximum 20 characters.");
                        return;
                    }

                    if (editingId !== null) {
                        saveName(editingId);
                    }
                    setExpandedId(null);
                }
            };
            window.addEventListener('keydown', handleEsc);
            return () => {
                document.body.style.overflow = 'unset';
                window.removeEventListener('keydown', handleEsc);
            };
        } else {
            document.body.style.overflow = 'unset';
            return () => { document.body.style.overflow = 'unset'; };
        }
    }, [expandedId, editingId, tempName]);

    const lineupRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!lineupRef.current) return;

        setIsDownloading(true);
        try {
            // Wait a tick for any UI updates
            await new Promise(resolve => setTimeout(resolve, 100));

            const dataUrl = await toPng(lineupRef.current, {
                cacheBust: true,
                pixelRatio: 2, // Better quality
                backgroundColor: undefined,
                // Actually if ref is modalContent, it has a background.
                // But wait, the user wants "Background actual".
                // If I capture modalContent, it has the background image/color.
                // I should NOT set backgroundColor here, or set it to null to respect the element's style.
                filter: (node) => {
                    // Exclude elements with specific classes or IDs
                    if (node.classList && node.classList.contains(styles.excludeFromCapture)) {
                        return false;
                    }
                    if (node.id === 'download-button' || node.id === 'background-switcher' || node.id === 'rating-slider-container') {
                        return false;
                    }
                    return true;
                }
            });

            const link = document.createElement('a');
            link.download = `${expandedLineup?.name || 'lineup'}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Failed to download lineup', err);
            onError("Failed to generate image");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, id: number) => {
        if (e.key === 'Enter') {
            saveName(id);
        } else if (e.key === 'Escape') {
            // Add validation here too so input focus ESC doesn't bypass it
            if (tempName.length > 20) {
                e.preventDefault();
                e.stopPropagation();
                onError("Maximum 20 characters.");
                return;
            }
            cancelEditing();
        }
    };

    const expandedLineup = lineups.find(l => l.id === expandedId);

    const isLineupOverused = (lineup: SavedLineup) => {
        return lineup.cards.some(card => {
            const key = getCardGroupKey(card);
            const used = usageMap[key] || 0;
            const owned = ownedMap[key] || 0;
            return used > owned;
        });
    };

    const renderLineupCard = (lineup: SavedLineup) => {
        const mokis = lineup.cards.filter(c => c.cardType !== 'SCHEME');
        const scheme = lineup.cards.find(c => c.cardType === 'SCHEME');
        const sortedCards = scheme ? [...mokis, scheme] : mokis;

        const bgOptions = BACKGROUND_OPTIONS.find(b => b.id === (lineup.backgroundId || 'default'));
        const bgStyle = {
            backgroundColor: bgOptions?.color || '#5097FF',
            backgroundImage: bgOptions?.image ? `url('${bgOptions.image}')` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
        };

        return (
            <motion.div
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                key={lineup.id}
                className={styles.lineupCard}
                onClick={() => setExpandedId(lineup.id)}
                style={bgStyle}
            >
                {/* Overuse Warning */}
                {isLineupOverused(lineup) && (
                    <div className={styles.warningIcon} title="Warning: Contains overused cards (More used than owned)">
                        !
                    </div>
                )}

                <button
                    className={styles.deleteButton}
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent opening modal
                        onDelete(lineup.id);
                    }}
                    title="Delete Lineup"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                <div className={styles.lineupHeader}>
                    <div className={styles.nameWrapper}>
                        <button
                            className={`${styles.favoriteButton} ${lineup.isFavorite ? styles.isFavorite : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(lineup.id);
                            }}
                            title={lineup.isFavorite ? "Unfavorite" : "Favorite"}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                        </button>
                        <div className={styles.lineupName}>{lineup.name}</div>
                    </div>
                </div>

                <div className={styles.cardPreview}>
                    {sortedCards.map((card, idx) => (
                        <img
                            key={`${lineup.id}-${idx}`}
                            src={card.image}
                            alt={card.name}
                            title={card.name}
                            className={`${styles.previewImage} ${card.cardType === 'SCHEME' ? styles.schemeImage : ''}`}
                        />
                    ))}
                </div>

                <div className={styles.ratingBadge}>
                    {lineup.rating || 0}
                </div>
            </motion.div>
        );
    };

    const renderSortDropdown = (section: 'favorites' | 'others', currentSort: SortOption, setSort: (s: SortOption) => void) => (
        <div className={styles.orderByContainer}>
            <button
                className={styles.orderByButton}
                onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === section ? null : section);
                }}
            >
                ORDER BY...
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: activeDropdown === section ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            {activeDropdown === section && (
                <ul className={styles.orderByMenu}>
                    <li onClick={() => { setSort('default'); setActiveDropdown(null); }} className={currentSort === 'default' ? styles.activeSort : ''}>Default</li>
                    <li onClick={() => { setSort('name_asc'); setActiveDropdown(null); }} className={currentSort === 'name_asc' ? styles.activeSort : ''}>Name A → Z</li>
                    <li onClick={() => { setSort('name_desc'); setActiveDropdown(null); }} className={currentSort === 'name_desc' ? styles.activeSort : ''}>Name Z → A</li>
                    <li onClick={() => { setSort('rating_desc'); setActiveDropdown(null); }} className={currentSort === 'rating_desc' ? styles.activeSort : ''}>Rate High → Low</li>
                    <li onClick={() => { setSort('rating_asc'); setActiveDropdown(null); }} className={currentSort === 'rating_asc' ? styles.activeSort : ''}>Rate Low → High</li>
                </ul>
            )}
        </div>
    );

    const renderDeleteAllButton = (section: 'favorites' | 'others', idsToDelete: number[]) => {
        if (idsToDelete.length === 0) return null;

        return (
            <div className={styles.deleteAllContainer}>
                <button
                    className={styles.deleteAllButton}
                    onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmSection(deleteConfirmSection === section ? null : section);
                    }}
                >
                    DELETE ALL
                </button>
                {deleteConfirmSection === section && (
                    <div className={styles.deleteConfirmationMenu}>
                        <div className={styles.deleteConfirmationText}>Are you sure you want to delete all your lineups?</div>
                        <div className={styles.deleteActions}>
                            <button
                                className={`${styles.deleteConfirmBtn} ${styles.btnYes}`}
                                onClick={() => {
                                    onBulkDelete(idsToDelete);
                                    setDeleteConfirmSection(null);
                                }}
                            >
                                YES
                            </button>
                            <button
                                className={`${styles.deleteConfirmBtn} ${styles.btnNo}`}
                                onClick={() => setDeleteConfirmSection(null)}
                            >
                                NO
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (lineups.length === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <h2>No saved lineups yet</h2>
                    <p>Go to the Builder to create your first team!</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.topBar}>
                <div className={styles.headerTopRow}>
                    <h2 className={styles.title}>My Lineups ({filteredLineups.length})</h2>
                    <input
                        type="text"
                        placeholder="Search lineups..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>

                {activeFilters.length > 0 && onRemoveFilter && (
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

            {favoriteLineups.length > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h3 className={styles.sectionTitle}>
                                FAVORITES <span className={styles.count}>({favoriteLineups.length})</span>
                            </h3>
                            <button className={styles.toggleButton} onClick={() => setFavoritesOpen(!favoritesOpen)}>
                                {favoritesOpen ? (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                ) : (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                )}
                            </button>
                        </div>
                        {favoritesOpen && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {renderSortDropdown('favorites', favoritesSort, setFavoritesSort)}
                                {renderDeleteAllButton('favorites', favoriteLineups.map(l => l.id))}
                            </div>
                        )}
                    </div>
                    <AnimatePresence>
                        {favoritesOpen && (
                            <motion.div
                                key="favorites-content"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                style={{ overflow: "hidden" }}
                            >
                                <div className={styles.grid}>
                                    {favoriteLineups.map(renderLineupCard)}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {recentLineups.length > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h3 className={styles.sectionTitle}>
                                {favoriteLineups.length > 0 ? 'OTHERS' : 'ALL LINEUPS'} <span className={styles.count}>({recentLineups.length})</span>
                            </h3>
                            <button className={styles.toggleButton} onClick={() => setAllLineupsOpen(!allLineupsOpen)}>
                                {allLineupsOpen ? (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                ) : (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                )}
                            </button>
                        </div>
                        {allLineupsOpen && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {renderSortDropdown('others', othersSort, setOthersSort)}
                                {renderDeleteAllButton('others', recentLineups.map(l => l.id))}
                            </div>
                        )}
                    </div>
                    <AnimatePresence>
                        {allLineupsOpen && (
                            <motion.div
                                key="others-content"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                style={{ overflow: "hidden" }}
                            >
                                <div className={styles.grid}>
                                    {recentLineups.map(renderLineupCard)}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {filteredLineups.length === 0 && (
                <div className={styles.noResults}>No lineups found matching your filters.</div>
            )}

            {/* Modal Overlay */}
            {expandedLineup && (
                <div className={styles.modalOverlay} onClick={() => {
                    // If editing and name is too long, don't allow closing
                    if (editingId !== null && tempName.length > 20) {
                        onError("Maximum 20 characters.");
                        return;
                    }
                    // Save name if editing before closing
                    if (editingId !== null) {
                        saveName(editingId);
                    }
                    setExpandedId(null);
                }}>
                    <div
                        ref={lineupRef}
                        className={styles.modalContent}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: BACKGROUND_OPTIONS.find(b => b.id === activeBackground)?.color,
                            backgroundImage: (() => {
                                const bg = BACKGROUND_OPTIONS.find(b => b.id === activeBackground);
                                return bg?.image ? `url('${bg.image}')` : 'none';
                            })(),
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                    >


                        {/* Header Row: Download | Title */}
                        <div className={styles.modalHeaderRow}>
                            <button
                                id="download-button"
                                className={`${styles.modalDownloadButton} ${styles.excludeFromCapture}`}
                                onClick={handleDownload}
                                title="Download Lineup Image"
                                disabled={isDownloading}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </button>

                            <div className={styles.modalTitleWrapper}>
                                {editingId === expandedLineup.id ? (
                                    <input
                                        key="modal-edit-input"
                                        type="text"
                                        value={tempName}
                                        onChange={(e) => setTempName(e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, expandedLineup.id)}
                                        onBlur={() => saveName(expandedLineup.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        autoFocus
                                        className={styles.modalEditInput}
                                    />
                                ) : (
                                    <div
                                        className={styles.modalTitle}
                                        onClick={(e) => startEditing(e, expandedLineup.id, expandedLineup.name)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {expandedLineup.name}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Background Switcher */}
                        <div id="background-switcher" className={`${styles.backgroundSwitcher} ${styles.excludeFromCapture}`}>
                            {BACKGROUND_OPTIONS.map((bg) => (
                                <button
                                    key={bg.id}
                                    className={`${styles.bgOption} ${activeBackground === bg.id ? styles.bgOptionActive : ''}`}
                                    style={{ backgroundColor: bg.color }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveBackground(bg.id);
                                        if (expandedLineup) {
                                            onUpdateBackground(expandedLineup.id, bg.id);
                                        }
                                    }}
                                    title={bg.label}
                                />
                            ))}
                        </div>

                        <div style={{ padding: '2rem', borderRadius: '1rem' }}>


                            <div className={styles.modalGrid} style={{ flexWrap: 'nowrap', padding: '0.25rem' }}>
                                {(() => {
                                    const mokis = expandedLineup.cards.filter(c => c.cardType !== 'SCHEME');
                                    const scheme = expandedLineup.cards.find(c => c.cardType === 'SCHEME');
                                    const sortedModalCards = scheme ? [...mokis, scheme] : mokis;

                                    return sortedModalCards.map((card, idx) => (
                                        <div key={idx} className={`${styles.modalCard} ${card.cardType === 'SCHEME' ? styles.schemeImage : ''}`} style={{ flexShrink: 0 }}>
                                            <img src={card.image} alt={card.name} />
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>

                        <div id="rating-slider-container" className={styles.excludeFromCapture} style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem', paddingBottom: '0.5rem' }}>
                            <RatingSlider
                                value={expandedLineup.rating || 0}
                                onChange={(val) => onRate(expandedLineup.id, val)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
