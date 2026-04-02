import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import styles from './PredictionsTab.module.css';
import { Contest, ContestsResponse } from '@/types/contest';
import mokiMetadata from '@/data/mokiMetadata.json';
import catalogJson from '@/data/catalog.json';
import { supabase } from '@/lib/supabase';
import {
  generateLineups,
  GeneratedLineup,
  MokiRankingRow,
  UpcomingMatchData,
  CatalogEntry,
  getRarityMultiplier,
} from '@/utils/lineupGenerator';
import { EnhancedCard } from '@/types';

interface PredictionsTabProps {
  allCards?: EnhancedCard[];
  userCards?: EnhancedCard[];
  cardMode?: 'ALL' | 'USER';
}

export default function PredictionsTab({ allCards = [], userCards = [], cardMode = 'ALL' }: PredictionsTabProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [lineupCount, setLineupCount] = useState<number>(1);
  const [allowRepeated, setAllowRepeated] = useState(false);
  const [maxRepeated, setMaxRepeated] = useState<number>(1);
  const [excludeStrikers, setExcludeStrikers] = useState(false);
  const [avoidMatchupConflicts, setAvoidMatchupConflicts] = useState(false);
  const [useOnlyMySchemes, setUseOnlyMySchemes] = useState(false);
  const [cardSource, setCardSource] = useState<'ALL' | 'MY'>('ALL');
  const [hideFull, setHideFull] = useState(false);
  const [useLocalTime, setUseLocalTime] = useState(false);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [isSchemeMenuOpen, setIsSchemeMenuOpen] = useState(false);
  const [selectedMetaScheme, setSelectedMetaScheme] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState<'SCORE' | 'WINRATE' | 'META'>('SCORE');
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
  const [rankingEffectiveDate, setRankingEffectiveDate] = useState<string | null>(null);
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
    const pad = (n: number) => n.toString().padStart(2, '0');

    if (!useLocalTime) {
      return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
    }
    
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const offset = -d.getTimezoneOffset() / 60;
    const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`;
    
    return `${day}/${month}/${year} ${hours}:${minutes} (UTC${offsetStr})`;
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
          if (json.effectiveDate) {
            setRankingEffectiveDate(json.effectiveDate);
          }
        }
      } catch (err) {
        console.error('Error fetching ranking:', err);
      } finally {
        setRankingLoading(false);
      }
    };
    fetchRanking();
  }, []);

  // Ensure maxRepeated is within valid bounds [2, lineupCount] if lineupCount >= 2
  useEffect(() => {
    if (lineupCount < 2) {
      setAllowRepeated(false);
      setMaxRepeated(1);
      return;
    }

    if (!allowRepeated) return;
    
    let target = maxRepeated;
    if (maxRepeated < 2) target = 2;
    if (maxRepeated > lineupCount) target = lineupCount;
    
    if (target !== maxRepeated) {
      setMaxRepeated(target);
    }
  }, [lineupCount, maxRepeated, allowRepeated]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedContest(null);
        setShowResultsModal(false);
      }
    };
    if (selectedContest) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [selectedContest]);

  // Block body scroll when modal is open
  useEffect(() => {
    if (selectedContest) {
      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
    };
  }, [selectedContest]);

  // Helper: check if a trait string from CSV contains any of the target trait substrings
  const hasTrait = (traitsStr: string, targets: string[]) => {
    if (!traitsStr) return false;
    const lowerTraits = traitsStr.toLowerCase();
    return targets.some(t => {
      const target = t.toLowerCase();
      // Special logic for "Onesie" to avoid false positives with names like "Kappa"
      // But here we are matching against the CSV string which usually has traits like "Rainbow, Black Sheep Onesie"
      const regex = new RegExp(`\\b${target}\\b`, 'i');
      return regex.test(lowerTraits);
    });
  };

  const getSortedRanking = () => {
    let sorted = [...rankingData];

    // 1. Determine base sorting metric based on activeSort
    if (activeSort === 'WINRATE') {
      sorted = sorted.map(moki => {
        const winValue = parseFloat(moki.WinRate?.toString().replace('%', '') || '0');
        return {
          ...moki,
          _metric: winValue,
          _displayScore: winValue,
          _metricLabel: '%'
        };
      });
    } else if (activeSort === 'SCORE') {
      sorted = sorted.map(moki => ({
        ...moki,
        _metric: Math.round(moki.Score),
        _displayScore: Math.round(moki.Score),
        _metricLabel: 'pts'
      }));
    } else if (activeSort === 'META' && selectedMetaScheme) {
      // Filter/Modify for Meta Scheme
      if (selectedMetaScheme === 'Whale Watching') {
        sorted = sorted.filter(m => {
          const fur = (m.Fur || '').toLowerCase().trim();
          return fur === '1 of 1' || fur === '1-of-1';
        });
      } else if (selectedMetaScheme === 'Divine Intervention') {
        sorted = sorted.filter(m => m.Fur === 'Spirit');
      } else if (selectedMetaScheme === 'Midnight Strike') {
        sorted = sorted.filter(m => m.Fur === 'Shadow');
      } else if (selectedMetaScheme === 'Golden Shower') {
        sorted = sorted.filter(m => m.Fur === 'Gold');
      } else if (selectedMetaScheme === 'Rainbow Riot') {
        sorted = sorted.filter(m => m.Fur === 'Rainbow');
      }
      // Trait-based schemes using TRAIT_GROUPS logic
      else if (selectedMetaScheme === 'Shapeshifting') {
        sorted = sorted.filter(m => hasTrait(m.Traits, ['Tongue Out', 'Tanuki', 'Kitsune', 'Cat Mask']));
      } else if (selectedMetaScheme === 'Tear jerking') {
        sorted = sorted.filter(m => hasTrait(m.Traits, ['Crying Eye']));
      } else if (selectedMetaScheme === 'Costume party') {
        sorted = sorted.filter(m => hasTrait(m.Traits, ['Onesie', 'Lemon', 'Kappa', 'Tomato', 'Blob Head']));
      } else if (selectedMetaScheme === 'Dress To Impress') {
        sorted = sorted.filter(m => hasTrait(m.Traits, ['Kimono']));
      } else if (selectedMetaScheme === 'Call To Arms') {
        sorted = sorted.filter(m => hasTrait(m.Traits, ['Ronin', 'Samurai']));
      } else if (selectedMetaScheme === 'Malicious Intent') {
        sorted = sorted.filter(m => hasTrait(m.Traits, ['Devious Mouth', 'Oni', 'Tengu', 'Skull Mask']));
      } else if (selectedMetaScheme === 'Housekeeping') {
        sorted = sorted.filter(m => hasTrait(m.Traits, ['Apron', 'Garbage Can', 'Gold Can', 'Toilet Paper']));
      } else if (selectedMetaScheme === 'Dungaree Duel') {
        sorted = sorted.filter(m => hasTrait(m.Traits, ['Pink Overalls', 'Blue Overalls', 'Green Overalls']));
      }
    }

    // Compute sorting metric and apply scheme-based bonuses
    sorted = sorted.map(moki => {
      // Safely parse numeric values from moki (which are typed as numbers but might be strings from API/CSV)
      const baseScore = typeof moki.Score === 'number' ? moki.Score : parseFloat(String(moki.Score || '0'));
      const winRateRaw = typeof moki.WinRate === 'number' ? moki.WinRate : parseFloat(String(moki.WinRate || '0').replace('%', ''));
      const losses = parseFloat(String(moki.Losses || '0'));
      const wartCloser = parseFloat(String(moki['Wart Closer'] || '0'));
      const gachaPts = parseFloat(String(moki['Gacha Pts'] || '0'));

      // Bonus of 1000 pts for filtering-based schemes (Fur/Traits)
      const filteringSchemes = [
        'Whale Watching', 'Divine Intervention', 'Midnight Strike', 'Golden Shower', 'Rainbow Riot',
        'Shapeshifting', 'Tear jerking', 'Costume party', 'Dress To Impress', 'Call To Arms', 
        'Malicious Intent', 'Housekeeping', 'Dungaree Duel'
      ];
      
      const hasBonus = filteringSchemes.includes(selectedMetaScheme || '');
      const bonus = hasBonus ? 1000 : 0;
      
      // Default case
      let displayScore: number = Math.round(baseScore + bonus);
      let metric: number = displayScore;
      let metricLabel = 'pts';

      // 1. If WINRATE filter is active, it overrides everything else
      if (activeSort === 'WINRATE') {
        displayScore = winRateRaw;
        metric = winRateRaw;
        metricLabel = '%';
      } 
      // 2. Specialized META schemes logic
      else if (selectedMetaScheme === 'Taking A Dive') {
        metric = displayScore + (losses * 175);
        displayScore = Math.round(metric);
      } else if (selectedMetaScheme === 'Touching The Wart') {
        metric = displayScore + (wartCloser * 175);
        displayScore = Math.round(metric);
      } else if (selectedMetaScheme === 'Collective Specialization') {
        // Formula: (Gacha Pts + ((WinRate / 10) * 300)) + (Gacha Pts * 0.5)
        const calculatedScore = (gachaPts + (winRateRaw / 10) * 300) + (gachaPts * 0.5);
        displayScore = Math.round(calculatedScore);
        metric = displayScore;
      }
      
      return { 
        ...moki, 
        _metric: metric,
        _displayScore: displayScore,
        _metricLabel: metricLabel
      };
    });

    sorted.sort((a: any, b: any) => (b._metric || 0) - (a._metric || 0));

    // Apply Top 50 cut for specific specialization schemes
    if (selectedMetaScheme === 'Taking A Dive' || selectedMetaScheme === 'Touching The Wart') {
      return sorted.slice(0, 50);
    }

    // Apply Top 30 cut for Collective Specialization
    if (selectedMetaScheme === 'Collective Specialization') {
      return sorted.slice(0, 30);
    }

    return sorted;
  };

  const allSortedRanking = getSortedRanking();
  const currentRanking = allSortedRanking.slice(rankingPage * RANKING_PAGE_SIZE, (rankingPage + 1) * RANKING_PAGE_SIZE);
  const totalRankingPages = Math.ceil(allSortedRanking.length / RANKING_PAGE_SIZE);

  const handleCardClick = (contest: Contest) => {
    setSelectedContest(contest);
    setLineupCount(contest.maxEntriesPerUser);
  };

  // ─── Lineup Generation State ───────────────────────────────────────────────
  const [upcomingMatchesCache, setUpcomingMatchesCache] = useState<UpcomingMatchData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLineups, setGeneratedLineups] = useState<GeneratedLineup[]>([]);
  const [showResultsModal, setShowResultsModal] = useState(false);

  const handleGenerate = async () => {
    if (!selectedContest || rankingData.length === 0) return;
    setIsGenerating(true);

    let matches = upcomingMatchesCache;
    if (matches.length === 0) {
      try {
        const { data } = await supabase.from('upcoming_matches_ga').select('*');
        if (data) {
          setUpcomingMatchesCache(data as UpcomingMatchData[]);
          matches = data as UpcomingMatchData[];
        }
      } catch (e) {
        console.error('Failed to load upcoming matches:', e);
      }
    }

    const results = generateLineups({
      rankingData: rankingData as unknown as MokiRankingRow[],
      catalog: catalogJson as unknown as CatalogEntry[],
      userCards: userCards,
      cardMode: cardSource === 'MY' ? 'USER' : 'ALL',
      contest: selectedContest,
      upcomingMatches: matches,
      lineupCount: selectedContest.maxEntriesPerUser,
      allowRepeated,
      maxRepeated,
      excludeStrikers,
      avoidMatchupConflicts,
      useOnlyMySchemes,
      cardSource,
    });

    setGeneratedLineups(results);
    setIsGenerating(false);
    // Don't clear selectedContest yet, we need its ID for the link in the results modal
    setShowResultsModal(true);
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
    <>
    <div className={styles.container}>
      <div className={styles.mainLayout}>
        <div className={styles.mainContent}>
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
            <h2 className={styles.rankingTitle}>PREDICTION RANKING</h2>
            
            {rankingEffectiveDate && (
              <p className={styles.rankingDateLabel} style={{ 
                color: '#333333', 
                fontSize: '0.72rem', 
                marginBottom: '0.4rem',
                marginTop: '-0.2rem',
                fontWeight: 600,
                letterSpacing: '0.01em',
                textTransform: 'uppercase'
              }}>
                FOR {formatContestDate(rankingEffectiveDate)} CONTEST
              </p>
            )}

            <div className={styles.filterByRow}>
              <span className={styles.filterLabel}>Filter by:</span>
              <div className={styles.sortControls}>
                <button 
                  className={`${styles.metaSchemesBtn} ${activeSort === 'SCORE' ? styles.activeMeta : ''}`}
                  onClick={() => {
                    setActiveSort('SCORE');
                    setSelectedMetaScheme(null);
                  }}
                >
                  SCORE
                </button>
                <button 
                  className={`${styles.metaSchemesBtn} ${activeSort === 'WINRATE' ? styles.activeMeta : ''}`}
                  onClick={() => {
                    setActiveSort('WINRATE');
                    setSelectedMetaScheme(null);
                  }}
                >
                  WINRATE
                </button>
                <button 
                  className={`${styles.metaSchemesBtn} ${activeSort === 'META' ? styles.activeMeta : ''}`}
                  onClick={() => setIsSchemeMenuOpen(true)}
                >
                  META SCHEME
                </button>
              </div>
            </div>

            <p className={styles.rankingSubtitle}>
              {activeSort === 'SCORE' && 'Ordered by expected Score'}
              {activeSort === 'WINRATE' && 'Ordered by expected Winrate'}
              {activeSort === 'META' && `Ordered by expected Score, filtered by ${selectedMetaScheme}`}
            </p>
            
            <div className={styles.rankingList}>
              {rankingLoading ? (
                <div className={styles.rankingStatus}>Loading ranking...</div>
              ) : currentRanking.length > 0 ? (
                currentRanking.map((moki, i) => {
                  const displayValue = (moki as any)._displayScore ?? moki.Score;
                  const metricLabel = (moki as any)._metricLabel ?? 'pts';

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
                        {displayValue}
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
          {selectedContest && !showResultsModal && (
            <motion.div
              className={styles.modalOverlay}
              onClick={() => setSelectedContest(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
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

                <div className={styles.modalBody}>
                  <p className={styles.modalDesc}>
                    Customize your predictions for <strong>{selectedContest.name}</strong>.
                  </p>
                
                <div className={styles.modalInfoBox}>
                  <p className={styles.modalInfoText}>
                    The model automatically generates all possible lineups and ranks them from highest to lowest, using only Meta Schemes, a minimum number of points to filter out bad lineups, and prioritizing Fur/Trait Schemes in the lineup logic. Once generated, you will have the option to refactor them.
                  </p>
                </div>

                <div className={styles.modalRow}>
                  <span className={styles.rowLabel}>Setup with</span>
                  <div className={styles.toggleGroup}>
                    <button 
                      className={`${styles.toggleBtn} ${cardSource === 'ALL' ? styles.active : ''}`}
                      onClick={() => {
                        setCardSource('ALL');
                        setAllowRepeated(false);
                        setUseOnlyMySchemes(false);
                      }}
                    >
                      ALL CARDS
                    </button>
                    <button 
                      className={`${styles.toggleBtn} ${cardSource === 'MY' ? styles.active : ''}`}
                      onClick={() => setCardSource('MY')}
                    >
                      MY CARDS
                    </button>
                  </div>
                </div>

                <div className={styles.checkboxGroup}>
                  <div 
                    className={styles.checkboxWrapper} 
                    onClick={() => setAvoidMatchupConflicts(!avoidMatchupConflicts)}
                  >
                    <div className={`${styles.customCheckbox} ${avoidMatchupConflicts ? styles.checked : ''}`}>
                      {avoidMatchupConflicts && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                    </div>
                    <span className={styles.checkboxLabel}>Avoid match up conflicts within the same lineup</span>
                  </div>

                  <div 
                    className={styles.checkboxWrapper} 
                    onClick={() => setExcludeStrikers(!excludeStrikers)}
                  >
                    <div className={`${styles.customCheckbox} ${excludeStrikers ? styles.checked : ''}`}>
                      {excludeStrikers && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                    </div>
                    <span className={styles.checkboxLabel}>Exclude Strikers</span>
                  </div>

                  <div 
                    className={styles.checkboxWrapper} 
                    onClick={() => {
                      if (cardSource !== 'ALL') {
                        setUseOnlyMySchemes(!useOnlyMySchemes);
                      }
                    }}
                    style={{ 
                      pointerEvents: cardSource === 'ALL' ? 'none' : 'auto',
                      opacity: cardSource === 'ALL' ? 0.5 : 1
                    }}
                    title={cardSource === 'ALL' ? "Scheme filtering is only available for 'MY CARDS' mode" : ""}
                  >
                    <div className={`${styles.customCheckbox} ${useOnlyMySchemes ? styles.checked : ''}`}>
                      {useOnlyMySchemes && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                    </div>
                    <span className={styles.checkboxLabel}>Use only my schemes</span>
                  </div>

                  {selectedContest.maxEntriesPerUser > 1 && (
                    <div 
                      className={styles.checkboxWrapper} 
                      onClick={() => {
                        if (cardSource !== 'ALL') {
                          setAllowRepeated(!allowRepeated);
                        }
                      }}
                      style={{ 
                        marginBottom: allowRepeated ? '6px' : '0',
                        pointerEvents: cardSource === 'ALL' ? 'none' : 'auto',
                        opacity: cardSource === 'ALL' ? 0.5 : 1
                      }}
                      title={cardSource === 'ALL' ? "Repeated lineups are only available for 'MY CARDS' mode" : ""}
                    >
                      <div className={`${styles.customCheckbox} ${allowRepeated ? styles.checked : ''}`}>
                        {allowRepeated && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>
                      <span className={styles.checkboxLabel}>Allow repeated lineups in the contest</span>
                    </div>
                  )}

                  {allowRepeated && selectedContest.maxEntriesPerUser > 1 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={styles.nestedRow}
                    >
                      <span className={styles.nestedLabel}>MAX PER UNIQUE LINEUP</span>
                      <div className={styles.counterControlsSmall}>
                        <button 
                          className={styles.counterBtnSmall}
                          onClick={() => setMaxRepeated(Math.max(2, maxRepeated - 1))}
                          disabled={maxRepeated <= 2}
                          title="Decrease"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        </button>
                        <input 
                          type="number" 
                          min="2" 
                          max={lineupCount}
                          value={maxRepeated === 0 ? '' : maxRepeated}
                          onKeyDown={(e) => {
                            if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => {
                            const rawVal = e.target.value;
                            if (rawVal === '') {
                              setMaxRepeated(0);
                              return;
                            }
                            const val = parseInt(rawVal);
                            if (!isNaN(val)) {
                              setMaxRepeated(Math.min(lineupCount, Math.max(0, val)));
                            }
                          }}
                          onBlur={() => {
                            if (maxRepeated < 2) {
                              setMaxRepeated(2);
                            }
                          }}
                          className={styles.nestedInput}
                        />
                        <button 
                          className={styles.counterBtnSmall}
                          onClick={() => setMaxRepeated(Math.min(lineupCount, maxRepeated + 1))}
                          disabled={maxRepeated >= lineupCount}
                          title="Increase"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        </button>
                        <button 
                          className={styles.maxBtnSmall}
                          onClick={() => setMaxRepeated(lineupCount)}
                        >
                          MAX
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className={styles.modalActions}>
                  <button 
                    className={`${styles.confirmButton} ${isGenerating ? styles.generating : ''}`}
                    onClick={handleGenerate}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                        <svg className={styles.spinner} viewBox="0 0 50 50" width="16" height="16">
                          <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="31.4 31.4" strokeLinecap="round">
                            <animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1s" values="0 25 25;360 25 25" />
                          </circle>
                        </svg>
                        Generating...
                      </span>
                    ) : 'Generate Lineups'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
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
                        const isDeselecting = selectedMetaScheme === scheme.name;
                        setSelectedMetaScheme(isDeselecting ? null : scheme.name);
                        setActiveSort(isDeselecting ? 'SCORE' : 'META');
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

    {/* ─── RESULTS MODAL ─────────────────────────────────────────────────── */}
    {mounted && createPortal(
      <AnimatePresence>
        {showResultsModal && selectedContest && (
          <motion.div
            className={styles.modalOverlay}
            onClick={() => { setShowResultsModal(false); setSelectedContest(null); }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={`${styles.modalContent} ${styles.resultsModal}`}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
            >
              <button className={styles.modalCloseButton} onClick={() => { setShowResultsModal(false); setSelectedContest(null); }} title="Close">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <div className={`${styles.modalHeader} ${styles.resultsModalHeader}`}>
                <div className={styles.modalTitleGroup}>
                  <h2 className={styles.modalTitle}>Generated Lineups</h2>
                  <div className={styles.modalSubtitleRow}>
                    <p className={styles.modalSubtitle}>
                      Explored {generatedLineups.length} unique strategic entries using {cardSource === 'ALL' ? 'all the collection.' : 'your collection.'}
                    </p>
                    {selectedContest && (
                      <a 
                        href={`https://fantasy.grandarena.gg/contests/${selectedContest.id}/lineup`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={styles.contestLink}
                      >
                        CONTEST LINK
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
              {generatedLineups.length === 0 ? (
                <div className={styles.resultsEmpty}>
                  <p>No lineups could be generated with the current settings and available cards.</p>
                  <p style={{ opacity: 0.6, fontSize: '0.85rem', marginTop: '0.5rem' }}>Try relaxing the filters or adding more cards to your wallet.</p>
                </div>
              ) : (
                        <div className={styles.lineupsList}>
                          {generatedLineups.map((lineup, idx) => {
                            // Find scheme card in catalog.json
                            const schemeCard = (catalogJson as any[]).find(
                              c => c.id === 'Scheme' && c.name?.toLowerCase() === lineup.schemeName?.toLowerCase()
                            );
                            const schemeImage = schemeCard?.image || lineup.schemeImage;

                            return (
                              <div key={lineup.id} className={styles.lineupCard}>
                                <div className={styles.lineupCardHeader}>
                                  <span className={styles.lineupNumber}>LINEUP #{idx + 1}</span>
                                  <div className={styles.lineupScoreBadge}>
                                    <span className={styles.lineupScoreLabel}>TOTAL SCORE</span>
                                    <span className={styles.lineupScoreValue}>{Math.round(lineup.totalEffectiveScore).toLocaleString()}</span>
                                  </div>
                                </div>
                                <div className={styles.lineupMokisGrid}>
                                  {/* ─── Moki Slots (1-4) ─── */}
                                  {lineup.mokis.map((moki) => {
                                    const mokiEffective = moki.baseScore * getRarityMultiplier(moki.rarity);
                                    return (
                                      <div key={`${lineup.id}-${moki.name}`} className={styles.mokiSlotCard}>
                                        <div className={styles.mokiCardImgWrapper}>
                                          {moki.cardImage ? (
                                            <img src={moki.cardImage} alt={moki.name} className={styles.mokiCardImg} loading="lazy" />
                                          ) : (
                                            <div className={styles.mokiCardImgPlaceholder}>?</div>
                                          )}
                                        </div>
                                        <div className={styles.mokiCardScoreBadge}>
                                          <span className={styles.mokiCardScoreValue}>{Math.round(mokiEffective).toLocaleString()} PTS</span>
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* ─── Scheme Card Slot (5th) ─── */}
                                  {(() => {
                                    const mokiSum = lineup.mokis.reduce((sum, m) => sum + (m.baseScore * getRarityMultiplier(m.rarity)), 0);
                                    const schemeScore = Math.max(0, lineup.totalEffectiveScore - mokiSum);
                                    
                                    // Check if user owns this scheme card (using generator's stock-aware flag)
                                    const isOwned = lineup.hasScheme;

                                    return (
                                      <div className={`${styles.mokiSlotCard} ${styles.schemeSlotCard}`}>
                                        <div className={`${styles.mokiCardImgWrapper} ${!isOwned ? styles.nonOwnedSchemeCard : ''}`}>
                                          <img src={schemeImage} alt="Scheme" className={styles.mokiCardImg} />
                                        </div>
                                        <div className={styles.mokiCardScoreBadge}>
                                          <span className={styles.mokiCardScoreValue}>{Math.round(schemeScore).toLocaleString()} PTS</span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  );
}

