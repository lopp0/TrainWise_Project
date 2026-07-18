import AsyncStorage from '@react-native-async-storage/async-storage';
import { spendCoins } from './checkInManager';
import { scopedKey } from './activeUser';

// Per-account (scopedKey) so owned/equipped items don't leak across accounts.
const OWNED_BASE = '@trainwise_owned_items';
const OWNED_KEY = () => scopedKey(OWNED_BASE);

const EQUIP_BASE = {
  badge: '@trainwise_equipped_badge',
  title: '@trainwise_equipped_title',
  chart_theme: '@trainwise_equipped_chart_theme',
  avatar_frame: '@trainwise_equipped_avatar_frame',
};
const equipKey = (type) => scopedKey(EQUIP_BASE[type]);

export const SHOP_ITEMS = [
  // --- Profile Badges (emoji shown next to name in ProfileScreen) ---
  {
    id: 'badge_crown',
    name: 'Crown',
    emoji: '👑',
    description: 'Show everyone you are royalty',
    price: 50,
    type: 'badge',
  },
  {
    id: 'badge_fire',
    name: 'Fire',
    emoji: '🔥',
    description: 'For the dedicated athletes',
    price: 30,
    type: 'badge',
  },
  {
    id: 'badge_star',
    name: 'Star',
    emoji: '⭐',
    description: 'A classic achievement badge',
    price: 40,
    type: 'badge',
  },
  {
    id: 'badge_lightning',
    name: 'Lightning',
    emoji: '⚡',
    description: 'Fast and powerful',
    price: 35,
    type: 'badge',
  },
  {
    id: 'badge_diamond',
    name: 'Diamond',
    emoji: '💎',
    description: 'Rare and precious',
    price: 100,
    type: 'badge',
  },
  {
    id: 'badge_trophy',
    name: 'Trophy',
    emoji: '🏆',
    description: 'For the champions',
    price: 75,
    type: 'badge',
  },

  // --- Custom Titles (shown in HomeScreen greeting) ---
  {
    id: 'title_champion',
    name: 'Champion',
    emoji: '🥇',
    description: 'Your greeting becomes: Hello Champion [name]!',
    price: 60,
    type: 'title',
    titleText: 'Champion',
  },
  {
    id: 'title_athlete',
    name: 'Athlete',
    emoji: '🏃',
    description: 'Your greeting becomes: Hello Athlete [name]!',
    price: 40,
    type: 'title',
    titleText: 'Athlete',
  },
  {
    id: 'title_legend',
    name: 'Legend',
    emoji: '🌟',
    description: 'Your greeting becomes: Hello Legend [name]!',
    price: 80,
    type: 'title',
    titleText: 'Legend',
  },
  {
    id: 'title_elite',
    name: 'Elite',
    emoji: '💫',
    description: 'Your greeting becomes: Hello Elite [name]!',
    price: 70,
    type: 'title',
    titleText: 'Elite',
  },

  // --- Chart Themes (replace HomeScreen bar-chart colors) ---
  // Keys map to load buckets: low < 150, medium < 300, high < 500,
  // veryHigh >= 500. Empty bars (load == 0) keep the default treatment.
  {
    id: 'theme_ocean',
    name: 'Ocean Theme',
    emoji: '🌊',
    description: 'Blue tones for your weekly load chart',
    price: 60,
    type: 'chart_theme',
    colors: {
      low: '#4fc3f7',
      medium: '#0288d1',
      high: '#01579b',
      veryHigh: '#311b92',
    },
  },
  {
    id: 'theme_sunset',
    name: 'Sunset Theme',
    emoji: '🌅',
    description: 'Warm orange-purple tones for your chart',
    price: 60,
    type: 'chart_theme',
    colors: {
      low: '#ffcc02',
      medium: '#ff9800',
      high: '#e91e63',
      veryHigh: '#6a1b9a',
    },
  },
  {
    id: 'theme_neon',
    name: 'Neon Theme',
    emoji: '⚡',
    description: 'Bright neon colors for your chart',
    price: 80,
    type: 'chart_theme',
    colors: {
      low: '#00e676',
      medium: '#00bcd4',
      high: '#e040fb',
      veryHigh: '#ff1744',
    },
  },

  // --- Avatar Frames ---
  {
    id: 'frame_gold',
    name: 'Gold Frame',
    emoji: '🥇',
    description: 'A golden border around your avatar',
    price: 90,
    type: 'avatar_frame',
    frameColor: '#FFD700',
  },
  {
    id: 'frame_pink',
    name: 'Pink Frame',
    emoji: '💗',
    description: 'A pink glowing border around your avatar',
    price: 70,
    type: 'avatar_frame',
    frameColor: '#ff2d6f',
  },
  {
    id: 'frame_silver',
    name: 'Silver Frame',
    emoji: '🥈',
    description: 'A sleek silver border around your avatar',
    price: 50,
    type: 'avatar_frame',
    frameColor: '#b0bec5',
  },
];

export const findShopItem = (itemId) =>
  SHOP_ITEMS.find((i) => i.id === itemId) || null;

export const getOwnedItems = async () => {
  const raw = await AsyncStorage.getItem(OWNED_KEY());
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const isOwned = async (itemId) => {
  const owned = await getOwnedItems();
  return owned.includes(itemId);
};

const readEquipped = (type) => async () =>
  AsyncStorage.getItem(equipKey(type));

export const getEquippedBadge = readEquipped('badge');
export const getEquippedTitle = readEquipped('title');
export const getEquippedChartTheme = readEquipped('chart_theme');
export const getEquippedAvatarFrame = readEquipped('avatar_frame');

export const purchaseItem = async (itemId) => {
  const item = findShopItem(itemId);
  if (!item) return { success: false, message: 'Item not found.' };

  const alreadyOwned = await isOwned(itemId);
  if (alreadyOwned) {
    return { success: false, message: 'You already own this item.' };
  }

  const paid = await spendCoins(item.price);
  if (!paid) {
    return { success: false, message: 'Not enough coins for this item.' };
  }

  const owned = await getOwnedItems();
  owned.push(itemId);
  await AsyncStorage.setItem(OWNED_KEY(), JSON.stringify(owned));

  return { success: true, message: `Purchased ${item.name}.` };
};

/**
 * Equipping an item of type T overwrites whatever was previously equipped
 * of type T — only one item per type can be active at a time.
 */
export const equipItem = async (itemId) => {
  const item = findShopItem(itemId);
  if (!item) return { success: false, message: 'Item not found.' };
  if (!EQUIP_BASE[item.type]) return { success: false, message: 'Unknown item type.' };

  const owned = await isOwned(itemId);
  if (!owned) return { success: false, message: 'You do not own this item.' };

  await AsyncStorage.setItem(equipKey(item.type), itemId);
  return { success: true, message: `Equipped ${item.name}.` };
};

export const unequipItem = async (itemId) => {
  const item = findShopItem(itemId);
  if (!item) return { success: false, message: 'Item not found.' };
  if (!EQUIP_BASE[item.type]) return { success: false, message: 'Unknown item type.' };
  await AsyncStorage.removeItem(equipKey(item.type));
  return { success: true, message: `Unequipped ${item.name}.` };
};
