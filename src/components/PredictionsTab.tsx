import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import styles from './PredictionsTab.module.css';
import { Contest, ContestsResponse } from '@/types/contest';
import mokiMetadata from '@/data/mokiMetadata.json';

export default function PredictionsTab() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [lineupCount, setLineupCount] = useState<number>(1);
  const [predictionModel, setPredictionModel] = useState<'CHAMP' | 'TEAM'>('CHAMP');
  const [allowRepeated, setAllowRepeated] = useState(false);
  const [hideFull, setHideFull] = useState(false);
  const [useLocalTime, setUseLocalTime] = useState(false);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [isSchemeMenuOpen, setIsSchemeMenuOpen] = useState(false);
  const [selectedMetaScheme, setSelectedMetaScheme] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    distribution: 'All',
    price: 'All',
    time: 'All',
    type: 'All'
  });

  interface MokiRanking {
    'Moki ID': number;
    Name: string;
    Class: string;
    Score: number;
    WinRate: number;
    'Wart Closer': number;
    Losses: number;
    'Gacha Pts': number;
    Deaths: number;
    'Win By Combat': number;
    Fur: string;
    Traits: string;
  }

  const [rankingData, setRankingData] = useState<MokiRanking[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingPage, setRankingPage] = useState(0);
  const RANKING_PAGE_SIZE = 10;

  // Build lookup: moki name (uppercase) -> metadata entry
  const metadataByName = React.useMemo(() => {
    const map: Record<string, any> = {};
    for (const val of Object.values(mokiMetadata as Record<string, any>)) {
      if (val?.name) {
        map[val.name.toString().toUpperCase()] = val;
      }
    }
    return map;
  }, []);

  const formatContestDate = (dateString: string) => {
    const d = new Date(dateString);
    if (!useLocalTime) {
      const day = d.getUTCDate().toString().padStart(2, '0');
      const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
      const year = d.getUTCFullYear();
      const hours = d.getUTCHours().toString().padStart(2, '0');
      const minutes = d.getUTCMinutes().toString().padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes} UTC`;
    }
    
    const offset = -d.getTimezoneOffset() / 60;
    const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`;
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (UTC${offsetStr})`;
  };

  const META_SCHEMES = [
    { name: 'Touching The Wart', image: '/scheme/touching the wart.png' },
    { name: 'Whale Watching', image: '/scheme/whale watching.png' },
    { name: 'Divine Intervention', image: '/scheme/divine intervention.png' },
    { name: 'Midnight Strike', image: '/scheme/midnight strike.png' },
    { name: 'Golden Shower', image: '/scheme/golden shower.png' },
    { name: 'Rainbow Riot', image: '/scheme/rainbow riot.png' },
    { name: 'Shapeshifting', image: '/scheme/shapeshifting.png' },
    { name: 'Tear jerking', image: '/scheme/tear jerking.png' },
    { name: 'Costume party', image: '/scheme/costume party.png' },
    { name: 'Dress To Impress', image: '/scheme/dress to impress.png' },
    { name: 'Call To Arms', image: '/scheme/call to arms.png' },
    { name: 'Malicious Intent', image: '/scheme/malicious intent.png' },
    { name: 'Housekeeping', image: '/scheme/housekeeping.png' },
    { name: 'Dungaree Duel', image: '/scheme/dungaree duel.png' },
    { name: 'Collective Specialization', image: '/scheme/collective specialization.png' },
    { name: 'Taking A Dive', image: '/scheme/taking a dive.png' },
  ];

  const getSlotLabel = (utcTime: string) => {
    if (!useLocalTime || utcTime === 'All') return utcTime;
    const [hours] = utcTime.split(':').map(Number);
    const d = new Date();
    d.setUTCHours(hours, 0, 0, 0);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getSlotStyle = (slot: { cardType: string; minRarity: string; maxRarity: string }) => {
    if (slot.cardType === 'scheme') {
      return { backgroundColor: '#2d5a9e' };
    }

    const RARITY_COLORS: Record<string, string> = {
      basic: '#b0b0b0',
      rare: '#1abf9e',
      epic: '#be50ff',
      legendary: '#ff66cc'
    };

    const min = slot.minRarity.toLowerCase();
    const max = slot.maxRarity.toLowerCase();

    if (min === max) {
      return { backgroundColor: RARITY_COLORS[min] || '#333' };
    }

    // Special case for OPEN (Basic to Legendary)
    if (min === 'basic' && max === 'legendary') {
      return {
        background: `conic-gradient(
          ${RARITY_COLORS.basic} 0% 25%, 
          ${RARITY_COLORS.rare} 25% 50%, 
          ${RARITY_COLORS.epic} 50% 75%, 
          ${RARITY_COLORS.legendary} 75% 100%
        )`
      };
    }

    // General range case (e.g. Basic to Rare, Basic to Epic)
    const rarities = ['basic', 'rare', 'epic', 'legendary'];
    const minIdx = rarities.indexOf(min);
    const maxIdx = rarities.indexOf(max);

    if (minIdx !== -1 && maxIdx !== -1 && maxIdx > minIdx) {
      const activeRarities = rarities.slice(minIdx, maxIdx + 1);
      const step = 100 / activeRarities.length;
      const gradientParts = activeRarities.map((r, i) => 
        `${RARITY_COLORS[r]} ${i * step}% ${(i + 1) * step}%`
      ).join(', ');
      
      return { background: `conic-gradient(${gradientParts})` };
    }

    return { backgroundColor: '#ffd753' }; // Fallback
  };

  const getSortedTimeOptions = () => {
    const rawOptions = ['01:00', '09:00', '17:00'];
    if (!useLocalTime) return ['All', ...rawOptions];
    
    return ['All', ...[...rawOptions].sort((a, b) => {
      const hA = parseInt(a.split(':')[0]);
      const hB = parseInt(b.split(':')[0]);
      
      const dA = new Date(); dA.setUTCHours(hA, 0, 0, 0);
      const dB = new Date(); dB.setUTCHours(hB, 0, 0, 0);
      
      return dA.getHours() - dB.getHours();
    })];
  };

  useEffect(() => {
    const fetchContests = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/contests');
        if (!response.ok) throw new Error('Failed to fetch contests');
        const json: ContestsResponse = await response.json();
        const now = new Date();
        const upcoming = (json.data || []).filter(contest => {
          const startDate = new Date(contest.startDate);
          return startDate > now;
        });
        setContests(upcoming);
      } catch (err) {
        console.error('Error fetching contests:', err);
        setError('Error loading active contests. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchContests();

    const fetchRanking = async () => {
      try {
        setRankingLoading(true);
        const res = await fetch('/api/predictions/ranking');
        const json = await res.json();
        if (json.success) {
          setRankingData(json.data);
        }
      } catch (err) {
        console.error('Error fetching ranking:', err);
      } finally {
        setRankingLoading(false);
      }
    };
    fetchRanking();
  }, []);

  // Helper: check if a trait string from CSV contains any of the target trait substrings
  const hasTrait = (traitsStr: string, targets: string[]) =>
    targets.some(t => traitsStr.toLowerCase().includes(t.toLowerCase()));

  const getSortedRanking = () => {
    let sorted = [...rankingData];

    // Filter by Fur
    if (selectedMetaScheme === 'Whale Watching') {
      sorted = sorted.filter(m => m.Fur === '1 of 1');
    } else if (selectedMetaScheme === 'Divine Intervention') {
      sorted = sorted.filter(m => m.Fur === 'Spirit');
    } else if (selectedMetaScheme === 'Midnight Strike') {
      sorted = sorted.filter(m => m.Fur === 'Shadow');
    } else if (selectedMetaScheme === 'Golden Shower') {
      sorted = sorted.filter(m => m.Fur === 'Gold');
    } else if (selectedMetaScheme === 'Rainbow Riot') {
      sorted = sorted.filter(m => m.Fur === 'Rainbow');
    }
    // Filter by Trait (using TRAIT_GROUPS exact trait values)
    else if (selectedMetaScheme === 'Shapeshifting') {
      // Tongue Out or Tanuki, Kitsune or Cat Mask
      sorted = sorted.filter(m => hasTrait(m.Traits, ['Tongue Out', 'Tanuki', 'Kitsune', 'Cat Mask']));
    } else if (selectedMetaScheme === 'Tear Jerking') {
      sorted = sorted.filter(m => hasTrait(m.Traits, ['Crying Eye']));
    } else if (selectedMetaScheme === 'Costume Party') {
      // Onesie or Lemon, Kappa, Tomato or Blob Head
      sorted = sorted.filter(m => hasTrait(m.Traits, ['Onesie', 'Lemon', 'Kappa', 'Tomato', 'Blob Head']));
    } else if (selectedMetaScheme === 'Dress To Impress') {
      sorted = sorted.filter(m => hasTrait(m.Traits, ['Kimono']));
    } else if (selectedMetaScheme === 'Call To Arms') {
      // Ronin or Samurai (including Ronin Aurora, Ronin Moon)
      sorted = sorted.filter(m => hasTrait(m.Traits, ['Ronin', 'Samurai']));
    } else if (selectedMetaScheme === 'Malicious Intent') {
      // Devious Mouth or Oni, Tengu or Skull Mask
      sorted = sorted.filter(m => hasTrait(m.Traits, ['Devious Mouth', 'Oni', 'Tengu', 'Skull Mask']));
    } else if (selectedMetaScheme === 'Housekeeping') {
      // Apron, Garbage/Gold Can or Toilet Paper
      sorted = sorted.filter(m => hasTrait(m.Traits, ['Apron', 'Garbage Can', 'Gold Can', 'Toilet Paper']));
    } else if (selectedMetaScheme === 'Dungaree Duel') {
      // Pink, Blue or Green Overalls
      sorted = sorted.filter(m => hasTrait(m.Traits, ['Pink Overalls', 'Blue Overalls', 'Green Overalls']));
    }

    // Compute sorting metric
    sorted = sorted.map(moki => {
      let metric = moki.Score;
      if (selectedMetaScheme === 'Taking A Dive') {
        metric = (moki.Losses * 175) + moki.Score;
      } else if (selectedMetaScheme === 'Touching The Wart') {
        metric = (moki['Wart Closer'] * 175) + moki.Score;
      } else if (selectedMetaScheme === 'Collective Specialization') {
        metric = moki['Gacha Pts'] + moki.Score;
      }
      return { ...moki, _metric: metric };
    });

    sorted.sort((a: any, b: any) => b._metric - a._metric);
    return sorted;
  };

  const allSortedRanking = getSortedRanking();
  const currentRanking = allSortedRanking.slice(rankingPage * RANKING_PAGE_SIZE, (rankingPage + 1) * RANKING_PAGE_SIZE);
  const totalRankingPages = Math.ceil(allSortedRanking.length / RANKING_PAGE_SIZE);

  const handleCardClick = (contest: Contest) => {
    setSelectedContest(contest);
    setLineupCount(1);
  };

  const handleGenerate = () => {
    alert(`Generating ${lineupCount} lineups for "${selectedContest?.name}"... (Feature coming soon!)`);
    setSelectedContest(null);
  };

  const toggleFilter = (filterName: string) => {
    setOpenFilter(openFilter === filterName ? null : filterName);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setOpenFilter(null);
  };

  const filteredContests = contests.filter(contest => {
    // Hide Full filter
    if (hideFull && contest.entries >= contest.maxEntries) return false;

    // Distribution filter
    if (filters.distribution !== 'All') {
      const split = contest.prizeSplitConfig.defaultSplit.toLowerCase();
      const target = filters.distribution.toLowerCase();
      if (target === '50/50' && !split.includes('50') && !split.includes('fifty')) return false;
      if (target === 'top 20%' && !split.includes('20')) return false;
      if (target === 'top 10%' && !split.includes('10')) return false;
      if (target === 'winner take all' && !split.includes('winner')) return false;
      if (target === 'free' && !split.includes('free')) return false;
    }

    // Price filter
    if (filters.price !== 'All') {
      const amount = contest.entryPrice.amount;
      if (filters.price === '100-500' && (amount < 100 || amount > 500)) return false;
      if (filters.price === '500-1000' && (amount < 500 || amount > 1000)) return false;
      if (filters.price === '1000-2000' && (amount < 1000 || amount > 2000)) return false;
      if (filters.price === '+2000' && amount <= 2000) return false;
    }

    // Time filter
    if (filters.time !== 'All') {
      const date = new Date(contest.startDate);
      const hour = date.getUTCHours();
      const targetHour = parseInt(filters.time.split(':')[0]);
      if (hour !== targetHour) return false;
    }

    // Type filter
    if (filters.type !== 'All') {
      const champions = contest.lineupConfig.slots.filter(s => s.cardType === 'champion');
      const type = filters.type.toLowerCase();

      if (type === 'open') {
        if (!champions.every(s => s.minRarity === 'basic' && s.maxRarity === 'legendary')) return false;
      } else if (type === 'only legendary') {
        if (!champions.every(s => s.minRarity === 'legendary' && s.maxRarity === 'legendary')) return false;
      } else if (type === 'only epic') {
        if (!champions.every(s => s.minRarity === 'epic' && s.maxRarity === 'epic')) return false;
      } else if (type === 'only rare') {
        if (!champions.every(s => s.minRarity === 'rare' && s.maxRarity === 'rare')) return false;
      } else if (type === 'only basic') {
        if (!champions.every(s => s.minRarity === 'basic' && s.maxRarity === 'basic')) return false;
      } else if (type === 'up to epic') {
        if (!champions.every(s => s.minRarity === 'basic' && s.maxRarity === 'epic')) return false;
      } else if (type === 'up to rare') {
        // Corrected from user text (likely 'rare')
        if (!champions.every(s => s.minRarity === 'basic' && s.maxRarity === 'rare')) return false;
      } else if (type === 'one-of-each') {
        if (champions.length !== 4) return false;
        const [c1, c2, c3, c4] = champions;
        if (!(c1.minRarity === 'basic' && c1.maxRarity === 'basic' &&
              c2.minRarity === 'rare' && c2.maxRarity === 'rare' &&
              c3.minRarity === 'epic' && c3.maxRarity === 'epic' &&
              c4.minRarity === 'legendary' && c4.maxRarity === 'legendary')) return false;
      } else if (type === 'mix') {
        const configs = champions.map(s => `${s.minRarity}-${s.maxRarity}`);
        const uniqueConfigs = new Set(configs);
        
        // MIX is flexible: more than one rarity config, but NOT one-of-each
        if (uniqueConfigs.size < 2) return false;
        
        const isOneOfEach = champions.length === 4 && 
              champions[0].minRarity === 'basic' && champions[0].maxRarity === 'basic' &&
              champions[1].minRarity === 'rare' && champions[1].maxRarity === 'rare' &&
              champions[2].minRarity === 'epic' && champions[2].maxRarity === 'epic' &&
              champions[3].minRarity === 'legendary' && champions[3].maxRarity === 'legendary';
              
        if (isOneOfEach) return false;
      }
    }

    return true;
  });

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Fetching active contests...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.loadingContainer}>
        <div style={{ color: '#ff4b4b', textAlign: 'center' }}>
          <h3>Oops!</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <div className={styles.headerTopRow}>
          <div className={styles.titleGroup}>
            <h1 className={styles.resultsTitle}>PREDICTIONS</h1>
          </div>

          <div className={styles.filterSection}>
            {/* DISTRIBUTION Filter */}
            <div className={styles.orderByContainer}>
              <button
                className={styles.orderByButton}
                onClick={() => toggleFilter('distribution')}
              >
                {filters.distribution === 'All' ? 'DISTRIBUTION' : filters.distribution}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openFilter === 'distribution' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {openFilter === 'distribution' && (
                <ul className={styles.orderByMenu}>
                  {['All', '50/50', 'Top 20%', 'Top 10%', 'Winner Take All', 'Free'].map(opt => (
                    <li key={opt} onClick={() => handleFilterChange('distribution', opt)} className={filters.distribution === opt ? styles.activeSort : ''}>
                      {opt}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* PRICE Filter */}
            <div className={styles.orderByContainer}>
              <button
                className={styles.orderByButton}
                onClick={() => toggleFilter('price')}
              >
                {filters.price === 'All' ? 'PRICE' : filters.price}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openFilter === 'price' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {openFilter === 'price' && (
                <ul className={styles.orderByMenu}>
                  {['All', '100-500', '500-1000', '1000-2000', '+2000'].map(opt => (
                    <li key={opt} onClick={() => handleFilterChange('price', opt)} className={filters.price === opt ? styles.activeSort : ''}>
                      {opt}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* TIME Filter */}
            <div className={styles.orderByContainer}>
              <button
                className={styles.orderByButton}
                onClick={() => toggleFilter('time')}
              >
                {filters.time === 'All' ? 'TIME' : getSlotLabel(filters.time)}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openFilter === 'time' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {openFilter === 'time' && (
                <ul className={styles.orderByMenu}>
                  {getSortedTimeOptions().map(opt => (
                    <li key={opt} onClick={() => handleFilterChange('time', opt)} className={filters.time === opt ? styles.activeSort : ''}>
                      {getSlotLabel(opt)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* TYPE Filter */}
            <div className={styles.orderByContainer}>
              <button
                className={styles.orderByButton}
                onClick={() => toggleFilter('type')}
              >
                {filters.type === 'All' ? 'TYPE' : filters.type}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openFilter === 'type' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {openFilter === 'type' && (
                <ul className={styles.orderByMenu}>
                  {['All', 'Open', 'Only Legendary', 'Only Epic', 'Only Rare', 'Only Basic', 'One-Of-Each', 'Up To Epic', 'Up To Rare', 'Mix'].map(opt => (
                    <li key={opt} onClick={() => handleFilterChange('type', opt)} className={filters.type === opt ? styles.activeSort : ''}>
                      {opt}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ flex: 1 }} />

            <button 
              className={`${styles.hideFullBtn} ${hideFull ? styles.active : ''}`}
              onClick={() => setHideFull(!hideFull)}
            >
              {hideFull ? 'SHOW ALL' : 'HIDE FULL'}
            </button>

            <button 
              className={`${styles.hideFullBtn} ${useLocalTime ? styles.activeLocal : ''}`}
              onClick={() => setUseLocalTime(!useLocalTime)}
              style={{ minWidth: '100px' }}
            >
              {useLocalTime ? 'LOCAL TIME' : 'UTC TIME'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.mainContent}>
          <div className={styles.contestGrid}>
            {filteredContests.length > 0 ? (
              filteredContests.map((contest) => (
                <div 
                  key={contest.id} 
                  className={styles.contestCard}
                  onClick={() => handleCardClick(contest)}
                >
                  <div className={styles.cardHeader}>
                    <h3 className={styles.contestName}>{contest.name}</h3>
                  </div>

                  <div className={styles.contestInfo}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoIcon}>📅</span>
                      <span>Starts: {formatContestDate(contest.startDate)}</span>
                    </div>
                    
                    <div className={styles.priceRow}>
                      <div className={styles.priceDisplay}>
                        {['gems', 'gem'].includes(contest.entryPrice.currency.toLowerCase()) ? (
                          <img 
                            src="/icons/count.png" 
                            className={styles.currencyIcon} 
                            alt="Gems" 
                          />
                        ) : null}
                        <span className={styles.amount}>{contest.entryPrice.amount}</span>
                        <span className={styles.currency}>{contest.entryPrice.currency}</span>
                      </div>

                      <div className={styles.slotsPreview}>
                        {contest.lineupConfig.slots.map((slot, idx) => (
                          <div 
                            key={idx} 
                            className={styles.slotDot} 
                            style={getSlotStyle(slot)}
                            title={`${slot.cardType} (${slot.minRarity}-${slot.maxRarity})`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <div className={styles.entriesCount}>
                      {contest.entries} / {contest.maxEntries} Entries
                    </div>
                    <div className={styles.entriesCount}>
                      Max Per User: {contest.maxEntriesPerUser}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className={styles.noResults}>
                No active contests found at the moment.
              </p>
            )}
          </div>
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.rankingBox}>
            <div className={styles.rankingHeader}>
              <h2 className={styles.rankingTitle}>Champions Ranking</h2>
              <button 
                className={styles.metaSchemesBtn}
                onClick={() => setIsSchemeMenuOpen(true)}
              >
                META SCHEMES
              </button>
            </div>
            <p className={styles.rankingSubtitle}>
              {selectedMetaScheme ? `Filtered by ${selectedMetaScheme}` : 'Ordered by prediction power'}
            </p>
            
            <div className={styles.rankingList}>
              {rankingLoading ? (
                <div className={styles.rankingStatus}>Loading ranking...</div>
              ) : currentRanking.length > 0 ? (
                currentRanking.map((moki, i) => {
                  // Display metric: rank by composite score, but show the relevant sub-metric
                  let displayValue: string | number = moki.Score;
                  let metricLabel = 'pts';
                  if (selectedMetaScheme === 'Taking A Dive') {
                    displayValue = ((moki as any)._metric ?? moki.Score);
                    metricLabel = 'pts';
                  } else if (selectedMetaScheme === 'Collective Specialization') {
                    displayValue = ((moki as any)._metric ?? moki.Score);
                    metricLabel = 'pts';
                  } else if (selectedMetaScheme === 'Touching The Wart') {
                    displayValue = ((moki as any)._metric ?? moki.Score);
                    metricLabel = 'pts';
                  } else {
                    displayValue = moki.Score;
                  }

                  // Image lookup: by name.toUpperCase() against value.name index
                  const lookupKey = moki.Name.toString().trim().toUpperCase();
                  const mMeta = metadataByName[lookupKey];
                  const imageUrl = mMeta?.portraitUrl ?? '';

                  const globalRank = rankingPage * RANKING_PAGE_SIZE + i + 1;

                  return (
                    <div key={`${moki['Moki ID']}-${moki.Name}-${globalRank}`} className={styles.rankingPlaceholder}>
                      <span className={styles.rankNum}>#{globalRank}</span>
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt={moki.Name}
                          className={styles.rankMokiImage}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <div className={styles.rankInfo}>
                        <span className={styles.rankName}>{moki.Name}</span>
                        <span className={styles.rankClass}>{moki.Class}</span>
                      </div>
                      <span className={styles.rankScore}>
                        {typeof displayValue === 'number' ? displayValue.toFixed(1) : displayValue}
                        <small>{metricLabel}</small>
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className={styles.rankingStatus}>No Mokis found for this scheme.</div>
              )}
              {/* Pagination */}
              {totalRankingPages > 1 && (
                <div className={styles.rankingPagination}>
                  <button
                    className={styles.rankingPageBtn}
                    onClick={() => setRankingPage(p => Math.max(0, p - 1))}
                    disabled={rankingPage === 0}
                  >‹</button>
                  <span className={styles.rankingPageLabel}>
                    {rankingPage + 1} / {totalRankingPages}
                  </span>
                  <button
                    className={styles.rankingPageBtn}
                    onClick={() => setRankingPage(p => Math.min(totalRankingPages - 1, p + 1))}
                    disabled={rankingPage === totalRankingPages - 1}
                  >›</button>
                </div>
              )}
              <div className={styles.rankingStatus}>
                {selectedMetaScheme ? `${allSortedRanking.length} candidates · ${selectedMetaScheme}` : `${allSortedRanking.length} champions ranked`}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {mounted && createPortal(
        <AnimatePresence>
          {selectedContest && (
            <div className={styles.modalOverlay} onClick={() => setSelectedContest(null)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={styles.modalContent}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className={styles.modalCloseButton}
                  onClick={() => setSelectedContest(null)}
                  title="Close"
                >
                  <svg
                  width="15"
                  height="15"
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

                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>Setup Predictions</h2>
                </div>

                <div className={styles.modalBody}>                <p className={styles.modalDesc}>
                  Customize your predictions for <strong>{selectedContest.name}</strong>.
                </p>
                
                <div className={styles.modalRow}>
                  <span className={styles.rowLabel}>
                    Entries (Max {selectedContest.maxEntriesPerUser})
                  </span>
                  <div className={styles.counterControls}>
                    <button 
                      className={styles.counterBtn}
                      onClick={() => setLineupCount(Math.max(1, lineupCount - 1))}
                      disabled={lineupCount <= 1}
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      min="1" 
                      max={selectedContest.maxEntriesPerUser}
                      value={lineupCount === 0 ? '' : lineupCount}
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        if (rawVal === '') {
                          setLineupCount(0);
                          return;
                        }
                        const val = parseInt(rawVal);
                        if (!isNaN(val)) {
                          const max = selectedContest!.maxEntriesPerUser;
                          setLineupCount(Math.min(max, Math.max(0, val)));
                        }
                      }}
                      onBlur={() => {
                        if (lineupCount < 1) {
                          setLineupCount(1);
                        }
                      }}
                      className={styles.lineupInput}
                    />
                    <button 
                      className={styles.counterBtn}
                      onClick={() => setLineupCount(Math.min(selectedContest!.maxEntriesPerUser, lineupCount + 1))}
                      disabled={lineupCount >= selectedContest.maxEntriesPerUser}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className={styles.modalRow}>
                  <span className={styles.rowLabel}>Model</span>
                  <div className={styles.toggleGroup}>
                    <button 
                      className={`${styles.toggleBtn} ${predictionModel === 'CHAMP' ? styles.active : ''}`}
                      onClick={() => setPredictionModel('CHAMP')}
                    >
                      CHAMP vs CHAMP
                    </button>
                    <button 
                      className={`${styles.toggleBtn} ${predictionModel === 'TEAM' ? styles.active : ''}`}
                      onClick={() => setPredictionModel('TEAM')}
                    >
                      TEAM vs TEAM
                    </button>
                  </div>
                </div>

                <div className={styles.modalRow}>
                  <div 
                    className={styles.checkboxWrapper} 
                    onClick={() => setAllowRepeated(!allowRepeated)}
                  >
                    <div className={`${styles.customCheckbox} ${allowRepeated ? styles.checked : ''}`}>
                      {allowRepeated && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                    </div>
                    <span className={styles.checkboxLabel}>Allow repeated lineups</span>
                  </div>
                </div>

                <div className={styles.modalActions}>
                  <button 
                    className={styles.confirmButton}
                    onClick={() => {
                      alert(`Generating ${lineupCount} ${predictionModel} lineups (Repeated: ${allowRepeated ? 'Yes' : 'No'}) for "${selectedContest.name}"`);
                      setSelectedContest(null);
                    }}
                  >
                    Generate Lineups
                  </button>
                </div>
              </div>
            </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {mounted && createPortal(
        <AnimatePresence>
          {isSchemeMenuOpen && (
            <div className={styles.modalOverlay} onClick={() => setIsSchemeMenuOpen(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={styles.schemeMenuContent}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>FILTER BY META SCHEME</h2>
                  <button
                    className={styles.modalCloseButton}
                    onClick={() => setIsSchemeMenuOpen(false)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>

                <div className={styles.schemeGrid}>
                  {META_SCHEMES.map((scheme) => (
                    <div 
                      key={scheme.name}
                      className={`${styles.schemeCard} ${selectedMetaScheme === scheme.name ? styles.selectedScheme : ''}`}
                      onClick={() => {
                        setSelectedMetaScheme(prev => prev === scheme.name ? null : scheme.name);
                        setRankingPage(0);
                        setIsSchemeMenuOpen(false);
                      }}
                    >
                      <div className={styles.schemeIconWrapper}>
                        <img src={scheme.image} alt={scheme.name} className={styles.schemeImg} />
                      </div>
                      <span className={styles.schemeNameLabel}>{scheme.name}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
