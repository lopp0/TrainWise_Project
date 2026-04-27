// מסך הגדרות — עריכת פרופיל, ערכת נושא, יום תחילת שבוע, משפטיות
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
// ייבוא צבעים, גופנים וריווחים מהתמה
import {Colors, Fonts, Spacing} from '../theme/colors';
// קומפוננטים משותפים
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
// שליפת ועדכון פרטי משתמש מה-Backend
import {getUserById, updateUser as updateUserApi} from '../services/api';
// userId + updateUser מה-AuthContext לעדכון הנתונים המקומיים
import { useAuth } from '../api/AuthContext';
// ניהול ערכת הנושא (dark/light) מה-ThemeContext
import { useTheme } from '../theme/ThemeContext';
// שמות הימים + פונקציות ניהול יום תחילת השבוע מה-AsyncStorage
import {
  DAY_NAMES,
  getWeekStartDay,
  setWeekStartDay,
} from '../constants/weekStart';

const SettingsScreen = ({navigation}) => {
  // userId לשליפה ועדכון; updateAuthUser לעדכון ה-Cache המקומי
  const { userId, updateUser: updateAuthUser } = useAuth();
  // theme: הערכה הנוכחית ('dark'/'light'); setTheme לשינוי
  const { theme, setTheme } = useTheme();
  // האם בטעינת נתוני המשתמש
  const [loading, setLoading] = useState(true);
  // האם שמירה בתהליך
  const [saving, setSaving] = useState(false);
  // שדות הטופס — מאוכלסים מהשרת ב-loadUser
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  // מצב מתג מאמן/מתאמן (אינו שמור ב-Backend כרגע)
  const [isCoachMode, setIsCoachMode] = useState(false);
  // יום תחילת שבוע: 0=ראשון, 1=שני ... 6=שבת (ברירת מחדל מה-AsyncStorage)
  const [weekStart, setWeekStart] = useState(getWeekStartDay());
  // שדות שה-BL מחייב בעדכון אך אינם ניתנים לעריכה כאן — מוחזרים כשהם
  const [serverFields, setServerFields] = useState({
    activityLevel: 1,
    deviceType: 'none',
    experienceLevel: 1,
  });

  // טעינת נתוני המשתמש בעלייה למסך
  useEffect(() => {
    loadUser();
  }, []);

  // שולף פרטי משתמש מה-Backend ומאכלס את שדות הטופס
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
      // שמירת שדות שמנוהלים על-ידי השרת כדי להחזירם בעת עדכון
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

  // שולח עדכון פרטים ל-Backend ומעדכן את ה-Cache המקומי
  const handleSave = async () => {
    setSaving(true);
    try {
      // Backend Update מאמת DTO מלא (ActivityLevel/ExperienceLevel
      // חייבים להיות 1-3, DeviceType לא ריק). מחזירים שדות שרת
      // כדי שעריכת פרטי פרופיל בסיסיים לא תפיל את האימות הזה.
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

      // עדכון AuthContext כדי ש-HomeScreen ו-ProfileScreen יוצגו מיד
      // עם הנתונים החדשים, ללא צורך בהתחברות מחדש
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

  // פתיחת Alert עם טקסט מדיניות — לשני כפתורי Legal
  const showPolicy = (title, text) => {
    Alert.alert(title, text, [{text: 'OK'}]);
  };

  // מסך טעינה — ספינר עד שנתוני המשתמש מגיעים
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* כותרת המסך עם כפתור חזרה */}
      <ScreenHeader
        title="Settings"
        subtitle="Manage your account"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* כרטיסיית פרטים אישיים */}
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

        {/* כרטיסיית מדידות — גובה ומשקל בשתי עמודות */}
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

        {/* כרטיסיית ערכת נושא — Dark / Light */}
        <Card>
          <Text style={styles.cardTitle}>Appearance</Text>
          {/* Segment control: לחיצה על כפתור מחיל את הערכה ומאחסן ב-AsyncStorage */}
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
          {/* הסבר לתחתית הכרטיסייה */}
          <Text style={styles.hint}>Light mode uses the logo's mint/teal palette.</Text>
        </Card>

        {/* כרטיסיית בחירת יום תחילת שבוע — 7 כפתורים */}
        <Card>
          <Text style={styles.cardTitle}>Week starts on</Text>
          <View style={styles.weekStartRow}>
            {/* מיפוי 7 שמות ימים עם מדד המתאים ליום */}
            {DAY_NAMES.map((name, idx) => {
              const active = weekStart === idx;
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.weekStartBtn, active && styles.weekStartBtnActive]}
                  onPress={async () => {
                    // עדכון ה-state המקומי + שמירה ב-AsyncStorage
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
          {/* הסבר על ההשפעה של ההגדרה */}
          <Text style={styles.hint}>
            Affects the Home + Warnings weekly charts and the AC ratio window.
          </Text>
        </Card>

        {/* כרטיסיית מצב פרופיל — מאמן / מתאמן */}
        <Card>
          <Text style={styles.cardTitle}>Profile Mode</Text>
          {/* שורת מתג עם תווית דינמית */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {isCoachMode ? 'Coach' : 'Trainee'}
            </Text>
            {/* Switch: false=מתאמן, true=מאמן */}
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

        {/* כרטיסיית משפטיות — Privacy Policy ו-Terms of Service */}
        <Card>
          <Text style={styles.cardTitle}>Legal</Text>
          {/* כפתור Privacy Policy — פותח Alert עם הטקסט */}
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
          {/* כפתור Terms of Service */}
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

        {/* כרטיסיית חיבורים — ניווט למסך QR */}
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

      {/* פס תחתון קבוע — כפתור שמירה + כפתור חזרה לדף הבית */}
      <View style={styles.bottomActions}>
        <PrimaryButton
          title="Save Changes"
          onPress={handleSave}
          loading={saving}
        />
        {/* כפתור משני — חזרה למסך Warnings */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Warnings')}>
          <Text style={styles.secondaryButtonText}>Home Page</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// סגנונות המסך
const styles = StyleSheet.create({
  // מיכל ראשי
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // מרכוז לספינר הטעינה
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ריפוד תחתון לגלילה
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  // כותרת כרטיסייה
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },
  // תווית שדה קטנה
  label: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  // שדה קלט
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    fontSize: Fonts.bodySize,
  },
  // שורה לשתי עמודות
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // עמודה חצי-רוחב
  halfCol: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  // שורת מתג (Profile Mode)
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  // שורת Segment control (Appearance)
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 4,
    marginBottom: Spacing.xs,
  },
  // כפתור בודד ב-Segment
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  // כפתור נבחר ב-Segment
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
  // שורת כפתורי ימים
  weekStartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  // כפתור יום בודד
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
  // כפתור יום נבחר
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
  // תווית מצב המתג
  switchLabel: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
  // טקסט הסבר קטן תחת קטעים
  hint: {
    color: Colors.textMuted,
    fontSize: Fonts.captionSize,
    marginTop: Spacing.xs,
  },
  // שורת קישור משפטי עם חץ
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
  // חץ ימני לפניות
  linkArrow: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
  },
  // שורת פעולה (Connect to Coach)
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
  // פס תחתון קבוע
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  // כפתור "Home Page" — משני
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
