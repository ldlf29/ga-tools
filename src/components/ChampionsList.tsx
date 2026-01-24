'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { MokiData, fetchLiveData } from '@/utils/liveData';
import styles from './ChampionsList.module.css';

type SortField = keyof MokiData;
type SortDirection = 'asc' | 'desc';

export default function ChampionsList() {
    const [data, setData] = useState<MokiData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    // Sort state
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    // Filter state
    const [filterClass, setFilterClass] = useState<string | null>(null);
    const [showClassFilter, setShowClassFilter] = useState(false);

    const [filterFur, setFilterFur] = useState<string | null>(null);
    const [showFurFilter, setShowFurFilter] = useState(false);

    const classOptions = [
        "All Classes",
        "Anchor", "Bruiser", "Center", "Defender", "Flanker",
        "Forward", "Grinder", "Sprinter", "Striker", "Support"
    ];

    const furOptions = [
        "All Furs",
        "Common", "Rainbow", "Gold", "Shadow", "Spirit", "1 of 1"
    ];

    const headerRef = useRef<HTMLTableSectionElement>(null);

    // Click Outside Handler
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
                setShowClassFilter(false);
                setShowFurFilter(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const map = await fetchLiveData();
            if (map) {
                // Convert Map to Array
                const list = Object.values(map);
                setData(list);
            } else {
                setError("Failed to load data.");
            }
        } catch (e) {
            console.error(e);
            setError("Error loading data.");
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: SortField) => {
        if (field === 'class') return; // Disable sorting for Class
        if (field === 'fur') return;   // Disable sorting for Fur

        // Close filters if open
        setShowClassFilter(false);
        setShowFurFilter(false);

        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc'); // Default to high-to-low for stats usually
        }
    };

    const selectClass = (cls: string) => {
        setFilterClass(cls === "All Classes" ? null : cls);
        setFilterFur(null); // Mutual exclusion
        setShowClassFilter(false);
    };

    const selectFur = (fur: string) => {
        setFilterFur(fur === "All Furs" ? null : fur);
        setFilterClass(null); // Mutual exclusion
        setShowFurFilter(false);
    };

    const sortedData = useMemo(() => {
        let items = [...data];

        // Filter Search
        if (search) {
            const q = search.toLowerCase();
            items = items.filter(i => i.name.toLowerCase().includes(q));
        }

        // Filter Class
        if (filterClass) {
            items = items.filter(i => i.class === filterClass);
        }

        // Filter Fur
        if (filterFur) {
            items = items.filter(i => i.fur === filterFur);
        }

        // Sort
        items.sort((a, b) => {
            const valA = a[sortField];
            const valB = b[sortField];

            // Handle undefined
            if (valA === undefined && valB === undefined) return 0;
            if (valA === undefined) return 1;
            if (valB === undefined) return -1;

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return items;
    }, [data, search, sortField, sortDirection, filterClass, filterFur]);

    const renderHeader = (label: string, field: SortField, width?: string) => {
        const isClass = field === 'class';
        const isFur = field === 'fur';
        const isActive = sortField === field;

        const showFilter = isClass ? showClassFilter : (isFur ? showFurFilter : false);
        const hasActiveFilter = isClass ? filterClass : (isFur ? filterFur : false);

        const toggleFilter = () => {
            if (isClass) {
                const opening = !showClassFilter;
                setShowClassFilter(opening);
                if (opening) setShowFurFilter(false);
            }
            if (isFur) {
                const opening = !showFurFilter;
                setShowFurFilter(opening);
                if (opening) setShowClassFilter(false);
            }
        };

        return (
            <th
                className={styles.th}
                onClick={() => (isClass || isFur) ? toggleFilter() : handleSort(field)}
                style={{ width, cursor: 'pointer', zIndex: (isClass || isFur) && showFilter ? 100 : 10 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', position: 'relative' }}>
                    {label}

                    {/* Filter Dropdown for Class / Fur */}
                    {(isClass || isFur) && showFilter && (
                        <div className={styles.dropdownMenu}>
                            {(isClass ? classOptions : furOptions).map(opt => (
                                <div
                                    key={opt}
                                    className={styles.dropdownItem}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isClass) selectClass(opt);
                                        if (isFur) selectFur(opt);
                                    }}
                                >
                                    {opt}
                                </div>
                            ))}
                        </div>
                    )}

                    {!isClass && !isFur && (
                        <span className={styles.sortIcon} style={{
                            opacity: isActive ? 1 : 0.3,
                            visibility: 'visible',
                            color: isActive ? 'inherit' : '#000',
                            display: 'flex', alignItems: 'center'
                        }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isActive && sortDirection === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </span>
                    )}
                    {(isClass || isFur) && (
                        <span className={styles.sortIcon} style={{
                            opacity: showFilter || hasActiveFilter ? 1 : 0.3,
                            visibility: 'visible',
                            color: showFilter || hasActiveFilter ? 'inherit' : '#000',
                            display: 'flex', alignItems: 'center'
                        }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showFilter ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </span>
                    )}
                </div>
            </th>
        );
    };

    if (loading) return <div className={styles.loading}>Loading Champions Data...</div>;
    if (error) return <div className={styles.error}>{error}</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.title}>Champions</div>
                <input
                    type="text"
                    placeholder="Search Moki..."
                    className={styles.searchBar}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className={styles.tableContainer}>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead ref={headerRef}>
                            <tr>
                                {/* Identity */}
                                {renderHeader("NAME", "name")}
                                {renderHeader("FUR", "fur")}
                                {renderHeader("CLASS", "class")}
                                {renderHeader("★", "stars")}

                                {/* Base Stats */}
                                {renderHeader("STR", "strength")}
                                {renderHeader("SPD", "speed")}
                                {renderHeader("DEF", "defense")}
                                {renderHeader("DEX", "dexterity")}
                                {renderHeader("FOR", "fortitude")}
                                {renderHeader("TOTAL", "totalStats")}

                                {/* Perf Stats */}
                                {renderHeader("ELIMS", "eliminations")}
                                {renderHeader("BALLS", "deposits")}
                                {renderHeader("WART", "wartDistance")}
                                {renderHeader("SCORE", "score")}
                                {renderHeader("W/R", "winRate")}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.length > 0 ? (
                                sortedData.map((moki, idx) => (
                                    <tr key={moki.id || moki.name + idx} className={styles.tr}>
                                        <td className={styles.td}>
                                            <div className={styles.tdName}>
                                                {moki.imageUrl && (
                                                    <img
                                                        src={moki.imageUrl}
                                                        alt={moki.name}
                                                        className={styles.mokiImage}
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                        }}
                                                    />
                                                )}
                                                {moki.name}
                                                {moki.marketLink && (
                                                    <a
                                                        href={moki.marketLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={styles.linkButton}
                                                        title="View on Market"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                                            <polyline points="15 3 21 3 21 9"></polyline>
                                                            <line x1="10" y1="14" x2="21" y2="3"></line>
                                                        </svg>
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className={styles.td}>{moki.fur}</td>
                                        <td className={styles.td}>{moki.class}</td>
                                        <td className={styles.td}>
                                            {moki.stars}
                                        </td>

                                        <td className={styles.td}>{moki.strength?.toFixed(2) || '-'}</td>
                                        <td className={styles.td}>{moki.speed?.toFixed(2) || '-'}</td>
                                        <td className={styles.td}>{moki.defense?.toFixed(2) || '-'}</td>
                                        <td className={styles.td}>{moki.dexterity?.toFixed(2) || '-'}</td>
                                        <td className={styles.td}>{moki.fortitude?.toFixed(2) || '-'}</td>
                                        <td className={styles.td}>{moki.totalStats?.toFixed(2) || '-'}</td>

                                        <td className={styles.td}>{moki.eliminations?.toFixed(2) || '-'}</td>
                                        <td className={styles.td}>{moki.deposits?.toFixed(2) || '-'}</td>
                                        <td className={styles.td}>{moki.wartDistance?.toFixed(2) || '-'}</td>
                                        <td className={styles.td}>{moki.score?.toFixed(2) || '-'}</td>
                                        <td className={styles.td}>{moki.winRate ? moki.winRate.toFixed(2) + '%' : '-'}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={15}>
                                        <div className={styles.noResults}>
                                            No Moki found matching your filters.
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
