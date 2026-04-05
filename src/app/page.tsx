/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import CardGrid from '@/components/CardGrid';
import FilterSidebar from '@/components/FilterSidebar';
import LineupBuilder from '@/components/LineupBuilder';
import WalletInput from '@/components/WalletInput';
import WalletManagerModal from '@/components/WalletManagerModal';

import {
  EnhancedCard,
  FilterState,
  ConnectedWallet,
} from '@/types';
import styles from './page.module.css';
import Toast, { ToastMessage } from '@/components/Toast';

import { fetchUserCards } from '@/utils/cardService';
import { sortCardsByFilters, getRarityValue } from '@/utils/sortingUtils';
import { matchesFilter } from '@/utils/filterUtils';
import { ModeToggle } from '@/components/ModeToggle';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { HeaderControls } from '@/components/HeaderControls';
import { checkAdminAction } from '@/app/actions/auth';

// Lazy Loaded Components
const MyLineups = dynamic(() => import('@/components/MyLineups'), {
  loading: () => (
    <div className={styles.spinnerWrapper}>
      <div className={styles.spinner}></div>
    </div>
  ),
  ssr: false,
});
const Champions = dynamic(() => import('@/components/Champions'), {
  loading: () => (
    <div className={styles.spinnerWrapper}>
      <div className={styles.spinner}></div>
    </div>
  ),
  ssr: false,
});
const PredictionsTab = dynamic(() => import('@/components/PredictionsTab'), {
  loading: () => (
    <div className={styles.spinnerWrapper}>
      <div className={styles.spinner}></div>
    </div>
  ),
  ssr: false,
});
const PredictionsGate = dynamic(() => import('@/components/PredictionsGate'), { ssr: false });
import ChangelogModal from '@/components/ChangelogModal';

// Custom Hooks
import { useCards } from '@/hooks/useCards';
import { useSavedLineups } from '@/hooks/useSavedLineups';
import { useLineupBuilder } from '@/hooks/useLineupBuilder';
import { useWorkerFilter } from '@/hooks/useWorkerFilter';

export default function Home() {
  /* Global UI State */
  const [activeTab, setActiveTab] = useState<
    'builder' | 'lineups' | 'predictions' | 'champions' | 'changelog'
  >('predictions');
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


  const [isSuggestionActive, setIsSuggestionActive] = useState(false);

  /* Admin Access State */
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Initial check for persisted admin session
    checkAdminAction().then((status) => {
      setIsAdmin(status);
    });
  }, []);



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
    updateLineup,
  } = useSavedLineups(
    cardMode === 'USER' ? 'myGrandArenaLineups' : 'grandArenaLineups'
  );

  const {
    lineup,
    setLineup,
    addCard,
    removeCard: removeFromLineup,
    clearLineup,
  } = useLineupBuilder();

  /* Local Helper: Toasts */
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const addToast = (
    text: string,
    type: 'error' | 'success' | 'warning' | 'suggestion',
    force: boolean = false
  ) => {
    if (!notificationsEnabled && !force) return;
    const now = Date.now();
    const lastTime = lastToastTimeRef.current[text] || 0;
    if (now - lastTime < 5000) return;
    lastToastTimeRef.current[text] = now;
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
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
    const savedMode = localStorage.getItem('grandArenaCardMode') as
      | 'ALL'
      | 'USER'
      | null;

    if (rawWallets) {
      try {
        const savedWallets: ConnectedWallet[] = JSON.parse(rawWallets);
        if (savedWallets.length > 0) {
          if (savedMode === 'ALL') {
            setCardMode('ALL');
          } else {
            setCardMode('USER');
          }
          handleLoadWallets(savedWallets);
        }
      } catch (e) {
        console.error('Failed to parse wallets', e);
      }
    } else {
      // Legacy compatibility
      const savedWallet = localStorage.getItem('grandArenaWallet');
      if (savedWallet) {
        if (savedMode === 'ALL') {
          setCardMode('ALL');
        } else {
          setCardMode('USER');
        }
        const legacyWallet: ConnectedWallet = {
          address: savedWallet,
          addedAt: Date.now() - 24 * 60 * 60 * 1000, // Allow immediate removal
          lastRefresh: Date.now(),
        };
        handleLoadWallets([legacyWallet]);
      }
    }
  }, []);

  /* URL Parameters Handling */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mokiSearch = params.get('mokiSearch');
      const tab = params.get('tab');

      if (tab === 'champions') {
        setActiveTab('champions');
      }

      if (mokiSearch) {
        setActiveTab('builder');
        setSearchQuery(decodeURIComponent(mokiSearch));
      }

      // Consolidate URL cleanup for both parameters
      if (tab || mokiSearch) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  /* User Cards Handlers */
  /* Global Scroll Lock for Modals */
  useEffect(() => {
    const isInitialLoading = isLoading && allCards.length === 0;
    const shouldLock =
      showWalletManagerModal ||
      showWalletInput ||
      (isLoadingUser && !showWalletInput) ||
      isInitialLoading;
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
  }, [
    showWalletManagerModal,
    showWalletInput,
    isLoadingUser,
    isLoading,
    allCards.length,
  ]);

  const reloadAllWallets = async (wallets: ConnectedWallet[]) => {
    setIsLoadingUser(true);
    try {
      const allCards = await Promise.all(
        wallets.map((w) => fetchUserCards(w.address))
      );
      setUserCards(allCards.flat());
    } catch (e) {
      console.warn('Failed loading some wallets', e);
      addToast('Failed to load some wallets', 'error');
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleLoadWallets = async (savedWallets: ConnectedWallet[]) => {
    setUserWallets(savedWallets);
    await reloadAllWallets(savedWallets);
  };

  const handleAddWallet = async (address: string) => {
    if (
      userWallets.find((w) => w.address.toLowerCase() === address.toLowerCase())
    ) {
      addToast('Wallet already connected', 'warning');
      return;
    }
    if (userWallets.length >= 2) {
      addToast('Maximum 2 wallets allowed', 'error');
      return;
    }

    setIsLoadingUser(true);
    setShowWalletInput(false);
    try {
      const cards = await fetchUserCards(address, false, true); // isInitialAdd=true bypasses server cooldown

      const newWallet: ConnectedWallet = {
        address: address,
        addedAt: Date.now(),
        lastRefresh: Date.now(),
      };

      const updatedWallets = [...userWallets, newWallet];
      setUserWallets(updatedWallets);
      localStorage.setItem(
        'grandArenaWallets_v2',
        JSON.stringify(updatedWallets)
      );

      setUserCards((prev) => [...prev, ...cards]);
      addToast(
        `Added wallet ${address.substring(0, 6)}...${address.substring(address.length - 6)}`,
        'success'
      );
      setCardMode('USER');
      localStorage.setItem('grandArenaCardMode', 'USER');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add wallet';
      addToast(msg, 'error');
      if (userWallets.length === 0) {
        setCardMode('ALL');
        localStorage.setItem('grandArenaCardMode', 'ALL');
      }
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleRemoveWallet = (address: string) => {
    const updated = userWallets.filter(
      (w) => w.address.toLowerCase() !== address.toLowerCase()
    );
    setUserWallets(updated);
    localStorage.setItem('grandArenaWallets_v2', JSON.stringify(updated));
    if (updated.length === 0) {
      handleDisconnectAllWallets();
    } else {
      reloadAllWallets(updated);
    }
  };

  const handleRefreshSingleWallet = async (address: string) => {
    const walletIdx = userWallets.findIndex(
      (w) => w.address.toLowerCase() === address.toLowerCase()
    );
    if (walletIdx === -1) return;

    try {
      setIsLoadingUser(true);
      const cards = await fetchUserCards(address, true); // Force network

      const updated = [...userWallets];
      updated[walletIdx].lastRefresh = Date.now();
      setUserWallets(updated);
      localStorage.setItem('grandArenaWallets_v2', JSON.stringify(updated));

      await reloadAllWallets(updated);
      addToast('Wallet refreshed successfully', 'success');
    } catch (e) {
      // Since the API returns 429 for cooldowns, the message will properly inform the user
      const msg = e instanceof Error ? e.message : 'Refresh failed';
      addToast(msg, 'error');
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleDisconnectAllWallets = () => {
    setUserWallets([]);
    setUserCards([]);
    setCardMode('ALL');
    localStorage.setItem('grandArenaCardMode', 'ALL');
    localStorage.removeItem('grandArenaWallets_v2');
    localStorage.removeItem('grandArenaWallet'); // clear legacy
    setShowWalletManagerModal(false);
  };

  const handleModeChange = (mode: 'ALL' | 'USER') => {
    if (mode === cardMode) return;

    // Context Isolation: Clear the current lineup when switching contexts
    if (lineup.length > 0) {
      clearLineup();
      addToast('Lineup builder cleared for new context', 'suggestion');
    }

    if (mode === 'USER' && userWallets.length === 0) {
      setShowWalletInput(true);
    } else {
      setCardMode(mode);
      localStorage.setItem('grandArenaCardMode', mode);
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
    matchLimit: 'ALL' as 'ALL' | 10 | 20 | 30,
  };

  const [filters, setFilters] = useState<FilterState>({
    ...emptyFilters,
    cardType: 'MOKI',
  });

  // Sorting state for Builder tab
  const [mokiSortOption, setMokiSortOption] = useState<any>('default');
  const [schemeSortOption, setSchemeSortOption] = useState<any>('default');

  // Reset local sortOption when sidebar-driven sorts are activated
  useEffect(() => {
    const hasSpecialization = filters.specialization && filters.specialization.length > 0;
    const hasExtraSort = !!filters.extraSort;

    if (hasSpecialization || hasExtraSort) {
      if (filters.cardType === 'SCHEME') setSchemeSortOption('default');
      else setMokiSortOption('default');
    }
  }, [filters.specialization, filters.extraSort, filters.cardType]);

  const handleSortChange = (option: any) => {
    if (filters.cardType === 'SCHEME') setSchemeSortOption(option);
    else setMokiSortOption(option);

    // If selecting a manual sort, clear specialization and extraSort from global state
    if (option !== 'default') {
      const newFilters = { ...filters, specialization: [], extraSort: undefined };
      if (newFilters.insertionOrder) {
        newFilters.insertionOrder = newFilters.insertionOrder.filter(
          (k) => !k.startsWith('specialization:') && !k.startsWith('extraSort:')
        );
      }
      handleFilterChange(newFilters);
    }
  };

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
    schemeFilters: { filters: emptyFilters, search: '' },
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
    schemeFilters: { filters: emptyFilters, search: '' },
  });

  const championsStateRef = useRef<{
    filters: FilterState;
    search: string;
    mokiFilters: { filters: typeof emptyFilters; search: string };
    schemeFilters: { filters: typeof emptyFilters; search: string };
  }>({
    filters: { ...emptyFilters, cardType: 'MOKI' },
    search: '',
    mokiFilters: { filters: emptyFilters, search: '' },
    schemeFilters: { filters: emptyFilters, search: '' },
  });

  // Handle main tab switching (Builder <-> My Lineups <-> Champions)
  const handleMainTabChange = (
    tab: 'builder' | 'lineups' | 'predictions' | 'champions' | 'changelog'
  ) => {
    if (tab === activeTab) {
      return;
    }

    // Save current main tab's state
    const currentState = {
      filters: filters,
      search: searchQuery,
      mokiFilters: { ...mokiFiltersRef.current },
      schemeFilters: { ...schemeFiltersRef.current },
    };

    if (activeTab === 'builder') {
      builderStateRef.current = currentState;
    } else if (activeTab === 'lineups') {
      lineupsStateRef.current = currentState;
    } else if (activeTab === 'champions') {
      championsStateRef.current = currentState;
    }

    // Restore target tab's state
    if (tab === 'builder') {
      const targetState = builderStateRef.current;
      setFilters(targetState.filters);
      setSearchQuery(targetState.search);
      mokiFiltersRef.current = targetState.mokiFilters;
      schemeFiltersRef.current = targetState.schemeFilters;
    } else if (tab === 'lineups') {
      const targetState = lineupsStateRef.current;
      setFilters(targetState.filters);
      setSearchQuery(targetState.search);
      mokiFiltersRef.current = targetState.mokiFilters;
      schemeFiltersRef.current = targetState.schemeFilters;
    } else if (tab === 'champions') {
      const targetState = championsStateRef.current;
      setFilters(targetState.filters);
      setSearchQuery(targetState.search);
      mokiFiltersRef.current = targetState.mokiFilters;
      schemeFiltersRef.current = targetState.schemeFilters;
    }

    setActiveTab(tab);
  };

  // Handle tab switching with filter preservation
  const handleCardTypeChange = (newCardType: 'MOKI' | 'SCHEME') => {
    if (newCardType === filters.cardType) return;

    // Save current tab's filters and search
    if (filters.cardType === 'MOKI') {
      mokiFiltersRef.current = {
        filters: { ...filters, cardType: undefined } as any,
        search: searchQuery,
      };
    } else {
      schemeFiltersRef.current = {
        filters: { ...filters, cardType: undefined } as any,
        search: searchQuery,
      };
    }

    // Restore target tab's filters and search
    const targetState =
      newCardType === 'MOKI'
        ? mokiFiltersRef.current
        : schemeFiltersRef.current;
    setFilters({
      ...targetState.filters,
      cardType: newCardType,
    });
    setSearchQuery(targetState.search);
  };

  /* Worker Filter Integration */
  const sourceCards = cardMode === 'USER' ? userCards : allCards;

  const filteredCards = useWorkerFilter(sourceCards, filters, searchQuery);

  /* Lineup Management Wrappers */
  const handleRemoveFromLineup = (index: number) => {
    const card = lineup[index];
    removeFromLineup(index);

    // --- NEW DYNAMIC RESELECTION LOGIC ---
    if (card && card.cardType === 'MOKI' && isSuggestionActive) {
      const schemeCard = lineup.find((c) => c.cardType === 'SCHEME');
      if (schemeCard && schemeCard.name === "Collect 'Em All") {
        setFilters((prev) => {
          const currentRarities = prev.rarity || [];
          const cardRarity = card.rarity === 'Common' ? 'Basic' : card.rarity;

          if (!currentRarities.includes(cardRarity)) {
            return {
              ...prev,
              rarity: [...currentRarities, cardRarity],
              insertionOrder: [
                ...(prev.insertionOrder || []),
                `rarity:${cardRarity}`,
              ],
            };
          }
          return prev;
        });
      }
    }
  };

  const handleAddToLineup = (card: EnhancedCard) => {
    // Toggle-remove: only if the EXACT same card variant (by image) is already in the lineup
    const indexToRemove = lineup.findIndex((c) => c.image === card.image);

    if (indexToRemove !== -1) {
      if (lineup[indexToRemove].locked) return;
      handleRemoveFromLineup(indexToRemove);
      return;
    }

    const result = addCard(card);
    if (!result.success && result.error) {
      addToast(result.error, 'error');
    } else if (result.success && card.cardType === 'MOKI') {
      // --- NEW DYNAMIC DESELECTION LOGIC ---
      const schemeCard = lineup.find((c) => c.cardType === 'SCHEME');
      if (schemeCard && schemeCard.name === "Collect 'Em All") {
        setFilters((prev) => {
          const currentRarities = prev.rarity || [];
          const cardRarity = card.rarity === 'Common' ? 'Basic' : card.rarity;

          if (currentRarities.includes(cardRarity)) {
            return {
              ...prev,
              rarity: currentRarities.filter((r) => r !== cardRarity),
              insertionOrder: (prev.insertionOrder || []).filter(
                (o) => o !== `rarity:${cardRarity}`
              ),
            };
          }
          return prev;
        });
      }
    }
  };

  const handleSaveLineup = (name: string) => {
    if (name.length > 50) {
      addToast('Maximum 50 characters for lineup name.', 'error');
      return;
    }
    try {
      saveLineupToStorage(name, lineup);
      // Keep only locked cards after save, remove unlocked ones
      const lockedCards = lineup.filter((card) => card.locked);
      setLineup(lockedCards);
      addToast('Lineup Saved Successfully!', 'success');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save lineup';
      addToast(message, 'error');
    }
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setIsSuggestionActive(false);
  };

  const handleRemoveFilter = (
    key: keyof FilterState,
    value: string | number
  ) => {
    setIsSuggestionActive(false);
    setFilters((prev) => {
      const currentValues = prev[key];
      let newValues = currentValues;
      let newExtraSort = prev.extraSort;

      if (key === 'stars') {
        newValues = [];
      } else if (key === 'matchLimit') {
        newValues = 'ALL';
        newExtraSort = undefined; // Clear extraSort when matchLimit is removed
      } else if (Array.isArray(currentValues)) {
        newValues = (currentValues as any[]).filter((v) => v !== value);
      }

      let newOrder = prev.insertionOrder ? [...prev.insertionOrder] : [];
      const orderKey = `${key}:${value}`;
      newOrder = newOrder.filter((k) => k !== orderKey);

      // Also clean up extraSort chips from insertionOrder if matchLimit was removed
      if (key === 'matchLimit') {
        newOrder = newOrder.filter((k) => !k.startsWith('extraSort:'));
      }

      return {
        ...prev,
        [key]: newValues,
        extraSort: newExtraSort,
        insertionOrder: newOrder,
      };
    });
  };

  const handleSuggestFilters = (newFilters: Partial<FilterState>) => {
    const cleared: FilterState = {
      rarity: [],
      cardType: 'MOKI', // Always switch to MOKI mode
      schemeName: [],
      fur: [],
      stars: [],
      customClass: [],
      specialization: [],
      traits: [],
      insertionOrder: [],
      matchLimit: 'ALL',
    };

    // Build insertion order: new filters only
    const newOrder: string[] = [];
    Object.entries(newFilters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((val) => {
          const orderKey = key === 'stars' ? 'stars:ACTIVE' : `${key}:${val}`;
          if (!newOrder.includes(orderKey)) {
            newOrder.push(orderKey);
          }
        });
      }
    });

    setFilters({ ...cleared, ...newFilters, insertionOrder: newOrder });
    setIsSuggestionActive(true);
    setSearchQuery(''); // Clear search bar when suggesting
    addToast('Suggestion Applied!', 'success');
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
        if (
          infoWrapperRef.current &&
          !infoWrapperRef.current.contains(event.target as Node)
        ) {
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
      <div
        className={`${styles.navContainer} ${styles.mobileOnly} ${mobileMenuOpen ? styles.navContainerVisible : ''}`}
      >
        <div className={`${styles.drawerHeader} ${styles.mobileOnly}`}>
          <img
            src="/icons/logo-ga-tools-2.png"
            alt="Grand Arena"
            className={styles.drawerLogo}
          />
          <button
            className={styles.closeMenuButton}
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close Menu"
          >
            <svg
              width="24"
              height="24"
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

        <nav className={styles.navTabs}>
          <button
            className={`${styles.navTab} ${activeTab === 'predictions' ? styles.activeTab : ''}`}
            onClick={() => {
              handleMainTabChange('predictions');
              closeDrawers();
            }}
          >
            Predictions
          </button>
          <button
            className={`${styles.navTab} ${activeTab === 'builder' ? styles.activeTab : ''}`}
            onClick={() => {
              handleMainTabChange('builder');
              closeDrawers();
            }}
          >
            Builder
          </button>
          <button
            className={`${styles.navTab} ${activeTab === 'lineups' ? styles.activeTab : ''}`}
            onClick={() => {
              handleMainTabChange('lineups');
              closeDrawers();
            }}
          >
            My Lineups
          </button>

          <button
            className={`${styles.navTab} ${activeTab === 'champions' ? styles.activeTab : ''}`}
            onClick={() => {
              handleMainTabChange('champions');
              closeDrawers();
            }}
          >
            Champions
          </button>
          <button
            className={`${styles.navTab} ${activeTab === 'changelog' ? styles.activeTab : ''}`}
            onClick={() => {
              handleMainTabChange('changelog');
              closeDrawers();
            }}
          >
            Changelog
          </button>
        </nav>

        <div className={styles.authWrapper}>
          <ModeToggle
            cardMode={cardMode}
            handleModeChange={handleModeChange}
            onOpenWalletManager={() => setShowWalletManagerModal(true)}
          />
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      <div
        className={`${styles.mobileDrawer} ${styles.filterDrawer} ${styles.mobileOnly} ${mobileFiltersOpen ? styles.filterDrawerOpen : ''}`}
      >
        <button
          className={`${styles.drawerCloseButton} ${styles.filterCloseButton}`}
          onClick={() => setMobileFiltersOpen(false)}
          aria-label="Close Filters"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <FilterSidebar
          filters={filters}
          onFilterChange={handleFilterChange}
          onCardTypeChange={handleCardTypeChange}
          hideMatchPerformance={activeTab === 'lineups'}
          hideRarity={activeTab === 'champions'}
          hideTypeToggle={activeTab === 'champions'}
          storagePrefix={activeTab === 'champions' ? 'champions_unified' : activeTab}
        />
      </div>

      {/* Mobile Builder Drawer */}
      <div
        className={`${styles.mobileDrawer} ${styles.builderDrawer} ${styles.mobileOnly} ${mobileBuilderOpen ? styles.builderDrawerOpen : ''}`}
      >
        <button
          className={`${styles.drawerCloseButton} ${styles.builderCloseButton}`}
          onClick={() => setMobileBuilderOpen(false)}
          aria-label="Close Builder"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <LineupBuilder
          lineup={lineup}
          onRemove={handleRemoveFromLineup}
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
            <img
              src="/icons/logo-ga-tools-2.png"
              alt="Grand Arena Builder"
              className={styles.logo}
            />

            <div className={styles.infoWrapper} ref={infoWrapperRef}>
              <button
                className={styles.infoButton}
                onClick={() => setShowInfo(!showInfo)}
                title="Disclaimer"
                style={{
                  background: showInfo
                    ? 'rgba(255,255,255,0.2)'
                    : 'transparent',
                  color: showInfo ? 'white' : 'rgba(255,255,255,0.6)',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </button>
              {showInfo && (
                <div className={styles.infoPopup}>
                  This tool was created by a community member unrelated to
                  Moku's Team. All assets used are the property of Moku Studios.
                </div>
              )}
            </div>

            {/* Desktop Navigation */}
            <nav className={`${styles.navContainer} ${styles.desktopOnly}`}>
              <div className={styles.navTabs}>
                <button
                  className={`${styles.navTab} ${activeTab === 'predictions' ? styles.activeTab : ''}`}
                  onClick={() => handleMainTabChange('predictions')}
                >
                  Predictions
                </button>
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
                <button
                  className={`${styles.navTab} ${activeTab === 'changelog' ? styles.activeTab : ''}`}
                  onClick={() => handleMainTabChange('changelog')}
                >
                  Changelog
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Mobile Floating Action Buttons */}
            <div className={styles.fabContainer}>
              <button
                className={`${styles.fabButton} ${styles.fabFilters}`}
                onClick={() => setMobileFiltersOpen(true)}
              >
                {/* Filter Icon */}
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
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
              </button>
              <button
                className={`${styles.fabButton} ${styles.fabBuilder}`}
                onClick={() => setMobileBuilderOpen(true)}
              >
                {/* Hammer Icon PNG from public */}
                <img
                  src="/icons/hammer.png"
                  alt="Hammer"
                  width={27}
                  height={27}
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </button>
            </div>

            <div className={styles.mainLayout}>
              {/* Column 1: FilterSidebar (Desktop only) */}
              <div className={styles.desktopOnly}>
                <FilterSidebar
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onCardTypeChange={handleCardTypeChange}
                  hideMatchPerformance={false}
                  storagePrefix="builder"
                />
              </div>

              {/* Column 2: CardGrid */}
              <div
                style={{
                  width: '100%',
                  minWidth: 0,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                }}
              >
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
                  mokiSortOption={mokiSortOption}
                  schemeSortOption={schemeSortOption}
                  onSortChange={handleSortChange}
                />
              </div>

              {/* Column 3: LineupBuilder (Desktop only) */}
              <div className={styles.desktopOnly}>
                <LineupBuilder
                  lineup={lineup}
                  onRemove={handleRemoveFromLineup}
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Mobile Floating Action Buttons */}
            <div className={styles.fabContainer}>
              <button
                className={`${styles.fabButton} ${styles.fabFilters}`}
                onClick={() => setMobileFiltersOpen(true)}
              >
                {/* Filter Icon */}
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
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
              </button>
            </div>

            <div className={styles.mainLayoutLineups}>
              {/* Column 1: Sidebar */}
              <div className={styles.desktopOnly}>
                <FilterSidebar
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onCardTypeChange={handleCardTypeChange}
                  hideMatchPerformance={true}
                  storagePrefix="lineups"
                />
              </div>

              {/* Column 2: Lineups List */}
              <div
                style={{
                  gridColumn: '2 / span 2',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                }}
              >
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

        {activeTab === 'predictions' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
            }}
          >
            <PredictionsGate
              hasUserCards={userWallets.length > 0}
              onLoadCards={() => setShowWalletInput(true)}
              onManageWallets={() => setShowWalletManagerModal(true)}
            >
              <PredictionsTab allCards={allCards} userCards={userCards} cardMode={cardMode} />
            </PredictionsGate>
          </div>
        )}

        {activeTab === 'champions' && (
          <div className={styles.mainLayout}>
            {/* Mobile Floating Action Buttons */}
            <div className={styles.fabContainer}>
              <button
                className={`${styles.fabButton} ${styles.fabFilters}`}
                onClick={() => setMobileFiltersOpen(true)}
              >
                {/* Filter Icon */}
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
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
              </button>
            </div>

            {/* Column 1: FilterSidebar (Desktop only) */}
            <div className={styles.desktopOnly}>
              <FilterSidebar
                filters={filters}
                onFilterChange={setFilters}
                onCardTypeChange={() => {}}
                hideMatchPerformance={false}
                hideRarity={true}
                hideTypeToggle={true}
                storagePrefix="champions_unified"
              />
            </div>

            {/* Column 2: Champions */}
            <div
              style={{
                gridColumn: '2 / span 2',
                width: '100%',
                minWidth: 0,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <Champions
                allCards={allCards}
                filters={filters}
                onFilterChange={setFilters}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            </div>
          </div>
        )}

        {activeTab === 'changelog' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <ChangelogModal onClose={() => handleMainTabChange('builder')} />
          </div>
        )}
      </div>

      <button
        className={`${styles.scrollTopButton} ${showScrollTop ? styles.scrollTopButtonVisible : ''}`}
        onClick={scrollToTop}
        title="Scroll to Top"
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
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
      </button>

      {isLoading && allCards.length === 0 && (
        <LoadingOverlay message="Loading cards..." />
      )}



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
    </main>
  );
}
