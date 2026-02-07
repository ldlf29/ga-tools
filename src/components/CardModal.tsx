'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { EnhancedCard } from '@/types';
import styles from './CardModal.module.css';
import NextImage from 'next/image';
import { useEffect } from 'react';

interface CardModalProps {
    card: EnhancedCard | null;
    onClose: () => void;
}

export default function CardModal({ card, onClose }: CardModalProps) {
    // Prevent scroll when modal is open
    useEffect(() => {
        if (card) {
            document.body.style.overflow = 'hidden';
            const handleEsc = (e: KeyboardEvent) => {
                if (e.key === 'Escape') onClose();
            };
            window.addEventListener('keydown', handleEsc);
            return () => {
                document.body.style.overflow = 'unset';
                window.removeEventListener('keydown', handleEsc);
            };
        }
    }, [card, onClose]);

    if (!card) return null;

    const rarityClass = styles[card.rarity.toLowerCase()] || '';
    const isCharacterImage = card.cardType === 'MOKI' && !!(card.custom.characterImage || card.custom.imageUrl);

    return (
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
                                        <div className={styles.performanceGrid}>
                                            <div className={styles.perfItem}>
                                                <span className={styles.statLabel}>Elims</span>
                                                <span className={styles.perfValue}>{card.custom.eliminations || '0'}</span>
                                            </div>
                                            <div className={styles.perfItem}>
                                                <span className={styles.statLabel}>Balls</span>
                                                <span className={styles.perfValue}>{card.custom.deposits || '0'}</span>
                                            </div>
                                            <div className={styles.perfItem}>
                                                <span className={styles.statLabel}>Wart</span>
                                                <span className={styles.perfValue}>{card.custom.wartDistance || '0'}</span>
                                            </div>
                                            <div className={styles.perfItem}>
                                                <span className={styles.statLabel}>Score</span>
                                                <span className={styles.perfValue}>{card.custom.score || '0'}</span>
                                            </div>
                                            <div className={styles.perfItem}>
                                                <span className={styles.statLabel}>Win Rate</span>
                                                <span className={styles.perfValue}>{card.custom.winRate ? `${card.custom.winRate.toFixed(1)}%` : '-'}</span>
                                            </div>
                                        </div>
                                    )}

                                    {card.cardType === 'MOKI' && (
                                        <div className={styles.statsGrid}>
                                            <div className={styles.statItem}>
                                                <span className={styles.statLabel}>Strength</span>
                                                <span className={styles.statValue}>{card.custom.strength?.toFixed(1) || '0.0'}</span>
                                            </div>
                                            <div className={styles.statItem}>
                                                <span className={styles.statLabel}>Speed</span>
                                                <span className={styles.statValue}>{card.custom.speed?.toFixed(1) || '0.0'}</span>
                                            </div>
                                            <div className={styles.statItem}>
                                                <span className={styles.statLabel}>Defense</span>
                                                <span className={styles.statValue}>{card.custom.defense?.toFixed(1) || '0.0'}</span>
                                            </div>
                                            <div className={styles.statItem}>
                                                <span className={styles.statLabel}>Dexterity</span>
                                                <span className={styles.statValue}>{card.custom.dexterity?.toFixed(1) || '0.0'}</span>
                                            </div>
                                            <div className={styles.statItem}>
                                                <span className={styles.statLabel}>Fortitude</span>
                                                <span className={styles.statValue}>{card.custom.fortitude?.toFixed(1) || '0.0'}</span>
                                            </div>
                                            <div className={styles.statItem}>
                                                <span className={styles.statLabel}>Total</span>
                                                <span className={styles.totalValue}>{card.custom.totalStats?.toFixed(1) || '0.0'}</span>
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
                </div>
            )}
        </AnimatePresence>
    );
}
