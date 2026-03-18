'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import NextImage from 'next/image';
import { createClient } from '@supabase/supabase-js';
import styles from './MatchHistoryModal.module.css';
import mokiMetadataRaw from '../data/mokiMetadata.json';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface MatchHistoryModalProps {
    tokenId: number | null;
    mokiName: string | null;
    onClose: () => void;
}

export default function MatchHistoryModal({ tokenId, mokiName, onClose }: MatchHistoryModalProps) {
    const [mounted, setMounted] = useState(false);
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMatchForDetails, setSelectedMatchForDetails] = useState<any | null>(null);
    const [historyLimit, setHistoryLimit] = useState<10 | 20 | 30>(10);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && tokenId !== null) {
            document.body.classList.add('modal-open');
            document.documentElement.classList.add('modal-open');
            const handleEsc = (e: KeyboardEvent) => {
                if (e.key === 'Escape') onClose();
            };
            window.addEventListener('keydown', handleEsc);

            const fetchMatches = async () => {
                setLoading(true);
                try {
                    const { data, error } = await supabase
                        .from('moki_match_history')
                        .select('*')
                        .eq('token_id', tokenId)
                        .order('match_id', { ascending: false })
                        .limit(historyLimit);

                    if (!error && data) {
                        setMatches(data);
                    } else {
                        console.error('Error fetching matches:', error);
                    }
                } catch (err) {
                    console.error('Fetch error:', err);
                } finally {
                    setLoading(false);
                }
            };

            fetchMatches();

            return () => {
                document.body.classList.remove('modal-open');
                document.documentElement.classList.remove('modal-open');
                window.removeEventListener('keydown', handleEsc);
            };
        }
    }, [tokenId, mounted, onClose, historyLimit]);

    if (!mounted || tokenId === null) return null;

    // Helper functions
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

    // Math calculation for averages
    let wins = 0, totalElims = 0, totalDeposits = 0, totalWart = 0, totalScore = 0;
    matches.forEach(m => {
        const isWinner = m.team_won === m.moki_team;
        if (isWinner) wins++;
        totalElims += m.eliminations || 0;
        totalDeposits += m.deposits || 0;
        totalWart += m.wart_distance || 0;
        totalScore += (isWinner ? 300 : 0) + ((m.deposits || 0) * 50) + ((m.eliminations || 0) * 80) + (Math.floor((m.wart_distance || 0) / 80) * 45);
    });

    const numMatches = matches.length;
    const winRate = numMatches > 0 ? Math.round((wins / numMatches) * 100) : 0;
    const avgScore = numMatches > 0 ? Math.round(totalScore / numMatches) : 0;
    const avgElims = numMatches > 0 ? (totalElims / numMatches).toFixed(1) : '0';
    const avgDeposits = numMatches > 0 ? (totalDeposits / numMatches).toFixed(1) : '0';
    const avgWart = numMatches > 0 ? Math.round(totalWart / numMatches) : 0;

    // Resolve market link
    const mokiMetadata = mokiMetadataRaw as Record<string, any>;
    const activeMetadata = Object.values(mokiMetadata).find(m => String(m.id) === String(tokenId));
    const marketLink = activeMetadata?.marketLink || null;

    const renderMatchDetailsModal = () => {
        if (!selectedMatchForDetails) return null;
        const m = selectedMatchForDetails;
        const players = m.match_data?.players || [];
        const targetMokiList = players.filter((p: any) => p.mokiId === m.moki_id);
        const teammates = players.filter((p: any) => p.team === m.moki_team && p.mokiId !== m.moki_id);
        const opponents = players.filter((p: any) => p.team !== m.moki_team);

        // Let's place targetMokiList (the queried moki) first, then the teammates.
        const allTeam = [...targetMokiList, ...teammates];

        const getPlayerPerformance = (mokiId: string, team: number) => {
            let elims = 0, deps = 0, wart = 0;
            const playerResult = m.match_data?.result?.players?.find((pr: any) => pr.mokiId === mokiId);
            if (playerResult) {
                elims = playerResult.eliminations || 0;
                deps = playerResult.deposits || 0;
                wart = playerResult.wartDistance || 0;
            }
            const isWinner = team === m.team_won;
            const score = (isWinner ? 300 : 0) + (deps * 50) + (elims * 80) + (Math.floor(wart / 80) * 45);
            return { elims, deps, wart: Math.round(wart), score };
        };

        const renderCard = (p: any, type: string) => {
            const perf = getPlayerPerformance(p.mokiId, p.team);
            return (
                <div key={`${type}-${p.mokiId}`} className={styles.mokiDetailCard}>
                    <div className={styles.mokiCardHeader}>
                        <span className={styles.mokiName} title={p.name}>{p.name}</span>
                    </div>
                    <div className={styles.mokiCardImageWrapper}>
                        {p.imageUrl ? (
                            <NextImage src={p.imageUrl} alt={p.name} fill style={{ objectFit: 'contain' }} />
                        ) : (
                            <span className={styles.mokiNoImage}>?</span>
                        )}
                        <span className={styles.mokiClassBadge}>{p.class}</span>
                    </div>
                    <div className={styles.mokiCardStatsBox}>
                        <div className={styles.mokiPerformanceLabel}>PERFORMANCE</div>

                        <div className={styles.mokiStatsRow}>
                            <div className={styles.mokiStatCol}>
                                <span className={styles.mokiStatVal}>{perf.elims}</span>
                                <span className={styles.mokiStatLabel}>ELIMS</span>
                            </div>
                            <div className={styles.mokiStatCol}>
                                <span className={styles.mokiStatVal}>{perf.deps}</span>
                                <span className={styles.mokiStatLabel}>BALLS</span>
                            </div>
                            <div className={styles.mokiStatCol}>
                                <span className={styles.mokiStatVal}>{perf.wart}</span>
                                <span className={styles.mokiStatLabel}>WART</span>
                            </div>
                        </div>

                        <div className={styles.mokiScoreDivider}></div>

                        <div className={styles.mokiScoreRow}>
                            <span className={styles.mokiScoreLabel}>SCORE</span>
                            <span className={styles.mokiScoreVal}>{perf.score}</span>
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <div className={styles.detailModalOverlay} onClick={(e) => { e.stopPropagation(); setSelectedMatchForDetails(null); }}>
                <div className={styles.detailModalContent} onClick={e => e.stopPropagation()}>
                    <button className={styles.modalCloseButton} onClick={() => setSelectedMatchForDetails(null)} title="Close Details">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>

                    <div className={styles.detailCardGridContainer}>
                        <h4 className={styles.detailModalSubtitle}>TEAM</h4>
                        <div className={styles.detailModalGrid}>
                            {allTeam.map((p: any) => renderCard(p, 'team'))}
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                            <h4 className={styles.detailModalSubtitle}>OPPONENTS</h4>
                            <div className={styles.detailModalGrid}>
                                {opponents.map((p: any) => renderCard(p, 'opp'))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return createPortal(
        <AnimatePresence>
            <div className={styles.modalOverlay} onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className={styles.modalContent}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button className={styles.modalCloseButton} onClick={onClose} title="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>

                    <div className={styles.header}>
                        <div className={styles.headerLeft}>
                            <div className={styles.titleRow}>
                                <h2 className={styles.title}>MATCH HISTORY</h2>
                                <div className={styles.limitToggle}>
                                    {[10, 20, 30].map(val => (
                                        <button
                                            key={val}
                                            className={`${styles.limitBtn} ${historyLimit === val ? styles.limitBtnActive : ''}`}
                                            onClick={() => setHistoryLimit(val as 10 | 20 | 30)}
                                            disabled={loading}
                                        >
                                            LAST {val}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <p className={styles.updateFreq}>The data is updated every 5 minutes.</p>
                            <div className={styles.subtitleRow}>
                                <h3 className={styles.subtitle}>{mokiName}</h3>
                            </div>
                        </div>

                        {!loading && numMatches > 0 && (
                            <div className={styles.headerRight}>
                                <div className={styles.avgBoxContainerWrapper}>
                                    <div className={styles.avgBoxTitle}>AVERAGE PERFORMANCE</div>
                                    <div className={styles.avgBoxContainer}>
                                        <div className={styles.avgStatBox}>
                                            <span className={styles.avgNumber}>{avgElims}</span>
                                            <span className={styles.avgLabel}>Elims</span>
                                        </div>
                                        <div className={styles.avgStatBox}>
                                            <span className={styles.avgNumber}>{avgWart}</span>
                                            <span className={styles.avgLabel}>Wart</span>
                                        </div>
                                        <div className={styles.avgStatBox}>
                                            <span className={styles.avgNumber}>{avgDeposits}</span>
                                            <span className={styles.avgLabel}>Balls</span>
                                        </div>
                                        <div className={styles.avgStatBox}>
                                            <span className={styles.avgNumber} style={{ color: '#FFD753' }}>{avgScore}</span>
                                            <span className={styles.avgLabel}>Score</span>
                                        </div>
                                        <div className={styles.avgStatBox}>
                                            <span className={styles.avgNumber} style={winRate >= 50 ? { color: '#4ade80' } : { color: '#f87171' }}>{winRate}%</span>
                                            <span className={styles.avgLabel}>Win Rate</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={styles.body}>
                        {loading ? (
                            <div className={styles.loadingContainer}>
                                <div className={styles.spinner}></div>
                                <p>Loading match data...</p>
                            </div>
                        ) : matches.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p>No match history found for this Moki.</p>
                            </div>
                        ) : (
                            <div className={styles.matchesList}>
                                {matches.map((m) => {
                                    const players = m.match_data?.players || [];
                                    const targetMokiList = players.filter((p: any) => p.mokiId === m.moki_id);
                                    const teammates = players.filter((p: any) => p.team === m.moki_team && p.mokiId !== m.moki_id);
                                    const opponents = players.filter((p: any) => p.team !== m.moki_team);
                                    const isWinner = m.team_won === m.moki_team;

                                    return (
                                        <div key={m.match_id} className={`${styles.matchCard} ${isWinner ? styles.winCard : styles.lossCard}`}>
                                            <div className={styles.matchMeta}>
                                                <div className={`${styles.resultBadge} ${isWinner ? styles.winText : styles.lossText}`}>
                                                    {isWinner ? 'VICTORY' : 'DEFEAT'}
                                                </div>
                                                <div className={styles.metaRow}>
                                                    <span className={styles.metaLabel}>Date:</span> {formatDate(m.match_date)}
                                                </div>
                                                <div className={styles.metaRow}>
                                                    <span className={styles.metaLabel}>Duration:</span> {formatDuration(m.duration)}
                                                </div>
                                                <div className={styles.metaRow}>
                                                    <span className={styles.metaLabel}>Win Type:</span> <span className={styles.capitalize}>
                                                        {m.win_type.toLowerCase() === 'eliminations' ? 'combat' : m.win_type.toLowerCase()}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className={styles.performanceSection}>
                                                <div className={styles.sectionTitle}>Performance</div>
                                                <div className={styles.statsGrid}>
                                                    <div className={styles.statBox}>
                                                        <span className={styles.statNumber}>{m.eliminations}</span>
                                                        <span className={styles.statLabel}>Elims</span>
                                                    </div>
                                                    <div className={styles.statBox}>
                                                        <span className={styles.statNumber}>{m.deposits}</span>
                                                        <span className={styles.statLabel}>Balls</span>
                                                    </div>
                                                    <div className={styles.statBox}>
                                                        <span className={styles.statNumber}>{Math.round(m.wart_distance)}</span>
                                                        <span className={styles.statLabel}>Wart</span>
                                                    </div>
                                                </div>
                                                <div className={styles.scoreBox}>
                                                    <span className={styles.scoreLabel}>Score</span>
                                                    <span className={styles.scoreValue}>
                                                        {(isWinner ? 300 : 0) + (m.deposits * 50) + (m.eliminations * 80) + (Math.floor(m.wart_distance / 80) * 45)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className={styles.teamsSectionContainer}>
                                                <div className={styles.teamsSection}>
                                                    <div className={styles.teamContainer}>
                                                        <div className={styles.sectionTitle}>Team</div>
                                                        <div className={styles.playersRow}>
                                                            {targetMokiList.map((p: any, idx: number) => (
                                                                <div key={`self-${idx}`} className={`${styles.playerAvatar} ${styles.currentPlayer}`} title={`${p.name} (You)`}>
                                                                    {p.imageUrl && <NextImage src={p.imageUrl} alt={p.name} fill style={{ objectFit: 'contain' }} />}
                                                                </div>
                                                            ))}
                                                            {teammates.map((p: any, idx: number) => (
                                                                <div key={`team-${idx}`} className={styles.playerAvatar} title={p.name}>
                                                                    {p.imageUrl && <NextImage src={p.imageUrl} alt={p.name} fill style={{ objectFit: 'contain' }} />}
                                                                </div>
                                                            ))}
                                                            {teammates.length === 0 && targetMokiList.length === 0 && <span className={styles.noData}>Unknown</span>}
                                                        </div>
                                                    </div>

                                                    <div className={styles.teamContainer}>
                                                        <div className={styles.sectionTitle}>Opponents</div>
                                                        <div className={styles.playersRow}>
                                                            {opponents.map((p: any, idx: number) => (
                                                                <div key={`opp-${idx}`} className={`${styles.playerAvatar} ${idx === 0 ? styles.leadOpponent : ''}`} title={p.name}>
                                                                    {p.imageUrl && <NextImage src={p.imageUrl} alt={p.name} fill style={{ objectFit: 'contain' }} />}
                                                                </div>
                                                            ))}
                                                            {opponents.length === 0 && <span className={styles.noData}>Unknown</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    className={`${styles.expandToggleBtn} ${selectedMatchForDetails?.match_id === m.match_id ? styles.active : ''}`}
                                                    onClick={() => setSelectedMatchForDetails(m)}
                                                    title="View Detailed Performance"
                                                >
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    </svg>
                                                </button>
                                            </div>

                                            <div className={styles.actionSection}>
                                                <a
                                                    href={`https://train.grandarena.gg/matches/${m.match_id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={styles.replayBtn}
                                                >
                                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M8 5v14l11-7z" />
                                                    </svg>
                                                    REPLAY
                                                </a>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {renderMatchDetailsModal()}
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}
