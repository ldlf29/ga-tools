'use client';

import { EnhancedCard, FilterState } from '@/types';
import styles from './LineupBuilder.module.css';
import { useState } from 'react';
import NextImage from 'next/image';
import { SCHEME_SUGGESTIONS } from '@/data/schemes';

interface LineupBuilderProps {
    lineup: EnhancedCard[];
    onRemove: (index: number) => void;
    onClear: () => void;
    onSave: (name: string) => void;
    onUpdate?: (newLineup: EnhancedCard[]) => void;
    onSuggestFilters?: (filters: Partial<FilterState>) => void;
    onShowMessage?: (msg: string) => void;
}

export default function LineupBuilder({ lineup, onRemove, onClear, onSave, onUpdate, onSuggestFilters, onShowMessage }: LineupBuilderProps) {
    const [lineupName, setLineupName] = useState('');

    // ... (rest unchanged)

    // separate mokis and schemes
    const mokiCards = lineup.filter(c => c.cardType !== 'SCHEME');
    const schemeCard = lineup.find(c => c.cardType === 'SCHEME');

    // Suggestion Logic
    type Suggestion = { title: string; filters?: Partial<FilterState>; message?: string };

    const getSuggestion = (card: EnhancedCard | undefined): Suggestion | null => {
        if (!card) return null;
        return SCHEME_SUGGESTIONS[card.name] || null;
    };

    const suggestion = getSuggestion(schemeCard);

    // Drag & Drop State
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        // Reorder Mokis
        const newMokis = [...mokiCards];
        const [movedItem] = newMokis.splice(draggedIndex, 1);
        newMokis.splice(index, 0, movedItem);

        // Reconstruct full lineup: New Mokis + Scheme (if any)
        const newLineup = schemeCard ? [...newMokis, schemeCard] : [...newMokis];

        if (onUpdate) {
            onUpdate(newLineup);
            setDraggedIndex(index); // Update dragged index to new position
        }
    };

    const handleDrop = () => {
        setDraggedIndex(null);
    };

    const toggleLock = (cardToToggle: EnhancedCard) => {
        if (!onUpdate) return;
        const newLineup = lineup.map(card =>
            card === cardToToggle ? { ...card, locked: !card.locked } : card
        );
        onUpdate(newLineup);
    };

    const handleClear = () => {
        // Filter to keep only locked cards
        const lockedCards = lineup.filter(c => c.locked);
        if (onUpdate) {
            onUpdate(lockedCards);
        } else {
            onClear();
        }
    };

    const [isCopied, setIsCopied] = useState(false);

    const handleCopyWallet = () => {
        navigator.clipboard.writeText("0x649e3693267FBd07239D03C18113D4f5DB385add");
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <input
                    type="text"
                    value={lineupName}
                    onChange={(e) => setLineupName(e.target.value)}
                    className={styles.input}
                    placeholder="Name your lineup..."
                />
            </div>

            <div className={styles.slotsContainer}>
                <div className={styles.sectionTitle}>MOKIS ({mokiCards.length}/4)</div>
                <div className={styles.mokiGrid}>
                    {[0, 1, 2, 3].map((slotIndex) => {
                        const card = mokiCards[slotIndex];
                        const rarityClass = card ? styles[(card.rarity || 'Basic').toLowerCase() + 'Slot'] : '';

                        return (
                            <div
                                key={`moki-slot-${slotIndex}`}
                                className={`${styles.slot} ${styles.mokiSlot} ${!card ? styles.empty : ''} ${card?.locked ? styles.lockedSlot : ''} ${rarityClass}`}
                                draggable={!!card && !card.locked}
                                onDragStart={() => card && !card.locked && handleDragStart(slotIndex)}
                                onDragOver={(e) => card && !card.locked && handleDragOver(e, slotIndex)}
                                onDragEnd={handleDrop}
                            >
                                {card ? (
                                    <div
                                        key={card.id || `card-${slotIndex}`}
                                        style={{ display: 'flex', alignItems: 'center', width: '100%' }}
                                    >

                                        <button
                                            onClick={() => !card.locked && onRemove(lineup.indexOf(card))}
                                            className={styles.removeButton}
                                            title="Remove"
                                            disabled={card.locked}
                                            style={{ opacity: card.locked ? 0.3 : 1, cursor: card.locked ? 'not-allowed' : 'pointer' }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleLock(card); }}
                                            className={`${styles.lockButton} ${card.locked ? styles.locked : ''}`}
                                            title={card.locked ? "Unlock" : "Lock"}
                                        >
                                            {card.locked ? (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                                </svg>
                                            ) : (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                    <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                                                </svg>
                                            )}
                                        </button>
                                        <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0, marginRight: '0.75rem' }}>
                                            <NextImage
                                                src={card.custom.characterImage || card.image}
                                                alt={card.name}
                                                width={48}
                                                height={48}
                                                className={styles.slotImage}
                                                style={{ objectFit: 'cover', borderRadius: '0.25rem' }}
                                            />
                                        </div>
                                        <div className={styles.slotInfo}>
                                            <div className={styles.slotName}>{card.name}</div>
                                            <div className={styles.slotStars}>
                                                {card.custom.stars > 0 && <span className={styles.starValue}>{card.custom.stars} ★</span>}
                                                {card.custom.class && (
                                                    <span className={styles.slotClass}>
                                                        {card.custom.class}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {!card.locked && <div className={styles.dragHandle}>:::</div>}
                                    </div>
                                ) : (
                                    <div
                                        key="empty-text"
                                        className={styles.emptyText}
                                    >
                                        Empty Moki Slot
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>SCHEME ({schemeCard ? 1 : 0}/1)</div>

                <div className={styles.schemeWrapper}>
                    <div className={`${styles.slot} ${styles.schemeSlot} ${!schemeCard ? styles.empty : ''}`}>
                        {schemeCard ? (
                            <div
                                key={schemeCard.id || 'scheme-card'}
                                style={{ display: 'flex', alignItems: 'center', width: '100%' }}
                            >
                                <button
                                    onClick={() => !schemeCard.locked && onRemove(lineup.indexOf(schemeCard))}
                                    className={styles.removeButton}
                                    title="Remove"
                                    disabled={schemeCard.locked}
                                    style={{ opacity: schemeCard.locked ? 0.3 : 1, cursor: schemeCard.locked ? 'not-allowed' : 'pointer' }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleLock(schemeCard); }}
                                    className={`${styles.lockButton} ${schemeCard.locked ? styles.locked : ''}`}
                                    title={schemeCard.locked ? "Unlock" : "Lock"}
                                >
                                    {schemeCard.locked ? (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                        </svg>
                                    ) : (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                            <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                                        </svg>
                                    )}
                                </button>
                                <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0, marginRight: '0.75rem' }}>
                                    <NextImage
                                        src={schemeCard.custom.characterImage || schemeCard.image}
                                        alt={schemeCard.name}
                                        width={48}
                                        height={48}
                                        className={styles.slotImage}
                                        style={{ objectFit: 'cover', borderRadius: '0.25rem' }}
                                    />
                                </div>
                                <div className={styles.slotInfo}>
                                    <div className={styles.slotName}>{schemeCard.name}</div>
                                    <div className={styles.slotStars}>
                                        {schemeCard.custom.class && (
                                            <span className={styles.slotClass} style={{ marginLeft: 0 }}>
                                                {schemeCard.custom.class}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.emptyText}>Empty Scheme Slot</div>
                        )}
                    </div>
                    <div className={styles.placeholder}>
                        {suggestion && (
                            <button
                                className={styles.suggestButton}
                                onClick={() => {
                                    if (suggestion.message && onShowMessage) {
                                        onShowMessage(suggestion.message);
                                    } else if (suggestion.filters && onSuggestFilters) {
                                        onSuggestFilters(suggestion.filters);
                                    }
                                }}
                                title={suggestion.title}
                            >
                                <svg className={styles.suggestIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                </svg>
                                SUGGEST
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className={styles.footer}>
                <button
                    className={styles.saveButton}
                    disabled={mokiCards.length !== 4 || !schemeCard}
                    onClick={() => {
                        onSave(lineupName);
                        setLineupName('');
                    }}
                >
                    Save Lineup
                </button>
                <div className={styles.secondaryActions}>
                    {lineup.length > 0 && (
                        <button onClick={handleClear} className={styles.clearButton}>
                            Clear All
                        </button>
                    )}
                    {lineup.some(c => c.locked) && (
                        <button onClick={() => {
                            if (onUpdate) {
                                onUpdate(lineup.map(c => ({ ...c, locked: false })));
                            }
                        }} className={styles.unlockAllButton}>
                            Unlock All
                        </button>
                    )}
                </div>

                <div className={styles.lowerFooter}>
                    <div className={styles.madeBy}>
                        Made by <a href="https://x.com/luksqron" target="_blank" rel="noopener noreferrer" className={styles.creatorLink}>luksq.ron</a>
                    </div>

                    <div className={styles.donateSection}>
                        <div className={styles.donateText}>Do you want to help me with my lineup?</div>
                        <button onClick={handleCopyWallet} className={styles.donateButton} title="Click to copy address">
                            {isCopied ? "Address Copied! Thank you! 💛" : "0x649e...385add 📋"}
                        </button>
                    </div>

                    <div className={styles.disclaimer}>
                        Disclaimer: This tool was created by a community member unrelated to Moku's Team. All assets used are the property of Moku Studios.
                    </div>
                </div>
            </div>
        </div>
    );
}
