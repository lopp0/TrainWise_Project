import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemedStyles } from '../theme/useThemedStyles';
import Avatar from './Avatar';
import { findShopItem } from '../utils/shopManager';

/**
 * A-1 — reusable row showing a user with their equipped cosmetics:
 *   avatar (+ frame ring + badge chip), name (+ title tag), optional subtitle.
 * Resolves the server-stored SHOP_ITEMS string ids to visuals via the client
 * catalog. Field accessors are dual-cased (camel/Pascal) to tolerate either
 * serialization. Use everywhere a user appears in Connect.
 */
const resolveCosmetics = (user) => {
  const badgeId = user?.equippedBadge ?? user?.EquippedBadge;
  const titleId = user?.equippedTitle ?? user?.EquippedTitle;
  const frameId = user?.equippedFrame ?? user?.EquippedFrame;
  return {
    badge: badgeId ? findShopItem(badgeId) : null,
    title: titleId ? findShopItem(titleId) : null,
    frame: frameId ? findShopItem(frameId) : null,
  };
};

const UserProfileCard = ({
  user,
  size = 48,
  online = false,
  showDot = false,
  subtitle,
  right,
  onPress,
  style,
}) => {
  const styles = useThemedStyles(makeStyles);
  const name = user?.fullName ?? user?.FullName ?? user?.name ?? 'Athlete';
  const imagePath = user?.profileImagePath ?? user?.ProfileImagePath;
  const { badge, title, frame } = resolveCosmetics(user);

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper style={[styles.row, style]} onPress={onPress} activeOpacity={0.85}>
      <Avatar
        imagePath={imagePath}
        name={name}
        size={size}
        showDot={showDot}
        online={online}
        frameColor={frame?.frameColor || null}
        badgeEmoji={badge?.emoji || null}
      />
      <View style={styles.textWrap}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {title?.titleText ? (
            <View style={styles.titleTag}>
              <Text style={styles.titleTagText}>{title.titleText}</Text>
            </View>
          ) : null}
        </View>
        {subtitle
          ? typeof subtitle === 'string'
            ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )
            : subtitle
          : null}
      </View>
      {right}
    </Wrapper>
  );
};

const makeStyles = (Colors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textWrap: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  titleTag: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  titleTagText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
});

export default UserProfileCard;
