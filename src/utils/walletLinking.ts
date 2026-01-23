
/**
 * Utility to manage linked wallets in LocalStorage.
 * This simulates a "User Profile" by remembering which addresses are associated with each other.
 */

const STORAGE_KEY = 'ronin_linked_wallets';

type LinkedWalletsMap = Record<string, string[]>;

/**
 * Retrieves the full map of linked wallets from storage.
 */
const getStorageMap = (): LinkedWalletsMap => {
    if (typeof window === 'undefined') return {};
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    try {
        return JSON.parse(stored);
    } catch (e) {
        console.error("Failed to parse linked wallets", e);
        return {};
    }
};

/**
 * Saves the map to storage.
 */
const saveStorageMap = (map: LinkedWalletsMap) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

/**
 * Returns all wallets linked to the given address (including itself).
 */
export const getLinkedWallets = (address: string): string[] => {
    const map = getStorageMap();
    // Normalize address to lowercase just in case
    const key = address.toLowerCase();

    // Look for map entry
    // Keys in map should probably be lowercase for consistency
    const entry = map[key];

    if (entry) {
        // Ensure uniqueness and that the address itself is included
        return Array.from(new Set([...entry, address]));
    }

    return [address];
};

/**
 * Links two addresses together.
 * Merges their existing groups into one large group and updates all references.
 */
export const linkWallets = (address1: string, address2: string): string[] => {
    const map = getStorageMap();
    const key1 = address1.toLowerCase();
    const key2 = address2.toLowerCase();

    // Get existing groups
    const group1 = map[key1] || [address1];
    const group2 = map[key2] || [address2];

    // Merge groups
    // We store the original casing if possible, but keys are lower
    // Let's assume input addresses have correct casing for display
    const mergedVar = Array.from(new Set([...group1, ...group2, address1, address2]));

    // Update map for EVERY member of the new group
    mergedVar.forEach(addr => {
        map[addr.toLowerCase()] = mergedVar;
    });

    saveStorageMap(map);
    return mergedVar;
};
