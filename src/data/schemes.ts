import { FilterState } from '@/types';

type Suggestion = {
  title: string;
  filters?: Partial<FilterState>;
  message?: string;
};

export const SCHEME_SUGGESTIONS: Record<string, Suggestion> = {
  "Collect 'Em All": {
    title: 'Requirement: 1 Basic, 1 Rare, 1 Epic, 1 Legendary',
    filters: { rarity: ['Basic', 'Rare', 'Epic', 'Legendary'] },
  },
  'Aggressive Specialization': {
    title: 'Specialization: Killer',
    filters: { specialization: ['Killer'] },
  },
  'Baiting the Trap': {
    title: 'Specialization: Wart Rider + Winner',
    filters: { specialization: ['Wart Rider', 'Winner'] },
  },
  'Beat the Buzzer': {
    title: 'Specialization: Gacha + Winner',
    filters: { specialization: ['Gacha', 'Winner'] },
  },
  'Big Game Hunt': {
    title: 'Specialization: Wart Rider + Winner',
    filters: { specialization: ['Wart Rider', 'Winner'] },
  },
  'Cage Match': {
    title: 'Specialization: Killer',
    filters: { specialization: ['Killer'] },
  },
  'Call to Arms': {
    title: 'Traits: Ronin or Samurai',
    filters: { traits: ['Ronin or Samurai'] },
  },
  'Collective Specialization': {
    title: 'Specialization: Gacha',
    filters: { specialization: ['Gacha'] },
  },
  'Costume Party': {
    title: 'Traits: Onesie, Lemon/Kappa/Tomato...',
    filters: { traits: ['Onesie or Lemon, Kappa, Tomato or Blob Head'] },
  },
  'Cursed Dinner': {
    title: 'Specialization: Wart Rider',
    filters: { specialization: ['Wart Rider'] },
  },
  'Divine Intervention': {
    title: 'Fur: Spirit',
    filters: { fur: ['Spirit'] },
  },
  'Dress to Impress': {
    title: 'Traits: Kimono',
    filters: { traits: ['Kimono'] },
  },
  'Dungaree Duel': {
    title: 'Traits: Pink, Blue or Green Overalls',
    filters: { traits: ['Pink, Blue or Green Overalls'] },
  },
  'Enforcing the Naughty List': {
    title: 'Specialization: Killer',
    filters: { specialization: ['Killer'] },
  },
  'Final Blow': {
    title: 'Specialization: Killer + Winner',
    filters: { specialization: ['Killer', 'Winner'] },
  },
  Flexing: {
    title: 'Specialization: Killer',
    filters: { specialization: ['Killer'] },
  },
  'Gacha Gouging': {
    title: 'Specialization: Gacha',
    filters: { specialization: ['Gacha'] },
  },
  'Gacha Hoarding': {
    title: 'Specialization: Gacha',
    filters: { specialization: ['Gacha'] },
  },
  'Golden Shower': {
    title: 'Fur: Gold',
    filters: { fur: ['Gold'] },
  },
  'Grabbing Balls': {
    title: 'Specialization: Gacha + Winner',
    filters: { specialization: ['Gacha', 'Winner'] },
  },
  Housekeeping: {
    title: 'Traits: Apron, Garbage/Gold Can or Toilet Paper',
    filters: { traits: ['Apron, Garbage/Gold Can or Toilet Paper'] },
  },
  'Litter Collection': {
    title: 'Specialization: Gacha',
    filters: { specialization: ['Gacha'] },
  },
  'Malicious Intent': {
    title: 'Traits: Devious Mouth, Oni/Tengu/Skull Mask',
    filters: { traits: ['Devious Mouth or Oni, Tengu or Skull Mask'] },
  },
  'Midnight Strike': {
    title: 'Fur: Shadow',
    filters: { fur: ['Shadow'] },
  },
  'Moki Smash': {
    title: 'Specialization: Killer + Winner',
    filters: { specialization: ['Killer', 'Winner'] },
  },
  'Rainbow Riot': {
    title: 'Fur: Rainbow',
    filters: { fur: ['Rainbow'] },
  },
  'Running Interference': {
    title: 'Specialization: Wart Rider',
    filters: { specialization: ['Wart Rider'] },
  },
  Saccing: {
    title: 'Specialization: Wart Rider',
    filters: { specialization: ['Wart Rider'] },
  },
  Shapeshifting: {
    title: 'Traits: Tongue Out, Tanuki/Kitsune/Cat Mask',
    filters: { traits: ['Tongue Out or Tanuki, Kitsune or Cat Mask'] },
  },
  'Taking a Dive': {
    title: 'Specialization: Loser (-47.50%)',
    filters: { specialization: ['Loser'] },
  },
  'Tear Jerking': {
    title: 'Traits: Crying Eye',
    filters: { traits: ['Crying Eye'] },
  },
  'Touching the Wart': {
    title: 'Specialization: Gacha',
    filters: { specialization: ['Gacha'] },
  },
  'Victory Lap': {
    title: 'Specialization: Winner (+53.50%)',
    filters: { specialization: ['Winner'] },
  },
  'Wart Rodeo': {
    title: 'Specialization: Wart Rider',
    filters: { specialization: ['Wart Rider'] },
  },
  'Whale Watching': {
    title: 'Fur: 1 of 1',
    filters: { fur: ['1 of 1'] },
  },
};

export const SCHEME_NAMES = Object.keys(SCHEME_SUGGESTIONS).sort();
