'use client';

import { EnhancedCard, FilterState } from '@/types';
import styles from './LineupBuilder.module.css';
import { useState } from 'react';
import NextImage from 'next/image';
import { SCHEME_SUGGESTIONS } from '@/data/schemes';
import { getCardCharacterImage } from '@/utils/cardService';

interface LineupBuilderProps {
  lineup: EnhancedCard[];
  onRemove: (index: number) => void;
  onClear: () => void;
  onSave: (name: string) => void;
  onUpdate?: (newLineup: EnhancedCard[]) => void;
  onSuggestFilters?: (filters: Partial<FilterState>) => void;
  onAutoLineups?: (filters: Partial<FilterState>) => void;
  onShowMessage?: (msg: string) => void;
  activeSpecializations?: string[];
}

// Schemes that base their filter on fur or context (not on a role spec),
// but should still allow AUTO when the user has a role spec active in the sidebar.
const ROLE_FLEXIBLE_SCHEMES = new Set([
  "Collect 'Em All",
  'Divine Intervention',
  'Golden Shower',
  'Midnight Strike',
  'Rainbow Riot',
  'Victory Lap',
  'Taking a Dive',
  'Whale Watching',
]);

const ROLE_SPECS = ['Gacha', 'Killer', 'Wart Rider'];

export default function LineupBuilder({
  lineup,
  onRemove,
  onClear,
  onSave,
  onUpdate,
  onSuggestFilters,
  onAutoLineups,
  onShowMessage,
  activeSpecializations = [],
}: LineupBuilderProps) {
  const [lineupName, setLineupName] = useState('');

  // ... (rest unchanged)

  // separate mokis and schemes
  const mokiCards = lineup.filter((c) => c.cardType !== 'SCHEME');
  const schemeCard = lineup.find((c) => c.cardType === 'SCHEME');

  // Suggestion Logic
  type Suggestion = {
    title: string;
    filters?: Partial<FilterState>;
    message?: string;
  };

  const getSuggestion = (card: EnhancedCard | undefined): Suggestion | null => {
    if (!card) return null;
    return SCHEME_SUGGESTIONS[card.name] || null;
  };

  const suggestion = getSuggestion(schemeCard);

  // Determine if we should show AUTO for role-flexible schemes
  const activeRoleSpecs = activeSpecializations.filter((s) =>
    ROLE_SPECS.includes(s)
  );
  const isFlexibleScheme = schemeCard
    ? ROLE_FLEXIBLE_SCHEMES.has(schemeCard.name)
    : false;
  const canAutoViaRole =
    isFlexibleScheme &&
    activeRoleSpecs.length > 0 &&
    onAutoLineups !== undefined;

  // Build the filters for the AUTO button: merge scheme filters with active role specs
  const getAutoFilters = (): Partial<FilterState> => {
    const base = suggestion?.filters ?? {};
    if (activeRoleSpecs.length > 0) {
      const existingSpecs: string[] = (base.specialization as string[]) ?? [];
      const mergedSpecs = [...new Set([...existingSpecs, ...activeRoleSpecs])];
      return { ...base, specialization: mergedSpecs };
    }
    return base;
  };

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
    const newLineup = lineup.map((card) =>
      card === cardToToggle ? { ...card, locked: !card.locked } : card
    );
    onUpdate(newLineup);
  };

  const handleClear = () => {
    // Filter to keep only locked cards
    const lockedCards = lineup.filter((c) => c.locked);
    if (onUpdate) {
      onUpdate(lockedCards);
    } else {
      onClear();
    }
  };

  const [isCopied, setIsCopied] = useState(false);

  const handleCopyWallet = () => {
    navigator.clipboard.writeText('0x649e3693267FBd07239D03C18113D4f5DB385add');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <input
          type="text"
          id="lineup-name"
          name="lineup_name_unique_99"
          value={lineupName}
          onChange={(e) => setLineupName(e.target.value)}
          className={styles.input}
          placeholder="Name your lineup..."
          maxLength={50}
          autoComplete="new-password"
          spellCheck="false"
        />
      </div>

      <div className={styles.slotsContainer}>
        <div className={styles.sectionTitle}>MOKIS ({mokiCards.length}/4)</div>
        <div className={styles.mokiGrid}>
          {[0, 1, 2, 3].map((slotIndex) => {
            const card = mokiCards[slotIndex];
            const rarityClass = card
              ? styles[(card.rarity || 'Basic').toLowerCase() + 'Slot']
              : '';

            return (
              <div
                key={`moki-slot-${slotIndex}`}
                className={`${styles.slot} ${styles.mokiSlot} ${!card ? styles.empty : ''} ${card?.locked ? styles.lockedSlot : ''} ${rarityClass}`}
                draggable={!!card && !card.locked}
                onDragStart={() =>
                  card && !card.locked && handleDragStart(slotIndex)
                }
                onDragOver={(e) =>
                  card && !card.locked && handleDragOver(e, slotIndex)
                }
                onDragEnd={handleDrop}
              >
                {card ? (
                  <div
                    key={card.id || `card-${slotIndex}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                    }}
                  >
                    <button
                      onClick={() =>
                        !card.locked && onRemove(lineup.indexOf(card))
                      }
                      className={styles.removeButton}
                      title="Remove"
                      disabled={card.locked}
                      style={{
                        opacity: card.locked ? 0.3 : 1,
                        cursor: card.locked ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLock(card);
                      }}
                      className={`${styles.lockButton} ${card.locked ? styles.locked : ''}`}
                      title={card.locked ? 'Unlock' : 'Lock'}
                    >
                      {card.locked ? (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="11"
                            width="18"
                            height="11"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      ) : (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="11"
                            width="18"
                            height="11"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                        </svg>
                      )}
                    </button>
                    <div
                      style={{
                        position: 'relative',
                        width: 48,
                        height: 48,
                        flexShrink: 0,
                        marginRight: '0.75rem',
                      }}
                    >
                      <NextImage
                        src={getCardCharacterImage(card)}
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
                        {card.custom.stars > 0 && (
                          <span className={styles.starValue}>
                            {card.custom.stars} ★
                          </span>
                        )}
                        {card.custom.class && (
                          <span className={styles.slotClass}>
                            {card.custom.class}
                          </span>
                        )}
                      </div>
                    </div>
                    {!card.locked && (
                      <div className={styles.dragHandle}>:::</div>
                    )}
                  </div>
                ) : (
                  <div key="empty-text" className={styles.emptyText}>
                    Empty Moki Slot
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>
          SCHEME ({schemeCard ? 1 : 0}/1)
        </div>

        <div className={styles.schemeWrapper}>
          <div
            className={`${styles.slot} ${styles.schemeSlot} ${!schemeCard ? styles.empty : ''}`}
          >
            {schemeCard ? (
              <div
                key={schemeCard.id || 'scheme-card'}
                style={{ display: 'flex', alignItems: 'center', width: '100%' }}
              >
                <button
                  onClick={() =>
                    !schemeCard.locked && onRemove(lineup.indexOf(schemeCard))
                  }
                  className={styles.removeButton}
                  title="Remove"
                  disabled={schemeCard.locked}
                  style={{
                    opacity: schemeCard.locked ? 0.3 : 1,
                    cursor: schemeCard.locked ? 'not-allowed' : 'pointer',
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLock(schemeCard);
                  }}
                  className={`${styles.lockButton} ${schemeCard.locked ? styles.locked : ''}`}
                  title={schemeCard.locked ? 'Unlock' : 'Lock'}
                >
                  {schemeCard.locked ? (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect
                        x="3"
                        y="11"
                        width="18"
                        height="11"
                        rx="2"
                        ry="2"
                      ></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  ) : (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect
                        x="3"
                        y="11"
                        width="18"
                        height="11"
                        rx="2"
                        ry="2"
                      ></rect>
                      <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                    </svg>
                  )}
                </button>
                <div
                  style={{
                    position: 'relative',
                    width: 48,
                    height: 48,
                    flexShrink: 0,
                    marginRight: '0.75rem',
                  }}
                >
                  <NextImage
                    src={getCardCharacterImage(schemeCard)}
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
                      <span
                        className={styles.slotClass}
                        style={{ marginLeft: 0 }}
                      >
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
          <div
            className={styles.placeholder}
            style={{
              flexDirection: 'row',
              gap: '0.5rem',
              width: '100%',
              alignItems: 'center',
              marginTop: '1rem',
            }}
          >
            {suggestion && (
              <>
                <button
                  className={styles.suggestButton}
                  style={{ margin: 0, flex: 1, padding: '0.5rem 0' }}
                  onClick={() => {
                    if (suggestion.message && onShowMessage) {
                      onShowMessage(suggestion.message);
                    }
                    if (suggestion.filters && onSuggestFilters) {
                      onSuggestFilters(suggestion.filters);
                    }
                  }}
                  title={suggestion.title}
                >
                  <svg
                    className={styles.suggestIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                  </svg>
                  SUGGEST
                </button>
                {(suggestion?.filters || canAutoViaRole) && onAutoLineups && (
                  <button
                    className={styles.autoButton}
                    style={{ margin: 0, flex: 1, padding: '0.5rem 0' }}
                    onClick={() => onAutoLineups(getAutoFilters())}
                    title={
                      canAutoViaRole && !suggestion?.filters
                        ? `Auto with active role filter: ${activeRoleSpecs.join(', ')}`
                        : 'Auto construct 5 optimal lineups using SUGGEST logic + SCORE'
                    }
                  >
                    <svg
                      className={styles.suggestIcon}
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    AUTO
                  </button>
                )}
              </>
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
          {lineup.some((c) => c.locked) && (
            <button
              onClick={() => {
                if (onUpdate) {
                  onUpdate(lineup.map((c) => ({ ...c, locked: false })));
                }
              }}
              className={styles.unlockAllButton}
            >
              Unlock All
            </button>
          )}
        </div>

        <div className={styles.lowerFooter}>
          <div className={styles.madeBy}>
            Made by{' '}
            <a
              href="https://x.com/luksqron"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.creatorLink}
            >
              luksq.ron
            </a>{' '}
            ⚔️
            <div style={{ marginTop: '0.5rem' }}>
              Join{' '}
              <a
                href="https://fantasy.grandarena.gg/clubs/join/dojo"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.guildLink}
              >
                The Dojo
              </a>{' '}
              Guild ⛩️
            </div>
          </div>

          <div className={styles.donateSection}>
            <div className={styles.donateText}>
              Do you want to help me with my lineup?
            </div>
            <button
              onClick={handleCopyWallet}
              className={styles.donateButton}
              title="Click to copy address"
            >
              {isCopied
                ? 'Address Copied! Thank you! 💛'
                : '0x649e...385add 📋'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
