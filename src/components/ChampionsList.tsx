/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchLiveData, MokiData } from '../utils/liveData';
import ChangelogModal from './ChangelogModal';
import MatchHistoryModal from './MatchHistoryModal';
import NextImage from 'next/image';
import Link from 'next/link';
import styles from './ChampionsList.module.css';
import { MOKI_CLASSES, MOKI_FURS } from '@/utils/constants';

type SortField = keyof MokiData;
type SortDirection = 'asc' | 'desc';

export default function ChampionsList() {
  const [championsData, setChampionsData] = useState<MokiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => {
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('champions_search');
      if (saved !== null) return saved;
    }
    return '';
  });

  // Sort state - default sort by score descending (leaderboard position)
  const [sortField, setSortField] = useState<SortField>(() => {
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('champions_sortField');
      if (saved !== null) return saved as SortField;
    }
    return 'score';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('champions_sortDirection');
      if (saved !== null) return saved as SortDirection;
    }
    return 'desc';
  });

  // Filter state
  const [filterClasses, setFilterClasses] = useState<string[]>(() => {
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('champions_filterClasses');
      if (saved !== null) return JSON.parse(saved);
    }
    return [];
  });
  const [showClassFilter, setShowClassFilter] = useState(false);

  const [filterFurs, setFilterFurs] = useState<string[]>(() => {
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('champions_filterFurs');
      if (saved !== null) return JSON.parse(saved);
    }
    return [];
  });
  const [showFurFilter, setShowFurFilter] = useState(false);

  // Mobile States
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [openMobileDropdown, setOpenMobileDropdown] = useState<
    'sort' | 'class' | 'fur' | null
  >(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [confirmExport, setConfirmExport] = useState(false);
  const [matchLimit, setMatchLimit] = useState<'ALL' | 10 | 20 | 30>(() => {
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('champions_matchLimit');
      if (saved !== null && saved !== 'ALL')
        return Number(saved) as 10 | 20 | 30;
    }
    return 'ALL';
  });
  const [historyTokenId, setHistoryTokenId] = useState<number | null>(null);
  const [historyName, setHistoryName] = useState<string | null>(null);



  const headerRef = useRef<HTMLTableSectionElement>(null);

  // Save state to sessionStorage
  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('champions_search', search);
      sessionStorage.setItem('champions_sortField', sortField);
      sessionStorage.setItem('champions_sortDirection', sortDirection);
      sessionStorage.setItem(
        'champions_filterClasses',
        JSON.stringify(filterClasses)
      );
      sessionStorage.setItem(
        'champions_filterFurs',
        JSON.stringify(filterFurs)
      );
      sessionStorage.setItem('champions_matchLimit', matchLimit.toString());
    }
  }, [search, sortField, sortDirection, filterClasses, filterFurs, matchLimit]);

  // Click Outside Handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (headerRef.current && !headerRef.current.contains(target)) {
        setShowClassFilter(false);
        setShowFurFilter(false);
      }

      // Mobile Click Outside
      if (
        openMobileDropdown &&
        !(event.target as Element).closest(`.${styles.mobileFilterContainer}`)
      ) {
        setOpenMobileDropdown(null);
      }

      // Export Confirmation Click Outside
      if (
        confirmExport &&
        !(event.target as Element).closest(`.${styles.confirmationContainer}`)
      ) {
        setConfirmExport(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMobileDropdown, confirmExport]);

  useEffect(() => {
    loadData();

    // Mobile detection
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1300);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const map = await fetchLiveData();
      if (map) {
        const championsArray = Object.values(map);
        setChampionsData(championsArray);
      } else {
        setError('Failed to load data.');
      }
    } catch (e) {
      console.error(e);
      setError('Error loading data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (field === 'class') return;
    if (field === 'fur') return;

    setShowClassFilter(false);
    setShowFurFilter(false);

    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Default to Descending for numeric fields (highest first),
      // Ascending for string fields like name (A-Z)
      const defaultAsc = ['name', 'fur', 'class'].includes(field);
      setSortDirection(defaultAsc ? 'asc' : 'desc');
    }
  };

  const toggleCard = (id: string) => {
    setExpandedCardId((prev) => (prev === id ? null : id));
  };

  const sortOptionsList: { label: string; value: SortField }[] = [
    { label: 'Name', value: 'name' },
    { label: 'Stars', value: 'stars' },
    { label: 'STR', value: 'strength' },
    { label: 'SPD', value: 'speed' },
    { label: 'DEF', value: 'defense' },
    { label: 'DEX', value: 'dexterity' },
    { label: 'FOR', value: 'fortitude' },
    { label: 'Total', value: 'totalStats' },
    { label: 'Train', value: 'train' },
    { label: 'Elims', value: 'eliminations' },
    { label: 'Wart', value: 'wartDistance' },
    { label: 'Balls', value: 'deposits' },
    { label: 'Score', value: 'score' },
    { label: 'Win Rate', value: 'winRate' },
  ];

  const handleExportExcel = async () => {
    if (sortedData.length === 0) return;

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Champions Stats');

    // Helper to get the right performance value based on active matchLimit
    const getPerfVal = (
      moki: (typeof sortedData)[0],
      field: 'eliminations' | 'deposits' | 'wartDistance' | 'score' | 'winRate'
    ): number | null => {
      if (matchLimit === 'ALL') {
        return moki[field] ?? null;
      }
      const avgKey =
        `avg${field.charAt(0).toUpperCase()}${field.slice(1)}${matchLimit}` as keyof typeof moki;
      return (moki[avgKey] as number) ?? null;
    };

    const limitLabel = matchLimit === 'ALL' ? '' : ` (L${matchLimit})`;

    // Define columns
    worksheet.columns = [
      { header: 'NAME', key: 'name', width: 20 },
      { header: 'FUR', key: 'fur', width: 12 },
      { header: 'CLASS', key: 'class', width: 12 },
      { header: 'STR', key: 'str', width: 8 },
      { header: 'SPD', key: 'spd', width: 8 },
      { header: 'DEF', key: 'def', width: 8 },
      { header: 'DEX', key: 'dex', width: 8 },
      { header: 'FOR', key: 'for', width: 8 },
      { header: 'TOTAL', key: 'total', width: 10 },
      { header: 'TRAIN', key: 'train', width: 10 },
      { header: `ELIMS${limitLabel}`, key: 'elims', width: 12 },
      { header: `WART${limitLabel}`, key: 'wart', width: 12 },
      { header: `BALLS${limitLabel}`, key: 'balls', width: 12 },
      { header: `SCORE${limitLabel}`, key: 'score', width: 12 },
      { header: `W/R${limitLabel}`, key: 'wr', width: 12 },
    ];

    // Add rows
    sortedData.forEach((moki) => {
      const elims = getPerfVal(moki, 'eliminations');
      const balls = getPerfVal(moki, 'deposits');
      const wart = getPerfVal(moki, 'wartDistance');
      const score = getPerfVal(moki, 'score');
      const wr = getPerfVal(moki, 'winRate');

      worksheet.addRow({
        name: moki.name,
        fur: moki.fur || '-',
        class: moki.class || '-',
        str: moki.strength?.toFixed(2) || '0.00',
        spd: moki.speed?.toFixed(2) || '0.00',
        def: moki.defense?.toFixed(2) || '0.00',
        dex: moki.dexterity?.toFixed(2) || '0.00',
        for: moki.fortitude?.toFixed(2) || '0.00',
        total: moki.totalStats?.toFixed(2) || '0.00',
        train: moki.train?.toFixed(2) || '0.00',
        elims: elims !== null ? elims.toFixed(2) : '-',
        balls: balls !== null ? balls.toFixed(2) : '-',
        wart: wart !== null ? wart.toFixed(2) : '-',
        score: score !== null ? score.toFixed(2) : '-',
        wr: wr !== null ? wr.toFixed(2) + '%' : '-',
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Trigger download
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const limitSuffix = matchLimit === 'ALL' ? '' : `_L${matchLimit}`;
    anchor.download = `Champions_Stats${limitSuffix}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleClass = (cls: string) => {
    if (cls === 'All Classes') {
      setFilterClasses([]);
    } else {
      setFilterClasses((prev) =>
        prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
      );
    }
  };

  const toggleFur = (fur: string) => {
    if (fur === 'All Furs') {
      setFilterFurs([]);
    } else {
      setFilterFurs((prev) =>
        prev.includes(fur) ? prev.filter((f) => f !== fur) : [...prev, fur]
      );
    }
  };

  // Map sort field to avg equivalent when a limit is active
  const getEffectiveSortField = (field: SortField): string => {
    if (matchLimit === 'ALL') return field;
    const avgMap: Partial<Record<SortField, string>> = {
      eliminations: `avgEliminations${matchLimit}`,
      deposits: `avgDeposits${matchLimit}`,
      wartDistance: `avgWartDistance${matchLimit}`,
      score: `avgScore${matchLimit}`,
      winRate: `avgWinRate${matchLimit}`,
    };
    return avgMap[field] || field;
  };

  const sortedData = useMemo(() => {
    let items = [...championsData];

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q));
    }

    if (filterClasses.length > 0) {
      items = items.filter((i) => i.class && filterClasses.includes(i.class));
    }

    if (filterFurs.length > 0) {
      items = items.filter((i) => i.fur && filterFurs.includes(i.fur));
    }

    const effectiveField = getEffectiveSortField(sortField);

    items.sort((a, b) => {
      let valA = (a as any)[effectiveField];
      let valB = (b as any)[effectiveField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA === undefined && valB === undefined) return 0;
      if (valA === undefined) return 1;
      if (valB === undefined) return -1;

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return items;
  }, [
    championsData,
    search,
    sortField,
    sortDirection,
    filterClasses,
    filterFurs,
    matchLimit,
  ]);

  const getStat = (moki: MokiData, baseProperty: string) => {
    if (matchLimit === 'ALL') return (moki as any)[baseProperty];
    const prop = `avg${baseProperty.charAt(0).toUpperCase() + baseProperty.slice(1)}${matchLimit}`;
    return (moki as any)[prop];
  };

  // Pre-compute leaderboard ranks based on score (full dataset, no filters)
  const rankMap = useMemo(() => {
    const map = new Map<string, number>();
    const ranked = [...championsData].sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    );
    ranked.forEach((moki, idx) => {
      const key = moki.id || moki.name;
      map.set(key, idx + 1);
    });
    return map;
  }, [championsData]);

  const renderHeader = (label: string, field: SortField, width?: string) => {
    const isClass = field === 'class';
    const isFur = field === 'fur';
    const isActive = sortField === field;

    const showFilter = isClass
      ? showClassFilter
      : isFur
        ? showFurFilter
        : false;
    const hasActiveFilter = isClass
      ? filterClasses.length > 0
      : isFur
        ? filterFurs.length > 0
        : false;

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
        onClick={() => (isClass || isFur ? toggleFilter() : handleSort(field))}
        style={{
          width,
          cursor: 'pointer',
          zIndex: (isClass || isFur) && showFilter ? 100 : 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            position: 'relative',
          }}
        >
          {label}

          {(isClass || isFur) && showFilter && (
            <div
              className={styles.dropdownMenu}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`${styles.dropdownItem} ${(isClass && filterClasses.length === 0) || (isFur && filterFurs.length === 0) ? styles.dropdownItemActive : ''}`}
                onClick={() =>
                  isClass ? toggleClass('All Classes') : toggleFur('All Furs')
                }
              >
                {isClass ? 'All Classes' : 'All Furs'}
              </div>
              {(isClass ? MOKI_CLASSES : MOKI_FURS).map((opt) => {
                const isActive = isClass
                  ? filterClasses.includes(opt)
                  : filterFurs.includes(opt);

                return (
                  <div
                    key={opt}
                    className={`${styles.dropdownItem} ${isActive ? styles.dropdownItemActive : ''}`}
                    onClick={() =>
                      isClass ? toggleClass(opt) : toggleFur(opt)
                    }
                  >
                    {opt}
                  </div>
                );
              })}
            </div>
          )}

          {!isClass && !isFur && (
            <span
              className={styles.sortIcon}
              style={{
                opacity: isActive ? 1 : 0.3,
                visibility: 'visible',
                color: isActive ? 'inherit' : '#000',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform:
                    isActive && sortDirection === 'asc'
                      ? 'rotate(180deg)'
                      : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          )}
          {(isClass || isFur) && (
            <span
              className={styles.sortIcon}
              style={{
                opacity: showFilter || hasActiveFilter ? 1 : 0.3,
                visibility: 'visible',
                color: showFilter || hasActiveFilter ? 'inherit' : '#000',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: showFilter ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          )}
        </div>
      </th>
    );
  };

  if (loading)
    return <div className={styles.loading}>Loading Champions Data...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTopRow}>
          <div className={styles.titleGroup}>
            <div className={styles.title}>
              {matchLimit !== 'ALL'
                ? `Champions - Last ${matchLimit} Matches`
                : 'Champions - SEASON 1'}
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.limitToggle}>
              {['ALL', 10, 20, 30].map((val) => (
                <button
                  key={val}
                  className={`${styles.limitBtn} ${matchLimit === val ? styles.limitBtnActive : ''}`}
                  onClick={() => setMatchLimit(val as 'ALL' | 10 | 20 | 30)}
                  title={`View ${val === 'ALL' ? 'Season 1' : 'Last ' + val} Match Performance`}
                >
                  {val === 'ALL' ? 'S1' : `LAST ${val}`}
                </button>
              ))}
            </div>

            <button
              className={styles.exportButton}
              onClick={() => setShowChangelog(true)}
              title="View Class Changes Log"
              style={{
                background: '#1ABF9E',
                color: 'white',
                borderColor: '#333',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </button>

            <div className={styles.confirmationContainer}>
              <button
                className={styles.exportButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmExport(!confirmExport);
                }}
                title="Export Champions Stats to Excel (.xlsx)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 384 512"
                  fill="currentColor"
                >
                  <path d="M64 48l112 0 0 88c0 39.8 32.2 72 72 72l88 0 0 240c0 8.8-7.2 16-16 16L64 464c-8.8 0-16-7.2-16-16L48 64c0-8.8 7.2-16 16-16zM224 67.9l92.1 92.1-68.1 0c-13.3 0-24-10.7-24-24l0-68.1zM64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-261.5c0-17-6.7-33.3-18.7-45.3L242.7 18.7C230.7 6.7 214.5 0 197.5 0L64 0zm99.2 265.6c-8-10.6-23-12.8-33.6-4.8s-12.8 23-4.8 33.6L162 344 124.8 393.6c-8 10.6-5.8 25.6 4.8 33.6s25.6 5.8 33.6-4.8L192 384 220.8 422.4c8 10.6 23 12.8 33.6 4.8s12.8-23 4.8-33.6L222 344 259.2 294.4c8-10.6 5.8-25.6-4.8-33.6s-25.6-5.8-33.6 4.8L192 304 163.2 265.6z" />
                </svg>
              </button>
              {confirmExport && (
                <div
                  className={styles.confirmationMenu}
                  style={{
                    background: '#5097FF',
                    width: '280px',
                    left: '0',
                    top: '45px',
                    right: 'auto',
                    textAlign: 'center',
                  }}
                >
                  <div className={styles.confirmationText}>
                    Would you like to download the current Champions list in
                    Excel?
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={`${styles.btnConfirm} ${styles.btnSuccess}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportExcel();
                        setConfirmExport(false);
                      }}
                    >
                      YES
                    </button>
                    <button
                      className={`${styles.btnConfirm} ${styles.btnCancel}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmExport(false);
                      }}
                    >
                      NO
                    </button>
                  </div>
                </div>
              )}
            </div>

            <input
              type="text"
              id="champs_srch_1"
              name="champs_srch_unq_123"
              placeholder="Search Moki..."
              className={styles.searchBar}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="new-password"
              spellCheck="false"
            />
          </div>
        </div>
        <div className={styles.updateInfo}>
          The data is updated every 5 minutes.
        </div>

        {/* Mobile Action Row (hidden on desktop) */}
        <div className={styles.actionRow}>
          <div className={styles.limitToggle}>
            {['ALL', 10, 20, 30].map((val) => (
              <button
                key={val}
                className={`${styles.limitBtn} ${matchLimit === val ? styles.limitBtnActive : ''}`}
                onClick={() => setMatchLimit(val as 'ALL' | 10 | 20 | 30)}
                title={`View ${val === 'ALL' ? 'Season 1' : 'Last ' + val} Match Performance`}
              >
                {val === 'ALL' ? 'S1' : val}
              </button>
            ))}
          </div>

          <button
            className={styles.exportButton}
            onClick={() => setShowChangelog(true)}
            title="View Class Changes Log"
            style={{
              background: '#1ABF9E',
              color: 'white',
              borderColor: '#333',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </button>

          <div className={styles.confirmationContainer}>
            <button
              className={styles.exportButton}
              onClick={(e) => {
                e.stopPropagation();
                setConfirmExport(!confirmExport);
              }}
              title="Export Champions Stats to Excel (.xlsx)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 384 512"
                fill="currentColor"
              >
                <path d="M64 48l112 0 0 88c0 39.8 32.2 72 72 72l88 0 0 240c0 8.8-7.2 16-16 16L64 464c-8.8 0-16-7.2-16-16L48 64c0-8.8 7.2-16 16-16zM224 67.9l92.1 92.1-68.1 0c-13.3 0-24-10.7-24-24l0-68.1zM64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-261.5c0-17-6.7-33.3-18.7-45.3L242.7 18.7C230.7 6.7 214.5 0 197.5 0L64 0zm99.2 265.6c-8-10.6-23-12.8-33.6-4.8s-12.8 23-4.8 33.6L162 344 124.8 393.6c-8 10.6-5.8 25.6 4.8 33.6s25.6 5.8 33.6-4.8L192 384 220.8 422.4c8 10.6 23 12.8 33.6 4.8s12.8-23 4.8-33.6L222 344 259.2 294.4c8-10.6 5.8-25.6-4.8-33.6s-25.6-5.8-33.6 4.8L192 304 163.2 265.6z" />
              </svg>
            </button>
            {confirmExport && (
              <div
                className={styles.confirmationMenu}
                style={{
                  background: '#5097FF',
                  width: '280px',
                  left: '0',
                  top: '45px',
                  right: 'auto',
                  textAlign: 'center',
                }}
              >
                <div className={styles.confirmationText}>
                  Would you like to download the current Champions list in
                  Excel?
                </div>
                <div className={styles.actions}>
                  <button
                    className={`${styles.btnConfirm} ${styles.btnSuccess}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportExcel();
                      setConfirmExport(false);
                    }}
                  >
                    YES
                  </button>
                  <button
                    className={`${styles.btnConfirm} ${styles.btnCancel}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmExport(false);
                    }}
                  >
                    NO
                  </button>
                </div>
              </div>
            )}
          </div>

          <input
            type="text"
            id="champs_srch_mob_2"
            name="champs_srch_mob_unq_123"
            placeholder="Search Moki..."
            className={styles.searchBar}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="new-password"
            spellCheck="false"
          />
        </div>

        {/* Mobile Toolbar */}
        <div className={styles.mobileToolbar}>
          {/* Sort Dropdown */}
          <div className={styles.mobileFilterContainer}>
            <button
              className={styles.mobileFilterButton}
              onClick={() =>
                setOpenMobileDropdown(
                  openMobileDropdown === 'sort' ? null : 'sort'
                )
              }
            >
              SORT BY...
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                style={{
                  transform:
                    openMobileDropdown === 'sort'
                      ? 'rotate(180deg)'
                      : 'rotate(0deg)',
                }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            {openMobileDropdown === 'sort' && (
              <ul className={styles.mobileFilterMenu}>
                {sortOptionsList.map((opt) => (
                  <li
                    key={opt.value}
                    onClick={() => {
                      handleSort(opt.value as SortField);
                      setOpenMobileDropdown(null);
                    }}
                    className={
                      sortField === opt.value ? styles.mobileFilterActive : ''
                    }
                  >
                    {opt.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Class Dropdown */}
          <div className={styles.mobileFilterContainer}>
            <button
              className={styles.mobileFilterButton}
              onClick={() =>
                setOpenMobileDropdown(
                  openMobileDropdown === 'class' ? null : 'class'
                )
              }
            >
              CLASSES
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                style={{
                  transform:
                    openMobileDropdown === 'class'
                      ? 'rotate(180deg)'
                      : 'rotate(0deg)',
                }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            {openMobileDropdown === 'class' && (
              <ul className={styles.mobileFilterMenu}>
                <li
                  onClick={() => toggleClass('All Classes')}
                  className={
                    filterClasses.length === 0 ? styles.mobileFilterActive : ''
                  }
                >
                  All Classes
                </li>
                {MOKI_CLASSES.map((opt) => (
                  <li
                    key={opt}
                    onClick={() => toggleClass(opt)}
                    className={
                      filterClasses.includes(opt)
                        ? styles.mobileFilterActive
                        : ''
                    }
                  >
                    {opt}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fur Dropdown */}
          <div className={styles.mobileFilterContainer}>
            <button
              className={styles.mobileFilterButton}
              onClick={() =>
                setOpenMobileDropdown(
                  openMobileDropdown === 'fur' ? null : 'fur'
                )
              }
            >
              FURS
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                style={{
                  transform:
                    openMobileDropdown === 'fur'
                      ? 'rotate(180deg)'
                      : 'rotate(0deg)',
                }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            {openMobileDropdown === 'fur' && (
              <ul className={styles.mobileFilterMenu}>
                <li
                  onClick={() => toggleFur('All Furs')}
                  className={
                    filterFurs.length === 0 ? styles.mobileFilterActive : ''
                  }
                >
                  All Furs
                </li>
                {MOKI_FURS.map((opt) => (
                  <li
                    key={opt}
                    onClick={() => toggleFur(opt)}
                    className={
                      filterFurs.includes(opt) ? styles.mobileFilterActive : ''
                    }
                  >
                    {opt}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Table View - ONLY RENDER IF NOT MOBILE */}
      {!isMobile && (
        <div className={styles.tableContainer}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead ref={headerRef}>
                <tr>
                  <th
                    className={styles.th}
                    style={{ textAlign: 'center', cursor: 'default' }}
                  >
                    #
                  </th>
                  {renderHeader('NAME', 'name')}
                  {renderHeader('FUR', 'fur')}
                  {renderHeader('CLASS', 'class')}
                  {renderHeader('★', 'stars')}
                  {renderHeader('STR', 'strength')}
                  {renderHeader('SPD', 'speed')}
                  {renderHeader('DEF', 'defense')}
                  {renderHeader('DEX', 'dexterity')}
                  {renderHeader('FOR', 'fortitude')}
                  {renderHeader('TOTAL', 'totalStats')}
                  {renderHeader('TRAIN', 'train')}
                  {renderHeader('ELIMS', 'eliminations')}
                  {renderHeader('WART', 'wartDistance')}
                  {renderHeader('BALLS', 'deposits')}
                  {renderHeader('SCORE', 'score')}
                  {renderHeader('W/R', 'winRate')}
                </tr>
              </thead>
              <tbody>
                {sortedData.length > 0 ? (
                  sortedData.map((moki, idx) => (
                    <tr key={moki.id || moki.name + idx} className={styles.tr}>
                      <td
                        className={styles.td}
                        style={{ textAlign: 'center', fontWeight: 700 }}
                      >
                        {rankMap.get(moki.id || moki.name) || '-'}
                      </td>
                      <td className={styles.td}>
                        <div className={styles.tdName}>
                          {moki.imageUrl && (
                            <div
                              style={{
                                position: 'relative',
                                width: 40,
                                height: 40,
                                flexShrink: 0,
                              }}
                            >
                              <NextImage
                                src={moki.imageUrl}
                                alt={moki.name}
                                width={40}
                                height={40}
                                className={styles.mokiImage}
                                style={{ objectFit: 'contain' }}
                              />
                            </div>
                          )}
                          <Link
                            href={`/moki/${encodeURIComponent(moki.name)}`}
                            style={{
                              textDecoration: 'none',
                              color: 'inherit',
                              borderBottom: '1px solid currentColor',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {moki.name}
                          </Link>
                          {moki.tokenId && (
                            <button
                              className={styles.linkButton}
                              title="View Match History"
                              onClick={(e) => {
                                e.stopPropagation();
                                setHistoryTokenId(moki.tokenId!);
                                setHistoryName(moki.name);
                              }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className={styles.td}>{moki.fur}</td>
                      <td className={styles.td}>{moki.class}</td>
                      <td className={styles.td}>{moki.stars}</td>
                      <td className={styles.td}>
                        {moki.strength?.toFixed(2) || '-'}
                      </td>
                      <td className={styles.td}>
                        {moki.speed?.toFixed(2) || '-'}
                      </td>
                      <td className={styles.td}>
                        {moki.defense?.toFixed(2) || '-'}
                      </td>
                      <td className={styles.td}>
                        {moki.dexterity?.toFixed(2) || '-'}
                      </td>
                      <td className={styles.td}>
                        {moki.fortitude?.toFixed(2) || '-'}
                      </td>
                      <td className={styles.td}>
                        {moki.totalStats?.toFixed(2) || '-'}
                      </td>
                      <td className={styles.td}>
                        {moki.train?.toFixed(2) || '-'}
                      </td>
                      <td className={styles.td}>
                        {getStat(moki, 'eliminations')?.toFixed(2) || '-'}
                      </td>
                      <td className={styles.td}>
                        {getStat(moki, 'wartDistance')?.toFixed(2) || '-'}
                      </td>
                      <td className={styles.td}>
                        {getStat(moki, 'deposits')?.toFixed(2) || '-'}
                      </td>
                      <td className={styles.td}>
                        {getStat(moki, 'score')?.toFixed(2) || '-'}
                      </td>
                      <td className={styles.td}>
                        {getStat(moki, 'winRate')
                          ? getStat(moki, 'winRate')?.toFixed(2) + '%'
                          : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={17}>
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
      )}

      {/* Mobile Card List View - ONLY RENDER IF MOBILE */}
      {isMobile && (
        <div className={styles.mobileCardList}>
          {sortedData.length > 0 ? (
            sortedData.map((moki, idx) => {
              const mokiUniqueId = moki.id || `moki-${idx}-${moki.name}`;
              const isExpanded = expandedCardId === mokiUniqueId;
              return (
                <div
                  key={mokiUniqueId}
                  className={`${styles.mobileCard} ${isExpanded ? styles.expanded : ''}`}
                >
                  <div
                    className={styles.mobileCardHeader}
                    onClick={() => toggleCard(mokiUniqueId)}
                  >
                    {moki.imageUrl && (
                      <NextImage
                        src={moki.imageUrl}
                        alt={moki.name}
                        width={48}
                        height={48}
                        className={styles.mobileCardImage}
                      />
                    )}
                    <div className={styles.mobileCardName}>
                      <span className={styles.mobileRank}>
                        #{rankMap.get(moki.id || moki.name) || '-'}
                      </span>
                      <Link
                        href={`/moki/${encodeURIComponent(moki.name)}`}
                        style={{
                          textDecoration: 'none',
                          color: 'inherit',
                          borderBottom: '1px solid currentColor',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {moki.name}
                      </Link>
                    </div>
                    <div className={styles.expandIcon}>
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      className={styles.mobileCardBody}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className={styles.statBlock}
                        style={{ marginBottom: '0.75rem' }}
                      >
                        <div className={styles.statTitle}>Identity</div>
                        <div className={styles.statRow}>
                          <span className={styles.statLabel}>CLASS</span>
                          <span className={styles.statValue}>{moki.class}</span>
                        </div>
                        <div className={styles.statRow}>
                          <span className={styles.statLabel}>FUR</span>
                          <span className={styles.statValue}>{moki.fur}</span>
                        </div>
                        <div className={styles.statRow}>
                          <span className={styles.statLabel}>STARS</span>
                          <span className={styles.statValue}>
                            {moki.stars} ★
                          </span>
                        </div>
                      </div>

                      {moki.tokenId && (
                        <button
                          className={styles.marketButton}
                          style={{ marginBottom: '1rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryTokenId(moki.tokenId!);
                            setHistoryName(moki.name);
                          }}
                        >
                          Match History
                        </button>
                      )}

                      <div className={styles.statsGrid}>
                        <div className={styles.statBlock}>
                          <div className={styles.statTitle}>Base Stats</div>
                          <div className={styles.statRow}>
                            <span className={styles.statLabel}>STR</span>
                            <span className={styles.statValue}>
                              {moki.strength?.toFixed(1)}
                            </span>
                          </div>
                          <div className={styles.statRow}>
                            <span className={styles.statLabel}>SPD</span>
                            <span className={styles.statValue}>
                              {moki.speed?.toFixed(1)}
                            </span>
                          </div>
                          <div className={styles.statRow}>
                            <span className={styles.statLabel}>DEF</span>
                            <span className={styles.statValue}>
                              {moki.defense?.toFixed(1)}
                            </span>
                          </div>
                          <div className={styles.statRow}>
                            <span className={styles.statLabel}>DEX</span>
                            <span className={styles.statValue}>
                              {moki.dexterity?.toFixed(1)}
                            </span>
                          </div>
                          <div className={styles.statRow}>
                            <span className={styles.statLabel}>FOR</span>
                            <span className={styles.statValue}>
                              {moki.fortitude?.toFixed(1)}
                            </span>
                          </div>
                          <div className={styles.statRow}>
                            <span className={styles.statLabel}>TOTAL</span>
                            <span className={styles.statValue}>
                              {moki.totalStats?.toFixed(1)}
                            </span>
                          </div>
                          <div className={styles.statRow}>
                            <span className={styles.statLabel}>TRAIN</span>
                            <span className={styles.statValue}>
                              {moki.train?.toFixed(1) || '0.0'}
                            </span>
                          </div>
                        </div>

                        <div className={styles.statBlock}>
                          <div className={styles.statTitle}>Performance</div>
                          <div className={styles.statRow}>
                            <span className={styles.statLabel}>ELIMS</span>
                            <span className={styles.statValue}>
                              {getStat(moki, 'eliminations')?.toFixed(1) || '-'}
                            </span>
                          </div>
                          <div className={styles.statRow}>
                            <span className={styles.statLabel}>WART</span>
                            <span className={styles.statValue}>
                              {getStat(moki, 'wartDistance')?.toFixed(0) || '-'}
                            </span>
                          </div>
                          <div className={styles.statRow}>
                            <span className={styles.statLabel}>BALLS</span>
                            <span className={styles.statValue}>
                              {getStat(moki, 'deposits')?.toFixed(1) || '-'}
                            </span>
                          </div>
                          <div className={styles.statRow}>
                            <span className={styles.statLabel}>SCORE</span>
                            <span className={styles.statValue}>
                              {getStat(moki, 'score')?.toFixed(0) || '-'}
                            </span>
                          </div>
                          <div className={styles.statRow}>
                            <span className={styles.statLabel}>W/R</span>
                            <span className={styles.statValue}>
                              {getStat(moki, 'winRate')
                                ? getStat(moki, 'winRate')?.toFixed(1) + '%'
                                : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className={styles.noResults}>
              No Mokis found!{' '}
              {championsData.length === 0
                ? '(Dataset empty)'
                : '(No matches)'}
            </div>
          )}
        </div>
      )}
      {showChangelog && (
        <ChangelogModal onClose={() => setShowChangelog(false)} />
      )}
      {historyTokenId && (
        <MatchHistoryModal
          tokenId={historyTokenId}
          mokiName={historyName}
          onClose={() => {
            setHistoryTokenId(null);
            setHistoryName(null);
          }}
        />
      )}
    </div>
  );
}
