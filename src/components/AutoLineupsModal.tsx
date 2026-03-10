import React, { useState } from 'react';
import NextImage from 'next/image';
import { EnhancedCard } from '@/types';
import styles from './AutoLineupsModal.module.css';
import { getCardCharacterImage } from '@/utils/cardService';

export interface AutoLineup {
    id: string;
    name: string;
    cards: EnhancedCard[];
}

interface AutoLineupsModalProps {
    isOpen: boolean;
    onClose: () => void;
    autoLineups: AutoLineup[];
    onSaveLineup: (name: string, cards: EnhancedCard[]) => void;
    onError?: (msg: string) => void;
}

export default function AutoLineupsModal({
    isOpen,
    onClose,
    autoLineups,
    onSaveLineup,
    onError
}: AutoLineupsModalProps) {
    const [lineups, setLineups] = useState<AutoLineup[]>([]);
    const [savedLineupIds, setSavedLineupIds] = useState<Set<string>>(new Set());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    // Update internal state when props change
    React.useEffect(() => {
        if (isOpen) {
            setLineups(autoLineups);
            setSavedLineupIds(new Set());
            setEditingId(null);
        }
    }, [isOpen, autoLineups]);

    if (!isOpen) return null;

    const handleSave = (lineup: AutoLineup) => {
        onSaveLineup(lineup.name, lineup.cards);
        setSavedLineupIds(new Set(savedLineupIds).add(lineup.id));
    };

    const handleDelete = (id: string) => {
        setLineups(lineups.filter(l => l.id !== id));
        if (lineups.length === 1) { // If last one was deleted, close modal
            setTimeout(onClose, 300);
        }
    };

    const startEditing = (lineup: AutoLineup) => {
        setEditingId(lineup.id);
        setEditName(lineup.name);
    };

    const commitEdit = () => {
        const trimmed = editName.trim();
        if (trimmed.length > 50) {
            if (onError) onError("Maximum 50 characters for lineup name.");
            return;
        }
        if (editingId && trimmed.length > 0) {
            setLineups(lineups.map(l => l.id === editingId ? { ...l, name: trimmed } : l));
        }
        setEditingId(null);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Auto Generated Lineups</h2>
                    <button className={styles.closeButton} onClick={onClose} title="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className={styles.content}>
                    {lineups.length === 0 ? (
                        <div className={styles.emptyState}>No lineups available.</div>
                    ) : (
                        <div className={styles.lineupList}>
                            {lineups.map((lineup) => {
                                const isSaved = savedLineupIds.has(lineup.id);
                                return (
                                    <div key={lineup.id} className={styles.lineupRow}>
                                        <div className={styles.lineupHeader}>
                                            {editingId === lineup.id ? (
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onBlur={commitEdit}
                                                    onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                                                    autoFocus
                                                    className={styles.renameInput}
                                                    maxLength={50}
                                                />
                                            ) : (
                                                <h3 className={styles.lineupName}>
                                                    <span className={styles.nameText} title={lineup.name}>{lineup.name}</span>
                                                    <button
                                                        className={styles.iconButton}
                                                        onClick={() => startEditing(lineup)}
                                                        title="Rename Lineup"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M12 20h9"></path>
                                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                                        </svg>
                                                    </button>
                                                </h3>
                                            )}

                                            <div className={styles.actions}>
                                                <button
                                                    className={`${styles.saveButton} ${isSaved ? styles.saved : ''}`}
                                                    onClick={() => handleSave(lineup)}
                                                    disabled={isSaved}
                                                >
                                                    {isSaved ? 'SAVED ✓' : 'SAVE'}
                                                </button>
                                                <button
                                                    className={styles.deleteButton}
                                                    onClick={() => handleDelete(lineup.id)}
                                                    title="Remove from list"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        <div className={styles.cardsGrid}>
                                            {lineup.cards.map((card, idx) => (
                                                <div
                                                    key={`${card.id}-${idx}`}
                                                    className={`${styles.cardSlot} ${card.cardType === 'SCHEME' ? styles.schemeSlot : styles.mokiSlot}`}
                                                >
                                                    <NextImage
                                                        src={getCardCharacterImage(card)}
                                                        alt={card.name}
                                                        width={50}
                                                        height={50}
                                                        className={styles.cardImage}
                                                    />
                                                    <div className={styles.rarityStripe} data-rarity={card.cardType === 'SCHEME' ? 'scheme' : card.rarity.toLowerCase()}></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
