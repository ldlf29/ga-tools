 
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './Champions.module.css';
import { EnhancedCard, FilterState } from '@/types';
import { matchesFilter } from '@/utils/filterUtils';
import mokiMetadata from '@/data/mokiMetadata.json';
import { getSpecializationCoefficient, getStatValueByLimit } from '@/utils/specializationUtils';
import { getActiveFiltersDisplay } from '@/utils/filterDisplay';
import { isSchemeTrait } from '@/data/traitMapping';


// ─── Cache ────────────────────────────────────────────────────────────────────
let cachedMatchesData: UpcomingMatchData[] = [];

// ─── Types ─────────────────────────────────────────────────────────────────────
interface UpcomingMatchData {
  id: string;
  contest_id: string;
  match_date: string;
  team_red: any[];
  team_blue: any[];
  created_at: string;
}

interface ChampionsProps {
  allCards: EnhancedCard[];
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

type ModalTab = 'stats' | 'history' | 'upcoming';

// ─── Component ─────────────────────────────────────────────────────────────────
export default function Champions({
  allCards,
  filters,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: ChampionsProps) {
  // Upcoming matches data
  const [matches, setMatches] = useState<UpcomingMatchData[]>([]);
  const [mokiStats, setMokiStats] = useState<any[]>([]);
  const [mokiAverages, setMokiAverages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [selectedChampion, setSelectedChampion] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('stats');

  // Match History state
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLimit, setHistoryLimit] = useState<10 | 20>(10);
  const [selectedMatchDetails, setSelectedMatchDetails] = useState<any | null>(null);



  // Filters state
  // Filters state managed via props
  const [sortOption, setSortOption] = useState<string>('default');
  const [sortDropdownOpen, setSortDropdownOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // ─── Filter Interaction Logic ──────────────────────────────────────────────
  // Reset local sortOption when sidebar-driven sorts (specialization/extraSort) are activated
  useEffect(() => {
    const hasSpecialization = filters.specialization && filters.specialization.length > 0;
    const hasExtraSort = !!filters.extraSort;

    if (hasSpecialization || hasExtraSort) {
      setSortOption('default');
    }
  }, [filters.specialization, filters.extraSort]);

  const handleSortSelection = (option: string) => {
    setSortOption(option);
    setSortDropdownOpen(false);

    // If selecting a manual sort, clear specialization and extraSort from global state
    if (option !== 'default') {
      const newFilters = { ...filters, specialization: [], extraSort: undefined };
      // Also clean up insertionOrder
      if (newFilters.insertionOrder) {
        newFilters.insertionOrder = newFilters.insertionOrder.filter(
          (k) => !k.startsWith('specialization:') && !k.startsWith('extraSort:')
        );
      }
      onFilterChange(newFilters);
    }
  };

  // ─── Load matches & stats ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      
      // Load moki_stats for real-time class verification
      const { data: statsData } = await supabase
        .from('moki_stats')
        .select('moki_id, name, class, eliminations, deposits, wart_distance, score, win_rate');
      if (statsData) setMokiStats(statsData);

      // Load averages (10/20 matches)
      const { data: avgData } = await supabase.rpc('get_moki_match_averages');
      if (avgData) setMokiAverages(avgData);

      if (cachedMatchesData.length > 0) {
        setMatches(cachedMatchesData);
        setIsLoading(false);
        return;
      }
      
      let allData: any[] = [];
      let from = 0;
      let to = 999;
      let hasMore = true;

      while (hasMore && allData.length < 3000) {
        const { data, error, count } = await supabase
          .from('upcoming_matches_ga')
          .select('*', { count: 'exact' })
          .order('match_date', { ascending: true })
          .range(from, to);

        if (error || !data) {
          console.error("[Supabase Pagination] Error:", error);
          hasMore = false;
          break;
        }

        allData = [...allData, ...data];

        if (data.length < 1000 || allData.length >= (count || 0)) {
          hasMore = false;
        } else {
          from += 1000;
          to += 1000;
        }
      }

      if (allData.length > 0) {
        setMatches(allData);
        cachedMatchesData = allData;
      }
      setIsLoading(false);
    }
    loadInitialData();
  }, []);

  // ─── Load match history when champion is selected ─────────────────────────
  useEffect(() => {
    if (!selectedChampion || activeTab !== 'history') return;
    const tokenId = selectedChampion.tokenId ?? selectedChampion.token_id ?? null;
    if (tokenId === null) return;

    const fetchHistory = async () => {
      setHistoryLoading(true);
      const { data, error } = await supabase
        .from('moki_match_history')
        .select('*')
        .eq('moki_id', tokenId)
        .order('match_id', { ascending: false })
        .limit(historyLimit);
      if (!error && data) setMatchHistory(data);
      setHistoryLoading(false);
    };
    fetchHistory();
  }, [selectedChampion, activeTab, historyLimit]);



  // Prevent background scroll when modal is open
  useEffect(() => {
    if (showModal) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflowY = 'scroll'; // Prevent layout shift
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflowY = '';
      window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
    }
    
    // Fallback for some browsers / Next.js configs
    if (showModal) {
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
    }
    
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflowY = '';
      document.documentElement.style.overflow = '';
    };
  }, [showModal]);

  // ─── Filters Helpers ──────────────────────────────────────────────────────
  const handleFilterChange = (newFilters: FilterState) => onFilterChange(newFilters);

  const handleRemoveFilter = (key: keyof FilterState, value: string | number) => {
    const currentValues = filters[key];
    let newValues = currentValues;
    if (key === 'stars') newValues = [];
    else if (key === 'matchLimit') newValues = 'ALL';
    else if (Array.isArray(currentValues)) newValues = (currentValues as any[]).filter((v) => v !== value);
    let newOrder = filters.insertionOrder ? [...filters.insertionOrder] : [];
    const orderKey = `${String(key)}:${value}`;
    newOrder = newOrder.filter((k) => k !== orderKey);

    onFilterChange({ ...filters, [key]: newValues, insertionOrder: newOrder });
  };

  const activeFilters = getActiveFiltersDisplay(filters);

  const hasSidebarFilters =
    filters.fur!.length > 0 ||
    filters.traits!.length > 0 ||
    filters.specialization!.length > 0 ||
    filters.customClass!.length > 0 ||
    (filters.stars && filters.stars.length > 0);

  // ─── Unique Champions aggregation ─────────────────────────────────────────
  const uniqueChampions = useMemo(() => {
    const map = new Map();
    matches.forEach((match) => {
      const redChamp = match.team_red[0];
      const blueChamp = match.team_blue[0];
      if (redChamp && !map.has(redChamp.name)) map.set(redChamp.name, redChamp);
      if (blueChamp && !map.has(blueChamp.name)) map.set(blueChamp.name, blueChamp);
    });

    const list = Array.from(map.values()).map((champ) => {
      // Robust Name Matching (Insensitive to underscores/spaces)
      const normalizeName = (name: string) => name?.trim().toUpperCase().replace(/_/g, ' ');
      const normalizedName = normalizeName(champ.name);

      // Find Catalog Card (Optional fallback for base stats)
      const fullCard = allCards.find((c) => normalizeName(c.name) === normalizedName);
      
      let metadata = (mokiMetadata as any)[normalizedName];
      if (!metadata && normalizedName.includes(' ')) {
        const withUnderscores = normalizedName.replace(/ /g, '_');
        metadata = (mokiMetadata as any)[withUnderscores];
      }

      // Real-time class and performances from Supabase (Primary Source)
      const dbStat = mokiStats.find(s => 
        s.moki_id === (metadata?.id ? parseInt(metadata.id, 10) : null) || 
        normalizeName(s.name) === normalizedName
      );
      
      const dbAvg = mokiAverages.find(a => 
        a.moki_id === (metadata?.id ? parseInt(metadata.id, 10) : null) || 
        normalizeName(a.moki_name) === normalizedName
      );

      const currentClass = dbStat?.class || fullCard?.custom?.class || champ.class;

      // Create a localized card with Supabase overrides for real-time accuracy
      let mergedCard = fullCard || { id: metadata?.id || champ.id, name: champ.name, custom: {} } as any;
      if (!mergedCard.custom) mergedCard.custom = {};
      
      const mappedCustom = { ...mergedCard.custom };

      // Global Stats Override
      if (dbStat) {
        mappedCustom.eliminations = dbStat.eliminations ?? mappedCustom.eliminations;
        mappedCustom.deposits = dbStat.deposits ?? mappedCustom.deposits;
        mappedCustom.wartDistance = dbStat.wart_distance ?? mappedCustom.wartDistance;
        mappedCustom.score = dbStat.score ?? mappedCustom.score;
        mappedCustom.winRate = dbStat.win_rate ?? mappedCustom.winRate;
      }

      // Averages Overrides (L10/L20)
      if (dbAvg) {
        // L10
        mappedCustom.avgWinRate10 = dbAvg.avg_win_rate_10 ?? mappedCustom.avgWinRate10;
        mappedCustom.avgScore10 = dbAvg.avg_score_10 ?? mappedCustom.avgScore10;
        mappedCustom.avgEliminations10 = dbAvg.avg_eliminations_10 ?? mappedCustom.avgEliminations10;
        mappedCustom.avgDeposits10 = dbAvg.avg_deposits_10 ?? mappedCustom.avgDeposits10;
        mappedCustom.avgWartDistance10 = dbAvg.avg_wart_distance_10 ?? mappedCustom.avgWartDistance10;
        mappedCustom.avgDeaths10 = dbAvg.avg_deaths_10 ?? mappedCustom.avgDeaths10;
        mappedCustom.avgBuffTime10 = dbAvg.avg_buff_time_10 ?? mappedCustom.avgBuffTime10;
        mappedCustom.avgWartTime10 = dbAvg.avg_wart_time_10 ?? mappedCustom.avgWartTime10;
        mappedCustom.avgLooseBallPickups10 = dbAvg.avg_loose_ball_pickups_10 ?? mappedCustom.avgLooseBallPickups10;
        mappedCustom.avgEatenByWart10 = dbAvg.avg_eaten_by_wart_10 ?? mappedCustom.avgEatenByWart10;
        mappedCustom.avgWartCloser10 = dbAvg.avg_wart_closer_10 ?? mappedCustom.avgWartCloser10;

        // L20
        mappedCustom.avgWinRate20 = dbAvg.avg_win_rate_20 ?? mappedCustom.avgWinRate20;
        mappedCustom.avgScore20 = dbAvg.avg_score_20 ?? mappedCustom.avgScore20;
        mappedCustom.avgEliminations20 = dbAvg.avg_eliminations_20 ?? mappedCustom.avgEliminations20;
        mappedCustom.avgDeposits20 = dbAvg.avg_deposits_20 ?? mappedCustom.avgDeposits20;
        mappedCustom.avgWartDistance20 = dbAvg.avg_wart_distance_20 ?? mappedCustom.avgWartDistance20;
        mappedCustom.avgDeaths20 = dbAvg.avg_deaths_20 ?? mappedCustom.avgDeaths20;
        mappedCustom.avgBuffTime20 = dbAvg.avg_buff_time_20 ?? mappedCustom.avgBuffTime20;
        mappedCustom.avgWartTime20 = dbAvg.avg_wart_time_20 ?? mappedCustom.avgWartTime20;
        mappedCustom.avgLooseBallPickups20 = dbAvg.avg_loose_ball_pickups_20 ?? mappedCustom.avgLooseBallPickups20;
        mappedCustom.avgEatenByWart20 = dbAvg.avg_eaten_by_wart_20 ?? mappedCustom.avgEatenByWart20;
        mappedCustom.avgWartCloser20 = dbAvg.avg_wart_closer_20 ?? mappedCustom.avgWartCloser20;
      }

      mergedCard = { ...mergedCard, custom: mappedCustom };

      return {
        ...champ,
        id: metadata?.id ?? mergedCard?.id ?? champ.id,
        tokenId: metadata?.id ? parseInt(metadata.id, 10) : null,
        class: currentClass,
        score: mergedCard ? getStatValueByLimit(mergedCard, 'score', filters.matchLimit) : 0,
        globalScore: mergedCard ? getStatValueByLimit(mergedCard, 'score', 'ALL') : 0,
        imageUrl: metadata?.portraitUrl || mergedCard?.custom?.imageUrl || champ.imageUrl,
        marketLink: metadata?.marketLink || null,
        fur: mergedCard?.custom?.fur || metadata?.fur || null,
        fullCard: mergedCard,
      };
    });

    // Create a stable rank map based on default GLOBAL score sorting
    const defaultSorted = [...list].sort((a, b) => (b.globalScore || 0) - (a.globalScore || 0));
    const rankMap = new Map();
    defaultSorted.forEach((c, i) => rankMap.set(c.name, i + 1));

    // Secondary sort: if scores are equal, sort by name to avoid "random" look
    const sortedList = [...list].sort((a, b) => {
      if (filters.extraSort) {
        const valA = getStatValueByLimit(a.fullCard, filters.extraSort, filters.matchLimit);
        const valB = getStatValueByLimit(b.fullCard, filters.extraSort, filters.matchLimit);
        if (valB !== valA) return valB - valA;
      }
      
      const scoreA = a.score || 0;
      const scoreB = b.score || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.name.localeCompare(b.name);
    }).map(champ => ({
      ...champ,
      rank: rankMap.get(champ.name)
    }));

    return sortedList;
  }, [matches, allCards, filters.extraSort, filters.matchLimit, mokiStats, mokiAverages]);

  // ─── Filtered champions ───────────────────────────────────────────────────
  const filteredChampions = useMemo(() => {
    const filtered = uniqueChampions.filter((champ) => {
      if (searchQuery.trim()) {
        if (!champ.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      // Use the newly constructed fullCard from uniqueChampions for filtering
      if (champ.fullCard) {
        if (!matchesFilter(champ.fullCard, filters)) return false;
      }
      return true;
    });

    const getStatValue = (champ: any, option: string) => {
      const custom = champ.fullCard?.custom;
      if (!custom) return 0;
      switch (option) {
        case 'str': return custom.strength || 0;
        case 'spd': return custom.speed || 0;
        case 'def': return custom.defense || 0;
        case 'dex': return custom.dexterity || 0;
        case 'for': return custom.fortitude || 0;
        case 'total': return custom.totalStats || 0;
        case 'train': return custom.train || 0;
        case 'win_rate':
          if (filters.matchLimit && filters.matchLimit !== 'ALL') {
            return getStatValueByLimit(champ.fullCard, 'winRate', filters.matchLimit);
          }
          return custom.winRate || 0;
        case 'name': return champ.name;
        default: return 0;
      }
    };

    const sorted = [...filtered];

    // Determine priority between specialization and extraSort based on insertionOrder
    const sortKeys = filters.insertionOrder?.filter(k => 
      k.startsWith('specialization:') || k.startsWith('extraSort:')
    ) || [];
    const lastSortKey = sortKeys[sortKeys.length - 1];

    // Priority 1: The last selected sidebar sort (Specialization or Extra)
    if (lastSortKey?.startsWith('specialization:') && filters.specialization && filters.specialization.length > 0) {
      sorted.sort((a, b) => {
        const fullA = a.fullCard;
        const fullB = b.fullCard;
        if (!fullA || !fullB) return (b.score || 0) - (a.score || 0);

        const activeSpecs = filters.specialization!;
        const perfSpecs = ['Gacha', 'Killer', 'Wart Rider'];
        const contextSpecs = ['Winner', 'Loser', 'Bad Streak', 'Good Streak'];
        const scoreSpecs = ['Score'];

        const activePerf = activeSpecs.find((s) => perfSpecs.includes(s));
        const activeContext = activeSpecs.find((s) => contextSpecs.includes(s));
        const activeScore = activeSpecs.find((s) => scoreSpecs.includes(s));
        const activeCategories = [activePerf, activeContext, activeScore].filter(Boolean);

        if (activeCategories.length > 1) {
          const calcCoeff = (c: any) => {
            let coeff = 1;
            activeCategories.forEach((spec) => {
              if (spec) coeff *= getSpecializationCoefficient(c, spec, filters.matchLimit);
            });
            return coeff;
          };
          const coeffA = calcCoeff(fullA);
          const coeffB = calcCoeff(fullB);
          const isLoserActive = activeSpecs.includes('Loser');
          if (coeffB !== coeffA) return isLoserActive ? coeffA - coeffB : coeffB - coeffA;
        }

        for (const spec of activeSpecs) {
          const valA = getSpecializationCoefficient(fullA, spec, filters.matchLimit);
          const valB = getSpecializationCoefficient(fullB, spec, filters.matchLimit);
          const diff = spec === 'Loser' ? valA - valB : valB - valA;
          if (diff !== 0) return diff;
        }
        return b.score - a.score;
      });
    }
    else if (lastSortKey?.startsWith('extraSort:') && filters.extraSort && (filters.matchLimit === 10 || filters.matchLimit === 20)) {
      sorted.sort((a, b) => {
        const valA = getStatValueByLimit(a.fullCard, filters.extraSort as string, filters.matchLimit as any);
        const valB = getStatValueByLimit(b.fullCard, filters.extraSort as string, filters.matchLimit as any);
        if (valB !== valA) return valB - valA;
        return a.name.localeCompare(b.name);
      });
    }
    // Priority 2: Manual dropdown sorting (name, total, spd, etc.) - Only if no sidebar sort is active or if it was cleared
    else if (sortOption !== 'default') {
      sorted.sort((a, b) => {
        if (sortOption === 'name') return a.name.localeCompare(b.name);
        return getStatValue(b, sortOption) - getStatValue(a, sortOption);
      });
    }
    // Fallbacks if insertionOrder is missing but filters are present
    else if (filters.extraSort && (filters.matchLimit === 10 || filters.matchLimit === 20)) {
      sorted.sort((a, b) => {
        const valA = getStatValueByLimit(a.fullCard, filters.extraSort as string, filters.matchLimit as any);
        const valB = getStatValueByLimit(b.fullCard, filters.extraSort as string, filters.matchLimit as any);
        if (valB !== valA) return valB - valA;
        return a.name.localeCompare(b.name);
      });
    }
    else if (filters.specialization && filters.specialization.length > 0) {
      sorted.sort((a, b) => {
        const fullA = a.fullCard;
        const fullB = b.fullCard;
        if (!fullA || !fullB) return (b.score || 0) - (a.score || 0);

        const activeSpecs = filters.specialization!;
        const perfSpecs = ['Gacha', 'Killer', 'Wart Rider'];
        const contextSpecs = ['Winner', 'Loser', 'Bad Streak', 'Good Streak'];
        const scoreSpecs = ['Score'];

        const activePerf = activeSpecs.find((s) => perfSpecs.includes(s));
        const activeContext = activeSpecs.find((s) => contextSpecs.includes(s));
        const activeScore = activeSpecs.find((s) => scoreSpecs.includes(s));
        const activeCategories = [activePerf, activeContext, activeScore].filter(Boolean);

        if (activeCategories.length > 1) {
          const calcCoeff = (c: any) => {
            let coeff = 1;
            activeCategories.forEach((spec) => {
              if (spec) coeff *= getSpecializationCoefficient(c, spec, filters.matchLimit);
            });
            return coeff;
          };
          const coeffA = calcCoeff(fullA);
          const coeffB = calcCoeff(fullB);
          const isLoserActive = activeSpecs.includes('Loser');
          if (coeffB !== coeffA) return isLoserActive ? coeffA - coeffB : coeffB - coeffA;
        }

        for (const spec of activeSpecs) {
          const valA = getSpecializationCoefficient(fullA, spec, filters.matchLimit);
          const valB = getSpecializationCoefficient(fullB, spec, filters.matchLimit);
          const diff = spec === 'Loser' ? valA - valB : valB - valA;
          if (diff !== 0) return diff;
        }
        return b.score - a.score;
      });
    } else {
      sorted.sort((a, b) => {
        const scoreB = b.score || 0;
        const scoreA = a.score || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.name.localeCompare(b.name);
      });
    }

    return sorted;
  }, [uniqueChampions, searchQuery, filters, hasSidebarFilters, allCards, sortOption]);

  // ─── Upcoming matches for selected champion ───────────────────────────────
  const championUpcomingMatches = useMemo(() => {
    if (!selectedChampion) return [];
    const targetName = selectedChampion.name.trim().toUpperCase();
    
    const found = matches.filter((match) => {
      return (match.team_red.some((m: any) => m?.name?.trim().toUpperCase() === targetName) ||
              match.team_blue.some((m: any) => m?.name?.trim().toUpperCase() === targetName));
    });
    
    return found.slice(0, 10).reverse();
  }, [selectedChampion, matches]);

  const formattedDate = useMemo(() => {
    const firstMatch = championUpcomingMatches[0];
    if (!firstMatch) return '';
    const d = new Date(firstMatch.match_date);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} - ${hours}:${minutes} UTC`;
  }, [championUpcomingMatches]);

  // ─── Modal open handler ───────────────────────────────────────────────────
  const handleChampionClick = (champ: any) => {
    setSelectedChampion(champ);
    setShowModal(true);
    setActiveTab('stats');
    setMatchHistory([]);

    setSelectedMatchDetails(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedChampion(null);
  };

  // ─── ESC Key close handler ───────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedMatchDetails) {
          setSelectedMatchDetails(null);
        } else if (showModal) {
          handleCloseModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMatchDetails, showModal]);

  // ─── History helpers ──────────────────────────────────────────────────────
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString.replace(/-/g, '/'));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ─── Stats display helpers ────────────────────────────────────────────────
  const getStat = (card: EnhancedCard | null | undefined, field: string) => {
    if (!card) return '—';
    const val = (card as any)[field] ?? (card.custom as any)?.[field];
    if (val === undefined || val === null) return '—';
    return typeof val === 'number' ? val.toFixed(2) : val;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.championsContainer}>
      <div className={styles.championsView}>
        <div className={styles.topControls}>
          <div className={styles.headerTopRow}>
            <h1 className={styles.pageTitle}>CHAMPIONS</h1>
            <div className={styles.headerRight}>
              <div className={styles.orderByContainer}>
                <button
                  className={styles.orderByButton}
                  onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                >
                  {filters.specialization && filters.specialization.length > 0
                    ? `BY ${filters.specialization[0].toUpperCase()}`
                    : filters.extraSort
                      ? `BY ${filters.extraSort === 'eatingWhileRiding' ? 'WART EAT' : filters.extraSort === 'looseBallPickups' ? 'PICKUPS' : filters.extraSort.toUpperCase()}`
                      : sortOption === 'default'
                        ? 'SORT BY...'
                        : `BY ${sortOption === 'win_rate' ? 'WIN RATE' : sortOption.toUpperCase()}`}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: sortDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                      marginLeft: '0.2rem'
                    }}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {sortDropdownOpen && (
                  <ul className={styles.orderByMenu}>
                    {[
                      { label: 'Default', value: 'default' },
                      { label: 'STR', value: 'str' },
                      { label: 'SPD', value: 'spd' },
                      { label: 'DEF', value: 'def' },
                      { label: 'DEX', value: 'dex' },
                      { label: 'FOR', value: 'for' },
                      { label: 'Total', value: 'total' },
                      { label: 'Train', value: 'train' },
                      { label: 'Win Rate', value: 'win_rate' },
                      { label: 'Name', value: 'name' },
                    ].map((item) => (
                      <li
                        key={item.value}
                        onClick={() => handleSortSelection(item.value)}
                        className={sortOption === item.value ? styles.activeSort : ''}
                      >
                        {item.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search Champion..."
                className={`${styles.searchInput} ${styles.desktopSearch}`}
              />

              <div className={styles.viewToggle}>
                <button
                  className={`${styles.toggleIcon} ${viewMode === 'grid' ? styles.toggleActive : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Gallery View"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                </button>
                <button
                  className={`${styles.toggleIcon} ${viewMode === 'list' ? styles.toggleActive : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List View"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className={styles.searchRow}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search Champion..."
              className={styles.searchInput}
            />
          </div>

          {activeFilters.length > 0 && (
            <div className={styles.activeFilters}>
              {activeFilters.map((f, i) => (
                <div key={`${f.key}-${f.value}-${i}`} className={styles.filterChip}>
                  <span className={styles.filterLabel}>{f.label}: </span>
                  <span className={styles.filterValue}>{f.displayValue || f.value}</span>
                  <button onClick={() => handleRemoveFilter(f.key, f.value)} className={styles.removeFilterButton}>
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

        {isLoading ? (
          <div className={styles.loading}>Loading Champions...</div>
        ) : filteredChampions.length === 0 ? (
          <div className={styles.empty}>No Champions found matching these filters.</div>
        ) : viewMode === 'grid' ? (
          <div className={styles.championsGrid}>
            {filteredChampions.map((champ) => {
              const globalRank = champ.rank;
              return (
                <button key={champ.name} className={styles.championButton} onClick={() => handleChampionClick(champ)}>
                  <div className={styles.imgBadgeWrapper}>
                    <img src={champ.imageUrl} alt={champ.name} className={styles.champImg} loading="lazy" />
                    <span className={styles.champRank}>#{globalRank}</span>
                  </div>
                  <div className={styles.champInfo}>
                    <span className={styles.champName}>{champ.name}</span>
                    <span className={styles.champClass}>{champ.class}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles.championsList}>
            {filteredChampions.map((champ) => {
              const wr = getStatValueByLimit(champ.fullCard, 'winRate', filters.matchLimit);
              const wrClass = wr >= 50 ? styles.mobWRGreen : styles.mobWRRed;

              return (
                <div key={champ.name} className={styles.listCard} onClick={() => handleChampionClick(champ)}>
                  {/* PC View (Table Row) */}
                  <div className={styles.pcOnly}>
                    <div className={styles.listHeader}>
                      <span>#</span><span>Name</span><span>Class</span><span>Str</span><span>Spd</span><span>Def</span><span>Dex</span><span>For</span><span>Total</span><span>Train</span><span>Elims</span><span>Wart</span><span>Balls</span><span>Score</span><span>W/R</span>
                    </div>
                    <div className={styles.listData}>
                      <span className={styles.listRank}>{champ.rank}</span>
                      <div className={styles.listNameCell}>
                        <img src={champ.imageUrl} alt={champ.name} className={styles.listPhoto} loading="lazy" />
                        <span className={styles.listName}>{champ.name}</span>
                      </div>
                      <div className={styles.listClassCell}><span className={styles.listClassValue}>{champ.class}</span></div>
                      <span className={styles.listStatValue}>{getStat(champ.fullCard, 'strength')}</span>
                      <span className={styles.listStatValue}>{getStat(champ.fullCard, 'speed')}</span>
                      <span className={styles.listStatValue}>{getStat(champ.fullCard, 'defense')}</span>
                      <span className={styles.listStatValue}>{getStat(champ.fullCard, 'dexterity')}</span>
                      <span className={styles.listStatValue}>{getStat(champ.fullCard, 'fortitude')}</span>
                      <span className={styles.listStatValue}>{getStat(champ.fullCard, 'totalStats')}</span>
                      <span className={styles.listStatValue}>{getStat(champ.fullCard, 'train')}</span>
                      <span className={styles.listStatValue}>{getStatValueByLimit(champ.fullCard, 'eliminations', filters.matchLimit).toFixed(2)}</span>
                      <span className={styles.listStatValue}>{getStatValueByLimit(champ.fullCard, 'wartDistance', filters.matchLimit).toFixed(0)}</span>
                      <span className={styles.listStatValue}>{getStatValueByLimit(champ.fullCard, 'deposits', filters.matchLimit).toFixed(1)}</span>
                      <span className={`${styles.listStatValue} ${styles.listScore}`}>{champ.score.toFixed(2)}</span>
                      <span className={`${styles.listStatValue} ${wr >= 50 ? styles.listWRGreen : styles.listWRRed}`}>
                        {wr.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Mobile View (3-Row Card) */}
                  <div className={styles.mobileOnly}>
                    <div className={styles.mobileRow1}>
                      <span className={styles.mobileRank}>#{champ.rank}</span>
                      <img src={champ.imageUrl} alt={champ.name} className={styles.mobilePhoto} loading="lazy" />
                      <span className={styles.mobileName}>{champ.name}</span>
                      <span className={styles.listClassValue}>{champ.class}</span>
                    </div>

                    <div className={styles.mobileStatsGrid}>
                      <div className={styles.mobileStatItem}><span className={styles.mobileStatLabel}>STR</span><span className={styles.mobileStatValue}>{getStat(champ.fullCard, 'strength')}</span></div>
                      <div className={styles.mobileStatItem}><span className={styles.mobileStatLabel}>SPD</span><span className={styles.mobileStatValue}>{getStat(champ.fullCard, 'speed')}</span></div>
                      <div className={styles.mobileStatItem}><span className={styles.mobileStatLabel}>DEF</span><span className={styles.mobileStatValue}>{getStat(champ.fullCard, 'defense')}</span></div>
                      <div className={styles.mobileStatItem}><span className={styles.mobileStatLabel}>DEX</span><span className={styles.mobileStatValue}>{getStat(champ.fullCard, 'dexterity')}</span></div>
                      <div className={styles.mobileStatItem}><span className={styles.mobileStatLabel}>FOR</span><span className={styles.mobileStatValue}>{getStat(champ.fullCard, 'fortitude')}</span></div>
                      <div className={styles.mobileStatItem}><span className={styles.mobileStatLabel}>TOTAL</span><span className={styles.mobileStatValue}>{getStat(champ.fullCard, 'totalStats')}</span></div>
                      <div className={styles.mobileStatItem}><span className={styles.mobileStatLabel}>TRAIN</span><span className={styles.mobileStatValue}>{getStat(champ.fullCard, 'train')}</span></div>
                    </div>

                    <div className={styles.mobilePerfGrid}>
                      <div className={styles.mobileStatItem}><span className={styles.mobileStatLabel}>ELIMS</span><span className={styles.mobileStatValue}>{getStatValueByLimit(champ.fullCard, 'eliminations', filters.matchLimit).toFixed(1)}</span></div>
                      <div className={styles.mobileStatItem}><span className={styles.mobileStatLabel}>WART</span><span className={styles.mobileStatValue}>{getStatValueByLimit(champ.fullCard, 'wartDistance', filters.matchLimit).toFixed(0)}</span></div>
                      <div className={styles.mobileStatItem}><span className={styles.mobileStatLabel}>BALLS</span><span className={styles.mobileStatValue}>{getStatValueByLimit(champ.fullCard, 'deposits', filters.matchLimit).toFixed(1)}</span></div>
                      <div className={styles.mobileStatItem}><span className={styles.mobileStatLabel}>SCORE</span><span className={`${styles.mobileStatValue} ${styles.mobScore}`}>{champ.score.toFixed(1)}</span></div>
                      <div className={styles.mobileStatItem}><span className={styles.mobileStatLabel}>W/R</span><span className={`${styles.mobileStatValue} ${wrClass}`}>{wr.toFixed(1)}%</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── FULL CHAMPION MODAL ─────────────────────────────────────────── */}
        {showModal && selectedChampion && (
          <div className={styles.modalOverlay} onClick={handleCloseModal}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>

              {/* Modal Header (Sticky) */}
              <div className={styles.modalHeader}>
                <img src={selectedChampion.imageUrl} alt={selectedChampion.name} className={styles.modalHeaderImg} />
                <div className={styles.modalHeaderInfo}>
                  <h2 className={styles.modalName}>{selectedChampion.name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={styles.modalRank}>
                      #{selectedChampion?.rank || 0} LEADERBOARD
                    </span>
                    {selectedChampion.marketLink && (
                      <a
                        href={selectedChampion.marketLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.marketLinkIconOnly}
                        onClick={(e) => e.stopPropagation()}
                        title="View on Marketplace"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                      </a>
                    )}
                  </div>
                </div>
                <button className={styles.modalClose} onClick={handleCloseModal} title="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Tab Switcher */}
              <div className={styles.tabBar}>
                {(['stats', 'history', 'upcoming'] as ModalTab[]).map((tab) => (
                  <button
                    key={tab}
                    className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'stats' && 'INFO'}
                    {tab === 'history' && 'HISTORY'}
                    {tab === 'upcoming' && 'UPCOMING'}
                  </button>
                ))}
              </div>

              {/* Modal Body */}
              <div className={styles.modalBody}>

                {/* ── TAB: STATS & PERFORMANCES ─────────────────────────── */}
                {activeTab === 'stats' && (() => {
                  const fc = selectedChampion?.fullCard;
                  if (!fc) return null;
                  const c = fc.custom;
                  return (
                    <div className={styles.statsGrid}>
                      <div className={styles.statsSection}>
                        <h3 className={styles.statsSectionTitle}>IDENTITY</h3>
                        <div className={styles.statsRow}>
                          {[
                            { label: 'Class', value: fc?.custom?.class || '-' },
                            { label: 'Fur', value: fc?.custom?.fur || '-' },
                            { label: 'Stars', value: fc?.custom?.stars ? `${fc.custom.stars} ★` : '-' },
                            ...(fc?.custom?.traits && fc.custom.traits.length > 0
                              ? Array.from(new Set(fc.custom.traits as string[]))
                                  .filter((t: string) => isSchemeTrait(t))
                                  .map((t: string) => ({ label: 'Trait', value: t }))
                              : []
                            ),
                          ].map((s, idx) => (
                            <div key={idx} className={styles.statPill} style={{ background: '#ffa834' }}>
                              <span className={styles.statLabel}>{s.label}</span>
                              <span className={styles.statValue} style={s.label !== 'Stars' ? { textTransform: 'capitalize', fontSize: '0.85rem' } : {}}>{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={styles.statsSection}>
                        <h3 className={styles.statsSectionTitle}>STATS</h3>
                        <div className={styles.statsRow}>
                          {[
                            { label: 'STR', value: getStat(fc, 'strength') },
                            { label: 'SPD', value: getStat(fc, 'speed') },
                            { label: 'DEF', value: getStat(fc, 'defense') },
                            { label: 'DEX', value: getStat(fc, 'dexterity') },
                            { label: 'FOR', value: getStat(fc, 'fortitude') },
                            { label: 'TOTAL', value: getStat(fc, 'totalStats') },
                            { label: 'TRAIN', value: getStat(fc, 'train') },
                          ].map((s) => (
                            <div key={s.label} className={styles.statPill}>
                              <span className={styles.statLabel}>{s.label}</span>
                              <span className={styles.statValue}>{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={styles.statsSection}>
                        <h3 className={styles.statsSectionTitle}>
                          {filters.matchLimit === 'ALL' || !filters.matchLimit
                            ? 'AVERAGE PERFORMANCE (ALL SEASON)'
                            : `AVERAGE PERFORMANCE (LAST ${filters.matchLimit})`}
                        </h3>
                        <div className={styles.statsRow}>
                          {[
                            { label: 'Elims', value: getStatValueByLimit(fc, 'eliminations', filters.matchLimit).toFixed(2) },
                            { label: 'Wart', value: getStatValueByLimit(fc, 'wartDistance', filters.matchLimit).toFixed(0) },
                            { label: 'Balls', value: getStatValueByLimit(fc, 'deposits', filters.matchLimit).toFixed(2) },
                            { label: 'Score', value: getStatValueByLimit(fc, 'score', filters.matchLimit).toFixed(2) },
                            { label: 'Win Rate', value: getStatValueByLimit(fc, 'winRate', filters.matchLimit).toFixed(1) + '%' },
                          ].map((s) => (
                            <div key={s.label} className={`${styles.statPill} ${styles.statPillPerf}`}>
                              <span className={styles.statLabel}>{s.label}</span>
                              <span className={styles.statValue}>{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {(filters.matchLimit === 10 || filters.matchLimit === 20) && (
                        <div className={styles.statsSection}>
                          <h3 className={styles.statsSectionTitle}>EXTRA (LAST {filters.matchLimit})</h3>
                          <div className={styles.statsRow} style={{ gap: '0.4rem' }}>
                            {[
                              { label: 'Ended', value: (getStatValueByLimit(fc, 'endedGame', filters.matchLimit) * 100).toFixed(0) + '%' },
                              { label: 'Deaths', value: getStatValueByLimit(fc, 'deaths', filters.matchLimit).toFixed(2) },
                              { label: 'WART EAT', value: getStatValueByLimit(fc, 'eatingWhileRiding', filters.matchLimit).toFixed(2) },
                              { label: 'Buff Time', value: getStatValueByLimit(fc, 'buffTime', filters.matchLimit).toFixed(1) + 's' },
                              { label: 'Wart Time', value: getStatValueByLimit(fc, 'wartTime', filters.matchLimit).toFixed(1) + 's' },
                              { label: 'Pickups', value: getStatValueByLimit(fc, 'looseBallPickups', filters.matchLimit).toFixed(2) },
                              { label: 'Eaten', value: getStatValueByLimit(fc, 'eatenByWart', filters.matchLimit).toFixed(2) },
                              { label: 'WART CLOSER', value: (getStatValueByLimit(fc, 'wartCloser', filters.matchLimit) * 100).toFixed(0) + '%' },
                            ].map((s) => (
                              <div key={s.label} className={`${styles.statPill} ${styles.statPillPerf}`} style={{ padding: '0.4rem 0.4rem', minWidth: '75px', flex: '1 1 content' }}>
                                <span className={styles.statLabel} style={{ fontSize: '0.6rem', whiteSpace: 'nowrap' }}>{s.label}</span>
                                <span className={styles.statValue} style={{ fontSize: '0.85rem' }}>{s.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── TAB: MATCH HISTORY ───────────────────────────────── */}
                {activeTab === 'history' && (
                  <div className={styles.historyContainer}>
                    {/* Controls */}

                    <div className={styles.mhControlsRow}>

                      {/* LEFT Column: Average performance box + Update Freq */}
                      <div>
                        {!historyLoading && matchHistory.length > 0 && (() => {
                          let wins = 0, totalElims = 0, totalDeposits = 0, totalWart = 0, totalScore = 0;
                          matchHistory.forEach((m: any) => {
                            const isWinner = m.team_won === m.moki_team;
                            if (isWinner) wins++;
                            totalElims += m.eliminations || 0;
                            totalDeposits += m.deposits || 0;
                            totalWart += m.wart_distance || 0;
                            totalScore += (isWinner ? 200 : 0) + (m.deposits || 0) * 50 + (m.eliminations || 0) * 80 + Math.floor((m.wart_distance || 0) / 80) * 40;
                          });
                          const n = matchHistory.length;
                          const winRate = Math.round((wins / n) * 100);
                          const avgScore = Math.round(totalScore / n);
                          const avgElims = (totalElims / n).toFixed(1);
                          const avgDeposits = (totalDeposits / n).toFixed(1);
                          const avgWart = Math.round(totalWart / n);
                          return (
                            <div className={styles.mhAvgWrapper} style={{ margin: 0 }}>
                              <div className={styles.mhAvgTitle}>AVERAGE PERFORMANCE</div>
                              <div className={styles.mhAvgBox}>
                                {[
                                  { label: 'Elims', value: avgElims },
                                  { label: 'Wart', value: avgWart },
                                  { label: 'Balls', value: avgDeposits },
                                  { label: 'Score', value: avgScore, gold: true },
                                  { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 50 ? '#46C767' : '#f87171' },
                                ].map((s) => (
                                  <div key={s.label} className={styles.mhAvgStat}>
                                    <span className={styles.mhAvgNum} style={s.gold ? { color: '#FFD753' } : s.color ? { color: s.color } : {}}>{s.value}</span>
                                    <span className={styles.mhAvgLabel}>{s.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        <p className={styles.mhUpdateFreq} style={{ marginTop: '0.4rem', marginBottom: 0 }}>The data is updated 1 hour after the contests end.</p>
                      </div>

                      {/* RIGHT Column: Limit Toggle Buttons */}
                      <div className={styles.mhLimitToggle} style={{ alignSelf: 'flex-start' }}>
                        {([10, 20] as const).map((limit) => (
                          <button
                            key={limit}
                            className={`${styles.mhLimitBtn} ${historyLimit === limit ? styles.mhLimitBtnActive : ''}`}
                            onClick={() => setHistoryLimit(limit)}
                            disabled={historyLoading}
                          >
                            LAST {limit}
                          </button>
                        ))}
                      </div>

                    </div>

                    {/* Match list */}
                    {historyLoading ? (
                      <div className={styles.mhLoading}>
                        <div className={styles.mhSpinner}></div>
                        <p>Loading match data...</p>
                      </div>
                    ) : matchHistory.length === 0 ? (
                      <div className={styles.mhEmpty}>No match history found for this Moki.</div>
                    ) : (
                      <div className={styles.mhMatchesList}>
                        {matchHistory.map((m: any) => {
                          const isWinner = m.team_won === m.moki_team;
                          const score = (isWinner ? 200 : 0) + (m.deposits || 0) * 50 + (m.eliminations || 0) * 80 + Math.floor((m.wart_distance || 0) / 80) * 40;
                          const players: any[] = m.match_data?.players || [];
                          const targetMoki = players.filter((p: any) => p.mokiId === m.moki_id);
                          const teammates = players.filter((p: any) => p.team === m.moki_team && p.mokiId !== m.moki_id);
                          const opponents = players.filter((p: any) => p.team !== m.moki_team);
                          const isExpanded = selectedMatchDetails?.match_id === m.match_id;

                          const getPlayerPerf = (mokiId: string, team: number) => {
                            const pr = m.match_data?.result?.players?.find((p: any) => p.mokiId === mokiId);
                            const elims = pr?.eliminations || 0;
                            const deps = pr?.deposits || 0;
                            const wart = pr?.wartDistance || 0;
                            const sc = (team === m.team_won ? 200 : 0) + deps * 50 + elims * 80 + Math.floor(wart / 80) * 40;
                            return { elims, deps, wart: Math.round(wart), score: sc };
                          };

                          return (
                            <div key={m.match_id} className={`${styles.mhMatchCard} ${isWinner ? styles.mhWinCard : styles.mhLossCard}`}>
                              {/* Meta */}
                              <div className={styles.mhMatchMeta}>
                                <div className={`${styles.mhResultBadge} ${isWinner ? styles.mhWinText : styles.mhLossText}`}>
                                  {isWinner ? 'VICTORY' : 'DEFEAT'}
                                </div>
                                <div className={styles.mhMetaRow}><span className={styles.mhMetaLabel}>Date:</span> {formatDate(m.match_date)}</div>
                                {m.duration != null && <div className={styles.mhMetaRow}><span className={styles.mhMetaLabel}>Duration:</span> {formatDuration(m.duration)}</div>}
                                {m.win_type && <div className={styles.mhMetaRow}><span className={styles.mhMetaLabel}>Win Type:</span> <span style={{ textTransform: 'capitalize' }}>{m.win_type.toLowerCase() === 'eliminations' ? 'combat' : m.win_type.toLowerCase()}</span></div>}
                              </div>

                              {/* Performance */}
                              <div className={styles.mhPerfSection}>
                                <div className={styles.mhSectionTitle}>Performance</div>
                                <div className={styles.mhStatsGrid}>
                                  {[
                                    { label: 'Elims', value: m.eliminations },
                                    { label: 'Balls', value: m.deposits },
                                    { label: 'Wart', value: m.wart_distance != null ? Math.round(m.wart_distance) : 0 },
                                  ].map((s) => (
                                    <div key={s.label} className={styles.mhStatBox}>
                                      <span className={styles.mhStatNumber}>{s.value}</span>
                                      <span className={styles.mhStatLabel}>{s.label}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className={styles.mhScoreBox}>
                                  <span className={styles.mhScoreLabel}>Score</span>
                                  <span className={styles.mhScoreValue}>{score}</span>
                                </div>
                              </div>

                              {/* Teams */}
                              <div className={styles.mhTeamsSectionContainer}>
                                <div className={styles.mhTeamsSection}>
                                  <div className={styles.mhTeamContainer}>
                                    <div className={styles.mhSectionTitle}>Team</div>
                                    <div className={styles.mhPlayersRow}>
                                      {[...targetMoki, ...teammates].map((p: any, idx: number) => (
                                        <div key={idx} className={`${styles.mhPlayerAvatar} ${idx === 0 && targetMoki.length > 0 ? styles.mhCurrentPlayer : ''}`} title={p.name}>
                                          {p.imageUrl && <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />}
                                        </div>
                                      ))}
                                      {targetMoki.length === 0 && teammates.length === 0 && <span className={styles.mhNoData}>Unknown</span>}
                                    </div>
                                  </div>
                                  <div className={styles.mhTeamContainer}>
                                    <div className={styles.mhSectionTitle}>Opponents</div>
                                    <div className={styles.mhPlayersRow}>
                                      {opponents.map((p: any, idx: number) => (
                                        <div key={idx} className={`${styles.mhPlayerAvatar} ${idx === 0 ? styles.mhLeadOpponent : ''}`} title={p.name}>
                                          {p.imageUrl && <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />}
                                        </div>
                                      ))}
                                      {opponents.length === 0 && <span className={styles.mhNoData}>Unknown</span>}
                                    </div>
                                  </div>
                                </div>
                                {/* Expand toggle */}
                                <button
                                  className={`${styles.mhExpandBtn} ${isExpanded ? styles.mhExpandBtnActive : ''}`}
                                  onClick={() => setSelectedMatchDetails(isExpanded ? null : m)}
                                  title="View Detailed Performance"
                                >
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                  </svg>
                                </button>
                              </div>

                              {/* Replay btn */}
                              <div className={styles.mhActionSection}>
                                <a href={`https://train.grandarena.gg/matches/${m.match_id}`} target="_blank" rel="noopener noreferrer" className={styles.mhReplayBtn} onClick={(e) => e.stopPropagation()}>
                                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z" /></svg>
                                  REPLAY
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Detail overlay when expanded */}
                    {selectedMatchDetails && (() => {
                      const m = selectedMatchDetails;
                      const players: any[] = m.match_data?.players || [];
                      const targetMoki = players.filter((p: any) => p.mokiId === m.moki_id);
                      const teammates = players.filter((p: any) => p.team === m.moki_team && p.mokiId !== m.moki_id);
                      const opponents = players.filter((p: any) => p.team !== m.moki_team);
                      const allTeam = [...targetMoki, ...teammates];

                      const getPlayerPerf = (mokiId: string, team: number) => {
                        const pr = m.match_data?.result?.players?.find((p: any) => p.mokiId === mokiId);
                        const elims = pr?.eliminations || 0;
                        const deps = pr?.deposits || 0;
                        const wart = pr?.wartDistance || 0;
                        const sc = (team === m.team_won ? 200 : 0) + deps * 50 + elims * 80 + Math.floor(wart / 80) * 40;
                        return { elims, deps, wart: Math.round(wart), score: sc };
                      };

                      const renderDetailCard = (p: any) => {
                        const perf = getPlayerPerf(p.mokiId, p.team);
                        return (
                          <div key={p.mokiId} className={styles.mhDetailCard}>
                            <div className={styles.mhDetailCardName}>{p.name}</div>
                            <div className={styles.mhDetailCardImgWrapper}>
                              {p.imageUrl && <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                              <span className={styles.mhDetailClassBadge}>{p.class}</span>
                            </div>
                            <div className={styles.mhDetailStatsBox}>
                              <div className={styles.mhDetailPerfLabel}>PERFORMANCE</div>
                              <div className={styles.mhDetailStatsRow}>
                                {[{ l: 'ELIMS', v: perf.elims }, { l: 'BALLS', v: perf.deps }, { l: 'WART', v: perf.wart }].map((s) => (
                                  <div key={s.l} className={styles.mhDetailStatCol}>
                                    <span className={styles.mhDetailStatVal}>{s.v}</span>
                                    <span className={styles.mhDetailStatLabel}>{s.l}</span>
                                  </div>
                                ))}
                              </div>
                              <div className={styles.mhDetailDivider}></div>
                              <div className={styles.mhDetailScoreRow}>
                                <span className={styles.mhDetailScoreLabel}>SCORE</span>
                                <span className={styles.mhDetailScoreVal}>{perf.score}</span>
                              </div>
                            </div>
                          </div>
                        );
                      };

                      return (
                        <div className={styles.mhDetailOverlay} onClick={() => setSelectedMatchDetails(null)}>
                          <div className={styles.mhDetailContent} onClick={(e) => e.stopPropagation()}>
                            <button className={styles.mhDetailClose} onClick={() => setSelectedMatchDetails(null)}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                            <div>
                              <h4 className={styles.mhDetailSubtitle}>TEAM</h4>
                              <div className={styles.mhDetailGrid}>{allTeam.map(renderDetailCard)}</div>
                            </div>
                            <div style={{ marginTop: '1rem' }}>
                              <h4 className={styles.mhDetailSubtitle}>OPPONENTS</h4>
                              <div className={styles.mhDetailGrid}>{opponents.map(renderDetailCard)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ── TAB: UPCOMING MATCHES ────────────────────────────── */}
                {activeTab === 'upcoming' && (
                  <div className={styles.upcomingContainer}>
                    {formattedDate && (
                      <p className={styles.upcomingDate}>Next block: {formattedDate}</p>
                    )}
                    <p className={styles.upcomingNote}>The data is updated 1 hour after the contests end.</p>
                    {championUpcomingMatches.length === 0 ? (
                      <div className={styles.empty}>No upcoming matches found for this champion.</div>
                    ) : (
                      <div className={styles.modalRows}>
                        {championUpcomingMatches.map((match) => {
                          const isRedTeam = match.team_red.some((m: any) => m.name === selectedChampion.name);
                          const leftTeam = isRedTeam ? match.team_red : match.team_blue;
                          const rightTeam = isRedTeam ? match.team_blue : match.team_red;
                          const leftMokiClass = isRedTeam ? styles.redMoki : styles.blueMoki;
                          const rightMokiClass = isRedTeam ? styles.blueMoki : styles.redMoki;
                          const gridEdgeClass = isRedTeam ? styles.redOnLeft : styles.blueOnLeft;

                          return (
                            <div key={match.id} className={styles.modalMatchRow}>
                              <div className={`${styles.modalTeamsGrid} ${gridEdgeClass}`}>
                                <div className={styles.playersRow}>
                                  {leftTeam.map((m: any, i: number) => {
                                    const normalizedName = m.name.trim().toUpperCase();
                                    const portrait = (mokiMetadata as any)[m.name.toUpperCase()]?.portraitUrl || m.imageUrl;
                                    const fc = allCards.find((c) => c.name.trim().toUpperCase() === normalizedName);
                                    const metadata = (mokiMetadata as any)[normalizedName] || (mokiMetadata as any)[normalizedName.replace(/ /g, '_')];
                                    const dbStat = mokiStats.find((s: any) => s.moki_id === (metadata?.id ? parseInt(metadata.id, 10) : null) || s.name.toUpperCase() === normalizedName);
                                    const actualClass = dbStat?.class || fc?.custom?.class || m.class;
                                    return (
                                      <div key={i} className={`${styles.miniMokiCard} ${i === 0 ? styles.championCard : ''}`}>
                                        <div className={styles.miniMokiNameWrapper}><span className={styles.miniMokiName}>{m.name}</span></div>
                                        <img src={portrait} alt={m.name} className={`${styles.miniMokiImg} ${leftMokiClass}`} />
                                        <span className={styles.miniMokiClassBadge}>{actualClass}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className={styles.modalVsBadge}>VS</div>
                                <div className={styles.playersRow}>
                                  {rightTeam.map((m: any, i: number) => {
                                    const normalizedName = m.name.trim().toUpperCase();
                                    const portrait = (mokiMetadata as any)[m.name.toUpperCase()]?.portraitUrl || m.imageUrl;
                                    const fc = allCards.find((c) => c.name.trim().toUpperCase() === normalizedName);
                                    const metadata = (mokiMetadata as any)[normalizedName] || (mokiMetadata as any)[normalizedName.replace(/ /g, '_')];
                                    const dbStat = mokiStats.find((s: any) => s.moki_id === (metadata?.id ? parseInt(metadata.id, 10) : null) || s.name.toUpperCase() === normalizedName);
                                    const actualClass = dbStat?.class || fc?.custom?.class || m.class;
                                    return (
                                      <div key={i} className={`${styles.miniMokiCard} ${i === 0 ? styles.championCard : ''}`}>
                                        <div className={styles.miniMokiNameWrapper}><span className={styles.miniMokiName}>{m.name}</span></div>
                                        <img src={portrait} alt={m.name} className={`${styles.miniMokiImg} ${rightMokiClass}`} />
                                        <span className={styles.miniMokiClassBadge}>{actualClass}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}



              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

