import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../api/AuthContext';
import { Colors, Fonts, Spacing } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const styles = useThemedStyles(makeStyles);

  const rows = [
    { label: 'Full Name', value: user?.fullName },
    { label: 'Email', value: user?.email },
    { label: 'Username', value: user?.userName },
    { label: 'Activity Level', value: user?.activityLevel },
    { label: 'Experience Level', value: user?.experienceLevel },
    { label: 'Height', value: user?.height ? `${user.height} cm` : undefined },
    { label: 'Weight', value: user?.weight ? `${user.weight} kg` : undefined },
    { label: 'Role', value: user?.isCoach ? 'Coach' : 'Trainee' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={54} color={Colors.textMuted} />
        </View>

        <Text style={styles.name}>{user?.fullName || 'Athlete'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>

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
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.cardBackground,
    borderWidth: 2,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
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
    marginBottom: Spacing.xl,
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
