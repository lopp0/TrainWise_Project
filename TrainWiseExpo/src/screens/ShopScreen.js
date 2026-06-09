import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  SHOP_ITEMS,
  getOwnedItems,
  getEquippedBadge,
  getEquippedTitle,
  getEquippedChartTheme,
  getEquippedAvatarFrame,
  purchaseItem,
  equipItem,
  unequipItem,
} from '../utils/shopManager';
import { getCheckInState, grantCoins } from '../utils/checkInManager';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

// Gold is semantic (coins) and kept fixed across themes.
const COIN_COLOR = '#FFD700';

const TYPE_SECTIONS = [
  { type: 'badge', label: 'Profile Badges' },
  { type: 'title', label: 'Custom Titles' },
  { type: 'chart_theme', label: 'Chart Themes' },
  { type: 'avatar_frame', label: 'Avatar Frames' },
];

const TYPE_LABEL = {
  badge: 'Badge',
  title: 'Title',
  chart_theme: 'Chart Theme',
  avatar_frame: 'Avatar Frame',
};

const ShopScreen = ({ navigation }) => {
  const styles = useThemedStyles(makeStyles);
  const [tab, setTab] = useState('shop');
  const [coins, setCoins] = useState(0);
  const [owned, setOwned] = useState([]);
  const [equipped, setEquipped] = useState({
    badge: null,
    title: null,
    chart_theme: null,
    avatar_frame: null,
  });

  const refresh = useCallback(async () => {
    const [state, ownedList, badge, title, theme, frame] = await Promise.all([
      getCheckInState(),
      getOwnedItems(),
      getEquippedBadge(),
      getEquippedTitle(),
      getEquippedChartTheme(),
      getEquippedAvatarFrame(),
    ]);
    setCoins(state.coins);
    setOwned(ownedList);
    setEquipped({ badge, title, chart_theme: theme, avatar_frame: frame });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleBuy = (item) => {
    if (coins < item.price) return;
    Alert.alert(
      `Buy ${item.name}?`,
      `${item.description}\n\nPrice: ${item.price} coins\nYour balance: ${coins} coins`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: async () => {
            const res = await purchaseItem(item.id);
            if (!res.success) {
              Alert.alert('Purchase failed', res.message);
            }
            await refresh();
          },
        },
      ]
    );
  };

  const handleEquip = async (item) => {
    await equipItem(item.id);
    await refresh();
  };

  const handleUnequip = async (item) => {
    await unequipItem(item.id);
    await refresh();
  };

  const isItemOwned = (id) => owned.includes(id);
  const isItemEquipped = (item) => equipped[item.type] === item.id;

  const renderActionButton = (item) => {
    const ownedFlag = isItemOwned(item.id);
    const equippedFlag = isItemEquipped(item);
    if (equippedFlag) {
      return (
        <View style={[styles.actionBtn, styles.equippedBtn]}>
          <Text style={styles.equippedBtnText}>Equipped ✓</Text>
        </View>
      );
    }
    if (ownedFlag) {
      return (
        <TouchableOpacity
          style={[styles.actionBtn, styles.equipBtn]}
          onPress={() => handleEquip(item)}
        >
          <Text style={styles.equipBtnText}>Equip</Text>
        </TouchableOpacity>
      );
    }
    const canAfford = coins >= item.price;
    return (
      <TouchableOpacity
        style={[
          styles.actionBtn,
          styles.buyBtn,
          !canAfford && styles.buyBtnDisabled,
        ]}
        onPress={() => canAfford && handleBuy(item)}
        disabled={!canAfford}
        activeOpacity={canAfford ? 0.8 : 1}
      >
        <Text
          style={[
            styles.buyBtnText,
            !canAfford && styles.buyBtnTextDisabled,
          ]}
        >
          Buy · {item.price} coins
        </Text>
      </TouchableOpacity>
    );
  };

  const renderShopCard = (item) => (
    <View key={item.id} style={styles.itemCard}>
      <Text style={styles.itemEmoji}>{item.emoji}</Text>
      <Text style={styles.itemName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.itemDesc} numberOfLines={3}>
        {item.description}
      </Text>
      <View style={styles.itemPriceRow}>
        <Text style={styles.itemPriceText}>💰 {item.price}</Text>
      </View>
      {renderActionButton(item)}
    </View>
  );

  const renderShopTab = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {TYPE_SECTIONS.map((section) => {
        const items = SHOP_ITEMS.filter((i) => i.type === section.type);
        if (items.length === 0) return null;
        return (
          <View key={section.type} style={styles.section}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            <View style={styles.grid}>{items.map(renderShopCard)}</View>
          </View>
        );
      })}
    </ScrollView>
  );

  const renderOwnedRow = (item) => {
    const equippedFlag = isItemEquipped(item);
    return (
      <View key={item.id} style={styles.ownedRow}>
        <Text style={styles.ownedEmoji}>{item.emoji}</Text>
        <View style={styles.ownedTextWrap}>
          <Text style={styles.ownedName}>{item.name}</Text>
          <Text style={styles.ownedType}>{TYPE_LABEL[item.type]}</Text>
        </View>
        {equippedFlag ? (
          <TouchableOpacity
            style={[styles.smallBtn, styles.unequipBtn]}
            onPress={() => handleUnequip(item)}
          >
            <Text style={styles.unequipBtnText}>Unequip</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.smallBtn, styles.equipBtn]}
            onPress={() => handleEquip(item)}
          >
            <Text style={styles.equipBtnText}>Equip</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderMyItemsTab = () => {
    const ownedItems = SHOP_ITEMS.filter((i) => owned.includes(i.id));
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {ownedItems.length === 0 ? (
          <Text style={styles.emptyText}>
            You don&apos;t own any items yet. Visit the Shop tab to spend coins
            on cosmetics.
          </Text>
        ) : (
          ownedItems.map(renderOwnedRow)
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shop</Text>
        <TouchableOpacity
          style={styles.coinBalance}
          activeOpacity={0.7}
          // Dev/testing: long-press the balance to grant 10,000 coins so all
          // shop items can be tried. Remove this onLongPress to disable.
          onLongPress={() => {
            Alert.alert('Add coins?', 'Grant 10,000 coins to this account for testing?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Add 10,000',
                onPress: async () => {
                  await grantCoins(10000);
                  await refresh();
                },
              },
            ]);
          }}
        >
          <Text style={styles.coinBalanceText}>💰 {coins} coins</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'shop' && styles.tabActive]}
          onPress={() => setTab('shop')}
        >
          <Text style={[styles.tabText, tab === 'shop' && styles.tabTextActive]}>
            Shop
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'my' && styles.tabActive]}
          onPress={() => setTab('my')}
        >
          <Text style={[styles.tabText, tab === 'my' && styles.tabTextActive]}>
            My Items
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'shop' ? renderShopTab() : renderMyItemsTab()}
    </SafeAreaView>
  );
};

const makeStyles = (Colors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 12,
    flex: 1,
  },
  coinBalance: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: COIN_COLOR,
  },
  coinBalanceText: {
    color: COIN_COLOR,
    fontWeight: '800',
    fontSize: 13,
  },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tabActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.cardBackgroundLight,
  },
  tabText: {
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  tabTextActive: {
    color: Colors.primary,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  itemCard: {
    width: '48%',
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  itemEmoji: {
    fontSize: 40,
    marginBottom: 6,
  },
  itemName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  itemDesc: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    minHeight: 30,
    marginBottom: 8,
  },
  itemPriceRow: {
    marginBottom: 8,
  },
  itemPriceText: {
    color: COIN_COLOR,
    fontWeight: '800',
    fontSize: 13,
  },

  actionBtn: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  buyBtn: {
    backgroundColor: Colors.primary,
  },
  buyBtnDisabled: {
    backgroundColor: Colors.cardBackgroundLight,
  },
  buyBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  buyBtnTextDisabled: {
    color: Colors.textMuted,
  },
  equipBtn: {
    backgroundColor: Colors.primaryLight,
  },
  equipBtnText: {
    color: '#0d1117',
    fontWeight: '800',
    fontSize: 12,
  },
  equippedBtn: {
    borderWidth: 1.5,
    borderColor: Colors.success,
    backgroundColor: 'transparent',
  },
  equippedBtnText: {
    color: Colors.success,
    fontWeight: '800',
    fontSize: 12,
  },

  ownedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  ownedEmoji: {
    fontSize: 32,
    marginRight: 14,
  },
  ownedTextWrap: {
    flex: 1,
  },
  ownedName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  ownedType: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  unequipBtn: {
    borderWidth: 1.5,
    borderColor: Colors.success,
    backgroundColor: 'transparent',
  },
  unequipBtnText: {
    color: Colors.success,
    fontWeight: '800',
    fontSize: 12,
  },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
});

export default ShopScreen;
