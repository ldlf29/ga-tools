'use client';

import { EnhancedCard, SavedLineup, FilterState } from '@/types';
import { getCardGroupKey, getCardCharacterImage } from '@/utils/cardService';
import { matchesFilter } from '@/utils/filterUtils';
import { getActiveFiltersDisplay } from '@/utils/filterDisplay';
import styles from './MyLineups.module.css';
import FilterSidebar from './FilterSidebar';
import NextImage from 'next/image';
import RatingSlider from './RatingSlider';
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import CardGrid from './CardGrid';
import CardModal from './CardModal';
import { LineupCardSelector } from '@/components/LineupCardSelector';
import { useWorkerFilter } from '@/hooks/useWorkerFilter';

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
    // Collapsible states passed from parent
    favoritesOpen: boolean;
    setFavoritesOpen: (open: boolean) => void;
    allLineupsOpen: boolean;
    setAllLineupsOpen: (open: boolean) => void;
    // New props for editing
    allCards: EnhancedCard[];
    onUpdateLineup: (id: number, cards: EnhancedCard[]) => void;
    isUserMode?: boolean;
}

type SortOption = 'default' | 'name_asc' | 'name_desc' | 'rating_desc' | 'rating_asc';

export default function MyLineups({
    lineups, onDelete, onRename, onToggleFavorite, onRate,
    onUpdateBackground, onBulkDelete, onError, filters, onRemoveFilter,
    favoritesOpen, setFavoritesOpen, allLineupsOpen, setAllLineupsOpen,
    allCards, onUpdateLineup, isUserMode
}: MyLineupsProps) {
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (expandedId !== null) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [expandedId]);

    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [tempName, setTempName] = useState('');

    const [favoritesSort, setFavoritesSort] = useState<SortOption>('default');
    const [othersSort, setOthersSort] = useState<SortOption>('default');
    const [activeDropdown, setActiveDropdown] = useState<'favorites' | 'others' | null>(null);
    const [activeBackground, setActiveBackground] = useState<string>('default');
    const [showDataInfo, setShowDataInfo] = useState(false);
    const [showRatingInfo, setShowRatingInfo] = useState(false);
    const infoWrapperRef = useRef<HTMLDivElement>(null);
    const [selectedInfoCard, setSelectedInfoCard] = useState<EnhancedCard | null>(null);

    // Editing State
    const [localCards, setLocalCards] = useState<(EnhancedCard | null)[]>([]);
    const [originalCards, setOriginalCards] = useState<(EnhancedCard | null)[]>([]);

    // Derived state for changes
    const hasChanges = useMemo(() => {
        if (localCards.length !== originalCards.length) return false;
        return localCards.some((card, index) => {
            const original = originalCards[index];
            if (card === original) return false;
            if (!card || !original) return true;

            // Compare key properties
            return card.name !== original.name ||
                card.rarity !== original.rarity ||
                card.image !== original.image ||
                JSON.stringify(card.custom) !== JSON.stringify(original.custom);
        });
    }, [localCards, originalCards]);

    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    // Card Selector State
    const [selectorSlot, setSelectorSlot] = useState<number | null>(null);
    const [selectorSearch, setSelectorSearch] = useState('');
    const [selectorFilters, setSelectorFilters] = useState<FilterState>({
        cardType: 'MOKI',
        rarity: [], schemeName: [], fur: [], stars: [], customClass: [], specialization: [], traits: [], insertionOrder: []
    });
    const [selectorMobileFiltersOpen, setSelectorMobileFiltersOpen] = useState(false);

    // Reset mobile filters when closing selector
    useEffect(() => {
        if (selectorSlot === null) {
            setSelectorMobileFiltersOpen(false);
        }
    }, [selectorSlot]);

    const filteredSelectorCards = useWorkerFilter(allCards, selectorFilters, selectorSearch);

    const [copiedSlot, setCopiedSlot] = useState<number | null>(null);

    const handleCopyCardName = (e: React.MouseEvent, cardName: string, slotIndex: number) => {
        e.stopPropagation();
        navigator.clipboard.writeText(cardName);
        setCopiedSlot(slotIndex);
        setTimeout(() => setCopiedSlot(null), 1500);
    };

    const handleExportExcel = async () => {
        const favorites = favoriteLineups;
        if (favorites.length === 0) {
            onError("No lineups in favorite!");
            return;
        }

        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Favorite Lineups');

        // Define columns
        worksheet.columns = [
            { header: 'Team Name', key: 'name', width: 20 },
            { header: 'Moki 1', key: 'moki1', width: 15 },
            { header: 'Class 1', key: 'class1', width: 12 },
            { header: 'Rarity 1', key: 'rarity1', width: 12 },
            { header: 'Moki 2', key: 'moki2', width: 15 },
            { header: 'Class 2', key: 'class2', width: 12 },
            { header: 'Rarity 2', key: 'rarity2', width: 12 },
            { header: 'Moki 3', key: 'moki3', width: 15 },
            { header: 'Class 3', key: 'class3', width: 12 },
            { header: 'Rarity 3', key: 'rarity3', width: 12 },
            { header: 'Moki 4', key: 'moki4', width: 15 },
            { header: 'Class 4', key: 'class4', width: 12 },
            { header: 'Rarity 4', key: 'rarity4', width: 12 },
            { header: 'Scheme', key: 'scheme', width: 15 },
            { header: 'Rating', key: 'rating', width: 10 },
        ];

        // Add rows
        favorites.forEach((l: SavedLineup) => {
            const mokis = l.cards.filter(c => c.cardType !== 'SCHEME');
            const scheme = l.cards.find(c => c.cardType === 'SCHEME');

            worksheet.addRow({
                name: l.name,
                moki1: mokis[0]?.name || '',
                class1: mokis[0]?.custom?.class || '',
                rarity1: mokis[0]?.rarity || '',
                moki2: mokis[1]?.name || '',
                class2: mokis[1]?.custom?.class || '',
                rarity2: mokis[1]?.rarity || '',
                moki3: mokis[2]?.name || '',
                class3: mokis[2]?.custom?.class || '',
                rarity3: mokis[2]?.rarity || '',
                moki4: mokis[3]?.name || '',
                class4: mokis[3]?.custom?.class || '',
                rarity4: mokis[3]?.rarity || '',
                scheme: scheme?.name || '',
                rating: l.rating || 0
            });
        });

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Trigger download
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'Favorite_Lineups.xlsx';
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    // --- Editing Handlers ---

    const handleSelectSlot = (index: number) => {
        setSelectorSlot(index);
        // Initialize filters based on slot type (0-3 = MOKI, 4 = SCHEME)
        const type = index === 4 ? 'SCHEME' : 'MOKI';
        setSelectorFilters({
            ...selectorFilters,
            cardType: type,
            // Reset other filters
            rarity: [], schemeName: [], fur: [], stars: [], customClass: [], specialization: [], traits: [], insertionOrder: []
        });
    };

    const handleCardSelect = (card: EnhancedCard) => {
        if (selectorSlot === null) return;

        // Validation for Mokis (Slots 0-3)
        if (selectorSlot < 4) {
            // Check if Moki name already exists in other slots
            const isDuplicate = localCards.some((c, i) => i !== selectorSlot && c?.name === card.name);
            if (isDuplicate) {
                onError("You cannot have duplicate Mokis!");
                return;
            }
        }

        const newCards = [...localCards];
        newCards[selectorSlot] = card;
        setLocalCards(newCards);
        setSelectorSlot(null);
    };

    const handleDeleteCard = (index: number) => {
        const newCards = [...localCards];
        newCards[index] = null;
        setLocalCards(newCards);
    };

    const handleUndoDelete = (index: number) => {
        const newCards = [...localCards];
        newCards[index] = originalCards[index];
        setLocalCards(newCards);
    };

    const handleSaveChanges = () => {
        if (localCards.some(c => c === null)) {
            onError("Lineup must have 5 cards!");
            return;
        }
        // Filter out nulls (guaranteed by check above)
        onUpdateLineup(expandedId!, localCards as EnhancedCard[]);
        setOriginalCards(localCards); // Update reference to mark as saved
    };



    const handleSelectorRemoveFilter = (key: keyof FilterState, value: string | number) => {
        setSelectorFilters(prev => ({
            ...prev,
            [key]: (prev[key] as any[]).filter((v: any) => v !== value)
        }));
    };

    const BACKGROUND_OPTIONS = [
        { id: 'default', label: 'Default', color: '#5097FF', image: null },
        { id: 'egg_field', label: 'Egg Field', color: '#7BCF5C', image: '/backgrounds/Egg_field.jpg' },
        { id: 'eggu_island', label: 'Eggu Island', color: '#FF4D88', image: '/backgrounds/Eggu_Island.jpg' },
        { id: 'colorful_stars', label: 'Colorful Stars', color: '#4BE3F5', image: '/backgrounds/Colorful_Stars.png' },
        { id: 'moki_universe', label: 'Moki Universe', color: '#6A3DE8', image: '/backgrounds/Moki_Universe.jpg' }
    ];

    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deleteConfirmSection, setDeleteConfirmSection] = useState<'favorites' | 'others' | null>(null);
    const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
    const [imageDownloadConfirmOpen, setImageDownloadConfirmOpen] = useState(false);

    // Track initialized ID to prevent resetting state on updates (like background change)
    const initializedIdRef = useRef<number | null>(null);

    // Sync activeBackground and initialize editing state
    useEffect(() => {
        if (expandedId !== null) {
            // Only initialize if we haven't already for this ID
            if (expandedId !== initializedIdRef.current) {
                const lineup = lineups.find(l => l.id === expandedId);
                if (lineup) {
                    setActiveBackground(lineup.backgroundId || 'default');

                    // Initialize local cards (5 slots: 0-3 Moki, 4 Scheme)
                    const mokis = lineup.cards.filter(c => c.cardType !== 'SCHEME');
                    const scheme = lineup.cards.find(c => c.cardType === 'SCHEME');
                    const slots = Array(5).fill(null);

                    // Fill Moki slots
                    mokis.forEach((m, i) => {
                        if (i < 4) slots[i] = m;
                    });

                    // Fill Scheme slot
                    if (scheme) slots[4] = scheme;

                    setLocalCards(slots);
                    setOriginalCards(slots);
                    setSelectorSlot(null);
                    setEditingId(null);
                    initializedIdRef.current = expandedId;
                }
            }
        } else {
            initializedIdRef.current = null;
        }
    }, [expandedId, lineups]);


    const activeFilters = filters ? getActiveFiltersDisplay(filters) : [];



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
            if (deleteConfirmId && !target.closest(`.${styles.lineupCard}`)) {
                setDeleteConfirmId(null);
            }
            if (exportConfirmOpen && !target.closest(`.${styles.confirmationContainer}`)) {
                setExportConfirmOpen(false);
            }
            if (imageDownloadConfirmOpen && !target.closest(`.${styles.confirmationContainer}`)) {
                setImageDownloadConfirmOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown, deleteConfirmSection, deleteConfirmId, exportConfirmOpen, imageDownloadConfirmOpen]);

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

    useEffect(() => {
        if (showDataInfo) {
            const timer = setTimeout(() => {
                setShowDataInfo(false);
            }, 5000);

            const handleClickOutside = (event: MouseEvent) => {
                if (infoWrapperRef.current && !infoWrapperRef.current.contains(event.target as Node)) {
                    setShowDataInfo(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                clearTimeout(timer);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showDataInfo]);

    useEffect(() => {
        if (showRatingInfo) {
            const timer = setTimeout(() => {
                setShowRatingInfo(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [showRatingInfo]);

    const filteredLineups = useMemo(() => {
        // Hydrate the lineups with fresh class/fur from allCards to prevent stale metadata
        const hydratedLineups = lineups.map(l => ({
            ...l,
            cards: l.cards.map(card => {
                if (card.cardType !== 'MOKI') return card;
                // Match by name or some reliable unique identifier
                const freshCard = allCards.find(c => c.name === card.name);
                if (freshCard && freshCard.custom) {
                    return {
                        ...card,
                        custom: {
                            ...card.custom,
                            class: freshCard.custom.class || card.custom?.class
                        }
                    };
                }
                return card;
            })
        }));

        return hydratedLineups.filter(l => {
            const nameMatch = l.name.toLowerCase().includes(searchQuery.toLowerCase());
            if (!nameMatch) return false;

            if (filters) {
                const hasMatchingCard = l.cards.some(card => matchesFilter(card, filters, ''));
                if (!hasMatchingCard) return false;
            }

            return true;
        });
    }, [lineups, searchQuery, filters, allCards]);

    const favoriteLineups = useMemo(() => {
        const rawFavorites = filteredLineups.filter(l => l.isFavorite);
        return sortLineups(rawFavorites, favoritesSort, true);
    }, [filteredLineups, favoritesSort]);

    const recentLineups = useMemo(() => {
        const rawRecent = filteredLineups.filter(l => !l.isFavorite);
        return sortLineups(rawRecent, othersSort, false);
    }, [filteredLineups, othersSort]);


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

    // handleCloseModal Logic
    const handleCloseModal = () => {
        if (hasChanges) {
            setShowDiscardConfirm(true);
        } else {
            setExpandedId(null);
        }
    };

    // Lock body scroll when modal is open and handle ESC
    useEffect(() => {
        if (expandedId !== null) {
            document.body.classList.add('modal-open');
            document.documentElement.classList.add('modal-open');
            const handleEsc = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    // If selector is open, just close it and stop
                    if (selectorSlot !== null) {
                        setSelectorSlot(null);
                        return;
                    }

                    // If we are editing, we must validate and save first
                    if (editingId !== null) {
                        if (tempName.length > 20) {
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            onError("Maximum 20 characters.");
                            return;
                        }
                        saveName(editingId);
                    }

                    if (hasChanges) {
                        setShowDiscardConfirm(true);
                    } else {
                        setExpandedId(null);
                    }
                }
            };
            window.addEventListener('keydown', handleEsc);
            return () => {
                document.body.classList.remove('modal-open');
                document.documentElement.classList.remove('modal-open');
                window.removeEventListener('keydown', handleEsc);
            };
        } else {
            document.body.classList.remove('modal-open');
            document.documentElement.classList.remove('modal-open');
            return () => {
                document.body.classList.remove('modal-open');
                document.documentElement.classList.remove('modal-open');
            };
        }
    }, [expandedId, editingId, tempName, hasChanges, selectorSlot]);

    const lineupRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!lineupRef.current) return;

        setIsDownloading(true);
        try {
            // Wait a tick for any UI updates
            await new Promise(resolve => setTimeout(resolve, 100));

            // Temporarily hide elements we don't want in the capture
            const excludeSelectors = [
                '#download-button',
                '#background-switcher',
                '#rating-slider-container',
                `.${styles.excludeFromCapture}`,
                `.${styles.modalCardClassBadge}`,
                `.${styles.cardInfoActions}`
            ];
            const hiddenElements: { el: HTMLElement, display: string }[] = [];
            excludeSelectors.forEach(selector => {
                lineupRef.current!.querySelectorAll<HTMLElement>(selector).forEach(el => {
                    hiddenElements.push({ el, display: el.style.display });
                    el.style.display = 'none';
                });
            });

            try {
                // Clear any text selection that might cause "selection" artifacts
                window.getSelection()?.removeAllRanges();

                const canvas = await html2canvas(lineupRef.current, {
                    useCORS: true,
                    allowTaint: false,
                    scale: 2,
                    backgroundColor: null,
                    logging: false,
                    onclone: (clonedDoc) => {
                        // Ensure the cloned version doesn't have any accidental hover or transition states
                        const clonedEl = clonedDoc.querySelector(`.${styles.modalContent}`) as HTMLElement;
                        if (clonedEl) {
                            clonedEl.style.transform = 'none';
                            clonedEl.style.transition = 'none';
                            clonedEl.style.animation = 'none';
                        }
                    }
                });

                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `${expandedLineup?.name || 'lineup'}.png`;
                link.href = dataUrl;
                link.click();
            } finally {
                // Restore hidden elements
                hiddenElements.forEach(({ el, display }) => {
                    el.style.display = display;
                });
            }
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
            if (tempName.length > 20) {
                e.preventDefault();
                e.stopPropagation();
                onError("Maximum 20 characters.");
                return;
            }
            saveName(id);
            setExpandedId(null);
        }
    };

    const expandedLineup = lineups.find(l => l.id === expandedId);


    // Calculate overused cards
    const overusedImages = useMemo(() => {
        const inventoryCounts = new Map<string, number>();
        allCards.forEach(card => {
            const key = card.image;
            inventoryCounts.set(key, (inventoryCounts.get(key) || 0) + 1);
        });

        const usageCounts = new Map<string, number>();
        lineups.forEach(lineup => {
            lineup.cards.forEach(card => {
                const key = card.image;
                usageCounts.set(key, (usageCounts.get(key) || 0) + 1);
            });
        });

        const overused = new Set<string>();
        usageCounts.forEach((count, key) => {
            const inventory = inventoryCounts.get(key) || 0;
            if (count > inventory) {
                overused.add(key);
            }
        });
        return overused;
    }, [allCards, lineups]);

    const renderLineupCard = (lineup: SavedLineup) => {
        const mokis = lineup.cards.filter(c => c.cardType !== 'SCHEME');
        const scheme = lineup.cards.find(c => c.cardType === 'SCHEME');
        const sortedCards = scheme ? [...mokis, scheme] : mokis;

        const hasConflict = isUserMode && lineup.cards.some(c => overusedImages.has(c.image));

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
                onClick={() => {
                    setExpandedId(lineup.id);
                    setShowDataInfo(false);
                    setShowRatingInfo(false);
                }}
                style={bgStyle}
            >

                <button
                    className={styles.deleteButton}
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent opening modal
                        setDeleteConfirmId(deleteConfirmId === lineup.id ? null : lineup.id);
                    }}
                    title="Delete Lineup"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                {hasConflict && (
                    <div className={styles.warningIcon} title="This lineup contains cards that exceed your inventory limit.">
                        !
                    </div>
                )}

                {/* Rest of the component... */}

                {deleteConfirmId === lineup.id && (
                    <div
                        className={styles.individualDeleteMenu}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.deleteConfirmationText}>Delete this lineup?</div>
                        <div className={styles.deleteActions}>
                            <button
                                className={`${styles.deleteConfirmBtn} ${styles.btnYes}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(lineup.id);
                                    setDeleteConfirmId(null);
                                }}
                            >
                                YES
                            </button>
                            <button
                                className={`${styles.deleteConfirmBtn} ${styles.btnNo}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(null);
                                }}
                            >
                                NO
                            </button>
                        </div>
                    </div>
                )}

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
                        <div key={`${lineup.id}-${idx}`} className={styles.previewImageContainer} style={{ position: 'relative', flex: 1, aspectRatio: '0.7' }}>
                            <NextImage
                                src={getCardCharacterImage(card)}
                                alt={card.name}
                                title={card.name}
                                fill
                                sizes="(max-width: 400px) 20vw, 50px"
                                className={`
                                    ${styles.previewImage} 
                                    ${card.cardType === 'MOKI' ? (styles[`rarity${card.rarity}`] || '') : ''} 
                                    ${card.cardType === 'SCHEME' ? styles.schemeImage : ''}
                                `}
                                style={{ objectFit: 'cover', borderRadius: '0.5rem' }}
                            />
                        </div>
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
                    <div className={styles.bulkDeleteMenu}>
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
                    <div className={styles.titleGroup}>
                        <h2 className={styles.title}>My Lineups</h2>
                        <div className={`${styles.confirmationContainer}`}>
                            <button
                                className={styles.exportButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (favoriteLineups.length === 0) {
                                        onError("No lineups in favorite!");
                                        return;
                                    }
                                    setExportConfirmOpen(!exportConfirmOpen);
                                }}
                                title="Export to Excel"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor">
                                    <path d="M64 48l112 0 0 88c0 39.8 32.2 72 72 72l88 0 0 240c0 8.8-7.2 16-16 16L64 464c-8.8 0-16-7.2-16-16L48 64c0-8.8 7.2-16 16-16zM224 67.9l92.1 92.1-68.1 0c-13.3 0-24-10.7-24-24l0-68.1zM64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-261.5c0-17-6.7-33.3-18.7-45.3L242.7 18.7C230.7 6.7 214.5 0 197.5 0L64 0zm99.2 265.6c-8-10.6-23-12.8-33.6-4.8s-12.8 23-4.8 33.6L162 344 124.8 393.6c-8 10.6-5.8 25.6 4.8 33.6s25.6 5.8 33.6-4.8L192 384 220.8 422.4c8 10.6 23 12.8 33.6 4.8s12.8-23 4.8-33.6L222 344 259.2 294.4c8-10.6 5.8-25.6-4.8-33.6s-25.6-5.8-33.6 4.8L192 304 163.2 265.6z" />
                                </svg>
                            </button>
                            {exportConfirmOpen && (
                                <div className={`${styles.deleteConfirmationMenu} ${styles.deleteConfirmationMenuBlue}`}>
                                    <div className={styles.deleteConfirmationText}>Would you like to download your favorite lineups in Excel?</div>
                                    <div className={styles.deleteActions}>
                                        <button
                                            className={`${styles.deleteConfirmBtn} ${styles.btnSuccess}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleExportExcel();
                                                setExportConfirmOpen(false);
                                            }}
                                        >
                                            YES
                                        </button>
                                        <button
                                            className={`${styles.deleteConfirmBtn} ${styles.btnNo}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setExportConfirmOpen(false);
                                            }}
                                        >
                                            NO
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={`${styles.headerRight} ${styles.desktopSearch}`}>
                        <div className={styles.infoWrapper} ref={infoWrapperRef}>
                            <button
                                className={styles.infoButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDataInfo(!showDataInfo);
                                }}
                                title="Data Management Info"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                </svg>
                            </button>
                            {showDataInfo && (
                                <div className={styles.infoPopup}>
                                    Data is stored locally in your browser. Clearing your browser cache will delete your lineups.
                                </div>
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="Search lineups..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                </div>

                <div className={styles.searchRow}>
                    <div className={styles.mobileSearchWrapper}>
                        <div className={styles.infoWrapper} ref={infoWrapperRef}>
                            <button
                                className={styles.infoButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDataInfo(!showDataInfo);
                                }}
                                style={{
                                    borderColor: '#333'
                                }}
                                title="Data Management Info"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                </svg>
                            </button>
                            {showDataInfo && (
                                <div className={`${styles.infoPopup} ${styles.infoPopupExt}`}>
                                    Data is stored locally in your browser. Clearing your browser cache will delete your lineups.
                                </div>
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="Search lineups..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
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
                        <div className={styles.sectionTitleRow}>
                            <h3 className={styles.sectionTitle}>
                                FAVORITES
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
                            <div className={styles.sectionActionRow}>
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
                                className={styles.overflowHidden}
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
                        <div className={styles.sectionTitleRow}>
                            <h3 className={styles.sectionTitle}>
                                {favoriteLineups.length > 0 ? 'OTHERS' : 'ALL LINEUPS'}
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
                            <div className={styles.sectionActionRow}>
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
                                className={styles.overflowHidden}
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
                <div
                    className={styles.modalOverlay}
                    style={{ overflowY: selectorSlot !== null ? 'hidden' : 'auto' }}
                    onClick={() => {
                        // If editing and name is too long, don't allow closing
                        if (editingId !== null && tempName.length > 20) {
                            onError("Maximum 20 characters.");
                            return;
                        }
                        // Save name if editing before closing
                        if (editingId !== null) {
                            saveName(editingId);
                        }
                        handleCloseModal();
                    }}>
                    <div
                        key={expandedLineup.id}
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
                        {/* Close Button */}
                        {selectorSlot === null && (
                            <button
                                className={`${styles.modalCloseButton} ${styles.excludeFromCapture}`}
                                onClick={handleCloseModal}
                                title="Close"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        )}

                        {/* Header Row: Download | Title */}
                        <div className={styles.modalHeaderRow}>


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
                                    <div className={styles.titleAnchor}>
                                        <div
                                            className={styles.modalTitle}
                                            onClick={(e) => startEditing(e, expandedLineup.id, expandedLineup.name)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {expandedLineup.name}
                                        </div>
                                        <div
                                            className={`${styles.editPencil} ${styles.excludeFromCapture}`}
                                            onClick={(e) => startEditing(e, expandedLineup.id, expandedLineup.name)}
                                            title="Edit name"
                                        >
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>


                        <div className={styles.modalGridContainer}>
                            <div className={styles.modalGrid}>
                                {localCards.map((card, idx) => (
                                    <div key={`slot-${idx}`} className={styles.modalCardWrapper}>
                                        {card ? (
                                            <div className={`${styles.modalCard} ${card.cardType === 'SCHEME' ? styles.schemeImage : ''} ${styles.modalCardRelative}`}>
                                                <NextImage
                                                    src={card.image}
                                                    alt={card.name}
                                                    fill
                                                    sizes="200px"
                                                    style={{ objectFit: 'cover' }}
                                                />
                                                {/* Delete Button (Overlay) */}
                                                <div
                                                    className={`${styles.deleteOverlay} ${styles.excludeFromCapture}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteCard(idx);
                                                    }}
                                                    title="Remove card"
                                                >
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                    </svg>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={`${styles.modalCard} ${styles.placeholderCard} ${styles.excludeFromCapture}`}>
                                                <button
                                                    className={styles.addCardButton}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelectSlot(idx);
                                                    }}
                                                    title="Add card"
                                                >
                                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    </svg>
                                                </button>
                                                {originalCards[idx] && (
                                                    <button
                                                        className={styles.undoButton}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUndoDelete(idx);
                                                        }}
                                                        title="Restore original card"
                                                    >
                                                        UNDO
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        <div
                                            className={styles.modalCardBottom}
                                            style={{ visibility: card ? 'visible' : 'hidden' }}
                                        >
                                            <div className={styles.modalCardClassBadge}>
                                                {card?.custom?.class || 'Class'}
                                            </div>
                                            {card && (
                                                <div className={styles.cardInfoActions}>
                                                    <button
                                                        className={styles.cardInfoButton}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedInfoCard(card);
                                                        }}
                                                        title="View details"
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                            <line x1="12" y1="16" x2="12" y2="12"></line>
                                                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className={styles.cardInfoButton}
                                                        onClick={(e) => handleCopyCardName(e, card.name, idx)}
                                                        title="Copy Name"
                                                    >
                                                        {copiedSlot === idx ? (
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12"></polyline>
                                                            </svg>
                                                        ) : (
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={`${styles.modalFooter} ${styles.excludeFromCapture}`}>
                            {/* Actions Left (Download / Save) */}
                            <div className={`${styles.confirmationContainer} ${styles.excludeFromCapture} ${styles.confirmationContainerGroup}`}>
                                <button
                                    id="download-button"
                                    className={`${styles.modalDownloadButton}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setImageDownloadConfirmOpen(!imageDownloadConfirmOpen);
                                    }}
                                    title={localCards.some(c => c === null) ? "Lineup incomplete" : "Download Lineup Image"}
                                    disabled={isDownloading || localCards.some(c => c === null)}
                                    style={{
                                        opacity: (isDownloading || localCards.some(c => c === null)) ? 0.5 : 1,
                                        cursor: (isDownloading || localCards.some(c => c === null)) ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                </button>

                                {imageDownloadConfirmOpen && (
                                    <div className={`${styles.deleteConfirmationMenu} ${styles.deleteConfirmationMenuExt}`}>
                                        <div className={styles.deleteConfirmationText}>Would you like to download your lineup as an image?</div>
                                        <div className={styles.deleteActions}>
                                            <button
                                                className={`${styles.deleteConfirmBtn} ${styles.btnSuccess}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDownload();
                                                    setImageDownloadConfirmOpen(false);
                                                }}
                                            >
                                                YES
                                            </button>
                                            <button
                                                className={`${styles.deleteConfirmBtn} ${styles.btnNo}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setImageDownloadConfirmOpen(false);
                                                }}
                                            >
                                                NO
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {hasChanges && (
                                    <button
                                        className={`${styles.modalDownloadButton} ${styles.modalSaveButton}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSaveChanges();
                                        }}
                                        title="Save Changes"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                            <polyline points="7 3 7 8 15 8"></polyline>
                                        </svg>
                                    </button>
                                )}
                            </div>

                            <div id="rating-slider-container" className={styles.ratingSliderContainer}>
                                <div className={styles.ratingSliderWrapper}>
                                    <div className={styles.infoContainerDesktop}>
                                        <div className={`${styles.infoMessage} ${showRatingInfo ? styles.infoMessageVisible : ''}`}>
                                            BuffMoki rates your lineup
                                        </div>
                                        <div
                                            className={styles.infoButtonIcon}
                                            onClick={() => setShowRatingInfo(!showRatingInfo)}
                                            style={{
                                                backgroundColor: showRatingInfo ? 'rgba(255, 215, 83, 0.3)' : '',
                                                borderColor: showRatingInfo ? '#FFD753' : '',
                                                color: showRatingInfo ? '#FFD753' : ''
                                            }}
                                            title="Click for info"
                                        >
                                            i
                                        </div>
                                    </div>
                                    <RatingSlider
                                        value={expandedLineup.rating || 0}
                                        onChange={(val) => {
                                            onRate(expandedLineup.id, val);
                                            if (showRatingInfo) setShowRatingInfo(false);
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Background Switcher - Right Aligned */}
                            <div id="background-switcher" className={styles.backgroundSwitcher}>
                                <div className={styles.infoContainerMobile}>
                                    <div
                                        className={styles.infoButtonIcon}
                                        onClick={() => setShowRatingInfo(!showRatingInfo)}
                                        style={{
                                            backgroundColor: showRatingInfo ? 'rgba(255, 215, 83, 0.3)' : '',
                                            borderColor: showRatingInfo ? '#FFD753' : '',
                                            color: showRatingInfo ? '#FFD753' : ''
                                        }}
                                        title="Click for info"
                                    >
                                        i
                                    </div>
                                    <div className={`${styles.infoMessageMobile} ${showRatingInfo ? styles.infoMessageMobileVisible : ''}`}>
                                        BuffMoki rates your lineup
                                    </div>
                                </div>
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
                        </div>

                        {/* Discard Confirmation Modal (Inline) */}
                        {showDiscardConfirm && (
                            <div className={`${styles.discardConfirmationMenu} ${styles.discardConfirmationModal}`} onClick={(e) => e.stopPropagation()}>
                                <div className={styles.deleteConfirmationText}>Discard unsaved changes?</div>
                                <div className={styles.deleteActions}>
                                    <button
                                        className={`${styles.deleteConfirmBtn} ${styles.btnYes}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowDiscardConfirm(false);
                                            setExpandedId(null);
                                        }}
                                    >
                                        YES
                                    </button>
                                    <button
                                        className={`${styles.deleteConfirmBtn} ${styles.btnNo}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowDiscardConfirm(false);
                                        }}
                                    >
                                        NO
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Selector Overlay - Extracted Component */}
            {selectorSlot !== null && (
                <LineupCardSelector
                    selectorFilters={selectorFilters}
                    setSelectorFilters={setSelectorFilters}
                    filteredSelectorCards={filteredSelectorCards}
                    handleCardSelect={handleCardSelect}
                    selectorSearch={selectorSearch}
                    setSelectorSearch={setSelectorSearch}
                    localCards={localCards}
                    lineups={lineups}
                    handleSelectorRemoveFilter={handleSelectorRemoveFilter}
                    setSelectorSlot={setSelectorSlot}
                    selectorMobileFiltersOpen={selectorMobileFiltersOpen}
                    setSelectorMobileFiltersOpen={setSelectorMobileFiltersOpen}
                />
            )}
            {/* Card Information Modal */}
            <CardModal
                card={selectedInfoCard}
                onClose={() => setSelectedInfoCard(null)}
            />
        </div>
    );
}
