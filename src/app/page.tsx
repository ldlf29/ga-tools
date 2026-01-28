'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import useSWR from 'swr';
import CardGrid from '@/components/CardGrid';
import FilterSidebar, { FilterState } from '@/components/FilterSidebar';
import LineupBuilder from '@/components/LineupBuilder';
import { fetchLiteCollection, EnhancedCard, getCardGroupKey } from '@/utils/cardService';
import styles from './page.module.css';
import Toast, { ToastMessage } from '@/components/Toast';
import MyLineups, { SavedLineup } from '@/components/MyLineups';
// import { matchesFilter } from '@/utils/filterUtils'; // Moved to Worker
import ChampionsList from '@/components/ChampionsList';

export default function Home() {
  /* State */
  const [activeTab, setActiveTab] = useState<'builder' | 'lineups' | 'champions'>('builder');
  const [savedLineups, setSavedLineups] = useState<SavedLineup[]>([]);
  const [lineup, setLineup] = useState<EnhancedCard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const lastToastTimeRef = useRef<{ [key: string]: number }>({});

  // SWR for instant loading + background refresh
  const { data: allCards = [], isLoading, mutate } = useSWR('liteCollection', fetchLiteCollection, {
    revalidateOnFocus: false,
    revalidateIfStale: true,
    fallbackData: []
  });

  // Handle Hydration: Load cache only after mount
  useEffect(() => {
    const cached = localStorage.getItem('cachedCards');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          mutate(parsed, false); // Update current data without re-fetching
        }
      } catch (e) {
        console.error("Failed to load cached cards", e);
      }
    }
  }, [mutate]);

  // Keep localStorage in sync for next load
  useEffect(() => {
    if (allCards && allCards.length > 0) {
      localStorage.setItem('cachedCards', JSON.stringify(allCards));
    }
  }, [allCards]);

  /* Controls */
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [mokiDropdownOpen, setMokiDropdownOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Scroll to Top Logic
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('grandArenaLineups');
    if (saved) {
      try {
        setSavedLineups(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved lineups", e);
      }
    }
  }, []);

  // Save to LocalStorage whenever savedLineups changes
  useEffect(() => {
    localStorage.setItem('grandArenaLineups', JSON.stringify(savedLineups));
  }, [savedLineups]);

  // Handle Refresh explicitly
  const handleRefresh = async () => {
    await mutate();
    addToast("Data updated!", 'success');
  };

  const addToast = (text: string, type: 'error' | 'success' | 'warning' | 'suggestion', force: boolean = false) => {
    if (!notificationsEnabled && !force) return;
    const now = Date.now();
    const lastTime = lastToastTimeRef.current[text] || 0;
    if (now - lastTime < 5000) return;
    lastToastTimeRef.current[text] = now;
    const id = Date.now();
    setToasts(prev => [...prev, { id, text, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const [filters, setFilters] = useState<FilterState>({
    rarity: [],
    cardType: 'ALL',
    schemeName: [],
    fur: [],
    stars: [],
    customClass: [],
    specialization: [],
    traits: [],
    insertionOrder: []
  });

  const [allLineupsOpen, setAllLineupsOpen] = useState(true);
  const [favoritesOpen, setFavoritesOpen] = useState(true);

  const handleConnect = () => {
    // Wallet connection available in PRO version
  };

  const handleAddToLineup = (card: EnhancedCard) => {
    const isScheme = card.cardType === 'SCHEME';
    const currentSchemes = lineup.filter(c => c.cardType === 'SCHEME').length;
    if (isScheme && currentSchemes >= 1) {
      addToast("Only 1 Scheme Card per Lineup!", 'error');
      return;
    }

    const currentMokis = lineup.filter(c => c.cardType !== 'SCHEME').length;
    if (!isScheme && currentMokis >= 4) {
      addToast("Maximum 4 Mokis per Lineup!", 'error');
      return;
    }

    if (!isScheme) {
      const hasSameMoki = lineup.some(c => c.cardType !== 'SCHEME' && c.name === card.name);
      if (hasSameMoki) {
        addToast("Only 1 Moki of the same type per Lineup!", 'error');
        return;
      }
    }

    setLineup([...lineup, card]);
  };

  const getUniqueName = (baseName: string, existingNames: string[]) => {
    let name = baseName;
    let counter = 1;
    while (existingNames.includes(name)) {
      name = `${baseName} (${counter})`;
      counter++;
    }
    return name;
  };

  const handleSaveLineup = (name: string) => {
    if (!name || name.trim() === "") {
      addToast("Please name your lineup before saving!", 'error');
      return;
    }

    const trimmedName = name.trim();
    const existingNames = savedLineups.map(l => l.name);
    const uniqueName = getUniqueName(trimmedName, existingNames);

    const newLineup: SavedLineup = {
      id: Date.now(),
      name: uniqueName,
      cards: lineup,
      createdAt: Date.now()
    };

    setSavedLineups(prev => [newLineup, ...prev]);
    setLineup(lineup.filter(c => c.locked));
    addToast("Lineup Saved Successfully!", 'success');
  };

  const handleDeleteLineup = (id: number) => {
    setSavedLineups(prev => prev.filter(l => l.id !== id));
    addToast("Lineup Deleted", 'success');
  };

  const handleRenameLineup = (id: number, newName: string) => {
    if (!newName || newName.trim() === "") return;
    const existingNames = savedLineups.filter(l => l.id !== id).map(l => l.name);
    const uniqueName = getUniqueName(newName.trim(), existingNames);
    setSavedLineups(prev => prev.map(l => l.id === id ? { ...l, name: uniqueName } : l));
    addToast("Lineup Renamed", 'success');
  };

  const handleToggleFavorite = (id: number) => {
    setSavedLineups(prev => prev.map(l => l.id === id ? { ...l, isFavorite: !l.isFavorite, favoritedAt: !l.isFavorite ? Date.now() : undefined } : l));
  };

  const handleRateLineup = (id: number, rating: number) => {
    setSavedLineups(prev => prev.map(l => l.id === id ? { ...l, rating } : l));
  };

  const handleBulkDelete = (ids: number[]) => {
    setSavedLineups(prev => prev.filter(l => !ids.includes(l.id)));
  };

  const handleUpdateBackground = (id: number, backgroundId: string) => {
    setSavedLineups(prev => prev.map(l => l.id === id ? { ...l, backgroundId } : l));
  };

  const handleRemoveFilter = (key: keyof FilterState, value: string | number) => {
    setFilters(prev => {
      const currentValues = prev[key];
      let newValues = currentValues;
      if (key === 'stars') {
        newValues = [];
      } else if (Array.isArray(currentValues)) {
        newValues = (currentValues as any[]).filter(v => v !== value);
      }
      let newOrder = prev.insertionOrder ? [...prev.insertionOrder] : [];
      const orderKey = `${key}:${value}`;
      newOrder = newOrder.filter(k => k !== orderKey);
      return { ...prev, [key]: newValues, insertionOrder: newOrder };
    });
  };

  const handleRemoveFromLineup = (index: number) => {
    const newLineup = [...lineup];
    newLineup.splice(index, 1);
    setLineup(newLineup);
  };

  const handleClearLineup = () => setLineup([]);

  const handleSuggestFilters = (newFilters: Partial<FilterState>) => {
    const preserveEpicLegendary = filters.onlyEpicLegendary;
    const cleared: FilterState = {
      rarity: preserveEpicLegendary ? ['Epic', 'Legendary'] : [],
      cardType: 'ALL',
      schemeName: [],
      fur: [],
      stars: [],
      customClass: [],
      specialization: [],
      traits: [],
      insertionOrder: [],
      onlyEpicLegendary: preserveEpicLegendary
    };
    const newOrder: string[] = [];
    Object.entries(newFilters).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach(val => newOrder.push(`${key}:${val}`));
    });
    setFilters({ ...cleared, ...newFilters, insertionOrder: newOrder });
    addToast("Suggestion Applied!", 'success');
  };

  /* Web Worker for Filtering */
  const [filteredCards, setFilteredCards] = useState<EnhancedCard[]>([]);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize Worker
    workerRef.current = new Worker(new URL('../workers/filter.worker.ts', import.meta.url));

    // Listen for results
    workerRef.current.onmessage = (event: MessageEvent) => {
      setFilteredCards(event.data);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Post message to worker when inputs change
  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ allCards, filters, searchQuery });
    }
  }, [allCards, filters, searchQuery]);

  /* Drawer State */
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileBuilderOpen, setMobileBuilderOpen] = useState(false);

  /* Helper to close drawers */
  const closeDrawers = () => {
    setMobileFiltersOpen(false);
    setMobileBuilderOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <main className={styles.main}>
      {/* Backdrop for Mobile Drawers & Menu */}
      <div
        className={`${styles.drawerOverlay} ${mobileFiltersOpen || mobileBuilderOpen || mobileMenuOpen ? styles.drawerOverlayVisible : ''}`}
        onClick={closeDrawers}
      />

      {/* Mobile Navigation Drawer */}
      <div className={`${styles.navContainer} ${styles.mobileOnly} ${mobileMenuOpen ? styles.navContainerVisible : ''}`}>
        <div className={`${styles.drawerHeader} ${styles.mobileOnly}`}>
          <img src="/ga-logo.png" alt="Grand Arena" className={styles.drawerLogo} />
          <button
            className={styles.closeMenuButton}
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <nav className={styles.navTabs}>
          <button
            className={`${styles.navTab} ${activeTab === 'builder' ? styles.activeTab : ''}`}
            onClick={() => { setActiveTab('builder'); closeDrawers(); }}
          >
            Builder
          </button>
          <button
            className={`${styles.navTab} ${activeTab === 'lineups' ? styles.activeTab : ''}`}
            onClick={() => { setActiveTab('lineups'); closeDrawers(); }}
          >
            My Lineups
          </button>
          <button
            className={`${styles.navTab} ${activeTab === 'champions' ? styles.activeTab : ''}`}
            onClick={() => { setActiveTab('champions'); closeDrawers(); }}
          >
            Champions
          </button>
        </nav>

        {/* Auth wrapper for mobile drawer - only contains connect wallet */}
        <div className={styles.authWrapper}>
          <button
            className={styles.connectButton}
            style={{ opacity: 0.7, cursor: 'not-allowed' }}
            onClick={handleConnect}
            title="Coming soon!"
          >
            Connect Wallet
          </button>
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      <div className={`${styles.mobileDrawer} ${styles.filterDrawer} ${styles.mobileOnly} ${mobileFiltersOpen ? styles.filterDrawerOpen : ''}`}>
        <FilterSidebar filters={filters} onFilterChange={setFilters} />
      </div>

      {/* Mobile Builder Drawer */}
      <div className={`${styles.mobileDrawer} ${styles.builderDrawer} ${styles.mobileOnly} ${mobileBuilderOpen ? styles.builderDrawerOpen : ''}`}>
        <LineupBuilder
          lineup={lineup}
          onRemove={handleRemoveFromLineup}
          onClear={handleClearLineup}
          onSave={handleSaveLineup}
          onUpdate={setLineup}
          onSuggestFilters={handleSuggestFilters}
          onShowMessage={(msg) => addToast(msg, 'suggestion', true)}
        />
      </div>

      <header className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.headerLeft}>
            <img src="/ga-logo.png" alt="Grand Arena Builder" className={styles.logo} />

            {/* Desktop Navigation */}
            <nav className={`${styles.navContainer} ${styles.desktopOnly}`}>
              <div className={styles.navTabs}>
                <button
                  className={`${styles.navTab} ${activeTab === 'builder' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('builder')}
                >
                  Builder
                </button>
                <button
                  className={`${styles.navTab} ${activeTab === 'lineups' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('lineups')}
                >
                  My Lineups
                </button>
                <button
                  className={`${styles.navTab} ${activeTab === 'champions' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('champions')}
                >
                  Champions
                </button>
              </div>
            </nav>
          </div>

          {/* Desktop Controls */}
          <div className={`${styles.authWrapper} ${styles.desktopOnly}`}>
            <div className={styles.headerControls}>
              <div className={styles.mokiButtonContainer}>
                <button
                  onClick={() => {
                    if (!mokiDropdownOpen) {
                      setMokiDropdownOpen(true);
                      setTimeout(() => setMokiDropdownOpen(false), 1500);
                    }
                  }}
                  className={styles.mokiButton}
                  title="Dorime"
                >
                  <img src="/moki-praying.png" alt="Moki" width={56} height={56} />
                </button>
                <div className={`${styles.mokiDropdown} ${mokiDropdownOpen ? styles.mokiDropdownOpen : ''}`}>
                  <img src="/count.png" alt="Count" width={24} height={24} />
                </div>
              </div>


              <button onClick={() => setNotificationsEnabled(!notificationsEnabled)} className={styles.iconButton} title={notificationsEnabled ? "Disable Notifications" : "Enable Notifications"}>
                {notificationsEnabled ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path><path d="M18 8a6 6 0 0 0-9.33-5"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                )}
              </button>
            </div>

            <button
              className={styles.connectButton}
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
              onClick={handleConnect}
              title="Coming soon!"
            >
              Connect Wallet
            </button>
          </div>

          {/* Mobile Header Right Controls: Notifications + Toggle */}
          <div className={`${styles.headerRightMobile} ${styles.mobileOnly}`}>
            <div className={styles.mokiButtonContainer}>
              <button
                onClick={() => {
                  if (!mokiDropdownOpen) {
                    setMokiDropdownOpen(true);
                    setTimeout(() => setMokiDropdownOpen(false), 1500);
                  }
                }}
                className={styles.mokiButton}
                title="Dorime"
              >
                <img src="/moki-praying.png" alt="Moki" width={44} height={44} />
              </button>
              <div className={`${styles.mokiDropdown} ${mokiDropdownOpen ? styles.mokiDropdownOpen : ''}`}>
                <img src="/count.png" alt="Count" width={20} height={20} />
              </div>
            </div>

            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={styles.iconButton}
              aria-label="Toggle Notifications"
            >
              {notificationsEnabled ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path><path d="M18 8a6 6 0 0 0-9.33-5"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              )}
            </button>

            <button
              className={`${styles.menuToggle} ${mobileMenuOpen ? styles.menuToggleActive : ''}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Menu"
            >
              <div className={styles.hamburgerLine} />
              <div className={styles.hamburgerLine} />
              <div className={styles.hamburgerLine} />
            </button>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <div style={{ display: activeTab === 'builder' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>

          {/* Mobile Floating Action Buttons */}
          <div className={styles.fabContainer}>
            <button className={`${styles.fabButton} ${styles.fabFilters}`} onClick={() => setMobileFiltersOpen(true)}>
              {/* Filter Icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            </button>
            <button className={`${styles.fabButton} ${styles.fabBuilder}`} onClick={() => setMobileBuilderOpen(true)}>
              {/* Hammer Icon PNG from public */}
              <img src="/hammer.png" alt="Hammer" width={32} height={32} style={{ filter: 'brightness(0) invert(1)' }} />
            </button>
          </div>

          <div className={styles.mainLayout}>
            {/* Column 1: FilterSidebar (Desktop only) */}
            <div className={styles.desktopOnly}>
              <FilterSidebar filters={filters} onFilterChange={setFilters} />
            </div>

            {/* Column 2: CardGrid */}
            <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <CardGrid
                cards={filteredCards}
                onAddCard={handleAddToLineup}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                currentLineup={lineup}
                filters={filters}
                onRemoveFilter={handleRemoveFilter}
              />
            </div>

            {/* Column 3: LineupBuilder (Desktop only) */}
            <div className={styles.desktopOnly}>
              <LineupBuilder
                lineup={lineup}
                onRemove={handleRemoveFromLineup}
                onClear={handleClearLineup}
                onSave={handleSaveLineup}
                onUpdate={setLineup}
                onSuggestFilters={handleSuggestFilters}
                onShowMessage={(msg) => addToast(msg, 'suggestion', true)}
              />
            </div>
          </div>
        </div>

        <div style={{ display: activeTab === 'lineups' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Mobile Floating Action Buttons */}
          <div className={styles.fabContainer}>
            <button className={`${styles.fabButton} ${styles.fabFilters}`} onClick={() => setMobileFiltersOpen(true)}>
              {/* Filter Icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            </button>
          </div>

          <div className={styles.mainLayoutLineups}>
            {/* Column 1: Sidebar */}
            <div className={styles.desktopOnly}>
              <FilterSidebar filters={filters} onFilterChange={setFilters} />
            </div>

            {/* Column 2: Lineups List */}
            <div style={{ gridColumn: '2 / span 2', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <MyLineups
                lineups={savedLineups}
                onDelete={handleDeleteLineup}
                onRename={handleRenameLineup}
                onToggleFavorite={handleToggleFavorite}
                onRate={handleRateLineup}
                onUpdateBackground={handleUpdateBackground}
                onBulkDelete={handleBulkDelete}
                onError={(msg) => addToast(msg, 'error')}
                filters={filters}
                onRemoveFilter={handleRemoveFilter}
                favoritesOpen={favoritesOpen}
                setFavoritesOpen={setFavoritesOpen}
                allLineupsOpen={allLineupsOpen}
                setAllLineupsOpen={setAllLineupsOpen}
              />
            </div>
          </div>
        </div>

        <div style={{ display: activeTab === 'champions' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ padding: '0 2rem' }}>
            <ChampionsList />
          </div>
        </div>
      </div>

      <button
        className={`${styles.scrollTopButton} ${showScrollTop ? styles.scrollTopButtonVisible : ''}`}
        onClick={scrollToTop}
        title="Scroll to Top"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
      </button>

      {
        isLoading && allCards.length === 0 && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className={styles.spinner} style={{ width: '50px', height: '50px', border: '5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ color: '#fff', marginLeft: '1rem' }}>Loading Cards Catalog...</p>
          </div>
        )
      }

      <Toast messages={toasts} onClose={removeToast} />
    </main >
  );
}
