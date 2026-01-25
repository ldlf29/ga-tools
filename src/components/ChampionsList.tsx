'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { MokiData, fetchLiveData } from '@/utils/liveData';
import styles from './ChampionsList.module.css';
import * as XLSX from 'xlsx';

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
            setSortDirection('asc'); // Default to ascending usually
        }
    };

    const handleExportExcel = () => {
        if (sortedData.length === 0) return;

        const exportData = sortedData.map(moki => ({
            'NAME': moki.name,
            'FUR': moki.fur || '-',
            'CLASS': moki.class || '-',
            'STR': moki.strength?.toFixed(2) || '0.00',
            'SPD': moki.speed?.toFixed(2) || '0.00',
            'DEF': moki.defense?.toFixed(2) || '0.00',
            'DEX': moki.dexterity?.toFixed(2) || '0.00',
            'FOR': moki.fortitude?.toFixed(2) || '0.00',
            'TOTAL': moki.totalStats?.toFixed(2) || '0.00',
            'ELIMS': moki.eliminations?.toFixed(2) || '0.00',
            'BALLS': moki.deposits?.toFixed(2) || '0.00',
            'WART': moki.wartDistance?.toFixed(2) || '0.00',
            'SCORE': moki.score?.toFixed(2) || '0.00',
            'W/R': moki.winRate ? moki.winRate.toFixed(2) + '%' : '-'
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Champions Stats");

        // Simple column widths
        const wscols = [
            { wch: 20 }, // NAME
            { wch: 12 }, // FUR
            { wch: 12 }, // CLASS
            { wch: 8 },  // STR
            { wch: 8 },  // SPD
            { wch: 8 },  // DEF
            { wch: 8 },  // DEX
            { wch: 8 },  // FOR
            { wch: 10 }, // TOTAL
            { wch: 10 }, // ELIMS
            { wch: 10 }, // BALLS
            { wch: 10 }, // WART
            { wch: 10 }, // SCORE
            { wch: 10 }, // W/R
        ];
        worksheet['!cols'] = wscols;

        XLSX.writeFile(workbook, "Champions_Stats.xlsx");
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
            let valA = a[sortField];
            let valB = b[sortField];

            // Case-insensitive sorting for strings
            if (typeof valA === 'string' && typeof valB === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

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
                <div className={styles.headerTopRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className={styles.title}>Champions</div>
                        <button
                            className={styles.exportButton}
                            onClick={handleExportExcel}
                            title="Export Champions Stats to Excel (.xlsx)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="18" height="24" fill="currentColor">
                                <path d="M64 48l112 0 0 88c0 39.8 32.2 72 72 72l88 0 0 240c0 8.8-7.2 16-16 16L64 464c-8.8 0-16-7.2-16-16L48 64c0-8.8 7.2-16 16-16zM224 67.9l92.1 92.1-68.1 0c-13.3 0-24-10.7-24-24l0-68.1zM64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-261.5c0-17-6.7-33.3-18.7-45.3L242.7 18.7C230.7 6.7 214.5 0 197.5 0L64 0zm99.2 265.6c-8-10.6-23-12.8-33.6-4.8s-12.8 23-4.8 33.6L162 344 124.8 393.6c-8 10.6-5.8 25.6 4.8 33.6s25.6 5.8 33.6-4.8L192 384 220.8 422.4c8 10.6 23 12.8 33.6 4.8s12.8-23 4.8-33.6L222 344 259.2 294.4c8-10.6 5.8-25.6-4.8-33.6s-25.6-5.8-33.6 4.8L192 304 163.2 265.6z" />
                            </svg>
                        </button>
                    </div>
                    <div className={styles.headerRight}>
                        <div className={styles.updateInfo}>The data is updated every 12 hours.</div>
                        <input
                            type="text"
                            placeholder="Search Moki..."
                            className={styles.searchBar}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
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
