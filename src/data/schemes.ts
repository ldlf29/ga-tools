
import { FilterState } from '@/types';

type Suggestion = { title: string; filters?: Partial<FilterState>; message?: string };

export const SCHEME_SUGGESTIONS: Record<string, Suggestion> = {
    'Collect \'Em All': {
        title: "Requirement: 1 Basic, 1 Rare, 1 Epic, 1 Legendary",
        message: "You should choose 1 Basic, 1 Rare, 1 Epic and 1 Legendary"
    },
    'Aggressive Specialization': {
        title: "Specialization: Killer (+1.50), Class: Bruiser",
        filters: { specialization: ['Killer'], customClass: ['Bruiser'] }
    },
    'Baiting the Trap': {
        title: "Specialization: Wart Rider (+170), Class: Defender, Sprinter",
        filters: { specialization: ['Wart Rider'], customClass: ['Defender', 'Sprinter'] }
    },
    'Beat the Buzzer': {
        title: "Specialization: Gacha (+4.75), Class: Striker, Grinder, Sprinter",
        filters: { specialization: ['Gacha'], customClass: ['Striker', 'Grinder', 'Sprinter'] }
    },
    'Big Game Hunt': {
        title: "Specialization: Wart Rider (+170), Class: Defender, Sprinter",
        filters: { specialization: ['Wart Rider'], customClass: ['Defender', 'Sprinter'] }
    },
    'Cage Match': {
        title: "Specialization: Killer (+1.50), Class: Bruiser",
        filters: { specialization: ['Killer'], customClass: ['Bruiser'] }
    },
    'Call to Arms': {
        title: "Traits: Ronin or Samurai",
        filters: { traits: ['Ronin or Samurai'] }
    },
    'Collective Specialization': {
        title: "Specialization: Gacha (+4.75), Class: Striker, Grinder, Sprinter",
        filters: { specialization: ['Gacha'], customClass: ['Striker', 'Grinder', 'Sprinter'] }
    },
    'Costume Party': {
        title: "Traits: Onesie, Lemon/Kappa/Tomato...",
        filters: { traits: ['Onesie', 'Lemon, Kappa, Tomato, Bear, Frog or Blob Head'] }
    },
    'Cursed Dinner': {
        title: "Specialization: Wart Rider (+170), Class: Defender, Sprinter",
        filters: { specialization: ['Wart Rider'], customClass: ['Defender', 'Sprinter'] }
    },
    'Divine Intervention': {
        title: "Fur: Spirit",
        filters: { fur: ['Spirit'] }
    },
    'Dress to Impress': {
        title: "Traits: Kimono",
        filters: { traits: ['Kimono'] }
    },
    'Dungaree Duel': {
        title: "Traits: Pink, Blue or Green Overalls",
        filters: { traits: ['Pink, Blue or Green Overalls'] }
    },
    'Enforcing the Naughty List': {
        title: "Specialization: Killer (+1.50), Class: Bruiser",
        filters: { specialization: ['Killer'], customClass: ['Bruiser'] }
    },
    'Final Blow': {
        title: "Specialization: Killer (+1.50), Class: Bruiser",
        filters: { specialization: ['Killer'], customClass: ['Bruiser'] }
    },
    'Flexing': {
        title: "Class: Bruiser",
        filters: { customClass: ['Bruiser'] }
    },
    'Gacha Gouging': {
        title: "Specialization: Gacha (+4.75), Class: Striker, Grinder, Sprinter",
        filters: { specialization: ['Gacha'], customClass: ['Striker', 'Grinder', 'Sprinter'] }
    },
    'Gacha Hoarding': {
        title: "Specialization: Gacha (+4.75), Class: Striker, Grinder, Sprinter",
        filters: { specialization: ['Gacha'], customClass: ['Striker', 'Grinder', 'Sprinter'] }
    },
    'Golden Shower': {
        title: "Fur: Gold",
        filters: { fur: ['Gold'] }
    },
    'Grabbing Balls': {
        title: "Specialization: Gacha (+4.75), Class: Striker, Grinder, Sprinter",
        filters: { specialization: ['Gacha'], customClass: ['Striker', 'Grinder', 'Sprinter'] }
    },
    'Housekeeping': {
        title: "Traits: Apron, Garbage/Gold Can or Toilet Paper",
        filters: { traits: ['Apron, Garbage/Gold Can or Toilet Paper'] }
    },
    'Litter Collection': {
        title: "Class: Bruiser, Striker, Grinder, Sprinter",
        filters: { customClass: ['Bruiser', 'Striker', 'Grinder', 'Sprinter'] }
    },
    'Malicious Intent': {
        title: "Traits: Devious Mouth, Oni/Tengu/Skull Mask",
        filters: { traits: ['Devious Mouth', 'Oni, Tengu or Skull Mask'] }
    },
    'Midnight Strike': {
        title: "Fur: Shadow",
        filters: { fur: ['Shadow'] }
    },
    'Moki Smash': {
        title: "Specialization: Killer (+1.50), Class: Bruiser",
        filters: { specialization: ['Killer'], customClass: ['Bruiser'] }
    },
    'Rainbow Riot': {
        title: "Fur: Rainbow",
        filters: { fur: ['Rainbow'] }
    },
    'Running Interference': {
        title: "Stars: 1-2, Specialization: Loser",
        filters: { stars: [1, 2], specialization: ['Loser'] }
    },
    'Saccing': {
        title: "Class: Defender, Specialization: Loser",
        filters: { customClass: ['Defender'], specialization: ['Loser'] }
    },
    'Shapeshifting': {
        title: "Traits: Tongue Out, Tanuki/Kitsune/Cat Mask",
        filters: { traits: ['Tongue Out', 'Tanuki, Kitsune or Cat Mask'] }
    },
    'Taking a Dive': {
        title: "Specialization: Loser (-47.50%)",
        filters: { specialization: ['Loser'] }
    },
    'Tear Jerking': {
        title: "Traits: Crying Eye",
        filters: { traits: ['Crying Eye'] }
    },
    'Touching the Wart': {
        title: "Specialization: Wart Rider (+170), Class: Defender, Sprinter",
        filters: { specialization: ['Wart Rider'], customClass: ['Defender', 'Sprinter'] }
    },
    'Victory Lap': {
        title: "Specialization: Winner (+53.50%)",
        filters: { specialization: ['Winner'] }
    },
    'Wart Rodeo': {
        title: "Specialization: Wart Rider (+170), Class: Defender, Sprinter",
        filters: { specialization: ['Wart Rider'], customClass: ['Defender', 'Sprinter'] }
    },
    'Whale Watching': {
        title: "Fur: 1 of 1",
        filters: { fur: ['1 of 1'] }
    }
};

export const SCHEME_NAMES = Object.keys(SCHEME_SUGGESTIONS).sort();
