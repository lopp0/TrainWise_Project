import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {Colors, Fonts, Spacing} from '../theme/colors';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import {getUserById, updateUser as updateUserApi} from '../services/api';
import { useAuth } from '../api/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import {
  DAY_NAMES,
  getWeekStartDay,
  setWeekStartDay,
} from '../constants/weekStart';

const SettingsScreen = ({navigation}) => {
  const { userId, updateUser: updateAuthUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [isCoachMode, setIsCoachMode] = useState(false);
  const [weekStart, setWeekStart] = useState(getWeekStartDay());
  // Server-managed fields the BL requires on update — kept hidden but echoed back.
  const [serverFields, setServerFields] = useState({
    activityLevel: 1,
    deviceType: 'none',
    experienceLevel: 1,
  });

  useEffect(() => {
    loadUser();
  }, []);

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
      });
    } catch (error) {
      console.log('Load user error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Backend Update validates the full DTO (ActivityLevel/ExperienceLevel
      // must be 1-3, DeviceType non-empty). Echo back server-side fields so
      // editing only profile basics doesn't trip those validators.
      const payload = {
        userID: userId,
        fullName,
        email,
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
          <Text style={styles.hint}>Light mode uses the logo's mint/teal palette.</Text>
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

        {/* Profile Switch */}
        <Card>
          <Text style={styles.cardTitle}>Profile Mode</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {isCoachMode ? 'Coach' : 'Trainee'}
            </Text>
            <Switch
              value={isCoachMode}
              onValueChange={setIsCoachMode}
              trackColor={{false: Colors.inputBorder, true: Colors.primaryDark}}
              thumbColor={isCoachMode ? Colors.primary : Colors.textMuted}
            />
          </View>
          <Text style={styles.hint}>
            Switch between trainee and coach views of the app.
          </Text>
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
      </ScrollView>

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

const styles = StyleSheet.create({
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
});

export default SettingsScreen;
