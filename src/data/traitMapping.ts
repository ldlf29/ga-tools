/**
 * This file is auto-generated/manually maintained based on traits.md
 * It helps filter which traits are displayed in the Champion Modal.
 */

export const SCHEME_TRAITS = [
  // Call to Arms
  "Ronin Moon",
  "Ronin Aurora",
  "Ronin",
  "Samurai",
  
  // Dungaree Duel
  "Pink Overalls",
  "Blue Overalls",
  "Green Overalls",
  
  // Shapeshifting
  "Tongue out",
  "Tanuki Mask",
  "Kitsune Mask",
  "Cat Mask",
  
  // Malicious Intent
  "Devious",
  "Oni Mask",
  "Tengu Mask",
  "Skull Mask",
  "Horns",
  "TMA Noble Skull",
  
  // Housekeeping
  "Blue Artist Apron",
  "Yellow Artist Apron",
  "Maid Apron",
  "Garbage Can",
  "Gold Can",
  "Toilet Paper",
  
  // Tear Jerking
  "Crying", // Special: substring match usually, but metadata has "Azure Crying", "Rainbow Crying", etc.
  
  // Costume Party
  "Black Sheep Onesie",
  "Tiger Onesie",
  "Neko Onesie",
  "Wolf Onesie",
  "Pig Onesie",
  "Cat Onesie",
  "Ratz Onesie",
  "Cow Onesie",
  "Penguin Onesie",
  "Corn Onesie",
  "White Sheep Onesie",
  "Banana Onesie",
  "CyberKongz Onesie",
  "Kappa Onesie",
  "Potato Onesie",
  "Avocado Onesie",
  "Lemon Head",
  "Kappa Head",
  "Tomato Head",
  "Bear Head",
  "Frog Head",
  "Blobfish Head",
  
  // Dress to Impress
  "Spirit Kimono",
  "Gold Kimono",
  "Rainbow Kimono",
  "Daimyo Kimono with Katanas",
  "Daimyo Kimono",
  "Straw Kimono",
  "Blue Kimono",
  "Casual Kimono"
];

/**
 * Checks if a trait from the metadata should be displayed in the modal.
 * Logic: Match exactly or as a substring for specific traits like "Crying".
 */
export const isSchemeTrait = (traitName: string): boolean => {
  const lowerTrait = traitName.toLowerCase();
  
  return SCHEME_TRAITS.some(schemeTrait => {
    const lowerScheme = schemeTrait.toLowerCase();
    
    // Special case for Crying: metadata has "Azure Crying", "Rainbow Crying", etc.
    if (lowerScheme === 'crying') {
      return lowerTrait.includes('crying');
    }
    
    // Exact match (case insensitive)
    return lowerTrait === lowerScheme;
  });
};
