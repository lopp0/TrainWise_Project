import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
} from 'react-native';
import * as Location from 'expo-location';
import {Colors, Fonts, Spacing} from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import {getUserById, updateUser as updateUserApi, deleteUser as deleteUserApi, setShareLiveLocation} from '../services/api';
import { getShareLocation, setShareLocationLocal } from '../utils/locationSharing';
import { useAuth } from '../api/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import {
  DAY_NAMES,
  getWeekStartDay,
  setWeekStartDay,
} from '../constants/weekStart';
import { resetOnboarding } from '../utils/onboardingManager';

const SettingsScreen = ({navigation}) => {
  const { userId, updateUser: updateAuthUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Delete-account flow uses TWO independent confirmations to avoid
  // accidental wipes: a native Alert ("are you sure?"), then a modal
  // that requires the user to retype their email exactly. Final delete
  // only fires after both pass.
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [weekStart, setWeekStart] = useState(getWeekStartDay());
  const [shareLocation, setShareLocation] = useState(false); // A-2
  // Server-managed fields the BL requires on update — kept hidden but echoed back.
  const [serverFields, setServerFields] = useState({
    activityLevel: 1,
    deviceType: 'none',
    experienceLevel: 1,
    userName: null,
  });

  useEffect(() => {
    loadUser();
    getShareLocation().then(setShareLocation);
  }, []);

  // A-2: toggle live-location sharing (double opt-in with an explainer).
  const toggleShareLocation = (value) => {
    if (value) {
      Alert.alert(
        'Share live location?',
        'Other TrainWise users on the Connect map will see your pin while you have the app open. You can turn this off anytime.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share',
            onPress: async () => {
              try { await Location.requestForegroundPermissionsAsync(); } catch {}
              setShareLocation(true);
              await setShareLocationLocal(true);
              setShareLiveLocation(userId, true).catch(() => {});
            },
          },
        ]
      );
    } else {
      setShareLocation(false);
      setShareLocationLocal(false);
      setShareLiveLocation(userId, false).catch(() => {});
    }
  };

  const loadUser = async () => {
    setLoading(true);
    try {
      const response = await getUserById(userId);
      const user = response.data || {};
      setFullName(user.fullName || '');
      setEmail(user.email || '');
      setBirthYear(String(user.birthYear || ''));
      setGender(user.gender || '');
      setHeight(String(user.height || ''));
      setWeight(String(user.weight || ''));
      setServerFields({
        activityLevel: user.activityLevel || 1,
        deviceType: user.deviceType || 'none',
        experienceLevel: user.experienceLevel || 1,
        userName: user.userName || null,
      });
    } catch (error) {
      console.log('Load user error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate personal info the same way signup does, so impossible values
    // (e.g. 400 cm / 500 kg) can't be saved (item 8).
    const h = parseInt(height, 10);
    const w = parseInt(weight, 10);
    const by = parseInt(birthYear, 10);
    const age = by ? new Date().getFullYear() - by : null;
    if (height && (isNaN(h) || h < 120 || h > 250)) {
      Alert.alert('Invalid height', 'Height must be between 120 and 250 cm.');
      return;
    }
    if (weight && (isNaN(w) || w < 30 || w > 300)) {
      Alert.alert('Invalid weight', 'Weight must be between 30 and 300 kg.');
      return;
    }
    if (birthYear && (isNaN(by) || age == null || age < 13 || age > 100)) {
      Alert.alert('Invalid birth year', 'Please enter a realistic birth year (age 13–100).');
      return;
    }

    setSaving(true);
    try {
      // Backend Update validates the full DTO (ActivityLevel/ExperienceLevel
      // must be 1-3, DeviceType non-empty). Echo back server-side fields so
      // editing only profile basics doesn't trip those validators.
      // Field names match UpdateUserRequest exactly. We always send email +
      // userName even if unchanged, otherwise the backend's UPDATE wipes
      // those columns to NULL (sp_UpdateUser parameters default to NULL).
      const payload = {
        userID: userId,
        fullName: fullName?.trim() || null,
        email: email?.trim() || null,
        userName: serverFields.userName || null,
        birthYear: parseInt(birthYear, 10) || 0,
        gender,
        height: parseInt(height, 10) || 0,
        weight: parseInt(weight, 10) || 0,
        activityLevel: serverFields.activityLevel,
        deviceType: serverFields.deviceType,
        experienceLevel: serverFields.experienceLevel,
      };
      await updateUserApi(userId, payload);

      // Mirror the change into AuthContext so HomeScreen's "Hello {name}"
      // and ProfileScreen's info card refresh immediately. Without this,
      // those screens read the cached login snapshot and only update on
      // next login. Field names match the AuthContext normalization.
      if (updateAuthUser) {
        await updateAuthUser({
          fullName: payload.fullName,
          email: payload.email,
          birthYear: payload.birthYear,
          gender: payload.gender,
          height: payload.height,
          weight: payload.weight,
          activityLevel: payload.activityLevel,
          deviceType: payload.deviceType,
          experienceLevel: payload.experienceLevel,
        });
      }

      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (error) {
      console.log('Save error:', error.message);
      Alert.alert('Error', error.response?.data || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const showPolicy = (title, text) => {
    Alert.alert(title, text, [{text: 'OK'}]);
  };

  // Step 1 of delete: native Alert. If the user taps Continue we open the
  // modal (step 2) where they must type their email exactly. Cancelling
  // here closes everything with no state change.
  const startDeleteFlow = () => {
    Alert.alert(
      'Delete account?',
      'This will permanently erase your profile, every workout, every injury report, every connection with your coach or trainees, and every chat message. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeleteConfirmText('');
            setDeleteModalVisible(true);
          },
        },
      ],
    );
  };

  const confirmDelete = async () => {
    // Defense in depth — even if the button somehow got tapped while
    // disabled, refuse if the typed text doesn't match.
    if (deleteConfirmText.trim().toLowerCase() !== email.trim().toLowerCase()) {
      Alert.alert('Email does not match', 'Please type your email exactly to confirm.');
      return;
    }
    setDeleting(true);
    try {
      await deleteUserApi(userId);
      setDeleteModalVisible(false);
      // logout() clears AsyncStorage + AuthContext; AppNavigator then
      // swaps AppStack for AuthStack so the user lands on the Welcome
      // screen with no in-memory user reference left behind.
      await logout();
    } catch (error) {
      const detail = error?.response?.data || error?.message || 'Unknown error.';
      Alert.alert('Could not delete account', String(detail));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Settings"
        subtitle="Manage your account"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Personal Info */}
        <Card>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.label}>Birth Year</Text>
          <TextInput
            style={styles.input}
            value={birthYear}
            onChangeText={setBirthYear}
            keyboardType="numeric"
            maxLength={4}
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.label}>Gender</Text>
          <TextInput
            style={styles.input}
            value={gender}
            onChangeText={setGender}
            placeholderTextColor={Colors.textMuted}
          />
        </Card>

        {/* Measurements */}
        <Card>
          <Text style={styles.cardTitle}>Measurements</Text>
          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                value={height}
                onChangeText={setHeight}
                keyboardType="numeric"
                maxLength={3}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.halfCol}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                maxLength={3}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
        </Card>

        {/* Appearance */}
        <Card>
          <Text style={styles.cardTitle}>Appearance</Text>
          <View style={styles.segmentRow}>
            {['dark', 'light'].map((opt) => {
              const active = theme === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  onPress={() => setTheme(opt)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {opt === 'dark' ? 'Dark' : 'Light'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>Light mode uses the logo&apos;s mint/teal palette.</Text>
        </Card>

        {/* Week start */}
        <Card>
          <Text style={styles.cardTitle}>Week starts on</Text>
          <View style={styles.weekStartRow}>
            {DAY_NAMES.map((name, idx) => {
              const active = weekStart === idx;
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.weekStartBtn, active && styles.weekStartBtnActive]}
                  onPress={async () => {
                    setWeekStart(idx);
                    await setWeekStartDay(idx);
                  }}
                >
                  <Text style={[styles.weekStartText, active && styles.weekStartTextActive]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>
            Affects the Home + Warnings weekly charts and the AC ratio window.
          </Text>
        </Card>

        {/* Privacy — live location sharing (A-2) */}
        <Card>
          <Text style={styles.cardTitle}>Privacy</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.switchLabel}>Share my live location</Text>
              <Text style={styles.hint}>
                Show my pin on the Connect map while the app is open. Default off.
              </Text>
            </View>
            <Switch
              value={shareLocation}
              onValueChange={toggleShareLocation}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </Card>

        {/* Privacy + Terms */}
        <Card>
          <Text style={styles.cardTitle}>Legal</Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() =>
              showPolicy(
                'Privacy Policy',
                'TrainWise collects only the data you provide and activity from your connected devices. We never share personal data with third parties without your consent.',
              )
            }>
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Text style={styles.linkArrow}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() =>
              showPolicy(
                'Terms of Service',
                'By using TrainWise you agree to use the app as a guide, not as medical advice. Always consult a qualified professional before making changes to your training routine.',
              )
            }>
            <Text style={styles.linkText}>Terms of Service</Text>
            <Text style={styles.linkArrow}>{'>'}</Text>
          </TouchableOpacity>
        </Card>

        {/* Actions */}
        <Card>
          <Text style={styles.cardTitle}>Connections</Text>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => navigation.navigate('ConnectQR')}>
            <Text style={styles.actionText}>Connect to Coach / Trainee</Text>
            <Text style={styles.linkArrow}>{'>'}</Text>
          </TouchableOpacity>
        </Card>

        {/* Replay the first-launch tutorial without reinstalling. */}
        <TouchableOpacity
          style={styles.resetOnboardingBtn}
          onPress={async () => {
            await resetOnboarding();
            Alert.alert('Done', 'Onboarding will show again on next app open.');
          }}
        >
          <Text style={styles.resetOnboardingText}>🔄 Reset Tutorial</Text>
        </TouchableOpacity>

        {/* Danger zone — separated visually so a stray tap on Save Changes
            can never land on the destructive action. Confirmation lives
            inside startDeleteFlow → modal, see top of file. */}
        <Card>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <Text style={styles.dangerBody}>
            Permanently delete your TrainWise account and every record we have about you.
            This cannot be undone.
          </Text>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={startDeleteFlow}
            activeOpacity={0.85}
          >
            <Text style={styles.dangerButtonText}>Delete my account</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>

      {/* Step 2 of delete: type-your-email modal. The final red button is
          disabled until the typed text matches the user's email (case-
          insensitive, whitespace-trimmed). Backdrop tap cancels. */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalBackdrop}
          onPress={() => !deleting && setDeleteModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm deletion</Text>
            <Text style={styles.modalBody}>
              To confirm, please type your email exactly:
            </Text>
            <Text style={styles.modalEmail}>{email}</Text>
            <TextInput
              style={styles.modalInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type your email here"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!deleting}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  (deleteConfirmText.trim().toLowerCase() !== email.trim().toLowerCase() || deleting) &&
                    styles.modalConfirmDisabled,
                ]}
                onPress={confirmDelete}
                disabled={
                  deleteConfirmText.trim().toLowerCase() !== email.trim().toLowerCase() || deleting
                }
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Delete forever</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <View style={styles.bottomActions}>
        <PrimaryButton
          title="Save Changes"
          onPress={handleSave}
          loading={saving}
        />
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Warnings')}>
          <Text style={styles.secondaryButtonText}>Home Page</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const makeStyles = (Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    fontSize: Fonts.bodySize,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfCol: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 4,
    marginBottom: Spacing.xs,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    color: Colors.textSecondary,
    fontWeight: Fonts.semiBold,
    fontSize: Fonts.bodySize,
  },
  segmentTextActive: {
    color: Colors.textPrimary,
  },
  weekStartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  weekStartBtn: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 2,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  weekStartBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  weekStartText: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize,
    fontWeight: Fonts.semiBold,
  },
  weekStartTextActive: {
    color: Colors.textPrimary,
  },
  switchLabel: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: Fonts.captionSize,
    marginTop: Spacing.xs,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  linkText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
  },
  linkArrow: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  actionText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
  resetOnboardingBtn: {
    marginTop: 32,
    alignItems: 'center',
    paddingVertical: 12,
  },
  resetOnboardingText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },
  // Danger zone — semantic red (theme-independent) so the destructive
  // action reads as destructive on both light and dark.
  dangerTitle: {
    color: Colors.red,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },
  dangerBody: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize + 1,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  dangerButton: {
    backgroundColor: Colors.red,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.bold,
  },
  // Delete-confirm modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    color: Colors.red,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.sm,
  },
  modalBody: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    marginBottom: Spacing.xs,
  },
  modalEmail: {
    color: Colors.primary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },
  modalInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    fontSize: Fonts.bodySize,
    marginBottom: Spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.red,
  },
  modalConfirmDisabled: {
    opacity: 0.4,
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.bold,
  },
});

export default SettingsScreen;
