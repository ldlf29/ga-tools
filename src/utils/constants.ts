export const MOKI_CLASSES = [
  'Anchor',
  'Bruiser',
  'Center',
  'Defender',
  'Flanker',
  'Forward',
  'Grinder',
  'Sprinter',
  'Striker',
  'Support',
] as const;

export const MOKI_FURS = [
  'Common',
  'Rainbow',
  'Gold',
  'Shadow',
  'Spirit',
  '1 of 1',
] as const;

export const RARITY_LEVELS = ['Basic', 'Rare', 'Epic', 'Legendary'] as const;

/**
 * Flat list of every individual NFT trait value that triggers at least one Trait Scheme.
 * Derived from traits.md. Used to filter card.custom.traits for display.
 */
export const SCHEME_RELEVANT_TRAITS = new Set<string>([
  // Call to Arms
  'Background - Ronin Moon',
  'Background - Ronin Aurora',
  'Clothing - Ronin',
  'Clothing - Samurai',
  'Head Accessory - Ronin',
  // Dungaree Duel
  'Clothing - Pink Overalls',
  'Clothing - Blue Overalls',
  'Clothing - Green Overalls',
  // Shapeshifting
  'Mouth - Tongue out',
  'Head Accessory - Tanuki Mask',
  'Head Accessory - Kitsune Mask',
  'Head Accessory - Cat Mask',
  // Malicious Intent
  'Mouth - Devious',
  'Head Accessory - Oni Mask',
  'Head Accessory - Tengu Mask',
  'Head Accessory - Skull Mask',
  'Head Accessory - Horns',
  'Head Accessory - TMA Noble Skull',
  // Housekeeping
  'Clothing - Blue Artist Apron',
  'Clothing - Yellow Artist Apron',
  'Clothing - Maid Apron',
  'Clothing - Garbage Can',
  'Clothing - Gold Can',
  'Clothing - Toilet Paper',
  'Head Accessory - Toilet Paper',
  'Hand Accessory - Toilet Paper',
  // Tear Jerking
  'Eye - Crying',
  // Costume Party
  'Clothing - Black Sheep Onesie',
  'Clothing - Tiger Onesie',
  'Clothing - Neko Onesie',
  'Clothing - Wolf Onesie',
  'Clothing - Pig Onesie',
  'Clothing - Cat Onesie',
  'Clothing - Ratz Onesie',
  'Clothing - Cow Onesie',
  'Clothing - Penguin Onesie',
  'Clothing - Corn Onesie',
  'Clothing - White Sheep Onesie',
  'Clothing - Banana Onesie',
  'Clothing - CyberKongz Onesie',
  'Clothing - Kappa Onesie',
  'Clothing - Potato Onesie',
  'Clothing - Avocado Onesie',
  'Head Accessory - Lemon Head',
  'Head Accessory - Kappa Head',
  'Head Accessory - Tomato Head',
  'Head Accessory - Bear Head',
  'Head Accessory - Frog Head',
  'Head Accessory - Blobfish Head',
  // Dress to Impress
  'Clothing - Spirit Kimono',
  'Clothing - Gold Kimono',
  'Clothing - Rainbow Kimono',
  'Clothing - Daimyo Kimono with Katanas',
  'Clothing - Daimyo Kimono',
  'Clothing - Straw Kimono',
  'Clothing - Blue Kimono',
  'Clothing - Casual Kimono',
]);
