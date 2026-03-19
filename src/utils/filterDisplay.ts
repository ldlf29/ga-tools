import { FilterState } from '@/types';

export interface DisplayFilter {
  key: keyof FilterState;
  label: string;
  value: string | number;
  displayValue?: string;
}

export function getActiveFiltersDisplay(filters: FilterState): DisplayFilter[] {
  if (!filters.insertionOrder || filters.insertionOrder.length === 0) {
    // Fallback for when insertionOrder is not present (passive display without order awareness)
    // or for legacy state
    const list: DisplayFilter[] = [
      ...filters.rarity.map((v) => ({
        key: 'rarity' as keyof FilterState,
        label: 'RARITY',
        value: v,
      })),
      ...filters.schemeName.map((v) => ({
        key: 'schemeName' as keyof FilterState,
        label: 'SCHEME',
        value: v,
      })),
      ...filters.fur.map((v) => ({
        key: 'fur' as keyof FilterState,
        label: 'FUR',
        value: v,
      })),
      ...(filters.stars.length > 0
        ? [
            {
              key: 'stars' as keyof FilterState,
              label: 'STARS',
              value: 'ACTIVE',
              displayValue:
                filters.stars.length > 0
                  ? Math.min(...filters.stars) === Math.max(...filters.stars)
                    ? `${Math.min(...filters.stars)}`
                    : `${Math.min(...filters.stars)} - ${Math.max(...filters.stars)}`
                  : '',
            },
          ]
        : []),
      ...filters.customClass.map((v) => ({
        key: 'customClass' as keyof FilterState,
        label: 'CLASS',
        value: v,
      })),
      ...filters.specialization.map((v) => ({
        key: 'specialization' as keyof FilterState,
        label: 'SPEC',
        value: v,
      })),
      ...filters.traits.map((v) => ({
        key: 'traits' as keyof FilterState,
        label: 'TRAIT',
        value: v,
      })),
    ];
    return list;
  }

  const mappedInfo: (DisplayFilter | null)[] = filters.insertionOrder.map(
    (orderKey) => {
      if (orderKey === 'stars:ACTIVE') {
        if (filters.stars.length === 0) return null;
        const min = Math.min(...filters.stars);
        const max = Math.max(...filters.stars);
        return {
          key: 'stars' as keyof FilterState,
          label: 'STARS',
          value: 'ACTIVE',
          displayValue: min === max ? `${min}` : `${min} - ${max}`,
        };
      }

      const parts = orderKey.split(':');
      if (parts.length < 2) return null;

      const group = parts[0];
      const valStr = parts.slice(1).join(':');

      const key = group as keyof FilterState;
      // value can be string or number
      const value: string | number = valStr;

      let label = key.toUpperCase();
      if (key === 'schemeName') label = 'SCHEME';
      if (key === 'customClass') label = 'CLASS';
      if (key === 'specialization') label = 'SPEC';
      if (key === 'traits') label = 'TRAIT';
      if (key === 'matchLimit') label = 'MATCHES';

      // For matchLimit, format the display properly
      let displayValue: string | undefined = undefined;
      if (key === 'matchLimit') {
        displayValue = `Last ${value}`;
      }

      return { key, label, value, displayValue };
    }
  );

  const result: DisplayFilter[] = mappedInfo.filter(
    (f): f is DisplayFilter => f !== null
  );

  return result;
}
