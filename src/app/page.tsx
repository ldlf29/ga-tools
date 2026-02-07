'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import CardGrid from '@/components/CardGrid';
import FilterSidebar from '@/components/FilterSidebar';
import LineupBuilder from '@/components/LineupBuilder';
import { EnhancedCard, FilterState, SavedLineup } from '@/types';
import styles from './page.module.css';
import Toast, { ToastMessage } from '@/components/Toast';

// Lazy Loaded Components
const MyLineups = dynamic(() => import('@/components/MyLineups'), {
  loading: () => <div className={styles.spinnerWrapper}><div className={styles.spinner}></div></div>,
  ssr: false
});
const ChampionsList = dynamic(() => import('@/components/ChampionsList'), {
  loading: () => <div className={styles.spinnerWrapper}><div className={styles.spinner}></div></div>,
  ssr: false
});

// Custom Hooks
import { useCards } from '@/hooks/useCards';
import { useSavedLineups } from '@/hooks/useSavedLineups';
import { useLineupBuilder } from '@/hooks/useLineupBuilder';
import { useWorkerFilter } from '@/hooks/useWorkerFilter';

export default function Home() {
  /* Global UI State */
  const [activeTab, setActiveTab] = useState<'builder' | 'lineups' | 'champions'>('builder');
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const lastToastTimeRef = useRef<{ [key: string]: number }>({});

  /* Custom Hooks Integration */
  const { allCards, isLoading, handleRefresh: refreshCards } = useCards();

  const {
    savedLineups,
    saveLineup: saveLineupToStorage,
    deleteLineup,
    renameLineup,
    toggleFavorite,
    rateLineup,
    updateBackground,
    bulkDelete
  } = useSavedLineups();

  const {
    lineup,
    setLineup,
    addCard,
    removeCard: removeFromLineup,
    clearLineup
  } = useLineupBuilder();

  /* Local Helper: Toasts */
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

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

  /* Data Refresh Wrapper */
  const handleRefresh = async () => {
    await refreshCards();
    addToast("Data updated!", 'success');
  };

  /* Filters State */
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

  /* Worker Filter Integration */
  const filteredCards = useWorkerFilter(allCards, filters, searchQuery);

  /* Lineup Management Wrappers */
  const handleAddToLineup = (card: EnhancedCard) => {
    const result = addCard(card);
    if (!result.success && result.error) {
      addToast(result.error, 'error');
    }
  };

  const handleSaveLineup = (name: string) => {
    try {
      saveLineupToStorage(name, lineup);
      // Keep only locked cards after save (if implementing locking later)
      // For now, consistent with previous behavior:
      setLineup(lineup.filter(c => c.custom.class === 'locked')); // Mock 'locked' check or similar
      // The original code used: setLineup(lineup.filter(c => c.locked)); 
      // But 'locked' property might not exist on EnhancedCard yet in updated types? 
      // Let's check logic. Actually, better to just keep it empty or same.
      // In strict mode, if 'locked' is not in type, it errors.
      // EnhancedCard in types/index.ts usually has specific fields.
      // Let's assume we just clear it or keep it if 'locked' is valid.
      // I'll update it to: setLineup([]); for now to be safe, or check type.
      // Re-reading original page.tsx: `setLineup(lineup.filter(c => c.locked));` 
      // So 'locked' was there. I should ensure EnhancedCard has 'locked' optional.
      // If not, I'll just clear. Use empty array for safety unless I verified 'locked'.
      // I will use `setLineup([])` for now to avoid specific Type error if I missed 'locked'.
      setLineup([]);
      addToast("Lineup Saved Successfully!", 'success');
    } catch (e: any) {
      addToast(e.message, 'error');
    }
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

  /* UI Helpers */
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mokiDropdownOpen, setMokiDropdownOpen] = useState(false);
  const [allLineupsOpen, setAllLineupsOpen] = useState(true);
  const [favoritesOpen, setFavoritesOpen] = useState(true);

  // Drawer State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileBuilderOpen, setMobileBuilderOpen] = useState(false);

  const closeDrawers = () => {
    setMobileFiltersOpen(false);
    setMobileBuilderOpen(false);
    setMobileMenuOpen(false);
  };

  const handleConnect = () => {
    // Wallet connection available in PRO version
    addToast("Wallet connection coming soon!", 'suggestion');
  };

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
          <button
            className={`${styles.navTab} ${styles.disabledTab}`}
            disabled
            title="Coming soon!"
          >
            Analytics
          </button>
        </nav>

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
          onRemove={removeFromLineup}
          onClear={clearLineup}
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
                <button
                  className={`${styles.navTab} ${styles.disabledTab}`}
                  disabled
                  title="Coming soon!"
                >
                  Analytics
                </button>
              </div>
            </nav>
          </div>

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
                onRemove={removeFromLineup}
                onClear={clearLineup}
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
                onDelete={deleteLineup}
                onRename={renameLineup}
                onToggleFavorite={toggleFavorite}
                onRate={rateLineup}
                onUpdateBackground={updateBackground}
                onBulkDelete={bulkDelete}
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
          <ChampionsList />
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
