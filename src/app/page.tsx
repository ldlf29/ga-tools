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
import AutoLineupsModal, { AutoLineup } from '@/components/AutoLineupsModal';
import ContestTypeModal, {
  ContestType,
  ExactCounts,
} from '@/components/ContestTypeModal';
import { ModeToggle } from '@/components/ModeToggle';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { HeaderControls } from '@/components/HeaderControls';

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
import ChangelogModal from '@/components/ChangelogModal';

// Custom Hooks
import { useCards } from '@/hooks/useCards';
import { useSavedLineups } from '@/hooks/useSavedLineups';
import { useLineupBuilder } from '@/hooks/useLineupBuilder';
import { useWorkerFilter } from '@/hooks/useWorkerFilter';

export default function Home() {
  /* Global UI State */
  const [activeTab, setActiveTab] = useState<
    'builder' | 'lineups' | 'champions' | 'changelog'
  >('builder');
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

  /* Auto Lineups State */
  const [autoLineupsModalOpen, setAutoLineupsModalOpen] = useState(false);
  const [currentAutoLineups, setCurrentAutoLineups] = useState<AutoLineup[]>(
    []
  );
  const [contestModalOpen, setContestModalOpen] = useState(false);
  const [pendingAutoFilters, setPendingAutoFilters] =
    useState<Partial<FilterState> | null>(null);
  const [isSuggestionActive, setIsSuggestionActive] = useState(false);

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
    newTab: 'builder' | 'lineups' | 'champions' | 'changelog'
  ) => {
    if (newTab === activeTab) {
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
    } else if (newTab === 'champions') {
      const targetState = championsStateRef.current;
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
      if (key === 'stars') {
        newValues = [];
      } else if (key === 'matchLimit') {
        newValues = 'ALL';
      } else if (Array.isArray(currentValues)) {
        newValues = (currentValues as any[]).filter((v) => v !== value);
      }
      let newOrder = prev.insertionOrder ? [...prev.insertionOrder] : [];
      const orderKey = `${key}:${value}`;
      newOrder = newOrder.filter((k) => k !== orderKey);
      return { ...prev, [key]: newValues, insertionOrder: newOrder };
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

  const handleAutoLineups = (suggestionFilters: Partial<FilterState>) => {
    // 1. Get current scheme card if any
    const schemeCard = lineup.find((c) => c.cardType === 'SCHEME');
    if (!schemeCard) {
      addToast('A Scheme is required for Auto Lineups.', 'error');
      return;
    }

    // 2. Special fast-path for "Collect 'Em All": skip the contest modal
    if (schemeCard.name === "Collect 'Em All") {
      setPendingAutoFilters(suggestionFilters);
      // Directly generate with 1 of each rarity, best by score
      generateCollectEmAllLineups(suggestionFilters, schemeCard);
      return;
    }

    // 3. All other Schemes: open contest type modal
    setPendingAutoFilters(suggestionFilters);
    setContestModalOpen(true);
  };

  const generateCollectEmAllLineups = (
    suggestionFilters: Partial<FilterState>,
    schemeCard: EnhancedCard
  ) => {
    const sourceCards = cardMode === 'USER' ? userCards : allCards;

    // Sort all MOKI cards by score (best first), then remove duplicate names
    const baseFilters: FilterState = {
      rarity: [],
      cardType: 'MOKI',
      schemeName: [],
      fur: [],
      stars: [],
      customClass: [],
      specialization: ['Score'],
      traits: [],
      insertionOrder: ['specialization:Score'],
      matchLimit: filters.matchLimit ?? 'ALL', // Respect active match performance filter
    };

    const allMokis = sourceCards.filter((c) => c.cardType === 'MOKI');

    // Merge active Context specs from sidebar (Winner/Loser/Good Streak/Bad Streak)
    // These override the Scheme's default Context.
    const CONTEXT_SPECS = ['Winner', 'Loser', 'Good Streak', 'Bad Streak'];
    const ROLE_SPECS_SET = ['Gacha', 'Killer', 'Wart Rider'];

    // 1. Roles come from suggestionFilters (passed by AUTO button)
    const passedRoleSpecs = (suggestionFilters.specialization || []).filter(
      (s) => ROLE_SPECS_SET.includes(s)
    );
    if (passedRoleSpecs.length > 0) {
      baseFilters.specialization = [
        ...baseFilters.specialization,
        ...passedRoleSpecs,
      ];
    }

    // 2. Roles from sidebar (Gacha/Killer/Wart Rider)
    const sidebarRoleSpecs = (filters.specialization || []).filter((s) =>
      ROLE_SPECS_SET.includes(s)
    );
    if (sidebarRoleSpecs.length > 0) {
      sidebarRoleSpecs.forEach((role) => {
        if (!baseFilters.specialization.includes(role)) {
          baseFilters.specialization.push(role);
        }
      });
    }

    // 3. Context specs come from sidebar
    const sidebarContextSpecs = (filters.specialization || []).filter((s) =>
      CONTEXT_SPECS.includes(s)
    );
    if (sidebarContextSpecs.length > 0) {
      baseFilters.specialization = baseFilters.specialization.filter(
        (s) => !CONTEXT_SPECS.includes(s)
      );
      baseFilters.specialization.push(...sidebarContextSpecs);
    }

    // 1. Filter by role/context specs if any are active (STRICT FILTER)
    const hasActiveSpecs = baseFilters.specialization.some(
      (s) => s !== 'Score'
    );
    const filteredMokis = hasActiveSpecs
      ? allMokis.filter((c) =>
          matchesFilter(c, { ...baseFilters, rarity: [] }, '')
        )
      : allMokis;

    // 2. Sort the filtered pool
    const sortedMokis = sortCardsByFilters(
      filteredMokis,
      baseFilters,
      'default'
    );

    // 3. Separate into rarity groups (they remain sorted by selection criteria)
    const lPool = sortedMokis.filter(
      (c) => c.rarity.toLowerCase() === 'legendary'
    );
    const ePool = sortedMokis.filter((c) => c.rarity.toLowerCase() === 'epic');
    const rPool = sortedMokis.filter((c) => c.rarity.toLowerCase() === 'rare');
    const bPool = sortedMokis.filter((c) =>
      ['basic', 'common'].includes(c.rarity.toLowerCase())
    );

    const generatedLineups: AutoLineup[] = [];
    const usedIds = new Set<string>();

    for (let count = 1; count <= 5; count++) {
      // For each lineup, we need 4 different names
      const lineupNames = new Set<string>();

      const findBestUnused = (pool: EnhancedCard[]) => {
        for (let i = 0; i < pool.length; i++) {
          const card = pool[i];
          if (!usedIds.has(card.id) && !lineupNames.has(card.name)) {
            pool.splice(i, 1); // Remove from pool so it's not reused in next lineup
            usedIds.add(card.id);
            lineupNames.add(card.name);
            return card;
          }
        }
        return null;
      };

      const legendary = findBestUnused(lPool);
      const epic = findBestUnused(ePool);
      const rare = findBestUnused(rPool);
      const basic = findBestUnused(bPool);

      if (!legendary || !epic || !rare || !basic) break;

      generatedLineups.push({
        id: `auto-${Date.now()}-${count}`,
        name: `${schemeCard.name} Auto ${count}`,
        cards: [legendary, epic, rare, basic, schemeCard],
      });
    }

    if (generatedLineups.length === 0) {
      addToast("Not enough cards of each rarity for Collect 'Em All.", 'error');
    } else {
      setCurrentAutoLineups(generatedLineups);
      setAutoLineupsModalOpen(true);
    }
  };

  const generateAutoLineups = (
    contestType: ContestType,
    exactCounts?: ExactCounts
  ) => {
    setContestModalOpen(false);
    const suggestionFilters = pendingAutoFilters;
    if (!suggestionFilters) return;

    const schemeCard = lineup.find((c) => c.cardType === 'SCHEME');
    if (!schemeCard) return;

    // We start with a base filter setting for Moki search
    const baseFilters: FilterState = {
      rarity: [],
      cardType: 'MOKI',
      schemeName: [],
      fur: [],
      stars: [],
      customClass: [],
      specialization: ['Score'], // Forcibly inject Score
      traits: [],
      insertionOrder: ['specialization:Score'],
      matchLimit: filters.matchLimit ?? 'ALL', // Respect active match performance filter
    };

    // Apply Contest Rules
    switch (contestType) {
      case 'ONLY_LEGENDARY':
        baseFilters.rarity = ['Legendary'];
        break;
      case 'ONLY_EPIC':
        baseFilters.rarity = ['Epic'];
        break;
      case 'ONLY_RARE':
        baseFilters.rarity = ['Rare'];
        break;
      case 'ONLY_BASIC':
        baseFilters.rarity = ['Basic', 'Common'];
        break;
      case 'UP_TO_EPIC':
        baseFilters.rarity = ['Epic', 'Rare', 'Basic', 'Common'];
        break;
      case 'UP_TO_RARE':
        baseFilters.rarity = ['Rare', 'Basic', 'Common'];
        break;
      case 'OPEN':
      case 'OTHER':
        break; // No absolute preliminary restrictions, exact rarity counting handles 'OTHER' below.
    }

    // Merge the suggestion filters into the base
    Object.entries(suggestionFilters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // If specialization, we already added Score, so append
        if (key === 'specialization') {
          baseFilters.specialization = ['Score', ...(value as string[])];
          (value as string[]).forEach((v) =>
            baseFilters.insertionOrder?.push(`specialization:${v}`)
          );
        } else {
          (baseFilters as any)[key] = value;
          (value as string[]).forEach((v) =>
            baseFilters.insertionOrder?.push(`${key}:${v}`)
          );
        }
      } else if (key === 'matchLimit') {
        baseFilters.matchLimit = value as 'ALL' | 10 | 20 | 30;
      }
    });

    // Merge active Context specs from sidebar (Winner/Loser/Good Streak/Bad Streak)
    // These override any Context the Scheme's suggestion may already have.
    const CONTEXT_SPECS = ['Winner', 'Loser', 'Good Streak', 'Bad Streak'];
    const sidebarContextSpecs = (filters.specialization || []).filter((s) =>
      CONTEXT_SPECS.includes(s)
    );
    if (sidebarContextSpecs.length > 0) {
      baseFilters.specialization = baseFilters.specialization.filter(
        (s) => !CONTEXT_SPECS.includes(s)
      );
      baseFilters.specialization.push(...sidebarContextSpecs);
    }

    // Role specs from sidebar (Gacha/Killer/Wart Rider) are ignored by default
    // UNLESS the scheme is one of the 7 whitelisted "flexible" schemes.
    const ROLE_WHITELIST = [
      'Divine Intervention',
      'Golden Shower',
      'Midnight Strike',
      'Rainbow Riot',
      'Taking a Dive',
      'Victory Lap',
      'Whale Watching',
    ];
    if (ROLE_WHITELIST.includes(schemeCard.name)) {
      const ROLE_SPECS_SET = ['Gacha', 'Killer', 'Wart Rider'];
      const sidebarRoleSpecs = (filters.specialization || []).filter((s) =>
        ROLE_SPECS_SET.includes(s)
      );
      if (sidebarRoleSpecs.length > 0) {
        // Add roles from sidebar without removing existing roles from the scheme itself
        sidebarRoleSpecs.forEach((role) => {
          if (!baseFilters.specialization.includes(role)) {
            baseFilters.specialization.push(role);
          }
        });
      }
    }

    const sourceCards = cardMode === 'USER' ? userCards : allCards;

    // Filter them
    const validMokis = sourceCards.filter(
      (c) => c.cardType === 'MOKI' && matchesFilter(c, baseFilters, '')
    );

    // Sort them (score & specialization happens here)
    const sortedMokis = sortCardsByFilters(validMokis, baseFilters, 'default');

    // Force Rarity to have the absolute highest priority on top of score
    sortedMokis.sort(
      (a, b) => getRarityValue(b.rarity) - getRarityValue(a.rarity)
    );

    // Remove duplicates
    const uniqueMokis: EnhancedCard[] = [];
    const seenNames = new Set<string>();

    for (const moki of sortedMokis) {
      if (!seenNames.has(moki.name)) {
        uniqueMokis.push(moki);
        seenNames.add(moki.name);
      }
    }

    // Partition into Teams of 4
    const generatedLineups: AutoLineup[] = [];

    if (contestType === 'OTHER' && exactCounts) {
      // Exact count distribution logic
      const legendaryList = uniqueMokis.filter(
        (c) => c.rarity.toLowerCase() === 'legendary'
      );
      const epicList = uniqueMokis.filter(
        (c) => c.rarity.toLowerCase() === 'epic'
      );
      const rareList = uniqueMokis.filter(
        (c) => c.rarity.toLowerCase() === 'rare'
      );
      const basicList = uniqueMokis.filter((c) =>
        ['basic', 'common'].includes(c.rarity.toLowerCase())
      );

      for (let count = 1; count <= 5; count++) {
        if (
          legendaryList.length >= exactCounts.legendary &&
          epicList.length >= exactCounts.epic &&
          rareList.length >= exactCounts.rare &&
          basicList.length >= exactCounts.basic
        ) {
          const chunk: EnhancedCard[] = [
            ...legendaryList.splice(0, exactCounts.legendary),
            ...epicList.splice(0, exactCounts.epic),
            ...rareList.splice(0, exactCounts.rare),
            ...basicList.splice(0, exactCounts.basic),
          ];

          generatedLineups.push({
            id: `auto-${Date.now()}-${count}`,
            name: `${schemeCard.name} Auto ${count}`,
            cards: [...chunk, schemeCard],
          });
        } else {
          break; // Insufficient cards to fill the exact rarity combo for the next lineup
        }
      }
    } else {
      // Standard full greedy grouping
      let count = 1;
      for (
        let i = 0;
        i < uniqueMokis.length && generatedLineups.length < 5;
        i += 4
      ) {
        const chunk = uniqueMokis.slice(i, i + 4);
        if (chunk.length === 4) {
          generatedLineups.push({
            id: `auto-${Date.now()}-${count}`,
            name: `${schemeCard.name} Auto ${count}`,
            cards: [...chunk, schemeCard],
          });
          count++;
        }
      }
    }

    // Results
    if (generatedLineups.length === 0) {
      addToast(
        'Not enough matching Mokis found for these restrictions.',
        'error'
      );
    } else {
      setCurrentAutoLineups(generatedLineups);
      setAutoLineupsModalOpen(true);
    }
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
          storagePrefix={activeTab}
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
          onAutoLineups={handleAutoLineups}
          onShowMessage={(msg) => addToast(msg, 'suggestion', true)}
          activeSpecializations={filters.specialization ?? []}
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
                  onAutoLineups={handleAutoLineups}
                  onShowMessage={(msg) => addToast(msg, 'suggestion', true)}
                  activeSpecializations={filters.specialization ?? []}
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

        {activeTab === 'champions' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
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

      {/* Request Contest Type Modal */}
      <ContestTypeModal
        isOpen={contestModalOpen}
        onClose={() => setContestModalOpen(false)}
        onGenerate={generateAutoLineups}
      />

      {/* Auto Lineups Modal */}
      <AutoLineupsModal
        isOpen={autoLineupsModalOpen}
        onClose={() => setAutoLineupsModalOpen(false)}
        autoLineups={currentAutoLineups}
        onError={(msg) => addToast(msg, 'error')}
        onSaveLineup={(name, cards) => {
          saveLineupToStorage(name, cards);
          addToast(`Lineup "${name}" Saved!`, 'success');
        }}
      />

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
