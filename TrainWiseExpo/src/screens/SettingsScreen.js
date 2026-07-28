import React, {useState, useEffect, useCallback} from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import {Colors, Fonts, Spacing} from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import ErrorBoundary from '../components/ErrorBoundary';
import {getUserById, updateUser as updateUserApi, deleteUser as deleteUserApi, setShareLiveLocation, getUserSessions, revokeUserSession, revokeOtherUserSessions, requestEmailVerification, confirmEmailVerification} from '../services/api';
import { getShareLocation, setShareLocationLocal } from '../utils/locationSharing';
import { useAuth } from '../api/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { ACCENT_LIST } from '../theme/palettes';
import {
  DAY_NAMES,
  getWeekStartDay,
  setWeekStartDay,
} from '../constants/weekStart';
import { resetAllTutorials } from '../utils/tutorialManager';
import {
  getNotifPrefs,
  setNotifPrefs,
  NOTIF_DEFAULTS,
  NOTIF_TYPE_LABELS,
} from '../utils/notificationPrefs';
import {
  isBiometricSupported,
  isBiometricEnabled,
  setBiometricEnabled,
  authenticateBiometric,
} from '../utils/biometric';
import { changePassword as changePasswordApi } from '../services/api';
import { sendWeeklyRecapNow } from '../api/NotificationService';
import { exportWorkoutHistory } from '../utils/exportHistory';
import { parseServerDate } from '../utils/serverDate';
import PasswordInput from '../components/PasswordInput';
import PasswordRequirements from '../components/PasswordRequirements';
import { isValidPassword } from '../utils/validation';

// ── Legal texts (GDPR-structured, 2026-07-19) ───────────────────────────────
// Written to describe what TrainWise ACTUALLY does today. If the data flows
// change (new third party, new category of data), update these too.
// NOTE: replace CONTACT_EMAIL with the real controller contact before any
// public release. Under GDPR a policy must name a reachable controller.
const CONTACT_EMAIL = 'lironeouak@gmail.com';

const PRIVACY_POLICY = `Last updated: 19 July 2026

1. WHO IS RESPONSIBLE (DATA CONTROLLER)
TrainWise is a student training-load project. The controller responsible for your personal data is the TrainWise project owner, reachable at ${CONTACT_EMAIL}.

2. WHAT WE COLLECT
a) Account data you enter: name, username, email, birth year, gender, height, weight, activity and experience level, and your role (trainee, coach, or both).
b) Training data: workouts (type, duration, distance, exertion), calculated training load, injuries you report (type, severity, notes, and any photo you attach), body measurements, and nutrition or hydration entries you log.
c) Health data from Google Health Connect, only if you grant permission: exercise sessions, heart rate, resting heart rate, HRV, steps, distance, calories, and sleep.
d) Social data: friends, coach links, challenges, events, workout-board posts, and the content of messages you send, including images and voice notes.
e) Location, only if you switch on live-location sharing: your approximate coordinates, used to place you on the Connect map and to find nearby gyms.
f) Technical data: a device identifier, your push-notification token, and the time you were last active.

3. SPECIAL CATEGORY DATA (ARTICLE 9)
Health and fitness data, including injuries, heart rate and sleep, is special category data. We process it only on the basis of your explicit consent, which you give by granting Health Connect permission and by choosing to log this information. You can withdraw that consent at any time by revoking the permission or deleting the data.

4. LEGAL BASIS (ARTICLE 6)
Contract: to provide the account and training features you asked for. Consent: for health data, live location, push notifications and optional AI features. Legitimate interests: to keep the service secure and working correctly.

5. WHY WE USE IT
To calculate your training load and injury risk, to show your history and trends, to let you connect with coaches and friends, to send reminders you enabled, and to keep your account secure.

6. WHO ELSE SEES IT
Coaches you are linked to can see your training data, load and injuries. Friends see only what you post publicly, such as workout-board posts. We also use these processors: Microsoft Azure (hosting and database), Google (Health Connect on your device, plus Maps, Weather, Air Quality and Places when those features are used), Firebase Cloud Messaging (push notifications), and OpenAI (only the text of the questions you send to the AI coach or injury advice features). We do not sell your data and we do not use it for advertising.

7. INTERNATIONAL TRANSFERS
Some processors listed above operate outside the European Economic Area. Where that happens, transfers rely on the European Commission's Standard Contractual Clauses or an adequacy decision.

8. HOW LONG WE KEEP IT
We keep your data for as long as your account exists. When you delete your account from Settings, your profile, workouts, injuries, messages, connections and posts are permanently erased from our database. Backups are overwritten on their normal cycle.

9. YOUR RIGHTS
You have the right to access your data, to correct it, to erase it, to restrict or object to processing, to withdraw consent at any time, and to data portability. In the app you can already: edit your profile, export your workout history to a CSV file, and permanently delete your account. For anything else, contact ${CONTACT_EMAIL}. You also have the right to complain to your national data protection authority.

10. SECURITY
Passwords are stored only as salted PBKDF2 hashes and are never readable by us. Access to the API requires a signed token, and each request is checked so you can only read your own records. No system is perfectly secure, so please use a strong, unique password.

11. CHILDREN
TrainWise is not intended for children under 16. We do not knowingly collect their data.

12. CHANGES
If this policy changes we will update the date above and show the new version here.`;

const TERMS_OF_SERVICE = `Last updated: 19 July 2026

1. AGREEMENT
By creating a TrainWise account or using the app you accept these terms. If you do not accept them, please do not use TrainWise.

2. WHO MAY USE IT
You must be at least 16 years old and able to enter into a binding agreement. You are responsible for the accuracy of the information you provide and for keeping your password confidential.

3. MEDICAL DISCLAIMER (PLEASE READ)
TrainWise is a training-load and fitness tracking tool. It is NOT a medical device and it does NOT provide medical advice, diagnosis or treatment. Its load figures, injury-risk scores, readiness scores, calorie estimates and AI suggestions are informational estimates produced by algorithms, and they can be wrong. Always consult a qualified doctor or physiotherapist before starting, changing or continuing any training programme, and especially if you are injured or in pain. Never ignore professional advice because of something you read in this app. If you think you have a medical emergency, contact your local emergency services immediately.

4. YOUR RESPONSIBILITY FOR TRAINING
You train at your own risk. You decide what exercise to do and how hard to push. TrainWise is not responsible for injury, illness or loss resulting from your training decisions.

5. YOUR CONTENT
You keep ownership of the content you create, such as notes, photos, voice messages and posts. You grant us the limited right to store and display it so the app can work, for example showing your post to your friends or your workout to your coach. Do not upload content that is unlawful, abusive, hateful, or that infringes someone else's rights, and do not upload other people's personal data without their permission.

6. ACCEPTABLE USE
Do not attempt to access another user's account or data, do not reverse engineer, overload or disrupt the service, and do not use the app to harass anyone. We may suspend or remove accounts that break these rules.

7. COACHES AND OTHER USERS
Coaches on TrainWise are other users, not our employees, and we do not verify their qualifications, certifications or advice. Any coaching relationship, review or recommendation is between you and that person. Check credentials yourself before acting on their guidance.

8. THIRD-PARTY SERVICES
The app relies on services such as Google Health Connect, Google Maps and OpenAI. Their own terms apply to your use of them, and their availability is outside our control.

9. AVAILABILITY
TrainWise is a student project provided "as is", without warranties of any kind. We do not guarantee that it will be available, uninterrupted, or free of errors, and features may change or be removed.

10. LIABILITY
To the fullest extent permitted by law, we are not liable for indirect or consequential loss, for lost data, or for loss arising from your use of or reliance on the app. Nothing in these terms limits liability that cannot lawfully be limited, such as liability for death or personal injury caused by negligence.

11. ENDING YOUR ACCOUNT
You can delete your account at any time from Settings, which permanently erases your data as described in the Privacy Policy.

12. CHANGES
We may update these terms. Continued use after an update means you accept the new version.`;

const SettingsScreen = ({navigation}) => {
  const { userId, updateUser: updateAuthUser, logout } = useAuth();
  const [exporting, setExporting] = useState(false); // #123

  // #123 — build a CSV of the user's workouts and open the share sheet.
  const handleExportHistory = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const count = await exportWorkoutHistory(userId);
      // The share sheet opens on success; a tiny confirmation for clarity.
      console.log(`Exported ${count} workouts`);
    } catch (e) {
      Alert.alert('Export failed', e?.message || 'Could not export your history.');
    } finally {
      setExporting(false);
    }
  };
  const { theme, setTheme, accent, setAccent, autoTheme, updateAutoTheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Delete-account flow uses TWO independent confirmations to avoid
  // accidental wipes: a native Alert ("are you sure?"), then a modal
  // that requires the user to retype their email exactly. Final delete
  // only fires after both pass.
  const [policyDoc, setPolicyDoc] = useState(null); // { title, body } | null
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
  const [notifPrefs, setNotifPrefsState] = useState(NOTIF_DEFAULTS); // #161
  // #112 — biometric unlock
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  // #111 — change password
  const [curPassword, setCurPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  // #163 — multi-device sessions (real, revocable)
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  // #114 — email verification
  const [verifyStep, setVerifyStep] = useState(0); // 0 idle · 1 code sent
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const sendVerifyCode = async () => {
    setVerifyBusy(true);
    try {
      const res = await requestEmailVerification(userId);
      if (res.data?.devCode) setVerifyCode(String(res.data.devCode));
      setVerifyStep(1);
    } catch (e) {
      Alert.alert('Could not send', e?.response?.data?.toString?.() || 'Please try again.');
    } finally {
      setVerifyBusy(false);
    }
  };

  const submitVerifyCode = async () => {
    if (!verifyCode.trim()) { Alert.alert('Enter the code', 'Enter the code you received.'); return; }
    setVerifyBusy(true);
    try {
      await confirmEmailVerification(userId, verifyCode.trim());
      setEmailVerified(true);
      setVerifyStep(0);
      setVerifyCode('');
      Alert.alert('Email verified', 'Your email address has been verified.');
    } catch (e) {
      Alert.alert('Could not verify', e?.response?.data?.toString?.() || 'The code may be wrong or expired.');
    } finally {
      setVerifyBusy(false);
    }
  };

  // #163 / 2026-07-19 — REAL sessions. Each login registers a server-side session
  // whose id is embedded in the JWT, so revoking one genuinely signs that device
  // out (its next request is rejected) instead of only deleting a row.
  const loadSessions = useCallback(() => {
    if (!userId) return;
    setDevicesLoading(true);
    getUserSessions(userId)
      .then((res) => setDevices(Array.isArray(res.data) ? res.data : []))
      .catch(() => setDevices([]))
      .finally(() => setDevicesLoading(false));
  }, [userId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const sVal = (s, camel, pascal) => s[camel] ?? s[pascal];

  const revokeDevice = (s) => {
    const id = sVal(s, 'sessionId', 'SessionId');
    const isCurrent = !!sVal(s, 'isCurrent', 'IsCurrent');
    const name = sVal(s, 'deviceName', 'DeviceName') || 'this device';
    Alert.alert(
      isCurrent ? 'Sign out this device?' : 'Sign out that device?',
      isCurrent
        ? `"${name}" is the device you are using now. Signing it out will log you out of TrainWise here.`
        : `"${name}" will be signed out of your account immediately and will need your password to get back in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out', style: 'destructive',
          onPress: async () => {
            try {
              await revokeUserSession(userId, id);
              if (isCurrent) { await logout(); return; }
              setDevices((prev) => prev.filter((x) => sVal(x, 'sessionId', 'SessionId') !== id));
            } catch (e) {
              Alert.alert('Could not sign out', e?.response?.data?.toString?.() || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const revokeAllOthers = () => {
    Alert.alert(
      'Sign out all other devices?',
      'Every device except this one will be signed out immediately. Use this if you think someone else has access to your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out others', style: 'destructive',
          onPress: async () => {
            try {
              const res = await revokeOtherUserSessions(userId);
              loadSessions();
              Alert.alert('Done', `Signed out ${res.data?.revoked ?? 0} other device(s).`);
            } catch (e) {
              Alert.alert('Could not sign out', e?.response?.data?.toString?.() || 'Please try again.');
            }
          },
        },
      ]
    );
  };
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
    getNotifPrefs().then(setNotifPrefsState);
    isBiometricSupported().then(setBioSupported);
    isBiometricEnabled().then(setBioEnabled);
  }, []);

  // #112 — enabling requires a successful biometric check first (so a user
  // can't lock themselves out with a sensor that doesn't recognize them).
  const toggleBiometric = async (value) => {
    if (value) {
      const ok = await authenticateBiometric('Confirm to enable biometric unlock');
      if (!ok) return;
      await setBiometricEnabled(true);
      setBioEnabled(true);
    } else {
      await setBiometricEnabled(false);
      setBioEnabled(false);
    }
  };

  // #111 — change password (Google-only accounts have no password to change).
  const handleChangePassword = async () => {
    if (!isValidPassword(newPassword)) {
      Alert.alert('Weak password', 'New password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    setChangingPw(true);
    try {
      await changePasswordApi(userId, curPassword, newPassword);
      setCurPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Done', 'Your password has been changed.');
    } catch (error) {
      Alert.alert('Could not change password', error.response?.data || error.message || 'Try again.');
    } finally {
      setChangingPw(false);
    }
  };

  // #161 — persist a single notification preference and reflect it immediately.
  const updateNotifPref = async (patch) => {
    const next = await setNotifPrefs(patch);
    setNotifPrefsState({ ...next });
  };

  // Quiet-hours start/end steppers (0–23, wrap).
  const stepQuiet = (field, delta) => {
    const cur = notifPrefs[field] ?? 0;
    updateNotifPref({ [field]: (cur + delta + 24) % 24 });
  };
  const hh = (h) => `${String(h).padStart(2, '0')}:00`;

  // #179 — auto-dark window start/end steppers (0–23, wrap).
  const stepDark = (field, delta) => {
    const cur = autoTheme[field] ?? 0;
    updateAutoTheme({ [field]: (cur + delta + 24) % 24 });
  };

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

  // The GDPR texts are far too long for Alert.alert (Android truncates and can't
  // scroll), so legal documents open in a scrollable modal instead.
  const showPolicy = (title, body) => setPolicyDoc({ title, body });

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
                  disabled={autoTheme.enabled}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {opt === 'dark' ? 'Dark' : 'Light'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {autoTheme.enabled
              ? 'Auto dark mode is on — the schedule below controls light/dark.'
              : 'Light mode uses the logo’s mint/teal palette.'}
          </Text>

          {/* #160 — accent color picker */}
          <Text style={[styles.label, { marginTop: Spacing.md }]}>Accent color</Text>
          <View style={styles.accentRow}>
            {ACCENT_LIST.map((a) => {
              const active = accent === a.name;
              return (
                <TouchableOpacity
                  key={a.name}
                  style={styles.accentItem}
                  onPress={() => setAccent(a.name)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.accentSwatch,
                      { backgroundColor: a.swatch },
                      active && styles.accentSwatchActive,
                    ]}
                  >
                    {active && <Text style={styles.accentCheck}>✓</Text>}
                  </View>
                  <Text style={[styles.accentLabel, active && styles.accentLabelActive]}>
                    {a.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* #179 — scheduled (auto) dark mode */}
          <View style={[styles.switchRow, { marginTop: Spacing.sm }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.switchLabel}>Auto dark mode</Text>
              <Text style={styles.hint}>Switch to dark in the evening and back to light by day.</Text>
            </View>
            <Switch
              value={!!autoTheme.enabled}
              onValueChange={(v) => updateAutoTheme({ enabled: v })}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {autoTheme.enabled && (
            <View style={styles.quietRow}>
              <View style={styles.quietCol}>
                <Text style={styles.label}>Dark from</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepDark('darkStart', -1)}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepVal}>{hh(autoTheme.darkStart)}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepDark('darkStart', 1)}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.quietCol}>
                <Text style={styles.label}>Light from</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepDark('darkEnd', -1)}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepVal}>{hh(autoTheme.darkEnd)}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepDark('darkEnd', 1)}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
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

        {/* Security (#112 biometric + #111 change password) */}
        <Card>
          <Text style={styles.cardTitle}>Security</Text>
          {bioSupported && (
            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.switchLabel}>Unlock with biometrics</Text>
                <Text style={styles.hint}>
                  Require fingerprint or face to open TrainWise.
                </Text>
              </View>
              <Switch
                value={bioEnabled}
                onValueChange={toggleBiometric}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>
          )}

          <Text style={[styles.label, { marginTop: Spacing.md }]}>Change password</Text>
          <PasswordInput
            style={styles.input}
            value={curPassword}
            onChangeText={setCurPassword}
            placeholder="Current password"
            placeholderTextColor={Colors.textMuted}
          />
          <PasswordInput
            style={[styles.input, { marginTop: Spacing.sm }]}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            placeholderTextColor={Colors.textMuted}
          />
          <PasswordRequirements password={newPassword} />
          <PasswordInput
            style={[styles.input, { marginTop: Spacing.sm }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.changePwBtn, changingPw && { opacity: 0.6 }]}
            onPress={handleChangePassword}
            disabled={changingPw}
            activeOpacity={0.85}
          >
            {changingPw ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.changePwText}>Update password</Text>
            )}
          </TouchableOpacity>
        </Card>

        {/* Notifications (#161) */}
        <Card>
          <Text style={styles.cardTitle}>Notifications</Text>
          {Object.keys(NOTIF_TYPE_LABELS).map((key) => (
            <View key={key} style={styles.switchRow}>
              <Text style={[styles.switchLabel, { flex: 1, paddingRight: 12 }]}>
                {NOTIF_TYPE_LABELS[key]}
              </Text>
              <Switch
                value={notifPrefs[key] !== false}
                onValueChange={(v) => updateNotifPref({ [key]: v })}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>
          ))}

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.switchLabel}>Quiet hours</Text>
              <Text style={styles.hint}>Silence all notifications during a chosen window.</Text>
            </View>
            <Switch
              value={!!notifPrefs.quietHoursEnabled}
              onValueChange={(v) => updateNotifPref({ quietHoursEnabled: v })}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {/* #162 — preview the weekly recap notification right now */}
          <TouchableOpacity
            style={styles.testRecapBtn}
            activeOpacity={0.85}
            onPress={async () => {
              await sendWeeklyRecapNow();
              Alert.alert('Sent', 'Check your notification shade for the weekly recap preview.');
            }}
          >
            <Text style={styles.testRecapText}>Send test recap now</Text>
          </TouchableOpacity>

          {notifPrefs.quietHoursEnabled && (
            <View style={styles.quietRow}>
              <View style={styles.quietCol}>
                <Text style={styles.label}>From</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepQuiet('quietStart', -1)}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepVal}>{hh(notifPrefs.quietStart)}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepQuiet('quietStart', 1)}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.quietCol}>
                <Text style={styles.label}>To</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepQuiet('quietEnd', -1)}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepVal}>{hh(notifPrefs.quietEnd)}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepQuiet('quietEnd', 1)}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </Card>

        {/* Privacy + Terms */}
        <Card>
          <Text style={styles.cardTitle}>Legal</Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => showPolicy('Privacy Policy', PRIVACY_POLICY)}>
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Text style={styles.linkArrow}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => showPolicy('Terms of Service', TERMS_OF_SERVICE)}>
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
            await resetAllTutorials();
            Alert.alert('Done', 'Screen tutorials will show again next time you visit each screen.');
          }}
        >
          <Text style={styles.resetOnboardingText}>🔄 Reset Tutorial</Text>
        </TouchableOpacity>

        {/* #123 — export your workout history to a CSV you can share/backup. */}
        <Card>
          <Text style={styles.cardTitle}>Your data</Text>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleExportHistory}
            disabled={exporting}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>
              {exporting ? 'Preparing export…' : 'Export workout history (CSV)'}
            </Text>
            {exporting ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <Text style={styles.linkArrow}>{'>'}</Text>
            )}
          </TouchableOpacity>
        </Card>

        {/* #114 — email verification. In dev (AUTH_DEV_CODES=true) the code is
            returned by the API and prefilled; otherwise it is emailed. */}
        <ErrorBoundary inline label="Email verification card">
        <Card>
          <Text style={styles.cardTitle}>Email verification</Text>
          {emailVerified ? (
            <View style={styles.verifyRow}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.verifiedText}>Your email is verified.</Text>
            </View>
          ) : verifyStep === 0 ? (
            <>
              <Text style={styles.verifyBlurb}>Verify {email || 'your email'} to secure your account.</Text>
              <TouchableOpacity style={styles.actionRow} onPress={sendVerifyCode} disabled={verifyBusy} activeOpacity={0.8}>
                <Text style={styles.actionText}>{verifyBusy ? 'Sending…' : 'Send verification code'}</Text>
                {verifyBusy ? <ActivityIndicator color={Colors.primary} size="small" /> : <Text style={styles.linkArrow}>{'>'}</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.verifyBlurb}>Enter the 6-digit code sent to {email}.</Text>
              <TextInput
                style={styles.verifyInput}
                value={verifyCode}
                onChangeText={setVerifyCode}
                placeholder="123456"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity style={styles.verifyBtn} onPress={submitVerifyCode} disabled={verifyBusy} activeOpacity={0.85}>
                {verifyBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyBtnText}>Verify email</Text>}
              </TouchableOpacity>
            </>
          )}
        </Card>
        </ErrorBoundary>

        {/* #163 / 2026-07-19 — REAL devices & sessions. Every login registers a
            server-side session whose id is inside that device's token, so "Sign
            out" here rejects that device on its very next request. */}
        <ErrorBoundary inline label="Devices & sessions card">
        <Card>
          <View style={styles.deviceHeaderRow}>
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Devices & sessions</Text>
            <TouchableOpacity onPress={loadSessions} hitSlop={8} disabled={devicesLoading}>
              <Ionicons name="refresh" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.deviceIntro}>
            Everywhere you are signed in. Sign out any device you don’t recognise. It loses access straight away.
          </Text>

          {devicesLoading && devices.length === 0 ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.md }} />
          ) : devices.length === 0 ? (
            <Text style={styles.deviceEmpty}>
              No active sessions recorded yet. Sign out and back in on this device to register it.
            </Text>
          ) : (
            devices.map((d) => {
              const id = d.sessionId ?? d.SessionId;
              const isCurrent = !!(d.isCurrent ?? d.IsCurrent);
              const lastSeen = d.lastSeenAt ?? d.LastSeenAt;
              const platform = d.platform ?? d.Platform;
              return (
                <View key={id} style={styles.deviceRow}>
                  <Ionicons
                    name={platform === 'ios' ? 'phone-portrait-outline' : 'phone-portrait-outline'}
                    size={20}
                    color={isCurrent ? Colors.primary : Colors.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.deviceNameRow}>
                      <Text style={styles.deviceName} numberOfLines={1}>
                        {d.deviceName ?? d.DeviceName ?? 'Unknown device'}
                      </Text>
                      {isCurrent && (
                        <View style={styles.deviceCurrentPill}>
                          <Text style={styles.deviceCurrentText}>This device</Text>
                        </View>
                      )}
                    </View>
                    {lastSeen ? (
                      <Text style={styles.deviceMeta}>
                        Last active {parseServerDate(lastSeen).toLocaleString()}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => revokeDevice(d)} hitSlop={8}>
                    <Text style={styles.deviceRevoke}>Sign out</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          {devices.length > 1 && (
            <TouchableOpacity style={styles.revokeAllBtn} onPress={revokeAllOthers} activeOpacity={0.85}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.red} />
              <Text style={styles.revokeAllText}>Sign out all other devices</Text>
            </TouchableOpacity>
          )}
        </Card>
        </ErrorBoundary>

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

      {/* Legal documents (Privacy Policy / Terms). Scrollable because the GDPR
          text is long; an Alert would truncate it. */}
      <Modal
        visible={!!policyDoc}
        transparent
        animationType="slide"
        onRequestClose={() => setPolicyDoc(null)}
      >
        <View style={styles.policyBackdrop}>
          <View style={styles.policyCard}>
            <View style={styles.policyHeader}>
              <Text style={styles.policyTitle} numberOfLines={1}>{policyDoc?.title}</Text>
              <TouchableOpacity onPress={() => setPolicyDoc(null)} hitSlop={10}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.policyScroll} contentContainerStyle={{ paddingBottom: Spacing.lg }}>
              <Text style={styles.policyBody}>{policyDoc?.body}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  accentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.xs,
  },
  accentItem: {
    width: '16.66%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  accentSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accentSwatchActive: {
    borderColor: Colors.textPrimary,
  },
  accentCheck: {
    color: '#fff',
    fontSize: 16,
    fontWeight: Fonts.bold,
  },
  accentLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },
  accentLabelActive: {
    color: Colors.textPrimary,
    fontWeight: Fonts.semiBold,
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
  testRecapBtn: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  testRecapText: {
    color: Colors.primary,
    fontSize: Fonts.captionSize + 1,
    fontWeight: Fonts.semiBold,
  },
  changePwBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  changePwText: {
    color: '#fff',
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.bold,
  },
  quietRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  quietCol: {
    flex: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  stepBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
  },
  stepBtnText: {
    color: Colors.primary,
    fontSize: 22,
    fontWeight: Fonts.bold,
  },
  stepVal: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.bold,
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
  // NOTE: this file's factory param is `Colors` (not `C`). Referencing `C.*`
  // here throws ReferenceError inside useThemedStyles → Settings crashed on
  // mount with no visible message (fixed 2026-07-19).

  // #114 email verification
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  verifiedText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  verifyBlurb: { color: Colors.textSecondary, fontSize: 13, marginTop: 6, marginBottom: 8 },
  verifyInput: {
    backgroundColor: Colors.inputBackground, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: Colors.textPrimary, fontSize: 16, borderWidth: 1, borderColor: Colors.inputBorder, letterSpacing: 4,
  },
  verifyBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  verifyBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // #163 devices & sessions
  deviceHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  deviceIntro: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 4 },
  deviceEmpty: { color: Colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 18 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  deviceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deviceName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  deviceCurrentPill: { backgroundColor: Colors.primary + '22', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  deviceCurrentText: { color: Colors.primary, fontSize: 10, fontWeight: '800' },
  deviceMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  deviceRevoke: { color: '#ff5252', fontSize: 13, fontWeight: '800' },
  revokeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: Spacing.md, paddingVertical: Spacing.sm + 2, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.red,
  },
  revokeAllText: { color: Colors.red, fontSize: 14, fontWeight: '800' },

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
  // Legal document modal (Privacy / Terms)
  policyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  policyCard: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    maxHeight: '88%',
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  policyTitle: {
    flex: 1,
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
  },
  policyScroll: { marginTop: Spacing.md },
  policyBody: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize + 1,
    lineHeight: 20,
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
