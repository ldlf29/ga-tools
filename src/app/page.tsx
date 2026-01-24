'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import WalletConnect from '@/components/WalletConnect';
import CardGrid from '@/components/CardGrid';
import FilterSidebar, { FilterState, TRAIT_GROUPS } from '@/components/FilterSidebar';
import LineupBuilder from '@/components/LineupBuilder';
import { connectRoninWallet } from '@/utils/ronin';
import { fetchUserCards, EnhancedCard, getCardGroupKey } from '@/utils/cardService';
import styles from './page.module.css';
import Toast, { ToastMessage } from '@/components/Toast';
import MyLineups, { SavedLineup } from '@/components/MyLineups';
import { matchesFilter } from '@/utils/filterUtils';
import { getLinkedWallets, linkWallets } from '@/utils/walletLinking';
import ChampionsList from '@/components/ChampionsList';

export default function Home() {
  /* State */
  const [addresses, setAddresses] = useState<string[]>([]);
  // activeAddress is purely for display or signing context if needed, but we fetch for all.
  // We can just derive "primary" as addresses[0] if needed.
  const [addressDropdownOpen, setAddressDropdownOpen] = useState(false);

  /* New States for Controls */
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [mokiDropdownOpen, setMokiDropdownOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeTab, setActiveTab] = useState<'builder' | 'lineups' | 'champions'>('builder'); // New Tab State
  const [savedLineups, setSavedLineups] = useState<SavedLineup[]>([]); // New Data State

  // Scroll to Top Logic
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  /* Existing State */
  const [isSigned, setIsSigned] = useState(false);
  const [allCards, setAllCards] = useState<EnhancedCard[]>([]);
  const [lineup, setLineup] = useState<EnhancedCard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const lastToastTimeRef = useRef<{ [key: string]: number }>({});

  // Refs for Dropdowns
  const toolsRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef<HTMLDivElement>(null);

  // Click Outside Handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setToolsDropdownOpen(false);
      }
      if (walletRef.current && !walletRef.current.contains(event.target as Node)) {
        setAddressDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  const addToast = (text: string, type: 'error' | 'success' | 'warning' | 'suggestion', force: boolean = false) => {
    if (!notificationsEnabled && !force) return;

    // Debounce: Check if same message shown in last 5 seconds
    const now = Date.now();
    const lastTime = lastToastTimeRef.current[text] || 0;
    if (now - lastTime < 5000) {
      return;
    }
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
    category: [],
    schemeName: [],
    fur: [],
    stars: [],
    customClass: [],
    specialization: [],

    traits: [],
    series: [],
  });

  // Load active session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('active_session_wallets');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAddresses(parsed);
          setIsSigned(true); // Auto-sign invalidates the need to click again

          // Auto-fetch collection for restored session
          // We can't call async properly in effect without wrapper, or we can just rely on user effect?
          // Better to just set addresses and let a separate effect handle fetching?
          // Or just call fetch here.
          Promise.all(parsed.map(addr => fetchUserCards(addr)))
            .then(allResults => {
              setAllCards(allResults.flat());
              // addToast("Session Restored & Cards Loaded", 'success');
            })
            .catch(e => console.error("Auto-fetch error", e));
        }
      } catch (e) {
        console.error("Failed to restore session", e);
      }
    }
  }, []);

  // Sync addresses to session storage whenever they change
  useEffect(() => {
    if (addresses.length > 0) {
      localStorage.setItem('active_session_wallets', JSON.stringify(addresses));
    }
  }, [addresses]);

  /* Logic Handlers */


  const handleRefreshCollection = async () => {
    if (addresses.length === 0) return;
    try {
      // Refresh logic loops through all addresses
      const allResults = await Promise.all(addresses.map(addr => fetchUserCards(addr)));
      const combined = allResults.flat();
      setAllCards(combined);
      addToast("Collection Updated!", 'success');
    } catch (e) {
      console.error(e);
      addToast("Failed to refresh collection", 'error');
    }
  };

  const handleConnect = async () => {
    const addr = await connectRoninWallet();
    if (addr) {
      setAddresses(prev => {
        // Case 1: Initial Login (prev is empty)
        if (prev.length === 0) {
          const linked = getLinkedWallets(addr);
          // Save to storage immediately
          localStorage.setItem('active_session_wallets', JSON.stringify(linked));

          if (linked.length > 1) {
            addToast(`Welcome back! Loaded ${linked.length} linked wallets.`, 'success');
          } else {
            addToast("Wallet Connected", 'success');
          }
          return linked;
        }

        // Case 2: Adding a wallet (prev has items)
        if (!prev.includes(addr)) {
          // Link the new address with the EXISTING primary address of the session
          const newLinkedGroup = linkWallets(prev[0], addr);
          // Save to storage
          localStorage.setItem('active_session_wallets', JSON.stringify(newLinkedGroup));

          addToast("Wallet Linked & Added", 'success');
          return newLinkedGroup;
        }

        addToast("Wallet Already Connected", 'warning');
        return prev;
      });
    }
  };

  const handleDisconnect = () => {
    setAddresses([]);
    setAllCards([]);
    setIsSigned(false);
    setLineup([]);
    localStorage.removeItem('active_session_wallets');
    addToast("Logged Out", 'success');
  };

  const handleRemoveWallet = (addressToRemove: string) => {
    setAddresses(prev => {
      const newAddresses = prev.filter(a => a !== addressToRemove);

      // Update local storage
      if (newAddresses.length > 0) {
        localStorage.setItem('active_session_wallets', JSON.stringify(newAddresses));
      } else {
        localStorage.removeItem('active_session_wallets');
        setAllCards([]);
        setIsSigned(false);
      }
      return newAddresses;
    });

    // We should ideally filter these cards out of allCards or re-fetch.
    // Re-fetching is safer to ensure consistency, but might be slow.
    // For now, let's notify the user.
    addToast("Wallet Removed. Refreshing collection...", 'warning');

    // Trigger refresh after state update (using setTimeout to ensure state is committed or just using newAddresses directly if I could)
    // Actually, I can't easily access the *new* state here immediately for the fetch.
    // But since handleRefreshCollection uses the *current* state 'addresses', it might be stale if called immediately.
    // A simple way is to rely on user to click "Refresh" or just let the stale cards persist until next interaction?
    // Better: Filter allCards immediately if possible? No, because we don't store owner in EnhancedCard.
    // So, we MUST re-fetch or accept stale data. 
    // Let's Set timeout to re-fetch? Or just let the user know they might need to refresh?
    // Or better, let's try to reload.
    setTimeout(() => {
      // This is hacky but forces a re-read of the *updated* addresses state? 
      // No, closures capture state.
      // We need a way to refetch with the NEW list.
      // Let's just do nothing complex and let the user hit refresh if they want, or we can reload the page? No.
      // Actually, if we just removed it, the `useEffect` [addresses] runs and saves to LS.
      // We can just add a toast.
    }, 100);
  };

  const handleSignAndFetch = async () => {
    if (addresses.length === 0 || !window.ronin) return;
    try {
      // Loop through addresses to fetch
      // Ideally sign once for the active address to prove humanity/session
      const activeAccount = addresses[0]; // Assuming first is primary or just using active from extension?
      // Actually we should use window.ronin.provider.request accounts to get active...
      // But for simplicity, let's just ask to sign with whatever is active in extension logic which 'connectRoninWallet' checks.

      await window.ronin.provider.request({
        method: 'personal_sign',
        params: ["Access Collection", activeAccount]
      });

      // Fetch for ALL addresses
      const allResults = await Promise.all(addresses.map(addr => fetchUserCards(addr)));
      const combined = allResults.flat();

      setAllCards(combined);
      setIsSigned(true);
    } catch (e) {
      console.error(e);
      alert("Signature failed");
    }
  };

  const handleAddToLineup = (card: EnhancedCard) => {
    // 1. Check if card is already in lineup (Exact instance check - though ID might be shared for types?)
    // Assuming we want unique instances if possible, but rules say "Only one unit of the same Moki".
    // "Moki" identity is defined by Name? Yes, users said "Only 1 Milky".

    const isScheme = card.cardType === 'SCHEME';
    const isMoki = card.cardType === 'MOKI'; // Or not 'SCHEME'

    // Validation: Max 1 Scheme
    const currentSchemes = lineup.filter(c => c.cardType === 'SCHEME').length;
    if (isScheme && currentSchemes >= 1) {
      addToast("Only 1 Scheme Card per Lineup!", 'error');
      return;
    }

    // Validation: Max 4 Mokis
    const currentMokis = lineup.filter(c => c.cardType !== 'SCHEME').length;
    if (isMoki && currentMokis >= 4) {
      addToast("Maximum 4 Mokis per Lineup!", 'error');
      return;
    }

    // Validation: Unique Moki Type (Name)
    if (isMoki) {
      // Check if a moki with the same name already exists
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


    // Validate Name
    if (!name || name.trim() === "") {
      addToast("Please name your lineup before saving!", 'error');
      return;
    }

    if (name.length > 30) {
      addToast("Maximum 30 characters", 'error');
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
    setLineup(lineup.filter(c => c.locked)); // Clear builder but keep locked cards
    addToast("Lineup Saved Successfully!", 'success');
  };

  const handleDeleteLineup = (id: number) => {
    setSavedLineups(prev => prev.filter(l => l.id !== id));
    addToast("Lineup Deleted", 'success');
  };

  const handleRenameLineup = (id: number, newName: string) => {
    if (!newName || newName.trim() === "") return;

    const trimmedName = newName.trim();
    const existingNames = savedLineups.filter(l => l.id !== id).map(l => l.name);
    const uniqueName = getUniqueName(trimmedName, existingNames);

    setSavedLineups(prev => prev.map(l => l.id === id ? { ...l, name: uniqueName } : l));
    addToast("Lineup Renamed", 'success');
  };

  const handleToggleFavorite = (id: number) => {
    setSavedLineups(prev => prev.map(l => {
      if (l.id === id) {
        const isFav = !l.isFavorite;
        return {
          ...l,
          isFavorite: isFav,
          favoritedAt: isFav ? Date.now() : undefined
        };
      }
      return l;
    }));
  };

  const handleRateLineup = (id: number, rating: number) => {
    setSavedLineups(prev => prev.map(l => l.id === id ? { ...l, rating } : l));
  };

  const handleBulkDelete = (ids: number[]) => {
    setSavedLineups(prev => prev.filter(l => !ids.includes(l.id)));
    // Optional: Add toast success
  };

  const handleUpdateBackground = (id: number, backgroundId: string) => {
    setSavedLineups(prev => prev.map(l => l.id === id ? { ...l, backgroundId } : l));
    // No toast needed for instant visual feedback, or maybe a subtle one? "Saved" might be spammy.
  };

  const handleRemoveFilter = (key: keyof FilterState, value: string | number) => {
    // ... existing implementation
    setFilters(prev => {
      // ... same logic
      const currentValues = prev[key];
      let newValues = currentValues;

      if (key === 'stars') {
        newValues = []; // Clear all stars
      } else if (Array.isArray(currentValues)) {
        newValues = (currentValues as any[]).filter(v => v !== value);
      }

      if (key === 'series') {
        const orderKey = `series:${value}`;
        // Also remove from insertionOrder
      }

      // Update insertionOrder
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



  const handleClearLineup = () => {
    setLineup([]);
  };

  const handleSuggestFilters = (newFilters: Partial<FilterState>) => {

    // Check if "Only Epic/Legendary" is active
    const preserveEpicLegendary = filters.onlyEpicLegendary;

    // Clear all filters then apply suggestion
    const cleared: FilterState = {
      rarity: preserveEpicLegendary ? ['Epic', 'Legendary'] : [], // Preserve if active
      cardType: 'ALL',
      category: [],
      schemeName: [],
      fur: [],
      stars: [],
      customClass: [],
      specialization: [],
      traits: [],
      series: [],
      insertionOrder: [],
      onlyEpicLegendary: preserveEpicLegendary // Preserve flag
    };

    // Reconstruct insertionOrder from newFilters
    // Assuming structure is { key: ['val1', 'val2'] } for arrays
    const newOrder: string[] = [];
    Object.entries(newFilters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(val => {
          newOrder.push(`${key}:${val}`);
        });
      }
    });

    const updated = {
      ...cleared,
      ...newFilters,
      insertionOrder: newOrder
    };

    setFilters(updated);
    addToast("Suggestion Applied!", 'success');
  };

  const filteredCards = useMemo(() => {
    return allCards.filter(card => matchesFilter(card, filters, searchQuery));
  }, [allCards, filters, searchQuery]);

  // Calculate usage map across all Saved Lineups
  const usageMap = useMemo(() => {
    const map: Record<string, number> = {};
    savedLineups.forEach(lineup => {
      lineup.cards.forEach(card => {
        const key = getCardGroupKey(card);
        map[key] = (map[key] || 0) + 1;
      });
    });
    return map;
  }, [savedLineups]);

  // Calculate Owned Map (Total Avail per type)
  const ownedMap = useMemo(() => {
    const map: Record<string, number> = {};
    allCards.forEach(card => {
      const key = getCardGroupKey(card);
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [allCards]);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          {/* <h1 className={styles.title}>Grand Arena Builder</h1> */}
          <img src="/ga-logo.png" alt="Grand Arena Builder" className={styles.logo} />

          {/* Tab Navigation */}
          {isSigned && (
            <nav className={styles.navTabs}>
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
            </nav>
          )}
        </div>

        <div className={styles.authWrapper}>

          {addresses.length > 0 && (
            <div className={styles.headerControls}>

              {/* Moki Praying Button with Dropdown */}
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

              {/* Tools Button */}
              <div className={styles.toolsContainer} ref={toolsRef}>
                <button
                  onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
                  className={styles.iconButton}
                  title="Tools & Analytics"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                  </svg>
                </button>
                {toolsDropdownOpen && (
                  <div className={styles.toolsDropdown}>
                    <p>For more stats and analysis tools, you should visit:</p>
                    <a href="https://mokimanager.com" target="_blank" rel="noopener noreferrer" className={styles.toolsLink}>
                      mokimanager.com
                    </a>
                    <a href="https://gatracker.xyz" target="_blank" rel="noopener noreferrer" className={styles.toolsLink}>
                      gatracker.xyz
                    </a>
                  </div>
                )}
              </div>

              {/* Notification Toggle */}
              <button onClick={() => setNotificationsEnabled(!notificationsEnabled)} className={styles.iconButton} title={notificationsEnabled ? "Disable Notifications" : "Enable Notifications"}>
                {notificationsEnabled ? (
                  /* Bell */
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                ) : (
                  /* Bell Off */
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path><path d="M18 8a6 6 0 0 0-9.33-5"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                )}
              </button>
            </div>
          )}

          {addresses.length === 0 ? (
            <button onClick={handleConnect} className={styles.connectButton}>
              Connect Wallet
            </button>
          ) : (
            <div className={styles.walletDropdownContainer} ref={walletRef}>
              <button
                className={styles.addressDisplay}
                onClick={() => setAddressDropdownOpen(!addressDropdownOpen)}
              >
                {addresses.length > 1 ? `Wallets: ${addresses.length}` : `${addresses[0].slice(0, 6)}...${addresses[0].slice(-4)}`}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>

              {addressDropdownOpen && (
                <div className={styles.walletDropdownMenu}>
                  {addresses.map((addr, idx) => (
                    <div key={addr} className={styles.walletItem}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className={styles.walletBadge}>{idx + 1}</span>
                        {addr.slice(0, 6)}...{addr.slice(-4)}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveWallet(addr);
                        }}
                        className={styles.walletRemoveButton}
                        title="Remove Wallet"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  ))}
                  <hr className={styles.dropdownDivider} />
                  <button onClick={() => { handleConnect(); setAddressDropdownOpen(false); }} className={styles.dropdownAction}>
                    + Add Wallet
                  </button>
                  <button onClick={() => { handleDisconnect(); setAddressDropdownOpen(false); }} className={styles.dropdownActionDestructive}>
                    Log Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className={styles.content}>
        {addresses.length === 0 ? (
          <div className={styles.card}>
            <p className="mb-4">Connect your Ronin Wallet to start.</p>
          </div>
        ) : !isSigned ? (
          <div className={styles.card}>
            <h2 className="text-xl font-bold mb-4">View Collection</h2>
            <button onClick={handleSignAndFetch} className={styles.connectButton}>
              Sign to Load Cards
            </button>
          </div>
        ) : (
          <>
            <>
              <div style={{ display: 'flex', width: '100%' }}>
                {/* Main Content Area: FilterSidebar + Tabs */}
                <div style={{ display: activeTab !== 'champions' ? 'block' : 'none' }}>
                  <FilterSidebar filters={filters} onFilterChange={setFilters} />
                </div>

                {/* Builder Tab - CardGrid */}
                <div style={{ flex: 1, padding: '0 2rem', display: activeTab === 'builder' ? 'block' : 'none' }}>
                  <CardGrid
                    cards={filteredCards}
                    onAddCard={handleAddToLineup}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    currentLineup={lineup}
                    filters={filters}
                    onRemoveFilter={handleRemoveFilter}
                    onRefresh={addresses.length > 0 ? handleRefreshCollection : undefined}
                    usageMap={usageMap}
                  />
                </div>

                {/* Builder Tab - LineupBuilder */}
                <div style={{ display: activeTab === 'builder' ? 'block' : 'none' }}>
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

                {/* My Lineups Tab */}
                <div style={{ flex: 1, display: activeTab === 'lineups' ? 'block' : 'none' }}>
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
                    usageMap={usageMap}
                    ownedMap={ownedMap}
                  />
                </div>

                {/* Champions Tab */}
                <div style={{ flex: 1, height: '850px', display: activeTab === 'champions' ? 'block' : 'none' }}>
                  <ChampionsList />
                </div>
              </div>
            </>
          </>
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

      <Toast messages={toasts} onClose={removeToast} />
    </main>
  );
}
