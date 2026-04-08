/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './UpcomingMatches.module.css';
import { EnhancedCard, FilterState } from '@/types';
import FilterSidebar from './FilterSidebar';
import { matchesFilter } from '@/utils/filterUtils';
import mokiMetadata from '@/data/mokiMetadata.json';
import { getSpecializationCoefficient } from '@/utils/specializationUtils';
import { getActiveFiltersDisplay } from '@/utils/filterDisplay';

let cachedMatchesData: UpcomingMatchData[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface UpcomingMatchData {
  id: string;
  contest_id: string;
  match_date: string;
  team_red: any[];
  team_blue: any[];
  created_at: string;
}

interface UpcomingMatchesProps {
  allCards: EnhancedCard[];
}

export default function UpcomingMatches({ allCards }: UpcomingMatchesProps) {

  const [matches, setMatches] = useState<UpcomingMatchData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedChampion, setSelectedChampion] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    rarity: [],
    cardType: 'MOKI',
    schemeName: [],
    fur: [],
    stars: [],
    customClass: [],
    specialization: [],
    traits: [],
    traitScheme: [],
    matchLimit: 'ALL',
  });
  
  // Mobile layout state
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    async function loadMatches() {
      const now = Date.now();
      const cacheValid = cachedMatchesData.length > 0 && (now - cacheTimestamp) < CACHE_TTL_MS;
      if (cacheValid) {
        setMatches(cachedMatchesData);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const { data, error } = await supabase
        .from('upcoming_matches_ga')
        .select('*')
        .order('match_date', { ascending: true })
        .limit(2000);

      if (!error && data) {
        setMatches(data);
        cachedMatchesData = data;
        cacheTimestamp = Date.now();
      } else if (error) {
        console.error('[UpcomingMatches] Supabase error:', error);
      }
      setIsLoading(false);
    }
    loadMatches();
  }, []);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const handleRemoveFilter = (
    key: keyof FilterState,
    value: string | number
  ) => {
    setFilters((prev) => {
      const currentValues = prev[key];
      let newValues = currentValues;
      if (key === 'stars') {
        newValues = [];
      } else if (key === 'matchLimit') {
        newValues = 'ALL';
      } else if (Array.isArray(currentValues)) {
        newValues = (currentValues as any[]).filter((v) => v !== value);
      }
      let newOrder = prev.insertionOrder ? [...prev.insertionOrder] : [];
      const orderKey = `${String(key)}:${value}`;
      newOrder = newOrder.filter((k) => k !== orderKey);
      return { ...prev, [key]: newValues, insertionOrder: newOrder };
    });
  };

  const activeFilters = getActiveFiltersDisplay(filters);

const hasSidebarFilters = 
    filters.fur!.length > 0 || 
    filters.traits!.length > 0 || 
    filters.specialization!.length > 0 || 
    filters.customClass!.length > 0 ||
    (filters.traitScheme?.length ?? 0) > 0 ||
    (filters.stars && filters.stars.length > 0);
// Aggregate Unique Champions from matches and calculate Rank
const uniqueChampions = useMemo(() => {
  const map = new Map();
  matches.forEach(match => {
    const redChamp = match.team_red[0];
    const blueChamp = match.team_blue[0];
    if (redChamp && !map.has(redChamp.name)) map.set(redChamp.name, redChamp);
    if (blueChamp && !map.has(blueChamp.name)) map.set(blueChamp.name, blueChamp);
  });

  const list = Array.from(map.values()).map(champ => {
    const fullCard = allCards.find(c => c.name.trim().toUpperCase() === champ.name.trim().toUpperCase());
    const normalizedName = champ.name.trim().toUpperCase();
    const metadata = (mokiMetadata as any)[normalizedName];

    return {
      ...champ,
      class: fullCard?.custom?.class || champ.class,
      score: fullCard?.custom?.score || 0,
      imageUrl: metadata?.portraitUrl || fullCard?.custom?.imageUrl || champ.imageUrl,
    };
  }).sort((a, b) => b.score - a.score);

  return list;
}, [matches, allCards]);

  // Filter ONLY derived Champions list based on active filters
  const filteredChampions = useMemo(() => {
    const filtered = uniqueChampions.filter(champ => {
       // Search query
       if (searchQuery.trim()) {
         if (!champ.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
       }

       const fullCard = allCards.find(c => c.name.trim().toUpperCase() === champ.name.trim().toUpperCase());
       if (hasSidebarFilters && fullCard) {
         if (!matchesFilter(fullCard, filters)) return false;
       }

       return true;
    });

    if (hasSidebarFilters && filters.specialization?.length > 0) {
      return filtered.sort((a, b) => {
         const fullA = allCards.find(c => c.name.trim().toUpperCase() === a.name.trim().toUpperCase());
         const fullB = allCards.find(c => c.name.trim().toUpperCase() === b.name.trim().toUpperCase());
         if (!fullA || !fullB) return b.score - a.score;

         const activeSpecs = filters.specialization;
         const perfSpecs = ['Gacha', 'Killer', 'Wart Rider'];
         const contextSpecs = ['Winner', 'Loser', 'Bad Streak', 'Good Streak'];
         const scoreSpecs = ['Score'];

         const activePerf = activeSpecs.find(s => perfSpecs.includes(s));
         const activeContext = activeSpecs.find(s => contextSpecs.includes(s));
         const activeScore = activeSpecs.find(s => scoreSpecs.includes(s));
         const activeCategories = [activePerf, activeContext, activeScore].filter(Boolean);

         if (activeCategories.length > 1) {
            const calcCoeff = (c: any) => {
               let coeff = 1;
               activeCategories.forEach(spec => {
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

    return filtered;
  }, [uniqueChampions, searchQuery, filters, hasSidebarFilters, allCards]);

  const championMatches = useMemo(() => {
    if (!selectedChampion) return [];
    const champName = selectedChampion.name;
    const found = matches.filter(match => (
      match.team_red.some((m: any) => m?.name === champName) ||
      match.team_blue.some((m: any) => m?.name === champName)
    ));
    return found.slice(0, 10).reverse();
  }, [selectedChampion, matches]);

  const formattedDate = useMemo(() => {
    const firstMatch = championMatches[0];
    if (!firstMatch) return '';
    const d = new Date(firstMatch.match_date);
    // Use UTC methods to ensure date/time matches the exact backend block
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} - ${hours}:${minutes} UTC`;
  }, [championMatches]);

  const handleChampionClick = (champ: any) => {
    setSelectedChampion(champ);
    setShowModal(true);
  };

  return (
    <div className={styles.upcomingContainer}>
      {/* Drawer layout similar setup */}
      <div className={styles.mobileOnly}>
         <div className={styles.fabContainer}>
           <button
             className={`${styles.fabButton} ${styles.fabFilters}`}
             onClick={() => setMobileFiltersOpen(true)}
           >
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
               <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
             </svg>
           </button>
         </div>
         <div className={`${styles.drawerOverlay} ${mobileFiltersOpen ? styles.drawerOverlayVisible : ''}`} onClick={() => setMobileFiltersOpen(false)} />
         <div className={`${styles.mobileDrawer} ${styles.filterDrawer} ${mobileFiltersOpen ? styles.filterDrawerOpen : ''}`}>
           <button className={`${styles.drawerCloseButton} ${styles.filterCloseButton}`} onClick={() => setMobileFiltersOpen(false)}>
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="15 18 9 12 15 6"></polyline></svg>
           </button>
           <FilterSidebar filters={filters} onFilterChange={handleFilterChange} onCardTypeChange={() => {}} hideMatchPerformance={false} hideRarity={true} hideTypeToggle={true} storagePrefix="upcoming_matches" />
         </div>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.desktopOnly}>
           <FilterSidebar filters={filters} onFilterChange={handleFilterChange} onCardTypeChange={() => {}} hideMatchPerformance={false} hideRarity={true} hideTypeToggle={true} storagePrefix="upcoming_matches" />
        </div>

        <div className={styles.matchesView}>
           <div className={styles.topControls}>
              <div className={styles.headerTopRow}>
                  <div className={styles.headerTitleGroup}>
                     <h1 className={styles.pageTitle}>UPCOMING MATCHES</h1>
                     {!isLoading && (
                       <span className={styles.matchCount}>
                         {uniqueChampions.length} champions · {matches.length} matches
                       </span>
                     )}
                  </div>
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search Champion by Name..." className={styles.searchInput} />
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
           ) : (
             <div className={styles.championsGrid}>
                {filteredChampions.map((champ) => {
                    const globalRank = uniqueChampions.findIndex(c => c.name === champ.name) + 1;
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
                    )
                })}
             </div>
           )}
        </div>
      </div>

      {showModal && selectedChampion && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
             <div className={styles.modalHeader}>
                <div className={styles.modalHeaderInfo}>
                   <h2 className={styles.modalName}>UPCOMING MATCHES</h2>
                   {formattedDate && <p className={styles.modalHeaderDate}>{formattedDate}</p>}
                   <p className={styles.updateFreq}>The data is updated at the end of each block of games.</p>
                   <h3 className={styles.mokiSubtitle}>{selectedChampion.name}</h3>
                </div>
                <button
                  className={styles.modalClose}
                  onClick={() => setShowModal(false)}
                  title="Close Modal"
                >
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
             
             <div className={styles.modalMatchesList}>
                
                <div className={styles.modalRows}>
                    {championMatches.map(match => {
                        const isRedTeam = match.team_red.some(m => m.name === selectedChampion.name);
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
                                            const portrait = (mokiMetadata as any)[m.name.toUpperCase()]?.portraitUrl || m.imageUrl;
                                            const fullCard = allCards.find(c => c.name.trim().toUpperCase() === m.name.trim().toUpperCase());
                                            const actualClass = fullCard?.custom?.class || m.class;
                                            return (
                                                <div key={i} className={`${styles.miniMokiCard} ${i === 0 ? styles.championCard : ''}`}>
                                                    <div className={styles.miniMokiNameWrapper}>
                                                        <span className={styles.miniMokiName}>{m.name}</span>
                                                    </div>
                                                    <img src={portrait} alt={m.name} className={`${styles.miniMokiImg} ${leftMokiClass}`} />
                                                    <span className={styles.miniMokiClassBadge}>{actualClass}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div className={styles.modalVsBadge}>VS</div>
                                    <div className={styles.playersRow}>
                                        {rightTeam.map((m: any, i: number) => {
                                            const portrait = (mokiMetadata as any)[m.name.toUpperCase()]?.portraitUrl || m.imageUrl;
                                            const fullCard = allCards.find(c => c.name.trim().toUpperCase() === m.name.trim().toUpperCase());
                                            const actualClass = fullCard?.custom?.class || m.class;
                                            return (
                                                <div key={i} className={`${styles.miniMokiCard} ${i === 0 ? styles.championCard : ''}`}>
                                                    <div className={styles.miniMokiNameWrapper}>
                                                        <span className={styles.miniMokiName}>{m.name}</span>
                                                    </div>
                                                    <img src={portrait} alt={m.name} className={`${styles.miniMokiImg} ${rightMokiClass}`} />
                                                    <span className={styles.miniMokiClassBadge}>{actualClass}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
