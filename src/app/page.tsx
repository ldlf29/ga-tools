'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import CardGrid from '@/components/CardGrid';
import FilterSidebar from '@/components/FilterSidebar';
import LineupBuilder from '@/components/LineupBuilder';
import WalletInput from '@/components/WalletInput';
import WalletManagerModal from '@/components/WalletManagerModal';
import walletStyles from '@/components/WalletInput.module.css';
import { EnhancedCard, FilterState, SavedLineup, ConnectedWallet } from '@/types';
import styles from './page.module.css';
import Toast, { ToastMessage } from '@/components/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchUserCards } from '@/utils/cardService';
import { ModeToggle } from '@/components/ModeToggle';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { HeaderControls } from '@/components/HeaderControls';

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
  const lastRefreshTimeRef = useRef<number>(0);

  /* User Cards Mode State */
  const [cardMode, setCardMode] = useState<'ALL' | 'USER'>('ALL');
  const [userWallets, setUserWallets] = useState<ConnectedWallet[]>([]);
  const [userCards, setUserCards] = useState<EnhancedCard[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [showWalletInput, setShowWalletInput] = useState(false);
  const [showWalletManagerModal, setShowWalletManagerModal] = useState(false);

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
    bulkDelete,
    updateLineup
  } = useSavedLineups(cardMode === 'USER' ? 'myGrandArenaLineups' : 'grandArenaLineups');

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
    if (cardMode === 'USER' && userWallets.length > 0) {
      setShowWalletManagerModal(true);
    } else {
      await refreshCards();
    }
  };

  /* Wallet Persistence */
  useEffect(() => {
    const rawWallets = localStorage.getItem('grandArenaWallets_v2');
    if (rawWallets) {
      try {
        const savedWallets: ConnectedWallet[] = JSON.parse(rawWallets);
        if (savedWallets.length > 0) {
          setCardMode('USER');
          handleLoadWallets(savedWallets);
        }
      } catch (e) {
        console.error("Failed to parse wallets", e);
      }
    } else {
      // Legacy compatibility
      const savedWallet = localStorage.getItem('grandArenaWallet');
      if (savedWallet) {
        setCardMode('USER');
        const legacyWallet: ConnectedWallet = {
          address: savedWallet,
          addedAt: Date.now() - (24 * 60 * 60 * 1000), // Allow immediate removal
          lastRefresh: Date.now()
        };
        handleLoadWallets([legacyWallet]);
      }
    }
  }, []);

  /* User Cards Handlers */
  /* Global Scroll Lock for Modals */
  useEffect(() => {
    const isInitialLoading = isLoading && allCards.length === 0;
    const shouldLock = showWalletManagerModal || showWalletInput || (isLoadingUser && !showWalletInput) || isInitialLoading;
    if (shouldLock) {
      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
    };
  }, [showWalletManagerModal, showWalletInput, isLoadingUser, isLoading, allCards.length]);

  const reloadAllWallets = async (wallets: ConnectedWallet[]) => {
    setIsLoadingUser(true);
    try {
      const allCards = await Promise.all(wallets.map(w => fetchUserCards(w.address)));
      setUserCards(allCards.flat());
    } catch (e) {
      console.warn("Failed loading some wallets", e);
      addToast("Failed to load some wallets", 'error');
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleLoadWallets = async (savedWallets: ConnectedWallet[]) => {
    setUserWallets(savedWallets);
    await reloadAllWallets(savedWallets);
  };

  const handleAddWallet = async (address: string) => {
    if (userWallets.find(w => w.address.toLowerCase() === address.toLowerCase())) {
      addToast("Wallet already connected", 'warning');
      return;
    }
    if (userWallets.length >= 2) {
      addToast("Maximum 2 wallets allowed", 'error');
      return;
    }

    setIsLoadingUser(true);
    setShowWalletInput(false);
    try {
      const cards = await fetchUserCards(address, true); // initial fetch force

      const newWallet: ConnectedWallet = {
        address: address,
        addedAt: Date.now(),
        lastRefresh: Date.now()
      };

      const updatedWallets = [...userWallets, newWallet];
      setUserWallets(updatedWallets);
      localStorage.setItem('grandArenaWallets_v2', JSON.stringify(updatedWallets));

      setUserCards(prev => [...prev, ...cards]);
      addToast(`Added wallet ${address.substring(0, 6)}...${address.substring(address.length - 6)}`, 'success');
      setCardMode('USER');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add wallet';
      addToast(msg, 'error');
      if (userWallets.length === 0) setCardMode('ALL');
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleRemoveWallet = (address: string) => {
    const updated = userWallets.filter(w => w.address.toLowerCase() !== address.toLowerCase());
    setUserWallets(updated);
    localStorage.setItem('grandArenaWallets_v2', JSON.stringify(updated));
    if (updated.length === 0) {
      handleDisconnectAllWallets();
    } else {
      reloadAllWallets(updated);
    }
  };

  const handleRefreshSingleWallet = async (address: string) => {
    const walletIdx = userWallets.findIndex(w => w.address.toLowerCase() === address.toLowerCase());
    if (walletIdx === -1) return;

    try {
      setIsLoadingUser(true);
      const cards = await fetchUserCards(address, true); // Force network

      const updated = [...userWallets];
      updated[walletIdx].lastRefresh = Date.now();
      setUserWallets(updated);
      localStorage.setItem('grandArenaWallets_v2', JSON.stringify(updated));

      await reloadAllWallets(updated);
      addToast("Wallet refreshed successfully", "success");
    } catch (e) {
      // Since the API returns 429 for cooldowns, the message will properly inform the user
      const msg = e instanceof Error ? e.message : "Refresh failed";
      addToast(msg, "error");
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleDisconnectAllWallets = () => {
    setUserWallets([]);
    setUserCards([]);
    setCardMode('ALL');
    localStorage.removeItem('grandArenaWallets_v2');
    localStorage.removeItem('grandArenaWallet'); // clear legacy
    setShowWalletManagerModal(false);
  };

  const handleModeChange = (mode: 'ALL' | 'USER') => {
    if (mode === cardMode) return;

    // Context Isolation: Clear the current lineup when switching contexts
    if (lineup.length > 0) {
      clearLineup();
      addToast("Lineup builder cleared for new context", 'suggestion');
    }

    if (mode === 'USER' && userWallets.length === 0) {
      setShowWalletInput(true);
    } else {
      setCardMode(mode);
    }
  };

  /* Filters State - Separate states for MOKI and SCHEME */
  const emptyFilters = {
    rarity: [] as string[],
    schemeName: [] as string[],
    fur: [] as string[],
    stars: [] as number[],
    customClass: [] as string[],
    specialization: [] as string[],
    traits: [] as string[],
    insertionOrder: [] as string[],
    useLast10Matches: false
  };

  const [filters, setFilters] = useState<FilterState>({
    ...emptyFilters,
    cardType: 'MOKI'
  });

  // Stored filters for each card type (MOKI/SCHEME) within current main tab
  const mokiFiltersRef = useRef({ filters: emptyFilters, search: '' });
  const schemeFiltersRef = useRef({ filters: emptyFilters, search: '' });

  // Stored filters for each main tab (Builder vs My Lineups)
  const builderStateRef = useRef<{
    filters: FilterState;
    search: string;
    mokiFilters: { filters: typeof emptyFilters; search: string };
    schemeFilters: { filters: typeof emptyFilters; search: string };
  }>({
    filters: { ...emptyFilters, cardType: 'MOKI' },
    search: '',
    mokiFilters: { filters: emptyFilters, search: '' },
    schemeFilters: { filters: emptyFilters, search: '' }
  });
  const lineupsStateRef = useRef<{
    filters: FilterState;
    search: string;
    mokiFilters: { filters: typeof emptyFilters; search: string };
    schemeFilters: { filters: typeof emptyFilters; search: string };
  }>({
    filters: { ...emptyFilters, cardType: 'MOKI' },
    search: '',
    mokiFilters: { filters: emptyFilters, search: '' },
    schemeFilters: { filters: emptyFilters, search: '' }
  });

  // Handle main tab switching (Builder <-> My Lineups <-> Champions)
  const handleMainTabChange = (newTab: 'builder' | 'lineups' | 'champions') => {
    if (newTab === activeTab) {
      return;
    }

    // Save current main tab's state
    const currentState = {
      filters: filters,
      search: searchQuery,
      mokiFilters: { ...mokiFiltersRef.current },
      schemeFilters: { ...schemeFiltersRef.current }
    };

    if (activeTab === 'builder') {
      builderStateRef.current = currentState;
    } else if (activeTab === 'lineups') {
      lineupsStateRef.current = currentState;
    }

    // Restore target tab's state
    if (newTab === 'builder') {
      const targetState = builderStateRef.current;
      setFilters(targetState.filters);
      setSearchQuery(targetState.search);
      mokiFiltersRef.current = targetState.mokiFilters;
      schemeFiltersRef.current = targetState.schemeFilters;
    } else if (newTab === 'lineups') {
      const targetState = lineupsStateRef.current;
      setFilters(targetState.filters);
      setSearchQuery(targetState.search);
      mokiFiltersRef.current = targetState.mokiFilters;
      schemeFiltersRef.current = targetState.schemeFilters;
    }

    setActiveTab(newTab);
  };

  // Handle tab switching with filter preservation
  const handleCardTypeChange = (newCardType: 'MOKI' | 'SCHEME') => {
    if (newCardType === filters.cardType) return;

    // Save current tab's filters and search
    if (filters.cardType === 'MOKI') {
      mokiFiltersRef.current = {
        filters: { ...filters, cardType: undefined } as any,
        search: searchQuery
      };
    } else {
      schemeFiltersRef.current = {
        filters: { ...filters, cardType: undefined } as any,
        search: searchQuery
      };
    }

    // Restore target tab's filters and search
    const targetState = newCardType === 'MOKI' ? mokiFiltersRef.current : schemeFiltersRef.current;
    setFilters({
      ...targetState.filters,
      cardType: newCardType
    });
    setSearchQuery(targetState.search);
  };

  /* Worker Filter Integration */
  const sourceCards = cardMode === 'USER' ? userCards : allCards;

  const filteredCards = useWorkerFilter(sourceCards, filters, searchQuery);

  /* Lineup Management Wrappers */
  const handleAddToLineup = (card: EnhancedCard) => {
    // Find if an instance of this card type (by image) is already in the lineup
    const indexToRemove = lineup.findIndex(c => c.image === card.image);

    if (indexToRemove !== -1) {
      if (lineup[indexToRemove].locked) return;
      removeFromLineup(indexToRemove);
      return;
    }

    const result = addCard(card);
    if (!result.success && result.error) {
      addToast(result.error, 'error');
    }
  };

  const handleSaveLineup = (name: string) => {
    if (name.length > 20) {
      addToast("Maximum 20 characters for lineup name.", 'error');
      return;
    }
    try {
      saveLineupToStorage(name, lineup);
      // Keep only locked cards after save, remove unlocked ones
      const lockedCards = lineup.filter(card => card.locked);
      setLineup(lockedCards);
      addToast("Lineup Saved Successfully!", 'success');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save lineup';
      addToast(message, 'error');
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
    // When on SCHEME tab, get preserved filters from mokiFiltersRef
    // When on MOKI tab, use current filters
    const sourceFilters = filters.cardType === 'SCHEME'
      ? mokiFiltersRef.current.filters
      : filters;

    // Preserve rarity always, stars only if suggestion doesn't include stars
    const preservedRarity = sourceFilters.rarity || [];
    // Only preserve stars if the suggestion doesn't specify stars (e.g., Running Interference)
    const suggestionHasStars = newFilters.stars && newFilters.stars.length > 0;
    const preservedStars = suggestionHasStars ? [] : (sourceFilters.stars || []);

    const cleared: FilterState = {
      rarity: preservedRarity, // Preserve rarity filter
      cardType: 'MOKI', // Always switch to MOKI mode
      schemeName: [],
      fur: [],
      stars: preservedStars, // Preserve stars filter only if suggestion doesn't override
      customClass: [],
      specialization: [],
      traits: [],
      insertionOrder: [],
      useLast10Matches: false
    };

    // Build insertion order: first preserved rarity/stars, then new filters
    const newOrder: string[] = [];
    preservedRarity.forEach(r => newOrder.push(`rarity:${r}`));
    if (preservedStars.length > 0) newOrder.push('stars:ACTIVE');
    Object.entries(newFilters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(val => {
          const orderKey = key === 'stars' ? 'stars:ACTIVE' : `${key}:${val}`;
          if (!newOrder.includes(orderKey)) {
            newOrder.push(orderKey);
          }
        });
      }
    });

    setFilters({ ...cleared, ...newFilters, insertionOrder: newOrder });
    setSearchQuery(''); // Clear search bar when suggesting
    addToast("Suggestion Applied!", 'success');
  };

  /* UI Helpers */
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mokiDropdownOpen, setMokiDropdownOpen] = useState(false);
  const [allLineupsOpen, setAllLineupsOpen] = useState(true);
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const infoWrapperRef = useRef<HTMLDivElement>(null);

  // Drawer State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileBuilderOpen, setMobileBuilderOpen] = useState(false);

  const closeDrawers = () => {
    setMobileFiltersOpen(false);
    setMobileBuilderOpen(false);
    setMobileMenuOpen(false);
  };

  // handleConnect removed — replaced by mode toggle

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (showInfo) {
      // Auto-close after 3 seconds
      const timer = setTimeout(() => {
        setShowInfo(false);
      }, 3000);

      // Close on click outside
      const handleClickOutside = (event: MouseEvent) => {
        if (infoWrapperRef.current && !infoWrapperRef.current.contains(event.target as Node)) {
          setShowInfo(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showInfo]);

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
          <img src="/ga-logo-new.png" alt="Grand Arena" className={styles.drawerLogo} />
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
            onClick={() => { handleMainTabChange('builder'); closeDrawers(); }}
          >
            Builder
          </button>
          <button
            className={`${styles.navTab} ${activeTab === 'lineups' ? styles.activeTab : ''}`}
            onClick={() => { handleMainTabChange('lineups'); closeDrawers(); }}
          >
            My Lineups
          </button>
          <button
            className={`${styles.navTab} ${activeTab === 'champions' ? styles.activeTab : ''}`}
            onClick={() => { handleMainTabChange('champions'); closeDrawers(); }}
          >
            Champions
          </button>

        </nav>

        <div className={styles.authWrapper}>
          <ModeToggle
            cardMode={cardMode}
            handleModeChange={handleModeChange}
            userWalletsCount={userWallets.length}
            onOpenWalletManager={() => setShowWalletManagerModal(true)}
          />
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      <div className={`${styles.mobileDrawer} ${styles.filterDrawer} ${styles.mobileOnly} ${mobileFiltersOpen ? styles.filterDrawerOpen : ''}`}>
        <button
          className={`${styles.drawerCloseButton} ${styles.filterCloseButton}`}
          onClick={() => setMobileFiltersOpen(false)}
          aria-label="Close Filters"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <FilterSidebar filters={filters} onFilterChange={setFilters} onCardTypeChange={handleCardTypeChange} />
      </div>

      {/* Mobile Builder Drawer */}
      <div className={`${styles.mobileDrawer} ${styles.builderDrawer} ${styles.mobileOnly} ${mobileBuilderOpen ? styles.builderDrawerOpen : ''}`}>
        <button
          className={`${styles.drawerCloseButton} ${styles.builderCloseButton}`}
          onClick={() => setMobileBuilderOpen(false)}
          aria-label="Close Builder"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
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
            <img src="/ga-logo-new.png" alt="Grand Arena Builder" className={styles.logo} />

            <div className={styles.infoWrapper} ref={infoWrapperRef}>
              <button
                className={styles.infoButton}
                onClick={() => setShowInfo(!showInfo)}
                title="Disclaimer"
                style={{ background: showInfo ? 'rgba(255,255,255,0.2)' : 'transparent', color: showInfo ? 'white' : 'rgba(255,255,255,0.6)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </button>
              {showInfo && (
                <div className={styles.infoPopup}>
                  This tool was created by a community member unrelated to Moku's Team. All assets used are the property of Moku Studios.
                </div>
              )}
            </div>

            {/* Desktop Navigation */}
            <nav className={`${styles.navContainer} ${styles.desktopOnly}`}>
              <div className={styles.navTabs}>
                <button
                  className={`${styles.navTab} ${activeTab === 'builder' ? styles.activeTab : ''}`}
                  onClick={() => handleMainTabChange('builder')}
                >
                  Builder
                </button>
                <button
                  className={`${styles.navTab} ${activeTab === 'lineups' ? styles.activeTab : ''}`}
                  onClick={() => handleMainTabChange('lineups')}
                >
                  My Lineups
                </button>
                <button
                  className={`${styles.navTab} ${activeTab === 'champions' ? styles.activeTab : ''}`}
                  onClick={() => handleMainTabChange('champions')}
                >
                  Champions
                </button>

              </div>
            </nav>
          </div>

          <div className={`${styles.authWrapper} ${styles.desktopOnly}`}>
            <HeaderControls
              mokiDropdownOpen={mokiDropdownOpen}
              setMokiDropdownOpen={setMokiDropdownOpen}
              notificationsEnabled={notificationsEnabled}
              setNotificationsEnabled={setNotificationsEnabled}
              iconSize={56}
            />

            <ModeToggle
              cardMode={cardMode}
              handleModeChange={handleModeChange}
              userWalletsCount={userWallets.length}
              onOpenWalletManager={() => setShowWalletManagerModal(true)}
            />
          </div>

          <div className={`${styles.headerRightMobile} ${styles.mobileOnly}`}>
            <HeaderControls
              mokiDropdownOpen={mokiDropdownOpen}
              setMokiDropdownOpen={setMokiDropdownOpen}
              notificationsEnabled={notificationsEnabled}
              setNotificationsEnabled={setNotificationsEnabled}
              iconSize={44}
            />

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
      {/* User Wallet Banner */}


      <div className={styles.content}>
        {activeTab === 'builder' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

            {/* Mobile Floating Action Buttons */}
            <div className={styles.fabContainer}>
              <button className={`${styles.fabButton} ${styles.fabFilters}`} onClick={() => setMobileFiltersOpen(true)}>
                {/* Filter Icon */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              </button>
              <button className={`${styles.fabButton} ${styles.fabBuilder}`} onClick={() => setMobileBuilderOpen(true)}>
                {/* Hammer Icon PNG from public */}
                <img src="/hammer.png" alt="Hammer" width={27} height={27} style={{ filter: 'brightness(0) invert(1)' }} />
              </button>
            </div>

            <div className={styles.mainLayout}>
              {/* Column 1: FilterSidebar (Desktop only) */}
              <div className={styles.desktopOnly}>
                <FilterSidebar filters={filters} onFilterChange={setFilters} onCardTypeChange={handleCardTypeChange} />
              </div>

              {/* Column 2: CardGrid */}
              <div style={{ width: '100%', minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <CardGrid
                  cards={filteredCards}
                  onAddCard={handleAddToLineup}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  currentLineup={lineup}
                  savedLineups={savedLineups}
                  filters={filters}
                  onRemoveFilter={handleRemoveFilter}
                  isUserMode={cardMode === 'USER'}
                  userCardCount={cardMode === 'USER' ? filteredCards.length : undefined}
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
        )}

        {activeTab === 'lineups' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
                <FilterSidebar filters={filters} onFilterChange={setFilters} onCardTypeChange={handleCardTypeChange} />
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
                  allCards={sourceCards}
                  onUpdateLineup={updateLineup}
                  isUserMode={cardMode === 'USER'}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'champions' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <ChampionsList />
          </div>
        )}
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
          <LoadingOverlay message="Loading cards..." />
        )
      }

      {/* Wallet Manager Modal */}
      {showWalletManagerModal && (
        <WalletManagerModal
          wallets={userWallets}
          onClose={() => setShowWalletManagerModal(false)}
          onAddWallet={() => {
            setShowWalletManagerModal(false);
            setShowWalletInput(true);
          }}
          onRemoveWallet={handleRemoveWallet}
          onRefreshWallet={handleRefreshSingleWallet}
          onToast={addToast}
        />
      )}

      {/* Wallet Input Modal */}
      {showWalletInput && (
        <WalletInput
          onSubmit={handleAddWallet}
          onCancel={() => {
            setShowWalletInput(false);
            if (userWallets.length === 0) setCardMode('ALL');
            else setShowWalletManagerModal(true);
          }}
          isLoading={isLoadingUser}
        />
      )}

      {/* Loading overlay for user cards */}
      {isLoadingUser && !showWalletInput && (
        <LoadingOverlay message="Loading cards..." />
      )}

      <Toast messages={toasts} onClose={removeToast} />
    </main >
  );
}