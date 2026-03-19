import React, { useState } from 'react';
import styles from './ContestTypeModal.module.css';

export type ContestType =
  | 'OPEN'
  | 'ONLY_LEGENDARY'
  | 'ONLY_EPIC'
  | 'ONLY_RARE'
  | 'ONLY_BASIC'
  | 'UP_TO_EPIC'
  | 'UP_TO_RARE'
  | 'OTHER';

export interface ExactCounts {
  legendary: number;
  epic: number;
  rare: number;
  basic: number;
}

interface ContestTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (type: ContestType, exactCounts?: ExactCounts) => void;
}

const CONTEST_OPTIONS: { value: ContestType; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ONLY_LEGENDARY', label: 'Only Legendary' },
  { value: 'ONLY_EPIC', label: 'Only Epic' },
  { value: 'ONLY_RARE', label: 'Only Rare' },
  { value: 'ONLY_BASIC', label: 'Only Basic' },
  { value: 'UP_TO_EPIC', label: 'Up To Epic' },
  { value: 'UP_TO_RARE', label: 'Up To Rare' },
  { value: 'OTHER', label: 'Other' },
];

export default function ContestTypeModal({
  isOpen,
  onClose,
  onGenerate,
}: ContestTypeModalProps) {
  const [selectedType, setSelectedType] = useState<ContestType>('OPEN');
  const [counts, setCounts] = useState<ExactCounts>({
    legendary: 0,
    epic: 0,
    rare: 0,
    basic: 0,
  });

  if (!isOpen) return null;

  const totalCount =
    counts.legendary + counts.epic + counts.rare + counts.basic;
  const isValid = selectedType !== 'OTHER' || totalCount === 4;

  const handleIncrement = (rarity: keyof ExactCounts) => {
    if (totalCount < 4) {
      setCounts({ ...counts, [rarity]: counts[rarity] + 1 });
    }
  };

  const handleDecrement = (rarity: keyof ExactCounts) => {
    if (counts[rarity] > 0) {
      setCounts({ ...counts, [rarity]: counts[rarity] - 1 });
    }
  };

  const handleGenerate = () => {
    if (isValid) {
      onGenerate(selectedType, selectedType === 'OTHER' ? counts : undefined);
      // reset state for next time
      setSelectedType('OPEN');
      setCounts({ legendary: 0, epic: 0, rare: 0, basic: 0 });
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Type of Contest</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.optionsGrid}>
            {CONTEST_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                className={`${styles.optionCard} ${selectedType === opt.value ? styles.selected : ''}`}
                onClick={() => setSelectedType(opt.value)}
              >
                <span className={styles.optionLabel}>{opt.label}</span>
              </div>
            ))}
          </div>

          {selectedType === 'OTHER' && (
            <div className={styles.customCountsContainer}>
              <h3 className={styles.customTitle}>
                Select Rarities (Total: {totalCount}/4)
              </h3>
              <div className={styles.counters}>
                {(Object.keys(counts) as Array<keyof ExactCounts>).map(
                  (rarity) => (
                    <div key={rarity} className={styles.counterRow}>
                      <span className={styles.rarityLabel} data-rarity={rarity}>
                        {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                      </span>
                      <div className={styles.counterControls}>
                        <button
                          className={styles.counterBtn}
                          onClick={() => handleDecrement(rarity)}
                          disabled={counts[rarity] === 0}
                        >
                          -
                        </button>
                        <span className={styles.countValue}>
                          {counts[rarity]}
                        </span>
                        <button
                          className={styles.counterBtn}
                          onClick={() => handleIncrement(rarity)}
                          disabled={totalCount >= 4}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
              {totalCount !== 4 && (
                <div className={styles.errorMsg}>
                  You must select exactly 4 cards.
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.generateButton}
            disabled={!isValid}
            onClick={handleGenerate}
          >
            Generate Lineups
          </button>
        </div>
      </div>
    </div>
  );
}
