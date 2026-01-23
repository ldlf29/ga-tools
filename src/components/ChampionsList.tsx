'use client';

import { useState, useEffect, useMemo } from 'react';
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

    const classOptions = [
        "All Classes",
        "Anchor", "Bruiser", "Center", "Defender", "Flanker",
        "Forward", "Grinder", "Sprinter", "Striker", "Support"
    ];

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

        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc'); // Default to high-to-low for stats usually
        }
    };

    const selectClass = (cls: string) => {
        setFilterClass(cls === "All Classes" ? null : cls);
        setShowClassFilter(false);
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
    }, [data, search, sortField, sortDirection, filterClass]);

    const renderHeader = (label: string, field: SortField, width?: string) => {
        const isClass = field === 'class';
        const isActive = sortField === field;

        return (
            <th
                className={styles.th}
                onClick={() => isClass ? setShowClassFilter(!showClassFilter) : handleSort(field)}
                style={{ width, cursor: 'pointer', zIndex: isClass && showClassFilter ? 50 : 10 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', position: 'relative' }}>
                    {label}

                    {/* Filter Dropdown for Class */}
                    {isClass && showClassFilter && (
                        <div className={styles.dropdownMenu}>
                            {classOptions.map(opt => (
                                <div
                                    key={opt}
                                    className={styles.dropdownItem}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        selectClass(opt);
                                    }}
                                >
                                    {opt}
                                </div>
                            ))}
                        </div>
                    )}

                    {!isClass && (
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
                    {isClass && (
                        <span className={styles.sortIcon} style={{
                            opacity: showClassFilter || filterClass ? 1 : 0.3,
                            visibility: 'visible',
                            color: showClassFilter || filterClass ? 'inherit' : '#000',
                            display: 'flex', alignItems: 'center'
                        }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showClassFilter ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
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
                        <thead>
                            <tr>
                                {/* Identity */}
                                {renderHeader("NAME", "name", "200px")}
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
                            {sortedData.map((moki, idx) => (
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
                                        </div>
                                    </td>
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
