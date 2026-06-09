import React, { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../api/AuthContext';
import { uploadProfileImage, resolveProfileImageUrl } from '../services/api';
import { Colors, Fonts, Spacing } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import {
  getEquippedBadge,
  getEquippedAvatarFrame,
  findShopItem,
} from '../utils/shopManager';

const ProfileScreen = () => {
  const { user, logout, updateUser } = useAuth();
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);
  const [equippedBadgeId, setEquippedBadgeId] = useState(null);
  const [equippedFrameId, setEquippedFrameId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const isCoachOnly = !!user?.isCoach && !user?.isTrainee;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [badge, frame] = await Promise.all([
          getEquippedBadge(),
          getEquippedAvatarFrame(),
        ]);
        if (!cancelled) {
          setEquippedBadgeId(badge);
          setEquippedFrameId(frame);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const badgeItem = equippedBadgeId ? findShopItem(equippedBadgeId) : null;
  const frameItem = equippedFrameId ? findShopItem(equippedFrameId) : null;
  const avatarBorderStyle = frameItem?.frameColor
    ? { borderColor: frameItem.frameColor, borderWidth: 3 }
    : null;

  const trainingRows = isCoachOnly
    ? []
    : [
        { label: 'Activity Level', value: user?.activityLevel },
        { label: 'Experience Level', value: user?.experienceLevel },
        { label: 'Height', value: user?.height ? `${user.height} cm` : undefined },
        { label: 'Weight', value: user?.weight ? `${user.weight} kg` : undefined },
      ];
  const roleLabel =
    user?.isCoach && user?.isTrainee ? 'Coach + Trainee'
    : user?.isCoach ? 'Coach'
    : 'Trainee';
  const rows = [
    { label: 'Full Name', value: user?.fullName },
    { label: 'Email', value: user?.email },
    { label: 'Username', value: user?.userName },
    ...trainingRows,
    { label: 'Role', value: roleLabel },
  ];

  const profileImageUrl = resolveProfileImageUrl(user?.profileImagePath);

  const pickAndUpload = async () => {
    if (!user?.userId || uploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      // SDK 54 removed MediaTypeOptions; the array form is required.
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;

    setUploading(true);
    try {
      const res = await uploadProfileImage(user.userId, result.assets[0].uri);
      const path = res?.path;
      if (!path) {
        // Surface the exact backend payload so we can tell whether the
        // request actually reached the controller (vs being eaten by a
        // proxy or middleware).
        throw new Error(`Server did not return an image path. Response: ${JSON.stringify(res)}`);
      }
      await updateUser({ profileImagePath: path });
    } catch (e) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      const bodyStr = typeof body === 'string' ? body : body ? JSON.stringify(body) : '';
      const detail = status
        ? `HTTP ${status}${bodyStr ? ` — ${bodyStr}` : ''}`
        : (e?.message || 'Upload failed.');
      Alert.alert('Could not upload', String(detail));
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={pickAndUpload}
          activeOpacity={0.85}
          disabled={uploading}
        >
          {/* Clip the avatar image inside its own circle so the badge can
              sit outside the clipped region — otherwise overflow:hidden on
              the parent cuts the camera icon in half. */}
          <View style={[styles.avatarCircle, avatarBorderStyle]}>
            {profileImageUrl ? (
              <Image source={{ uri: profileImageUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={54} color={Colors.textMuted} />
            )}
            {uploading && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </View>
          {!uploading && (
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.name}>
          {badgeItem ? `${badgeItem.emoji} ` : ''}
          {user?.fullName || 'Athlete'}
        </Text>
        <Text style={styles.email}>{user?.email || ''}</Text>

        <TouchableOpacity
          style={styles.shopBtn}
          onPress={() => navigation.navigate('HomeTab', { screen: 'Shop' })}
          activeOpacity={0.85}
        >
          <Ionicons name="bag-handle-outline" size={18} color={Colors.primary} />
          <Text style={styles.shopBtnText}>Visit Shop</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          {rows.map((row, i) => (
            <View key={i} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value}>
                {row.value !== undefined && row.value !== null ? String(row.value) : '—'}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.primary} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (C) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  avatarWrap: {
    width: 108,
    height: 108,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.cardBackground,
    borderWidth: 2,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.background,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: Fonts.bold,
    color: C.primary,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: Spacing.md,
  },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.primary,
    marginBottom: Spacing.xl,
  },
  shopBtnText: {
    color: C.primary,
    fontWeight: Fonts.bold,
    fontSize: 14,
  },
  card: {
    width: '100%',
    backgroundColor: C.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  label: {
    fontSize: 13,
    color: C.textSecondary,
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: C.textPrimary,
    fontWeight: Fonts.semiBold,
    textAlign: 'right',
    flex: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  logoutText: {
    color: C.primary,
    fontSize: 15,
    fontWeight: Fonts.bold,
  },
});

export default ProfileScreen;
