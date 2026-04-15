import React, { useEffect, useState, useMemo } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
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
import { isSchemeTrait } from '@/data/traitMapping';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('API Error');
  return res.json();
});

const ChevronDown = ({ size = 16, style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

interface PredictionsTabProps {
  allCards?: EnhancedCard[];
  userCards?: EnhancedCard[];
  cardMode?: 'ALL' | 'USER';
  isTestMode?: boolean;
}

export default function PredictionsTab({ allCards = [], userCards = [], cardMode = 'ALL', isTestMode = false }: PredictionsTabProps) {
  const [mounted, setMounted] = useState(false);
  const [mokiStats, setMokiStats] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ─── 1. Load moki_stats for real-time class verification ───────────────────
  useEffect(() => {
    async function loadStats() {
      const { data } = await supabase
        .from('moki_stats')
        .select('moki_id, name, class');
      if (data) setMokiStats(data);
    }
    loadStats();
  }, []);

  // ─── 2. AI Ranking (using SWR) ─────────────────────────────────────────────
  const {
    data: rankingRaw,
    error: rankingErrorSWR,
    isLoading: rankingLoading
  } = useSWR(`/api/predictions/ranking${isTestMode ? '?mode=test' : ''}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  const rankingData = useMemo(() => rankingRaw?.success ? rankingRaw.data : [], [rankingRaw]);
  const rankingEffectiveDate = useMemo(() => rankingRaw?.effectiveDate || null, [rankingRaw]);
  const rankingError = rankingErrorSWR ? 'Failed to load AI ranking.' : null;

  // ─── 3. Contests (using SWR) ───────────────────────────────────────────────
  const {
    data: contestsRaw,
    error: contestsErrorSWR,
    isLoading: contestsLoading
  } = useSWR<ContestsResponse>('/api/contests', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  const contests = useMemo(() => {
    if (!contestsRaw?.data) return [];
    const now = new Date();
    return contestsRaw.data.filter(contest => new Date(contest.startDate) > now);
  }, [contestsRaw]);

  const contestsError = contestsErrorSWR ? 'Contests API timeout or error.' : null;

  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [lineupCount, setLineupCount] = useState<number>(1);
  const [allowRepeated, setAllowRepeated] = useState(false);
  const [maxRepeated, setMaxRepeated] = useState<number>(1);
  const [excludedClasses, setExcludedClasses] = useState<string[]>([]);
  const [isExcludeClassesModalOpen, setIsExcludeClassesModalOpen] = useState(false);
  const [selectedGenerateScheme, setSelectedGenerateScheme] = useState('ALL');
  const [isSchemeSelectModalOpen, setIsSchemeSelectModalOpen] = useState(false);
  const [avoidMatchupConflicts, setAvoidMatchupConflicts] = useState(false);
  const [useOnlyMySchemes, setUseOnlyMySchemes] = useState(false);
  const [cardSource, setCardSource] = useState<'ALL' | 'MY'>('ALL');
  const [hideFull, setHideFull] = useState(false);
  const [useLocalTime, setUseLocalTime] = useState(false);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [isSchemeMenuOpen, setIsSchemeMenuOpen] = useState(false);
  const [selectedMetaScheme, setSelectedMetaScheme] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState<'SCORE' | 'WINRATE' | 'META'>('SCORE');
  const [mobileRankingOpen, setMobileRankingOpen] = useState(false);
  const [isExpandedRankingOpen, setIsExpandedRankingOpen] = useState(false);
  const [modalSortKey, setModalSortKey] = useState<string | null>(null);
  const [modalSortDirection, setModalSortDirection] = useState<'asc' | 'desc'>('desc');
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const handleModalSort = (key: string) => {
    if (modalSortKey === key) {
      setModalSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setModalSortKey(key);
      setModalSortDirection('desc');
    }
  };

  useEffect(() => {
    if (isExpandedRankingOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsExpandedRankingOpen(false);
        }
      };
      window.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = 'unset';
        document.documentElement.style.overflow = 'unset';
        window.removeEventListener('keydown', handleEscape);
      };
    } else {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    }
  }, [isExpandedRankingOpen]);

  const [modalFilters, setModalFilters] = useState({ class: 'ALL', fur: 'ALL', trait: 'ALL', strategicScheme: 'ALL' });
  const [openModalDropdown, setOpenModalDropdown] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    distribution: 'All',
    price: 'All',
    time: 'All',
    type: 'All',
    mode: 'All'
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
    Deposits?: number;
    'Wart Distance'?: number;
    Deaths: number;
    Kills: number;
    'Win By Combat': number;
    Fur: string;
    Traits: string;
    _metric?: number;
    _displayScore?: number;
    _metricLabel?: string;
  }

  const [rankingPage, setRankingPage] = useState(0);
  const RANKING_PAGE_SIZE = 10;
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [contestDate, setContestDate] = useState<string | null>(null);

  // ─── 4. Load contest date for the ranking sidebar ──────────────────────────
  useEffect(() => {
    async function loadContestDate() {
      const { data } = await supabase
        .from('upcoming_matches_ga')
        .select('match_date')
        .limit(1)
        .order('match_date', { ascending: true });
      if (data && data[0]) setContestDate(data[0].match_date);
    }
    loadContestDate();
  }, []);

  // Build lookup: moki name (uppercase) -> metadata entry
  const metadataByName = React.useMemo(() => {
    const map: Record<string, Record<string, any>> = {};
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
    { name: 'Touching The Wart', image: '/scheme/touching the wart.webp' },
    { name: 'Whale Watching', image: '/scheme/whale watching.webp' },
    { name: 'Divine Intervention', image: '/scheme/divine intervention.webp' },
    { name: 'Midnight Strike', image: '/scheme/midnight strike.webp' },
    { name: 'Golden Shower', image: '/scheme/golden shower.webp' },
    { name: 'Rainbow Riot', image: '/scheme/rainbow riot.webp' },
    { name: 'Shapeshifting', image: '/scheme/shapeshifting.webp' },
    { name: 'Tear jerking', image: '/scheme/tear jerking.webp' },
    { name: 'Costume party', image: '/scheme/costume party.webp' },
    { name: 'Dress To Impress', image: '/scheme/dress to impress.webp' },
    { name: 'Call To Arms', image: '/scheme/call to arms.webp' },
    { name: 'Malicious Intent', image: '/scheme/malicious intent.webp' },
    { name: 'Housekeeping', image: '/scheme/housekeeping.webp' },
    { name: 'Dungaree Duel', image: '/scheme/dungaree duel.webp' },
    { name: 'Collective Specialization', image: '/scheme/collective specialization.webp' },
    { name: 'Taking A Dive', image: '/scheme/taking a dive.webp' },
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
    const rawOptions = ['00:00', '14:00'];
    if (!useLocalTime) return ['All', ...rawOptions];

    return ['All', ...[...rawOptions].sort((a, b) => {
      const hA = parseInt(a.split(':')[0]);
      const hB = parseInt(b.split(':')[0]);

      const dA = new Date(); dA.setUTCHours(hA, 0, 0, 0);
      const dB = new Date(); dB.setUTCHours(hB, 0, 0, 0);

      return dA.getHours() - dB.getHours();
    })];
  };

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
      const regex = new RegExp(`\\b${target}\\b`, 'i');
      return regex.test(lowerTraits);
    });
  };

  const getProcessedRanking = (
    sortMode: 'SCORE' | 'WINRATE' | 'META',
    metaScheme: string | null
  ) => {
    let sorted = [...rankingData];

    // Real-time class override from moki_stats
    sorted = sorted.map(moki => {
      const dbStat = mokiStats.find(s => s.moki_id === moki['Moki ID'] || s.name.toUpperCase() === moki.Name.toUpperCase());
      return {
        ...moki,
        Class: dbStat?.class || moki.Class
      };
    });

    // 1. Determine base sorting metric based on sortMode
    if (sortMode === 'WINRATE') {
      sorted = sorted.map(moki => {
        const winValue = parseFloat(moki.WinRate?.toString().replace('%', '') || '0');
        return {
          ...moki,
          _metric: winValue,
          _displayScore: winValue,
          _metricLabel: '%'
        };
      });
    } else if (sortMode === 'SCORE') {
      sorted = sorted.map(moki => ({
        ...moki,
        _metric: Math.round(moki.Score),
        _displayScore: Math.round(moki.Score),
        _metricLabel: 'pts'
      }));
    } else if (sortMode === 'META' && metaScheme) {
      // Filter/Modify for Meta Scheme
      if (metaScheme === 'Whale Watching') {
        sorted = sorted.filter(m => {
          const fur = (m.Fur || '').toLowerCase().trim();
          return fur === '1 of 1' || fur === '1-of-1';
        });
      } else if (metaScheme === 'Divine Intervention') {
        sorted = sorted.filter(m => m.Fur === 'Spirit');
      } else if (metaScheme === 'Midnight Strike') {
        sorted = sorted.filter(m => m.Fur === 'Shadow');
      } else if (metaScheme === 'Golden Shower') {
        sorted = sorted.filter(m => m.Fur === 'Gold');
      } else if (metaScheme === 'Rainbow Riot') {
        sorted = sorted.filter(m => m.Fur === 'Rainbow');
      } else {
        const SCHEME_NAME_MAP: Record<string, string> = {
          'Shapeshifting': 'Shapeshifting',
          'Tear jerking': 'Tear Jerking',
          'Costume party': 'Costume Party',
          'Dress To Impress': 'Dress to Impress',
          'Call To Arms': 'Call to Arms',
          'Malicious Intent': 'Malicious Intent',
          'Housekeeping': 'Housekeeping',
          'Dungaree Duel': 'Dungaree Duel',
        };
        const metaKey = metaScheme ? SCHEME_NAME_MAP[metaScheme] : null;
        if (metaKey) {
          sorted = sorted.filter(m => {
            const meta = metadataByName[(m.Name || '').toUpperCase()];
            const schemes: string[] = (meta as any)?.schemes ?? [];
            return schemes.includes(metaKey);
          });
        }
      }
    }

    // Compute sorting metric and apply scheme-based bonuses
    sorted = sorted.map(moki => {
      const baseScore = typeof moki.Score === 'number' ? moki.Score : parseFloat(String(moki.Score || '0'));
      const winRateRaw = typeof moki.WinRate === 'number' ? moki.WinRate : parseFloat(String(moki.WinRate || '0').replace('%', ''));
      const losses = parseFloat(String(moki.Losses || '0'));
      const wartCloser = parseFloat(String(moki['Wart Closer'] || '0'));
      const gachaPts = parseFloat(String(moki['Gacha Pts'] || '0'));

      const filteringSchemes = [
        'Whale Watching', 'Divine Intervention', 'Midnight Strike', 'Golden Shower', 'Rainbow Riot',
        'Shapeshifting', 'Tear jerking', 'Costume party', 'Dress To Impress', 'Call To Arms',
        'Malicious Intent', 'Housekeeping', 'Dungaree Duel'
      ];

      const hasBonus = filteringSchemes.includes(metaScheme || '');
      const bonus = hasBonus ? 1000 : 0;

      let displayScore: number = Math.round(baseScore + bonus);
      let metric: number = displayScore;
      let metricLabel = 'pts';

      if (sortMode === 'WINRATE') {
        displayScore = winRateRaw;
        metric = winRateRaw;
        metricLabel = '%';
      }
      else if (metaScheme === 'Taking A Dive') {
        metric = displayScore + (losses * 175);
        displayScore = Math.round(metric);
      } else if (metaScheme === 'Touching The Wart') {
        metric = displayScore + (wartCloser * 175);
        displayScore = Math.round(metric);
      } else if (metaScheme === 'Collective Specialization') {
        const calculatedScore = (gachaPts + (winRateRaw / 10) * 200) + (gachaPts * 0.5);
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

    if (metaScheme === 'Taking A Dive' || metaScheme === 'Touching The Wart') {
      return sorted.slice(0, 50);
    }

    if (metaScheme === 'Collective Specialization') {
      return sorted.slice(0, 30);
    }

    return sorted;
  };

  const allSidebarRanking = useMemo(() => {
    return getProcessedRanking(activeSort, selectedMetaScheme).map((m, i) => ({ ...m, _originalRank: i + 1 }));
  }, [rankingData, mokiStats, activeSort, selectedMetaScheme, metadataByName]);

  const allGlobalRanking = useMemo(() => {
    return getProcessedRanking('SCORE', null).map((m, i) => ({ ...m, _originalRank: i + 1 }));
  }, [rankingData, mokiStats, metadataByName]);

  const currentRanking = allSidebarRanking.slice(rankingPage * RANKING_PAGE_SIZE, (rankingPage + 1) * RANKING_PAGE_SIZE);
  const totalRankingPages = Math.ceil(allSidebarRanking.length / RANKING_PAGE_SIZE);

  const availClasses = ["ALL", "DEFENDER", "STRIKER", "SPRINTER", "BRUISER", "GRINDER", "ANCHOR", "CENTER", "FLANKER", "FORWARD", "SUPPORT"];
  const availFurs = ["ALL", "COMMON", "RAINBOW", "GOLD", "SHADOW", "SPIRIT", "1 OF 1"];
  const availStrategicSchemes = ["ALL", "TOUCHING THE WART", "COLLECTIVE SPECIALIZATION", "TAKING A DIVE"];
  const availTraits = ["ALL", "Shapeshifting", "Tear jerking", "Costume party", "Dress To Impress", "Call To Arms", "Malicious Intent", "Housekeeping", "Dungaree Duel"];

  const modalSortedRanking = React.useMemo(() => {
    const STRATEGIC_MAP: Record<string, string> = {
      'TOUCHING THE WART': 'Touching The Wart',
      'COLLECTIVE SPECIALIZATION': 'Collective Specialization',
      'TAKING A DIVE': 'Taking A Dive'
    };
    const sScheme = STRATEGIC_MAP[modalFilters.strategicScheme] || null;
    let baseData = getProcessedRanking('SCORE', sScheme).map((m, i) => ({ ...m, _originalRank: i + 1 }));

    let filtered = baseData;

    // Apply Class Filter
    if (modalFilters.class !== 'ALL') {
      const classFilter = modalFilters.class.toLowerCase().trim();
      filtered = filtered.filter(m => (m.Class || '').toLowerCase().trim() === classFilter);
    }
    // Apply Fur Filter
    if (modalFilters.fur !== 'ALL') {
      const furFilter = modalFilters.fur.toLowerCase().trim();
      filtered = filtered.filter(m => {
        const dataFur = (m.Fur || '').toLowerCase().trim();
        if (furFilter === '1 of 1') return dataFur === '1 of 1' || dataFur === '1-of-1';
        return dataFur === furFilter;
      });
    }
    // Apply Trait Filter
    if (modalFilters.trait !== 'ALL') {
      const MODAL_SCHEME_MAP: Record<string, string> = {
        'Shapeshifting': 'Shapeshifting',
        'Tear jerking': 'Tear Jerking',
        'Costume party': 'Costume Party',
        'Dress To Impress': 'Dress to Impress',
        'Call To Arms': 'Call to Arms',
        'Malicious Intent': 'Malicious Intent',
        'Housekeeping': 'Housekeeping',
        'Dungaree Duel': 'Dungaree Duel',
      };
      const metaKey = MODAL_SCHEME_MAP[modalFilters.trait];
      if (metaKey) {
        filtered = filtered.filter(m => {
          const mokiName = (m.Name || '').toUpperCase();
          const meta = metadataByName[mokiName];
          const schemes: string[] = (meta as any)?.schemes ?? [];
          return schemes.includes(metaKey);
        });
      }
    }

    // Apply Name Search Filter
    if (modalSearchQuery.trim()) {
      const q = modalSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(m => (m.Name || '').toLowerCase().includes(q));
    }

    if (!modalSortKey) return filtered;

    return [...filtered].sort((a: any, b: any) => {
      let valA = a[modalSortKey];
      let valB = b[modalSortKey];
      if (modalSortKey === 'WinRate') {
        valA = parseFloat(String(valA).replace('%', ''));
        valB = parseFloat(String(valB).replace('%', ''));
      }
      if (modalSortKey === 'Score') {
        valA = a._displayScore || a.Score;
        valB = b._displayScore || b.Score;
      }
      const diff = Number(valB || 0) - Number(valA || 0);
      return modalSortDirection === 'desc' ? diff : -diff;
    });
  }, [rankingData, mokiStats, modalSortKey, modalSortDirection, modalFilters, metadataByName, modalSearchQuery]);

  const deferredModalSortedRanking = React.useDeferredValue(modalSortedRanking);

  const pcRows = React.useMemo(() => deferredModalSortedRanking.map((moki: any) => (
    <tr key={moki['Moki ID']}>
      <td><strong>#{moki._originalRank}</strong></td>
      <td>{moki.Name}</td>
      <td style={{ textTransform: 'uppercase' }}><strong>{moki.Class}</strong></td>
      <td style={{ color: '#ffd753', fontWeight: 'bold' }}>{moki._displayScore}</td>
      <td style={{ color: '#1abf9e', fontWeight: 'bold' }}>{moki.WinRate}%</td>
      <td style={{ color: '#ff6b6b' }}>{moki.Losses}</td>
      <td>{moki.Deposits ?? moki.deposits ?? '0'}</td>
      <td>{moki['Wart Distance'] ?? moki.wart_distance ?? '0'}</td>
      <td>{moki.Kills ? Number(moki.Kills).toFixed(2) : '0'}</td>
      <td>{moki['Wart Closer'] ? Number(moki['Wart Closer']).toFixed(2) : '0'}</td>
      <td>{moki.Deaths ? Number(moki.Deaths).toFixed(1) : '0'}</td>
      <td>{moki['Win By Combat'] ? Number(moki['Win By Combat']).toFixed(2) : '0'}</td>
      <td>{moki.Fur}</td>
      <td className={styles.traitsCell}>
        {moki.Traits.split(',')
          .map((t: string) => t.trim())
          .filter((t: string) => isSchemeTrait(t))
          .join(', ')}
      </td>
    </tr>
  )), [deferredModalSortedRanking]);

  const mobileCards = React.useMemo(() => deferredModalSortedRanking.map((moki: any) => (
    <div key={moki['Moki ID']} className={styles.mobileRankCard}>
      <div className={styles.mobileRankHeader}>
        <span className={styles.mobileRankId}>#{moki._originalRank}</span>
        <span className={styles.mobileRankName}>{moki.Name}</span>
        <span className={styles.mobileRankClass}>{moki.Class}</span>
      </div>
      <div className={styles.mobileMainStats}>
        <div className={styles.mobileStatBox}>
          <span className={styles.mobileStatLabel}>Score</span>
          <span className={`${styles.mobileStatValue} ${styles.mobileScoreValue}`}>{moki._displayScore}</span>
        </div>
        <div className={styles.mobileStatBox}>
          <span className={styles.mobileStatLabel}>WinRate</span>
          <span className={`${styles.mobileStatValue} ${moki.WinRate >= 50 ? styles.mobileWRValPos : styles.mobileWRValNeg}`}>
            {moki.WinRate}%
          </span>
        </div>
      </div>
      <div className={styles.mobileStatsGrid}>
        <div className={styles.mobileGridItem}>
          <span className={styles.mobileGridLabel}>Losses</span>
          <span className={styles.mobileGridValue}>{moki.Losses}</span>
        </div>
        <div className={styles.mobileGridItem}>
          <span className={styles.mobileGridLabel}>Balls</span>
          <span className={styles.mobileGridValue}>{moki.Deposits ?? moki.deposits ?? '0'}</span>
        </div>
        <div className={styles.mobileGridItem}>
          <span className={styles.mobileGridLabel}>WART</span>
          <span className={styles.mobileGridValue}>{moki['Wart Distance'] ? Number(moki['Wart Distance']).toFixed(1) : '0'}</span>
        </div>
        <div className={styles.mobileGridItem}>
          <span className={styles.mobileGridLabel}>ELIMS</span>
          <span className={styles.mobileGridValue}>{moki.Kills ? Number(moki.Kills).toFixed(1) : '0'}</span>
        </div>
        <div className={styles.mobileGridItem}>
          <span className={styles.mobileGridLabel}>Wart Closer</span>
          <span className={styles.mobileGridValue}>{moki['Wart Closer'] ? Number(moki['Wart Closer']).toFixed(1) : '0'}</span>
        </div>
        <div className={styles.mobileGridItem}>
          <span className={styles.mobileGridLabel}>Deaths</span>
          <span className={styles.mobileGridValue}>{moki.Deaths ? Number(moki.Deaths).toFixed(1) : '0'}</span>
        </div>
        <div className={styles.mobileGridItem}>
          <span className={styles.mobileGridLabel}>Win By Combat</span>
          <span className={styles.mobileGridValue}>{moki['Win By Combat'] ? Number(moki['Win By Combat']).toFixed(1) : '0'}</span>
        </div>
      </div>
      <div className={styles.mobileRowFooter}>
        <div className={styles.mobileFooterItem}>
          <span className={styles.mobileFooterLabel}>Fur:</span> {moki.Fur}
        </div>
        {moki.Traits.split(',').map((t: string) => t.trim()).filter((t: string) => isSchemeTrait(t)).length > 0 && (
          <div className={styles.mobileFooterItem}>
            <span className={styles.mobileFooterLabel}>Traits:</span>
            {moki.Traits.split(',').map((t: string) => t.trim()).filter((t: string) => isSchemeTrait(t)).join(', ')}
          </div>
        )}
      </div>
    </div>
  )), [deferredModalSortedRanking]);

  const handleCardClick = (contest: Contest) => {
    setSelectedContest(contest);
    setLineupCount(contest.maxEntriesPerUser);
  };

  const [upcomingMatchesCache, setUpcomingMatchesCache] = useState<UpcomingMatchData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLineups, setGeneratedLineups] = useState<GeneratedLineup[]>([]);
  const [showResultsModal, setShowResultsModal] = useState(false);

  const handleGenerate = async () => {
    if (!selectedContest || rankingData.length === 0) return;
    setIsGenerating(true);

    let matches: UpcomingMatchData[] = [];
    try {
      const { data } = await supabase.from('upcoming_matches_ga').select('*').limit(2000);
      if (data) {
        setUpcomingMatchesCache(data as UpcomingMatchData[]);
        matches = data as UpcomingMatchData[];
      }
    } catch (e) {
      console.error('Failed to load upcoming matches:', e);
      // Fallback to cache if request fails
      matches = upcomingMatchesCache;
    }

    let currentMokiStats = mokiStats;
    try {
      const { data } = await supabase.from('moki_stats').select('moki_id, name, class');
      if (data) {
        currentMokiStats = data;
        setMokiStats(data); // update the state too for the ranking table
      }
    } catch (e) {
      console.error('Failed to load fresh moki_stats:', e);
    }

    // Real-time class override from fresh moki_stats before generating
    const rankingWithFreshClasses = (rankingData as unknown as MokiRankingRow[]).map(moki => {
      const freshStat = currentMokiStats.find(s => s.moki_id === moki['Moki ID'] || s.name.toUpperCase() === moki.Name.toUpperCase());
      return {
        ...moki,
        Class: freshStat?.class || moki.Class
      };
    });

    const results = generateLineups({
      rankingData: rankingWithFreshClasses,
      catalog: catalogJson as unknown as CatalogEntry[],
      userCards: userCards,
      cardMode: cardSource === 'MY' ? 'USER' : 'ALL',
      contest: selectedContest,
      upcomingMatches: matches,
      lineupCount: selectedContest.maxEntriesPerUser,
      allowRepeated,
      maxRepeated,
      excludedClasses,
      avoidMatchupConflicts,
      useOnlyMySchemes: useOnlyMySchemes,
      cardSource: cardSource,
      selectedScheme: selectedGenerateScheme,
    });

    setGeneratedLineups(results);
    setIsGenerating(false);
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
    if (hideFull && contest.entries >= contest.maxEntries) return false;
    if (filters.distribution !== 'All') {
      const split = contest.prizeSplitConfig.defaultSplit.toLowerCase();
      const target = filters.distribution.toLowerCase();
      const contestName = contest.name.toLowerCase();

      if (target === 'sponsored') {
        if (!contestName.includes('sponsored') && !contestName.includes('bron')) return false;
      } else if (target === '50/50' && !split.includes('50') && !split.includes('fifty')) return false;
      else if (target === 'top 20%' && !split.includes('20')) return false;
      else if (target === 'top 10%' && !split.includes('10')) return false;
      else if (target === 'winner take all' && !split.includes('winner')) return false;
      else if (target === 'free' && !split.includes('free')) return false;
    }
    if (filters.price !== 'All') {
      const amount = contest.entryPrice.amount;
      if (filters.price === '100-500' && (amount < 100 || amount > 500)) return false;
      if (filters.price === '500-1000' && (amount < 500 || amount > 1000)) return false;
      if (filters.price === '1000-2000' && (amount < 1000 || amount > 2000)) return false;
      if (filters.price === '+2000' && amount <= 2000) return false;
    }
    if (filters.time !== 'All') {
      const date = new Date(contest.startDate);
      const hour = date.getUTCHours();
      const targetHour = parseInt(filters.time.split(':')[0]);
      if (hour !== targetHour) return false;
    }
    if (filters.type !== 'All') {
      const champions = contest.lineupConfig.slots.filter(s => s.cardType === 'champion');
      const type = filters.type.toLowerCase();
      const contestName = contest.name.toLowerCase();

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
        if (!champions.every(s => s.minRarity === 'basic' && s.maxRarity === 'rare')) return false;
      } else if (type === 'one-of-each') {
        // Must have "one of each" in name
        if (!contestName.includes('one of each')) return false;
        // Must have exactly 4 champions
        if (champions.length !== 4) return false;
        // Must have exactly one of each rarity
        const has = (r: string) => champions.some(s => s.minRarity.toLowerCase() === r && s.maxRarity.toLowerCase() === r);
        const isOneOfEach = has('basic') && has('rare') && has('epic') && has('legendary');
        if (!isOneOfEach) return false;
      } else if (type === 'mix') {
        const championsConfigs = champions.map(s => `${s.minRarity}-${s.maxRarity}`);
        const uniqueConfigs = new Set(championsConfigs);
        if (uniqueConfigs.size < 2) return false;

        // Exclude One-Of-Each from Mix
        const has = (r: string) => champions.some(s => s.minRarity.toLowerCase() === r && s.maxRarity.toLowerCase() === r);
        const isOneOfEach = champions.length === 4 && has('basic') && has('rare') && has('epic') && has('legendary');
        if (isOneOfEach && contestName.includes('one of each')) return false;
      }
    }
    if (filters.mode !== 'All') {
      const contestName = contest.name.toLowerCase();
      const targetMode = filters.mode.toLowerCase();

      if (targetMode === 'no win bonus') {
        if (!contestName.includes('no win')) return false;
      } else if (targetMode === 'class coverage') {
        // Class Coverage matches both "Class Coverage" and "Class Diversity"
        if (!contestName.includes('class coverage') && !contestName.includes('class diversity')) return false;
      } else {
        if (!contestName.includes(targetMode)) return false;
      }
    }
    return true;
  });

  return (
    <>
      <div className={styles.container}>
        <div
          className={`${styles.drawerOverlay} ${mobileRankingOpen ? styles.drawerOverlayVisible : ''}`}
          onClick={() => setMobileRankingOpen(false)}
        />

        <div className={styles.mainLayout}>
          <div className={styles.mainContent}>
            <div className={styles.headerContainer}>
              <div className={styles.headerTopRow}>
                <div className={styles.titleGroup}>
                  <h1 className={styles.resultsTitle}>PREDICTIONS</h1>
                </div>

                <div className={styles.filterSection}>
                  <div className={styles.orderByContainer}>
                    <button className={styles.orderByButton} onClick={() => toggleFilter('distribution')}>
                      {filters.distribution === 'All' ? 'DISTRIBUTION' : filters.distribution}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openFilter === 'distribution' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                    {openFilter === 'distribution' && (
                      <ul className={styles.orderByMenu}>
                        {['All', '50/50', 'Top 20%', 'Top 10%', 'Winner Take All', 'Free', 'Sponsored'].map(opt => (
                          <li key={opt} onClick={() => handleFilterChange('distribution', opt)} className={filters.distribution === opt ? styles.activeSort : ''}>{opt}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className={styles.orderByContainer}>
                    <button className={styles.orderByButton} onClick={() => toggleFilter('price')}>
                      {filters.price === 'All' ? 'PRICE' : filters.price}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openFilter === 'price' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                    {openFilter === 'price' && (
                      <ul className={styles.orderByMenu}>
                        {['All', '100-500', '500-1000', '1000-2000', '+2000'].map(opt => (
                          <li key={opt} onClick={() => handleFilterChange('price', opt)} className={filters.price === opt ? styles.activeSort : ''}>{opt}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className={styles.orderByContainer}>
                    <button className={styles.orderByButton} onClick={() => toggleFilter('time')}>
                      {filters.time === 'All' ? 'TIME' : getSlotLabel(filters.time)}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openFilter === 'time' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                    {openFilter === 'time' && (
                      <ul className={styles.orderByMenu}>
                        {getSortedTimeOptions().map(opt => (
                          <li key={opt} onClick={() => handleFilterChange('time', opt)} className={filters.time === opt ? styles.activeSort : ''}>{getSlotLabel(opt)}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className={styles.orderByContainer}>
                    <button className={styles.orderByButton} onClick={() => toggleFilter('type')}>
                      {filters.type === 'All' ? 'TYPE' : filters.type}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openFilter === 'type' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                    {openFilter === 'type' && (
                      <ul className={`${styles.orderByMenu}`}>
                        {['All', 'Open', 'Only Epic', 'Only Rare', 'Only Basic', 'One-Of-Each', 'Up To Epic', 'Up To Rare', 'Mix'].map(opt => (
                          <li key={opt} onClick={() => handleFilterChange('type', opt)} className={filters.type === opt ? styles.activeSort : ''}>{opt}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className={styles.orderByContainer}>
                    <button className={styles.orderByButton} onClick={() => toggleFilter('mode')}>
                      {filters.mode === 'All' ? 'MODE' : filters.mode}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openFilter === 'mode' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                    {openFilter === 'mode' && (
                      <ul className={`${styles.orderByMenu} ${styles.rightMenu}`}>
                        {['All', 'No Win Bonus', 'No Scheme', 'Best Objective', 'Median Cap', 'Drop Worst Moki', 'Lowest Score', 'Class Coverage'].map(opt => (
                          <li key={opt} onClick={() => handleFilterChange('mode', opt)} className={filters.mode === opt ? styles.activeSort : ''}>{opt}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div style={{ flex: 1 }} />

                  <button className={`${styles.hideFullBtn} ${hideFull ? styles.active : ''}`} onClick={() => setHideFull(!hideFull)}>{hideFull ? 'SHOW ALL' : 'HIDE FULL'}</button>
                  <button className={`${styles.hideFullBtn} ${styles.utcBtn} ${useLocalTime ? styles.activeLocal : ''}`} onClick={() => setUseLocalTime(!useLocalTime)}>{useLocalTime ? 'LOCAL TIME' : 'UTC TIME'}</button>
                </div>
              </div>
            </div>

            <div className={styles.contestGrid}>
              {contestsLoading ? (
                <div className={styles.loadingInner}><div className={styles.loadingSpinner} /><p>Loading contests...</p></div>
              ) : contestsError ? (
                <div className={styles.errorInner}><p>{contestsError}</p></div>
              ) : filteredContests.length > 0 ? (
                filteredContests.map((contest) => (
                  <div key={contest.id} className={styles.contestCard} onClick={() => handleCardClick(contest)}>
                    <div className={styles.cardHeader}><h3 className={styles.contestName}>{contest.name}</h3></div>
                    <div className={styles.contestInfo}>
                      <div className={styles.infoItem}><span className={styles.infoIcon}>📅</span><span>Starts: {formatContestDate(contest.startDate)}</span></div>
                      <div className={styles.priceRow}>
                        <div className={styles.priceDisplay}>
                          {['gems', 'gem'].includes(contest.entryPrice.currency.toLowerCase()) && <img src="/icons/count.png" className={styles.currencyIcon} alt="Gems" />}
                          <span className={styles.amount}>{contest.entryPrice.amount}</span>
                          <span className={styles.currency}>{contest.entryPrice.currency}</span>
                        </div>
                        <div className={styles.slotsPreview}>{contest.lineupConfig.slots.map((slot, idx) => <div key={idx} className={styles.slotDot} style={getSlotStyle(slot)} title={`${slot.cardType} (${slot.minRarity}-${slot.maxRarity})`} />)}</div>
                      </div>
                    </div>
                    <div className={styles.cardFooter}>
                      <div className={styles.entriesCount}>{contest.entries} / {contest.maxEntries} Entries</div>
                      <div className={styles.entriesCount}>Max Per User: {contest.maxEntriesPerUser}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className={styles.noResults}>No active contests found.</p>
              )}
            </div>
          </div>

          <aside className={`${styles.sidebar} ${mobileRankingOpen ? styles.sidebarOpen : ''}`}>
            <button className={styles.drawerCloseButton} onClick={() => setMobileRankingOpen(false)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
            <div className={styles.rankingBox}>
              <div className={styles.rankingTitleRow}>
                <h2 className={styles.rankingTitle}>PREDICTION RANKING</h2>
                <button className={styles.expandRankingBtn} onClick={() => setIsExpandedRankingOpen(true)}>EXPAND</button>
              </div>
              {contestDate && (
                <p className={styles.rankingDateLabel}>FOR {formatContestDate(contestDate)} CONTEST</p>
              )}
              <p className={styles.rankingUpdateInfo}>Ranking is updated 1 hour after the contest end</p>
              <div className={styles.filterByRow}>
                <span className={styles.filterLabel}>Filter by:</span>
                <div className={styles.sortControls}>
                  <button className={`${styles.metaSchemesBtn} ${activeSort === 'SCORE' ? styles.activeMeta : ''}`} onClick={() => { setActiveSort('SCORE'); setSelectedMetaScheme(null); }}>SCORE</button>
                  <button className={`${styles.metaSchemesBtn} ${activeSort === 'WINRATE' ? styles.activeMeta : ''}`} onClick={() => { setActiveSort('WINRATE'); setSelectedMetaScheme(null); }}>WINRATE</button>
                  <button className={`${styles.metaSchemesBtn} ${activeSort === 'META' ? styles.activeMeta : ''}`} onClick={() => setIsSchemeMenuOpen(true)}>SCHEME</button>
                </div>
              </div>
              <div className={styles.rankingList}>
                {rankingLoading ? (
                  <div className={styles.rankingStatus}>Loading ranking...</div>
                ) : rankingError ? (
                  <div className={styles.rankingStatus} style={{ color: '#ff4b4b' }}>{rankingError}</div>
                ) : currentRanking.length > 0 ? (
                  currentRanking.map((moki, i) => {
                    const lookupKey = moki.Name.toString().trim().toUpperCase();
                    const mMeta = metadataByName[lookupKey];
                    const imageUrl = mMeta?.portraitUrl ?? '';
                    const globalRank = rankingPage * RANKING_PAGE_SIZE + i + 1;
                    return (
                      <div key={`${moki['Moki ID']}-${moki.Name}-${globalRank}`} className={styles.rankingPlaceholder}>
                        <span className={styles.rankNum}>#{globalRank}</span>
                        {imageUrl && <img src={imageUrl} alt={moki.Name} className={styles.rankMokiImage} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                        <div className={styles.rankInfo}><span className={styles.rankName}>{moki.Name}</span><span className={styles.rankClass}>{moki.Class}</span></div>
                        <span className={styles.rankScore}>{(moki as any)._displayScore}<small>{(moki as any)._metricLabel}</small></span>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.rankingStatus}>No results found.</div>
                )}
                {totalRankingPages > 1 && (
                  <div className={styles.rankingPagination}>
                    <button className={styles.rankingPageBtnText} onClick={() => setRankingPage(0)} disabled={rankingPage === 0}>FIRST</button>
                    <button className={styles.rankingPageBtn} onClick={() => setRankingPage(p => Math.max(0, p - 1))} disabled={rankingPage === 0}>‹</button>
                    <span className={styles.rankingPageLabel}>{rankingPage + 1} / {totalRankingPages}</span>
                    <button className={styles.rankingPageBtn} onClick={() => setRankingPage(p => Math.min(totalRankingPages - 1, p + 1))} disabled={rankingPage === totalRankingPages - 1}>›</button>
                    <button className={styles.rankingPageBtnText} onClick={() => setRankingPage(totalRankingPages - 1)} disabled={rankingPage === totalRankingPages - 1}>LAST</button>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <button className={styles.drawerToggleButton} onClick={() => setMobileRankingOpen(!mobileRankingOpen)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
        </div>

        {mounted && createPortal(
          <AnimatePresence>
            {selectedContest && !showResultsModal && (
              <motion.div className={styles.modalOverlay} onClick={() => setSelectedContest(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                  <button className={styles.modalCloseButton} onClick={() => setSelectedContest(null)} title="Close"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                  <div className={styles.modalHeader}><h2 className={styles.modalTitle}>Setup Predictions</h2></div>
                  <div className={styles.modalBody}>
                    <p className={styles.modalDesc}>Customize your predictions for <strong>{selectedContest.name}</strong>.</p>
                    <div className={styles.modalInfoBox}><p className={styles.modalInfoText}>The model automatically generates and ranks lineups using Meta Schemes and performance history.</p></div>
                    <div className={styles.modalRow}>
                      <span className={styles.rowLabel}>Setup with</span>
                      <div className={styles.toggleGroup}>
                        <button className={`${styles.toggleBtn} ${cardSource === 'ALL' ? styles.active : ''}`} onClick={() => { setCardSource('ALL'); setAllowRepeated(false); setUseOnlyMySchemes(false); }}>ALL CARDS</button>
                        <button className={`${styles.toggleBtn} ${cardSource === 'MY' ? styles.active : ''}`} onClick={() => setCardSource('MY')}>MY CARDS</button>
                      </div>
                    </div>

                    <div className={styles.modalRow} style={{ marginBottom: '4px' }}>
                      <span className={styles.rowLabel}>EXCLUDE CLASSES</span>
                      <button className={styles.filterBtnSmall} onClick={() => setIsExcludeClassesModalOpen(true)}>
                        {excludedClasses.length > 0 ? `${excludedClasses.length} SELECTED` : 'NONE'}
                      </button>
                    </div>
                    <div className={styles.modalRow} style={{ marginBottom: '8px' }}>
                      <span className={styles.rowLabel}>SELECT SCHEME</span>
                      <button className={styles.filterBtnSmall} onClick={() => setIsSchemeSelectModalOpen(true)}>
                        {selectedGenerateScheme}
                      </button>
                    </div>

                    <div className={styles.checkboxGroup}>
                      <div className={styles.checkboxWrapper} onClick={() => setAvoidMatchupConflicts(!avoidMatchupConflicts)}>
                        <div className={`${styles.customCheckbox} ${avoidMatchupConflicts ? styles.checked : ''}`}>
                          {avoidMatchupConflicts && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                        <span className={styles.checkboxLabel}>Avoid match up conflicts</span>
                      </div>
                      <div className={styles.checkboxWrapper} onClick={() => cardSource !== 'ALL' && setUseOnlyMySchemes(!useOnlyMySchemes)} style={{ opacity: cardSource === 'ALL' ? 0.5 : 1 }}>
                        <div className={`${styles.customCheckbox} ${useOnlyMySchemes ? styles.checked : ''}`}>
                          {useOnlyMySchemes && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
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
                    <div className={styles.modalActions}><button className={`${styles.confirmButton} ${isGenerating ? styles.generating : ''}`} onClick={handleGenerate} disabled={isGenerating}>{isGenerating ? 'Generating...' : 'Generate Lineups'}</button></div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {mounted && createPortal(
          <AnimatePresence>
            {isExcludeClassesModalOpen && (
              <div className={styles.modalOverlay} onClick={() => setIsExcludeClassesModalOpen(false)}>
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className={styles.schemeMenuContent} style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>EXCLUDE CLASSES</h2>
                    <button className={styles.modalCloseButton} onClick={() => setIsExcludeClassesModalOpen(false)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                  <p className={styles.modalDesc} style={{ marginBottom: '10px' }}>Select the classes you want to <strong>exclude</strong> from the generation.</p>
                  <div className={styles.classGrid}>
                    {['Anchor', 'Bruiser', 'Center', 'Defender', 'Flanker', 'Forward', 'Grinder', 'Sprinter', 'Striker', 'Support'].map((className) => {
                      const isSelected = excludedClasses.includes(className.toUpperCase());
                      return (
                        <div key={className} className={styles.checkboxWrapper} onClick={() => {
                          const upper = className.toUpperCase();
                          if (isSelected) {
                            setExcludedClasses(prev => prev.filter(c => c !== upper));
                          } else {
                            setExcludedClasses(prev => [...prev, upper]);
                          }
                        }}>
                          <div className={`${styles.customCheckbox} ${isSelected ? styles.checked : ''}`}>
                            {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                          </div>
                          <span className={styles.checkboxLabel}>{className}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className={styles.modalActions} style={{ marginTop: '20px' }}>
                    <button className={styles.confirmButton} onClick={() => setIsExcludeClassesModalOpen(false)}>DONE</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {mounted && createPortal(
          <AnimatePresence>
            {isSchemeSelectModalOpen && (
              <div className={styles.modalOverlay} onClick={() => setIsSchemeSelectModalOpen(false)}>
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className={styles.schemeMenuContent} style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>SELECT SCHEME</h2>
                    <button className={styles.modalCloseButton} onClick={() => setIsSchemeSelectModalOpen(false)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                  <p className={styles.modalDesc} style={{ marginBottom: '10px' }}>Select the main strategy for lineage generation.</p>
                  <div className={styles.classGrid} style={{ gridTemplateColumns: '1fr' }}>
                    {['ALL', 'TRAIT', 'COLLECTIVE SPECIALIZATION', 'TOUCHING THE WART', 'TAKING A DIVE'].map((schemeOpt) => {
                      const isSelected = selectedGenerateScheme === schemeOpt;
                      return (
                        <div key={schemeOpt} className={styles.checkboxWrapper} onClick={() => {
                          setSelectedGenerateScheme(schemeOpt);
                          setIsSchemeSelectModalOpen(false);
                        }}>
                          <div className={`${styles.customCheckbox} ${isSelected ? styles.checked : ''}`}>
                            {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                          </div>
                          <span className={styles.checkboxLabel} style={{ fontSize: '11px' }}>{schemeOpt}</span>
                        </div>
                      );
                    })}
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
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className={styles.schemeMenuContent} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.modalHeader}><h2 className={styles.modalTitle}>FILTER BY META SCHEME</h2><button className={styles.modalCloseButton} onClick={() => setIsSchemeMenuOpen(false)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div>
                  <div className={styles.schemeGrid}>
                    {META_SCHEMES.map((scheme) => (
                      <div
                        key={scheme.name}
                        className={`${styles.schemeCard} ${selectedMetaScheme === scheme.name ? styles.selectedScheme : ''}`}
                        onClick={() => {
                          if (selectedMetaScheme === scheme.name) {
                            setSelectedMetaScheme(null);
                            setActiveSort('SCORE');
                          } else {
                            setSelectedMetaScheme(scheme.name);
                            setActiveSort('META');
                          }
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

        {/* Results Modal */}
        {mounted && createPortal(
          <AnimatePresence>
            {showResultsModal && selectedContest && (
              <motion.div className={styles.modalOverlay} onClick={() => { setShowResultsModal(false); setSelectedContest(null); }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className={`${styles.modalContent} ${styles.resultsModal}`} onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}>
                  <button className={styles.modalCloseButton} onClick={() => { setShowResultsModal(false); setSelectedContest(null); }} title="Close">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                  <div className={styles.modalHeader}>
                    <button className={styles.backBtnPink} onClick={() => setShowResultsModal(false)}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                      </svg>
                      BACK
                    </button>
                    <h2 className={styles.modalTitle} style={{ marginTop: '12px' }}>Generated Lineups</h2>
                    <a
                      href={`https://grandarena.gg/contests/${selectedContest.id}/lineup`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.contestLinkBtn}
                    >
                      CONTEST
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                    </a>
                  </div>
                  <div className={styles.lineupsList}>
                    {generatedLineups.length > 0 ? (
                      generatedLineups.map((lineup, idx) => {
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
                              {lineup.mokis.map((moki) => {
                                const mokiEffective = moki.baseScore * getRarityMultiplier(moki.rarity);
                                return (
                                  <div key={`${lineup.id}-${moki.name}`} className={styles.mokiSlotCard}>
                                    <div
                                      className={styles.mokiCardImgWrapper}
                                      onClick={() => moki.cardImage && setZoomedImage(moki.cardImage)}
                                      style={{ cursor: moki.cardImage ? 'zoom-in' : 'default' }}
                                    >
                                      {moki.cardImage ? (
                                        <img src={moki.cardImage} alt={moki.name} className={styles.mokiCardImg} loading="lazy" />
                                      ) : (
                                        <div style={{ aspectRatio: '2/3', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>?</div>
                                      )}
                                    </div>
                                    <div className={styles.mokiCardScoreBadge}>
                                      <span className={styles.mokiCardScoreValue}>{Math.round(mokiEffective).toLocaleString()} PTS</span>
                                    </div>
                                  </div>
                                );
                              })}

                              <div className={`${styles.mokiSlotCard} ${styles.schemeSlotCard}`}>
                                <div
                                  className={`${styles.mokiCardImgWrapper} ${!lineup.hasScheme ? styles.nonOwnedSchemeCard : ''}`}
                                  onClick={() => schemeImage && setZoomedImage(schemeImage)}
                                  style={{ cursor: schemeImage ? 'zoom-in' : 'default' }}
                                >
                                  <img src={schemeImage} alt="Scheme" className={styles.mokiCardImg} />
                                </div>
                                <div className={styles.mokiCardScoreBadge}>
                                  <span className={styles.mokiCardScoreValue}>
                                    {Math.round(lineup.totalEffectiveScore - lineup.mokis.reduce((s, m) => s + (m.baseScore * getRarityMultiplier(m.rarity)), 0)).toLocaleString()} PTS
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className={styles.noLineupsMessage}>
                        <h3 className={styles.noLineupsTitle}>UNABLE TO GENERATE LINEUPS</h3>
                        <p className={styles.noLineupsDesc}>{"The model couldn't find a valid configuration with your current cards and filters."}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {/* IMAGE ZOOM LIGHTBOX */}
        {mounted && zoomedImage && createPortal(
          <div
            onClick={() => setZoomedImage(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.92)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              cursor: 'zoom-out',
              padding: '16px',
            }}
          >
            <img
              src={zoomedImage}
              alt="Card zoom"
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 0 60px rgba(0,0,0,0.8)',
                border: '3px solid #333',
              }}
            />
            <button
              onClick={() => setZoomedImage(null)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#ff66cc',
                border: '3px solid #333',
                color: 'white',
                fontSize: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >×</button>
          </div>,
          document.body
        )}

        {mounted && createPortal(
          <AnimatePresence>
            {isExpandedRankingOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={styles.expandedRankingOverlay}
                onClick={() => setIsExpandedRankingOpen(false)}
              >
                <motion.div
                  initial={{ y: 20, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 20, opacity: 0, scale: 0.95 }}
                  className={styles.expandedRankingModal}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className={styles.modalCloseButton} onClick={() => setIsExpandedRankingOpen(false)} style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 100 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                  <div className={styles.expandedHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                      <h2 className={styles.resultsTitle} style={{ margin: 0 }}>FULL RANKING DATA</h2>
                      <div className={styles.modalSearchWrapper}>
                        <input
                          type="text"
                          className={`${styles.searchInput} ${styles.desktopSearch}`}
                          placeholder="Search Champion..."
                          value={modalSearchQuery}
                          onChange={(e) => setModalSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className={`${styles.modalFilterDropdown} ${styles.pcOnlyDropdown}`} style={{ position: 'relative', width: 'fit-content', marginRight: '45px' }}>
                      <button
                        className={`${styles.metaSchemesBtn} ${modalFilters.strategicScheme !== 'ALL' ? styles.activeMeta : ''}`}
                        onClick={() => setOpenModalDropdown(openModalDropdown === 'strategicScheme' ? null : 'strategicScheme')}
                        style={{ margin: 0, height: '32px', display: 'flex', alignItems: 'center' }}
                      >
                        SCHEME
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '6px', transform: openModalDropdown === 'strategicScheme' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
                      {openModalDropdown === 'strategicScheme' && (
                        <ul className={styles.modalFilterMenu} style={{
                          position: 'absolute',
                          top: '100%',
                          right: '0',
                          left: 'auto',
                          marginTop: '8px',
                          zIndex: 1000,
                          width: 'max-content',
                          minWidth: '100%',
                          display: 'block'
                        }}>
                          {availStrategicSchemes.map(s => (
                            <li key={s} onClick={() => { setModalFilters(p => ({ ...p, strategicScheme: s })); setOpenModalDropdown(null); }}>{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className={styles.expandedTableWrapper}>
                    {/* PC VIEW: TABLE */}
                    <div className={styles.pcOnlyRanking}>
                      <table className={styles.expandedTable} style={{ opacity: modalSortedRanking !== deferredModalSortedRanking ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                        <thead>
                          <tr>
                            <th className={styles.modalHeaderLabel} style={{ cursor: 'default', width: '65px' }}>Rank</th>
                            <th className={styles.modalHeaderLabel} style={{ cursor: 'default', width: '150px' }}>Name</th>
                            <th className={styles.filterHeaderCell} style={{ width: '120px' }}>
                              <div className={styles.modalFilterDropdown}>
                                <button
                                  className={`${styles.modalFilterBtn} ${modalFilters.class !== 'ALL' ? styles.activeFilter : ''}`}
                                  onClick={() => setOpenModalDropdown(openModalDropdown === 'class' ? null : 'class')}
                                >
                                  CLASS
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px', transform: openModalDropdown === 'class' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                  </svg>
                                </button>
                                {openModalDropdown === 'class' && (
                                  <ul className={styles.modalFilterMenu}>
                                    {availClasses.map(c => (
                                      <li key={c} onClick={() => { setModalFilters(p => ({ ...p, class: c })); setOpenModalDropdown(null); }}>{c}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </th>
                            <th className={styles.filterHeaderCell} style={{ width: '100px' }}>
                              <button className={styles.modalFilterBtn} onClick={() => handleModalSort('Score')}>
                                Score
                              </button>
                            </th>
                            <th className={styles.filterHeaderCell} style={{ width: '80px' }}>
                              <button className={styles.modalFilterBtn} onClick={() => handleModalSort('WinRate')}>
                                W/R
                              </button>
                            </th>
                            <th className={styles.filterHeaderCell} style={{ width: '80px' }}>
                              <button className={styles.modalFilterBtn} onClick={() => handleModalSort('Losses')}>
                                Losses
                              </button>
                            </th>
                            <th className={styles.filterHeaderCell} style={{ width: '100px' }}>
                              <button className={styles.modalFilterBtn} onClick={() => handleModalSort('Deposits')}>
                                Balls
                              </button>
                            </th>
                            <th className={styles.filterHeaderCell} style={{ width: '100px' }}>
                              <button className={styles.modalFilterBtn} onClick={() => handleModalSort('Wart Distance')}>
                                Wart
                              </button>
                            </th>
                            <th className={styles.filterHeaderCell} style={{ width: '100px' }}>
                              <button className={styles.modalFilterBtn} onClick={() => handleModalSort('Kills')}>
                                Elims
                              </button>
                            </th>
                            <th className={styles.filterHeaderCell} style={{ width: '110px' }}>
                              <button className={styles.modalFilterBtn} onClick={() => handleModalSort('Wart Closer')}>
                                Wart Closer
                              </button>
                            </th>
                            <th className={styles.filterHeaderCell} style={{ width: '80px' }}>
                              <button className={styles.modalFilterBtn} onClick={() => handleModalSort('Deaths')}>
                                Deaths
                              </button>
                            </th>
                            <th className={styles.filterHeaderCell} style={{ width: '120px' }}>
                              <button className={styles.modalFilterBtn} onClick={() => handleModalSort('Win By Combat')}>
                                Win By Combat
                              </button>
                            </th>
                            <th className={styles.filterHeaderCell} style={{ width: '100px' }}>
                              <div className={styles.modalFilterDropdown}>
                                <button
                                  className={`${styles.modalFilterBtn} ${modalFilters.fur !== 'ALL' ? styles.activeFilter : ''}`}
                                  onClick={() => setOpenModalDropdown(openModalDropdown === 'fur' ? null : 'fur')}
                                >
                                  FUR
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px', transform: openModalDropdown === 'fur' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                  </svg>
                                </button>
                                {openModalDropdown === 'fur' && (
                                  <ul className={styles.modalFilterMenu}>
                                    {availFurs.map(f => (
                                      <li key={f} onClick={() => { setModalFilters(p => ({ ...p, fur: f })); setOpenModalDropdown(null); }}>{f}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </th>
                            <th className={styles.filterHeaderCell} style={{ width: '250px' }}>
                              <div className={styles.modalFilterDropdown}>
                                <button
                                  className={`${styles.modalFilterBtn} ${modalFilters.trait !== 'ALL' ? styles.activeFilter : ''}`}
                                  onClick={() => setOpenModalDropdown(openModalDropdown === 'trait' ? null : 'trait')}
                                >
                                  TRAITS (SCHEME)
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px', transform: openModalDropdown === 'trait' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                  </svg>
                                </button>
                                {openModalDropdown === 'trait' && (
                                  <ul className={`${styles.modalFilterMenu} ${styles.rightMenu}`}>
                                    {availTraits.map(t => (
                                      <li key={t} onClick={() => { setModalFilters(p => ({ ...p, trait: t })); setOpenModalDropdown(null); }}>{t}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pcRows.length > 0 ? pcRows : (
                            <tr>
                              <td colSpan={14} className={`${styles.noResultsMessage} ${styles.pcNoResults}`}>
                                No Champions found matching these filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* MOBILE VIEW: CARDS */}
                    <div className={styles.mobileOnlyRanking}>
                      {/* Mobile Controls */}
                      <div className={styles.mobileModalControls}>
                        {/* SEARCH ROW */}
                        <div className={styles.mobileFilterRow}>
                          <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Search Champion..."
                            value={modalSearchQuery}
                            onChange={(e) => setModalSearchQuery(e.target.value)}
                          />
                        </div>
                        {/* ROW 1: SORT BY & SCHEMES */}
                        <div className={styles.mobileFilterRow}>
                          <div className={styles.mobileFilterDropdownWrapper}>
                            <button
                              className={`${styles.mobileCustomSelectBtn} ${modalSortKey !== 'Score' ? styles.activeFilter : ''}`}
                              onClick={() => setOpenModalDropdown(openModalDropdown === 'mobileSort' ? null : 'mobileSort')}
                            >
                              SORT BY
                              <ChevronDown size={14} style={{ marginLeft: '4px' }} />
                            </button>
                            {openModalDropdown === 'mobileSort' && (
                              <ul className={styles.modalFilterMenu} style={{ top: '100%', left: 0, width: '100%', position: 'absolute', zIndex: 10000 }}>
                                <li onClick={() => { handleModalSort('Score'); setOpenModalDropdown(null); }}>DEFAULT</li>
                                <li onClick={() => { handleModalSort('WinRate'); setOpenModalDropdown(null); }}>W/R</li>
                                <li onClick={() => { handleModalSort('Losses'); setOpenModalDropdown(null); }}>LOSSES</li>
                                <li onClick={() => { handleModalSort('Deposits'); setOpenModalDropdown(null); }}>BALLS</li>
                                <li onClick={() => { handleModalSort('Wart Distance'); setOpenModalDropdown(null); }}>WART</li>
                                <li onClick={() => { handleModalSort('Kills'); setOpenModalDropdown(null); }}>ELIMS</li>
                                <li onClick={() => { handleModalSort('Deaths'); setOpenModalDropdown(null); }}>DEATHS</li>
                              </ul>
                            )}
                          </div>

                          <div className={styles.mobileFilterDropdownWrapper}>
                            <button
                              className={`${styles.mobileCustomSelectBtn} ${(modalFilters.strategicScheme !== 'ALL' || modalFilters.trait !== 'ALL') ? styles.activeFilter : ''}`}
                              onClick={() => setOpenModalDropdown(openModalDropdown === 'mobileScheme' ? null : 'mobileScheme')}
                            >
                              SCHEMES
                              <ChevronDown size={14} style={{ marginLeft: '4px' }} />
                            </button>
                            {openModalDropdown === 'mobileScheme' && (
                              <ul className={styles.modalFilterMenu} style={{ top: '100%', right: 0, left: 'auto', width: '100%', position: 'absolute', zIndex: 10000 }}>
                                <li onClick={() => { setModalFilters(p => ({ ...p, strategicScheme: 'ALL', trait: 'ALL' })); setOpenModalDropdown(null); }}>ALL SCHEMES</li>
                                {[...availTraits.filter(t => t !== 'ALL'), ...availStrategicSchemes.filter(s => s !== 'ALL')].map(s => (
                                  <li key={s} onClick={() => {
                                    if (availStrategicSchemes.includes(s)) {
                                      setModalFilters(p => ({ ...p, strategicScheme: s, trait: 'ALL' }));
                                    } else {
                                      setModalFilters(p => ({ ...p, trait: s, strategicScheme: 'ALL' }));
                                    }
                                    setOpenModalDropdown(null);
                                  }}>
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        {/* ROW 2: CLASSES & FURS */}
                        <div className={styles.mobileFilterRow}>
                          <div className={styles.mobileFilterDropdownWrapper}>
                            <button
                              className={`${styles.mobileCustomSelectBtn} ${modalFilters.class !== 'ALL' ? styles.activeFilter : ''}`}
                              onClick={() => setOpenModalDropdown(openModalDropdown === 'mobileClass' ? null : 'mobileClass')}
                            >
                              CLASSES
                              <ChevronDown size={14} style={{ marginLeft: '4px' }} />
                            </button>
                            {openModalDropdown === 'mobileClass' && (
                              <ul className={styles.modalFilterMenu} style={{ top: '100%', left: 0, width: '100%', position: 'absolute', zIndex: 10000 }}>
                                <li onClick={() => { setModalFilters(p => ({ ...p, class: 'ALL' })); setOpenModalDropdown(null); }}>ALL CLASSES</li>
                                {availClasses.filter(c => c !== 'ALL').map(c => (
                                  <li key={c} onClick={() => { setModalFilters(p => ({ ...p, class: c })); setOpenModalDropdown(null); }}>{c}</li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className={styles.mobileFilterDropdownWrapper}>
                            <button
                              className={`${styles.mobileCustomSelectBtn} ${modalFilters.fur !== 'ALL' ? styles.activeFilter : ''}`}
                              onClick={() => setOpenModalDropdown(openModalDropdown === 'mobileFur' ? null : 'mobileFur')}
                            >
                              FURS
                              <ChevronDown size={14} style={{ marginLeft: '4px' }} />
                            </button>
                            {openModalDropdown === 'mobileFur' && (
                              <ul className={styles.modalFilterMenu} style={{ top: '100%', right: 0, left: 'auto', width: '100%', position: 'absolute', zIndex: 10000 }}>
                                <li onClick={() => { setModalFilters(p => ({ ...p, fur: 'ALL' })); setOpenModalDropdown(null); }}>ALL FURS</li>
                                {availFurs.filter(f => f !== 'ALL').map(f => (
                                  <li key={f} onClick={() => { setModalFilters(p => ({ ...p, fur: f })); setOpenModalDropdown(null); }}>{f}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ opacity: modalSortedRanking !== deferredModalSortedRanking ? 0.6 : 1, transition: 'opacity 0.2s', display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                        {mobileCards.length > 0 ? mobileCards : (
                          <div className={styles.noResultsMessage}>
                            No Champions found matching these filters.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>
    </>
  );
}
