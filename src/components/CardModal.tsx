'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { EnhancedCard } from '@/types';
import styles from './CardModal.module.css';
import NextImage from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface CardModalProps {
    card: EnhancedCard | null;
    onClose: () => void;
    matchLimit?: 'ALL' | 10 | 20 | 30;
}

export default function CardModal({ card, onClose, matchLimit = 'ALL' }: CardModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent scroll when modal is open and handle ESC
    useEffect(() => {
        if (!card) return; // Only apply scroll lock and ESC handler if modal is open (card is not null)

        document.body.classList.add('modal-open');
        document.documentElement.classList.add('modal-open');

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopImmediatePropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.classList.remove('modal-open');
            document.documentElement.classList.remove('modal-open');
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [card, onClose]); // Depend on card to re-run effect when modal opens/closes

    if (!mounted || !card) return null;

    const rarityClass = styles[card.rarity.toLowerCase()] || '';
    const isCharacterImage = card.cardType === 'MOKI' && !!(card.custom.characterImage || card.custom.imageUrl);

    return createPortal(
        <AnimatePresence>
            {card && (
                <div className={styles.modalOverlay} onClick={onClose}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`${styles.modalContent} ${card.cardType === 'SCHEME' ? styles.schemeModal : ''}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className={styles.modalCloseButton}
                            onClick={onClose}
                            title="Close"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>

                        {card.cardType === 'SCHEME' ? (
                            <div className={styles.schemeView}>
                                <div className={styles.schemeImageWrapper}>
                                    <NextImage
                                        src={card.image}
                                        alt={card.name}
                                        fill
                                        sizes="(max-width: 768px) 90vw, 500px"
                                        style={{ objectFit: 'contain' }}
                                        priority
                                    />
                                </div>
                                {card.custom.catalogMarketLink && (
                                    <a
                                        href={card.custom.catalogMarketLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.marketButton}
                                        style={{ marginTop: '1.5rem', width: '100%', maxWidth: '300px' }}
                                    >
                                        View on Market
                                    </a>
                                )}
                            </div>
                        ) : (
                            <div className={styles.modalBody}>
                                <div className={styles.imageSection}>
                                    <div className={`${styles.cardImageWrapper} ${isCharacterImage ? styles.characterImage : ''}`}>
                                        <NextImage
                                            src={card.custom.characterImage || card.custom.imageUrl || card.image}
                                            alt={card.name}
                                            fill
                                            sizes="(max-width: 768px) 100vw, 400px"
                                            style={{ objectFit: isCharacterImage ? 'contain' : 'cover' }}
                                            priority
                                        />
                                    </div>
                                    {card.custom.catalogMarketLink && (
                                        <a
                                            href={card.custom.catalogMarketLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.marketButton}
                                        >
                                            View on Market
                                        </a>
                                    )}
                                </div>

                                <div className={styles.infoSection}>
                                    <div className={styles.headerInfo}>
                                        <h2>{card.name}</h2>
                                        <div className={`${styles.rarityBadge} ${rarityClass}`}>
                                            {card.rarity}
                                        </div>
                                    </div>

                                    <div className={styles.detailsList}>
                                        <div className={styles.detailRow}>
                                            <span className={styles.statLabel}>Class</span>
                                            <span className={styles.statValue}>{card.custom.class || '-'}</span>
                                        </div>
                                        <div className={styles.detailRow}>
                                            <span className={styles.statLabel}>Fur</span>
                                            <span className={styles.statValue}>{card.custom.fur || '-'}</span>
                                        </div>
                                        <div className={styles.detailRow}>
                                            <span className={styles.statLabel}>Stars</span>
                                            <span className={styles.statValue}>{card.custom.stars > 0 ? `${card.custom.stars} ★` : '-'}</span>
                                        </div>
                                    </div>

                                    {card.cardType === 'MOKI' && (
                                        <>
                                            <div className={styles.performanceGrid}>
                                                <div className={styles.perfHeader}>
                                                    {matchLimit === 'ALL' ? 'PERFORMANCE' : `LAST ${matchLimit} MATCHES AVERAGE`}
                                                </div>
                                                <div className={styles.perfItem}>
                                                    <span className={styles.perfLabel}>ELIMS</span>
                                                    <span className={styles.perfValue}>{(matchLimit === 10 ? card.custom.avgEliminations10 : matchLimit === 20 ? card.custom.avgEliminations20 : matchLimit === 30 ? card.custom.avgEliminations30 : card.custom.eliminations)?.toFixed(1) || '0'}</span>
                                                </div>
                                                <div className={styles.perfItem}>
                                                    <span className={styles.perfLabel}>WART</span>
                                                    <span className={styles.perfValue}>{(matchLimit === 10 ? card.custom.avgWartDistance10 : matchLimit === 20 ? card.custom.avgWartDistance20 : matchLimit === 30 ? card.custom.avgWartDistance30 : card.custom.wartDistance)?.toFixed(1) || '0'}</span>
                                                </div>
                                                <div className={styles.perfItem}>
                                                    <span className={styles.perfLabel}>BALLS</span>
                                                    <span className={styles.perfValue}>{(matchLimit === 10 ? card.custom.avgDeposits10 : matchLimit === 20 ? card.custom.avgDeposits20 : matchLimit === 30 ? card.custom.avgDeposits30 : card.custom.deposits)?.toFixed(1) || '0'}</span>
                                                </div>
                                                <div className={styles.perfItem}>
                                                    <span className={styles.perfLabel}>SCORE</span>
                                                    <span className={styles.perfValue}>{(matchLimit === 10 ? card.custom.avgScore10 : matchLimit === 20 ? card.custom.avgScore20 : matchLimit === 30 ? card.custom.avgScore30 : card.custom.score)?.toFixed(1) || '0'}</span>
                                                </div>
                                                <div className={styles.perfItem}>
                                                    <span className={styles.perfLabel}>W/R</span>
                                                    <span className={styles.perfValue}>{(() => {
                                                        const wr = matchLimit === 10 ? card.custom.avgWinRate10 : matchLimit === 20 ? card.custom.avgWinRate20 : matchLimit === 30 ? card.custom.avgWinRate30 : card.custom.winRate;
                                                        return wr ? `${wr.toFixed(1)}%` : '0%';
                                                    })()}</span>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {card.cardType === 'MOKI' && (
                                        <div className={styles.statsGrid}>
                                            <div className={styles.perfHeader}>STATS</div>
                                            <div className={styles.statItem}>
                                                <span className={styles.statLabel}>STR</span>
                                                <span className={styles.statValue}>{card.custom.strength?.toFixed(1) || '0.0'}</span>
                                            </div>
                                            <div className={styles.statItem}>
                                                <span className={styles.statLabel}>SPD</span>
                                                <span className={styles.statValue}>{card.custom.speed?.toFixed(1) || '0.0'}</span>
                                            </div>
                                            <div className={styles.statItem}>
                                                <span className={styles.statLabel}>DEF</span>
                                                <span className={styles.statValue}>{card.custom.defense?.toFixed(1) || '0.0'}</span>
                                            </div>
                                            <div className={styles.statItem}>
                                                <span className={styles.statLabel}>DEX</span>
                                                <span className={styles.statValue}>{card.custom.dexterity?.toFixed(1) || '0.0'}</span>
                                            </div>
                                            <div className={styles.statItem}>
                                                <span className={styles.statLabel}>FOR</span>
                                                <span className={styles.statValue}>{card.custom.fortitude?.toFixed(1) || '0.0'}</span>
                                            </div>
                                            <div className={`${styles.statItem} ${styles.mainStatItem}`}>
                                                <span className={styles.statLabel}>TOTAL</span>
                                                <span className={styles.totalValue}>{card.custom.totalStats?.toFixed(1) || '0.0'}</span>
                                            </div>
                                            <div className={`${styles.statItem} ${styles.mainStatItem}`}>
                                                <span className={styles.statLabel}>TRAIN</span>
                                                <span className={styles.totalValue}>{card.custom.train?.toFixed(1) || '0.0'}</span>
                                            </div>
                                        </div>
                                    )}

                                    {card.custom.traits && card.custom.traits.length > 0 && (
                                        <div className={styles.traitsSection}>
                                            <span className={styles.statLabel}>Traits</span>
                                            <div className={styles.traitsWrapper}>
                                                {card.custom.traits.map(trait => (
                                                    <span key={trait} className={styles.traitTag}>{trait}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div >
            )
            }
        </AnimatePresence >,
        document.body
    );
}
