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

const ProfileScreen = () => {
  const { user, logout } = useAuth();

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
        {/* Avatar placeholder */}
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={54} color={Colors.textMuted} />
        </View>

        <Text style={styles.name}>{user?.fullName || 'Athlete'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>

        {/* Info card */}
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.cardBackground,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  name: {
    fontSize: 22,
    fontWeight: Fonts.bold,
    color: Colors.primary,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
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
    borderBottomColor: Colors.border,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: Colors.textPrimary,
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
    borderColor: Colors.primary,
  },
  logoutText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: Fonts.bold,
  },
});

export default ProfileScreen;
