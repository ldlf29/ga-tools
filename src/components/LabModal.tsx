import React, { useState, useEffect, useMemo } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import styles from './LabModal.module.css';

const FlaskIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3h6" />
    <path d="M10 9l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" />
    <path d="M7 14h10" />
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const getBadgeBgColor = (cls: string) => {
  if (!cls) return '#1abf9e';
  const upper = cls.toUpperCase();
  if (['STRIKER', 'SPRINTER (S)', 'GRINDER (S)'].includes(upper)) return '#ff4b4b'; // RED
  if (['DEFENDER', 'SPRINTER (D)'].includes(upper)) return '#84bcff'; // BLUE
  if (['BRUISER', 'GRINDER (B)'].includes(upper)) return '#ffd753'; // YELLOW
  if (upper === 'GRINDER') return '#f39c12'; // ORANGE
  if (upper === 'SPRINTER') return '#9b59b6'; // VIOLET
  return '#1abf9e'; // GREEN
};

type LabModalProps = {
  onMokiClick?: (name: string) => void;
  onCloseUpcoming?: () => void;
};

export default function LabModal({ onMokiClick, onCloseUpcoming }: LabModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'v1' | 'v2' | 'merge'>('v1');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showStrikers, setShowStrikers] = useState(true);
  const [showDefenders, setShowDefenders] = useState(true);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const [v1Data, setV1Data] = useState<any[]>([]);
  const [v2Data, setV2Data] = useState<any[]>([]);
  const [mokiStats, setMokiStats] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
      
      document.body.style.setProperty('overflow', 'hidden', 'important');
      document.documentElement.style.setProperty('overflow', 'hidden', 'important');
      
      fetchData();
    } else {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const upcomingOverlay = document.querySelector('[class*="expandedRankingOverlay"]') as HTMLElement;
        if (upcomingOverlay) {
          if (onCloseUpcoming) onCloseUpcoming();
          return; 
        }
        
        setIsStatsOpen(prevStats => {
          if (prevStats) return false;
          
          setIsOpen(prevOpen => {
            if (prevOpen) return false;
            return prevOpen;
          });
          
          return prevStats;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch classes for overrides
      const { data: stats } = await supabase.from('moki_stats').select('moki_id, name, class, dexterity, strength, defense');
      if (stats) setMokiStats(stats);

      // Fetch V1
      const { data: dV1 } = await supabase.from('moki_predictions_ranking').select('*');
      
      // Fetch V2 Striker & Defender
      const { data: dV2S } = await supabase.from('moki_v2_ranking_striker').select('*');
      const { data: dV2D } = await supabase.from('moki_v2_ranking_defender').select('*');

      setV1Data(dV1 || []);
      setV2Data([...(dV2S || []), ...(dV2D || [])]);
    } catch (err) {
      console.error('Error fetching lab data:', err);
    }
    setLoading(false);
  };

  const getEffectiveClass = (mokiId: number, originalClass: string) => {
    const stat = mokiStats.find(s => s.moki_id === mokiId);
    let displayClass = stat?.class || originalClass;
    if (stat) {
      const dex = parseFloat(stat.dexterity || 0);
      const str = parseFloat(stat.strength || 0);
      const def = parseFloat(stat.defense || 0);
      if (displayClass === 'Grinder') {
        displayClass = dex > str ? 'Grinder (S)' : 'Grinder (B)';
      } else if (displayClass === 'Sprinter') {
        displayClass = dex > def ? 'Sprinter (S)' : 'Sprinter (D)';
      }
    }
    return displayClass;
  };

  const toggleStriker = () => {
    if (showStrikers && !showDefenders) return; // Prevent deselecting both
    setShowStrikers(!showStrikers);
  };

  const toggleDefender = () => {
    if (showDefenders && !showStrikers) return; // Prevent deselecting both
    setShowDefenders(!showDefenders);
  };

  const isMatch = (moki: any) => {
    if (searchTerm && !moki.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    
    const c = moki.displayClass?.toUpperCase() || '';
    const isStrikerGroup = ['STRIKER', 'SPRINTER (S)', 'GRINDER (S)'].includes(c);
    const isDefenderGroup = ['DEFENDER', 'SPRINTER (D)'].includes(c);
    
    if (!showStrikers && isStrikerGroup) return false;
    if (!showDefenders && isDefenderGroup) return false;
    if (!showStrikers && !showDefenders) return false;
    
    return true;
  };

  // V1 Filtered
  const filteredV1 = useMemo(() => {
    const validClasses = ['Striker', 'Defender', 'Sprinter (S)', 'Grinder (S)', 'Sprinter (D)'];
    return v1Data.map(m => ({
      ...m,
      displayClass: getEffectiveClass(m.moki_id, m.class)
    }))
    .filter(m => validClasses.includes(m.displayClass))
    .filter(isMatch)
    .sort((a, b) => b.score - a.score);
  }, [v1Data, mokiStats, searchTerm, showStrikers, showDefenders]);

  // V2
  const processedV2 = useMemo(() => {
    return v2Data.map(m => ({
      ...m,
      displayClass: getEffectiveClass(m.moki_id, m.class)
    }))
    .filter(isMatch)
    .sort((a, b) => b.v2_score - a.v2_score);
  }, [v2Data, mokiStats, searchTerm, showStrikers, showDefenders]);

  // Merge
  const mergedData = useMemo(() => {
    const map = new Map<number, any>();
    
    // Add V1
    filteredV1.forEach(m => {
      map.set(m.moki_id, {
        moki_id: m.moki_id,
        name: m.name,
        displayClass: m.displayClass,
        v1_score: m.score,
        v1_wr: m.win_rate,
        v2_score: null,
        v2_wr: null,
      });
    });

    // Add V2
    processedV2.forEach(m => {
      if (map.has(m.moki_id)) {
        const existing = map.get(m.moki_id);
        existing.v2_score = m.v2_score;
        existing.v2_wr = m.v2_win_rate;
      } else {
        map.set(m.moki_id, {
          moki_id: m.moki_id,
          name: m.name,
          displayClass: m.displayClass,
          v1_score: null,
          v1_wr: null,
          v2_score: m.v2_score,
          v2_wr: m.v2_win_rate,
        });
      }
    });

    return Array.from(map.values())
      .map(m => ({
        ...m,
        avg_score: ((m.v1_score || 0) + (m.v2_score || 0)) / ((m.v1_score !== null && m.v2_score !== null) ? 2 : 1),
        avg_wr: ((m.v1_wr || 0) + (m.v2_wr || 0)) / ((m.v1_wr !== null && m.v2_wr !== null) ? 2 : 1),
      }))
      .sort((a, b) => b.avg_score - a.avg_score);
  }, [filteredV1, processedV2]);

  // --- STATS LOGIC ---
  const renderStatsModal = () => {
    if (!isStatsOpen) return null;

    const currentData = activeTab === 'v1' ? filteredV1 : activeTab === 'v2' ? processedV2 : mergedData;

    const getStats = (topN: number) => {
      const topData = currentData.slice(0, topN);
      const total = topData.length;
      if (total === 0) return { sCount: 0, dCount: 0 };
      
      let sCount = 0;
      let dCount = 0;
      topData.forEach(m => {
        const c = m.displayClass?.toUpperCase() || '';
        if (['STRIKER', 'SPRINTER (S)', 'GRINDER (S)'].includes(c)) sCount++;
        else if (['DEFENDER', 'SPRINTER (D)'].includes(c)) dCount++;
      });
      
      return { sCount, dCount };
    };

    const top10 = getStats(10);
    const top25 = getStats(25);
    const top50 = getStats(50);

    const Pie = ({ stats, title }: any) => {
      const totalSD = stats.sCount + stats.dCount;
      const sPct = totalSD > 0 ? (stats.sCount / totalSD) * 100 : 0;
      
      return (
        <div className={styles.pieContainer}>
          <h3 className={styles.pieTitle}>{title}</h3>
          <div 
            className={styles.pieChart}
            style={{
              background: totalSD > 0 
                ? `conic-gradient(#ff4b4b 0% ${sPct}%, #84bcff ${sPct}% 100%)`
                : '#eee'
            }}
          >
            <div className={styles.pieHole}></div>
          </div>
          <div className={styles.pieLegend}>
            <div className={styles.legendItem}>
              <span className={styles.dot} style={{ background: '#ff4b4b' }}></span> 
              Striker <span className={styles.legendCount}>({stats.sCount})</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.dot} style={{ background: '#84bcff' }}></span> 
              Defender <span className={styles.legendCount}>({stats.dCount})</span>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className={styles.statsOverlay} onClick={() => setIsStatsOpen(false)}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={styles.statsModal} 
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.statsHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <h2 className={styles.title}>
                CLASS DISTRIBUTION
              </h2>
              <div className={styles.tabs}>
                <button 
                  className={`${styles.tab} ${activeTab === 'v1' ? styles.active : ''}`}
                  onClick={() => setActiveTab('v1')}
                >
                  V1
                </button>
                <button 
                  className={`${styles.tab} ${activeTab === 'v2' ? styles.active : ''}`}
                  onClick={() => setActiveTab('v2')}
                >
                  V2
                </button>
                <button 
                  className={`${styles.tab} ${activeTab === 'merge' ? styles.active : ''}`}
                  onClick={() => setActiveTab('merge')}
                >
                  V3
                </button>
              </div>
            </div>
            <button className={styles.closeButton} onClick={() => setIsStatsOpen(false)} style={{ alignSelf: 'flex-start' }}>
              <XIcon />
            </button>
          </div>
          <div className={styles.piesWrapper}>
            <Pie stats={top10} title="TOP 10" />
            <Pie stats={top25} title="TOP 25" />
            <Pie stats={top50} title="TOP 50" />
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <>
      <button 
        className={styles.floatingButton} 
        onClick={() => setIsOpen(true)} 
        title="Open AI Lab"
        style={{ zIndex: isOpen ? 9000 : 9998 }} // Cuando está abierto, queda debajo del overlay (9500)
      >
        <FlaskIcon />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.overlay}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className={styles.modal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.header}>
                <div className={styles.titleGroup}>
                  <h2 className={styles.title}>
                    PREDICTION RANKING LAB
                  </h2>
                  
                  <div className={styles.modalSearchWrapper}>
                    <input 
                      type="text" 
                      placeholder="Search Champion..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={styles.searchInput}
                    />
                  </div>
                  
                  <button 
                    className={styles.statsBtn} 
                    onClick={() => setIsStatsOpen(true)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                    CLASS DISTRIBUTION
                  </button>
                </div>

                <button className={styles.closeButton} onClick={() => setIsOpen(false)}>
                  <XIcon />
                </button>
              </div>

              <div className={styles.tabsRow}>
                <div className={styles.tabs}>
                  <button 
                    className={`${styles.tab} ${activeTab === 'v1' ? styles.active : ''}`}
                    onClick={() => setActiveTab('v1')}
                  >
                    V1 (Original)
                  </button>
                  <button 
                    className={`${styles.tab} ${activeTab === 'v2' ? styles.active : ''}`}
                    onClick={() => setActiveTab('v2')}
                  >
                    V2 (Specialized)
                  </button>
                  <button 
                    className={`${styles.tab} ${activeTab === 'merge' ? styles.active : ''}`}
                    onClick={() => setActiveTab('merge')}
                  >
                    V3 (V1 + V2)
                  </button>
                </div>
                
                <div className={styles.classFilters}>
                  <button 
                    className={`${styles.filterBtn} ${showStrikers ? styles.filterActive : ''}`}
                    onClick={toggleStriker}
                  >
                    STRIKER
                  </button>
                  <button 
                    className={`${styles.filterBtn} ${showDefenders ? styles.filterActive : ''}`}
                    onClick={toggleDefender}
                  >
                    DEFENDER
                  </button>
                </div>
              </div>

              <div className={styles.content}>
                {loading ? (
                  <div className={styles.loading}>Loading lab data...</div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={`${styles.colRank} ${styles.textCenter}`}>Rank</th>
                        <th className={styles.colName}>Name</th>
                        <th className={styles.textCenter}>Class</th>
                        {activeTab === 'v1' && (
                          <>
                            <th className={styles.textCenter}>V1 Score</th>
                            <th className={styles.textCenter}>V1 WinRate</th>
                          </>
                        )}
                        {activeTab === 'v2' && (
                          <>
                            <th className={styles.textCenter}>V2 Score</th>
                            <th className={styles.textCenter}>V2 WinRate</th>
                          </>
                        )}
                        {activeTab === 'merge' && (
                          <>
                            <th className={styles.textCenter}>V1 Score</th>
                            <th className={styles.textCenter}>V2 Score</th>
                            <th className={styles.textCenter}>Avg Score</th>
                            <th className={styles.textCenter}>Avg WinRate</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {activeTab === 'v1' && filteredV1.map((m, i) => (
                        <tr key={m.moki_id}>
                          <td className={`${styles.colRank} ${styles.textCenter}`}>#{i + 1}</td>
                          <td className={styles.colName}>
                            <span className={styles.clickableName} onClick={() => onMokiClick && onMokiClick(m.name)}>{m.name}</span>
                          </td>
                          <td className={styles.textCenter}>
                            <span className={styles.badge} style={{ backgroundColor: getBadgeBgColor(m.displayClass) }}>
                              {m.displayClass}
                            </span>
                          </td>
                          <td className={`${styles.outlinedScore} ${styles.textCenter}`}>{m.score?.toFixed(1) || '-'}</td>
                          <td className={styles.textCenter} style={{ color: '#1abf9e', fontWeight: 'bold' }}>{m.win_rate?.toFixed(1) || '-'}%</td>
                        </tr>
                      ))}

                      {activeTab === 'v2' && processedV2.map((m, i) => (
                        <tr key={m.moki_id}>
                          <td className={`${styles.colRank} ${styles.textCenter}`}>#{i + 1}</td>
                          <td className={styles.colName}>
                            <span className={styles.clickableName} onClick={() => onMokiClick && onMokiClick(m.name)}>{m.name}</span>
                          </td>
                          <td className={styles.textCenter}>
                            <span className={styles.badge} style={{ backgroundColor: getBadgeBgColor(m.displayClass) }}>
                              {m.displayClass}
                            </span>
                          </td>
                          <td className={`${styles.outlinedScore} ${styles.textCenter}`}>{m.v2_score?.toFixed(1) || '-'}</td>
                          <td className={styles.textCenter} style={{ color: '#1abf9e', fontWeight: 'bold' }}>{m.v2_win_rate?.toFixed(1) || '-'}%</td>
                        </tr>
                      ))}

                      {activeTab === 'merge' && mergedData.map((m, i) => (
                        <tr key={m.moki_id}>
                          <td className={`${styles.colRank} ${styles.textCenter}`}>#{i + 1}</td>
                          <td className={styles.colName}>
                            <span className={styles.clickableName} onClick={() => onMokiClick && onMokiClick(m.name)}>{m.name}</span>
                          </td>
                          <td className={styles.textCenter}>
                            <span className={styles.badge} style={{ backgroundColor: getBadgeBgColor(m.displayClass) }}>
                              {m.displayClass}
                            </span>
                          </td>
                          <td className={styles.textCenter} style={{ color: '#888' }}>{m.v1_score?.toFixed(1) || '-'}</td>
                          <td className={styles.textCenter} style={{ color: '#888' }}>{m.v2_score?.toFixed(1) || '-'}</td>
                          <td className={`${styles.outlinedScore} ${styles.textCenter}`}>{m.avg_score?.toFixed(1)}</td>
                          <td className={styles.textCenter} style={{ color: '#1abf9e', fontWeight: 'bold' }}>{m.avg_wr?.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* RENDER STATS MODAL */}
      <AnimatePresence>
        {isStatsOpen && renderStatsModal()}
      </AnimatePresence>
    </>
  );
}
