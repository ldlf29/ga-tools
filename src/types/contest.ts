export interface ContestSlot {
  cardType: 'champion' | 'scheme';
  minRarity: string;
  maxRarity: string;
}

export interface LineupConfig {
  slots: ContestSlot[];
}

export interface PrizeSplitConfig {
  defaultSplit: string;
}

export interface Contest {
  id: string;
  name: string;
  description: string;
  gameTypes: string[];
  openDate: string;
  startDate: string;
  endDate: string;
  completed: boolean;
  cancelled: boolean;
  featured: boolean;
  entries: number;
  entryPrice: {
    currency: string;
    amount: number;
  };
  lineupConfig: LineupConfig;
  prizeSplitConfig: PrizeSplitConfig;
  minEntries: number;
  maxEntries: number;
  maxEntriesPerUser: number;
  scoringMethod: string;
}

export interface ContestsResponse {
  data: Contest[];
  total: number;
  page: number;
  limit: number;
}
