import { EnhancedCard } from '@/types';

export const SPECIALIZATIONS_CONFIG: Record<
  string,
  {
    stat: string;
    excludeClasses?: string[];
    threshold?: number; // Config for sorting coefficient or display
    scale?: number;
    filterThreshold?: number; // Separate config for filter matching if needed
  }
> = {
  Gacha: {
    stat: 'deposits',
    excludeClasses: ['Defender', 'Bruiser'],
    threshold: 4,
    scale: 1,
    filterThreshold: 4,
  },
  Killer: {
    stat: 'eliminations',
    excludeClasses: ['Striker'],
    threshold: 1.25,
    scale: 0.75,
    filterThreshold: 1.25,
  },
  'Wart Rider': {
    stat: 'wartDistance',
    excludeClasses: ['Striker', 'Bruiser'],
    threshold: 150,
    scale: 110,
    filterThreshold: 150,
  },
  Winner: {
    stat: 'winRate',
    threshold: 0.37, // Coefficient formula threshold
    scale: 0.25,
    filterThreshold: 52.5,
  },
  Loser: {
    stat: 'winRate',
    threshold: 0.37, // Coefficient formula threshold
    scale: 0.25,
    filterThreshold: 47.5,
  },
  'Bad Streak': {
    stat: 'winRate',
  },
  'Good Streak': {
    stat: 'winRate',
  },
  Score: {
    stat: 'score',
    threshold: 300,
    scale: 100,
  },
};

/**
 * Resolves the metric value based on the matchLimit (e.g., avgDeposits10)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const getStatValueByLimit = (
  card: EnhancedCard,
  baseStat: string,
  limit?: string | number
): number => {
  if (!limit || limit === 'ALL') {
    return (card.custom as any)?.[baseStat] || 0;
  }
  const capitalized = baseStat.charAt(0).toUpperCase() + baseStat.slice(1);
  const key = `avg${capitalized}${limit}`;
  return (card.custom as any)?.[key] || 0;
};

/**
 * Calculates the coefficient ratio for Bad/Good Streak spec
 */
const getStreakRatio = (card: EnhancedCard, limit?: string | number): number => {
  const global = card.custom?.winRate || 0;
  let actual = global;

  if (limit == 10) actual = card.custom?.avgWinRate10 || 0;
  else if (limit == 20) actual = card.custom?.avgWinRate20 || 0;
  else {
    const avg10 = card.custom?.avgWinRate10 || 0;
    const avg20 = card.custom?.avgWinRate20 || 0;
    actual = (avg10 + avg20) / 2;
  }

  return (global + 0.05) / (actual + 0.05);
};

/**
 * Calculates the numeric coefficient for a Specialization (used for sorting)
 */
export const getSpecializationCoefficient = (
  card: EnhancedCard,
  spec: string,
  limit?: string | number
): number => {
  const config = SPECIALIZATIONS_CONFIG[spec];

  if (spec === 'Bad Streak') {
    return getStreakRatio(card, limit) - 1;
  }
  if (spec === 'Good Streak') {
    return 1 - getStreakRatio(card, limit);
  }

  if (!config) return 0;

  let val = getStatValueByLimit(card, config.stat, limit);

  if (spec === 'Winner' || spec === 'Loser') {
    val = val / 100; // Normalize percentage as in sortingUtils
  }

  const threshold = config.threshold ?? 0;
  const scale = config.scale ?? 1;

  return (val - threshold) / scale;
};

/**
 * Verifies if a card matches the Specialization criteria (used for filtering)
 */
export const matchesSpecialization = (
  card: EnhancedCard,
  spec: string,
  limit?: string | number
): boolean => {
  const config = SPECIALIZATIONS_CONFIG[spec];
  if (!config) return true;

  // 1. Exclude Classes
  if (
    config.excludeClasses &&
    card.custom?.class &&
    config.excludeClasses.includes(card.custom.class)
  ) {
    return false;
  }

  // 2. Specialty Logic
  if (spec === 'Bad Streak') {
    return getStreakRatio(card, limit) >= 1;
  }
  if (spec === 'Good Streak') {
    return getStreakRatio(card, limit) <= 1;
  }

  const val = getStatValueByLimit(card, config.stat, limit);

  if (config.filterThreshold !== undefined) {
    if (spec === 'Winner') {
      return val >= config.filterThreshold;
    }
    if (spec === 'Loser') {
      return val <= config.filterThreshold;
    }
    return val > config.filterThreshold;
  }

  return true;
};
