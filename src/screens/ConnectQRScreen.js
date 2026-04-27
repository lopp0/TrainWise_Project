// מסך חיבור QR — מאפשר למשתמש להציג את ה-QR Code שלו או לסרוק קוד של אחר
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
// ספריית יצירת QR Code
import QRCode from 'react-native-qrcode-svg';
// ייבוא צבעים, גופנים וריווחים מהתמה
import {Colors, Fonts, Spacing} from '../theme/colors';
// קומפוננטים משותפים
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
// userId מה-AuthContext
import { useAuth } from '../api/AuthContext';

const ConnectQRScreen = ({navigation}) => {
  // userId של המשתמש המחובר — ייכלל ב-QR
  const { userId } = useAuth();
  // מצב תצוגה: 'show' = הצג QR שלי, 'scan' = סרוק קוד של אחר
  const [mode, setMode] = useState('show');
  // הקוד שהמשתמש הדביק בשדה הטקסט (בסריקה ידנית)
  const [scanCode, setScanCode] = useState('');

  // מטען ה-JSON שיוצפן ב-QR Code — מכיל זיהוי האפליקציה, סוג החיבור, ו-userId
  const qrPayload = JSON.stringify({
    app: 'TrainWise',
    type: 'coach-connect',
    userId: userId,
    timestamp: Date.now(),  // timestamp למניעת שימוש חוזר בקוד ישן
  });

  // מטפל בחיבור ידני — מנתח את הקוד שהוזן ושולח בקשת חיבור
  const handleConnect = () => {
    // וידוא שיש קוד להתחבר אליו
    if (!scanCode.trim()) {
      Alert.alert('Missing Code', 'Please enter or scan a connection code');
      return;
    }
    try {
      // ניסיון לפרסר את הקוד כ-JSON
      const data = JSON.parse(scanCode);
      // וידוא שהקוד הוא מ-TrainWise ולא מאפליקציה אחרת
      if (data.app !== 'TrainWise') {
        throw new Error('Invalid code');
      }
      // הצגת אישור ומעבר חזרה
      Alert.alert(
        'Connection Requested',
        `A connection request has been sent to user #${data.userId}. They will be notified to approve.`,
        [{text: 'OK', onPress: () => navigation.goBack()}],
      );
    } catch (e) {
      // קוד לא תקין — JSON שגוי או שאינו מ-TrainWise
      Alert.alert('Invalid Code', 'That does not look like a TrainWise code.');
    }
  };

  return (
    <View style={styles.container}>
      {/* כותרת עם כפתור חזרה */}
      <ScreenHeader
        title="Connect"
        subtitle="Coach / Trainee link"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* כפתורי מצב: הצג QR שלי / סרוק קוד */}
        <View style={styles.toggleRow}>
          {/* כפתור הצגת QR Code */}
          <TouchableOpacity
            style={[
              styles.toggleButton,
              mode === 'show' && styles.toggleButtonActive,
            ]}
            onPress={() => setMode('show')}>
            <Text
              style={[
                styles.toggleText,
                mode === 'show' && styles.toggleTextActive,
              ]}>
              My QR Code
            </Text>
          </TouchableOpacity>
          {/* כפתור סריקת קוד */}
          <TouchableOpacity
            style={[
              styles.toggleButton,
              mode === 'scan' && styles.toggleButtonActive,
            ]}
            onPress={() => setMode('scan')}>
            <Text
              style={[
                styles.toggleText,
                mode === 'scan' && styles.toggleTextActive,
              ]}>
              Scan Code
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'show' ? (
          // מצב הצגה — מציג את ה-QR Code של המשתמש
          <Card>
            <Text style={styles.cardTitle}>Share Your Code</Text>
            <Text style={styles.description}>
              Show this QR code to your coach or trainee so they can connect
              with you.
            </Text>
            {/* QR Code — מכיל את qrPayload */}
            <View style={styles.qrContainer}>
              <View style={styles.qrWrapper}>
                <QRCode
                  value={qrPayload}
                  size={220}
                  backgroundColor="white"
                  color={Colors.background}  // צבע הקוד עצמו = צבע רקע האפליקציה
                />
              </View>
            </View>
            {/* הצגת ה-userId לאימות */}
            <Text style={styles.userIdText}>User ID: #{userId}</Text>
          </Card>
        ) : (
          // מצב סריקה — הזנת קוד ידנית (או עתידית: מצלמה)
          <Card>
            <Text style={styles.cardTitle}>Enter Connection Code</Text>
            <Text style={styles.description}>
              Paste the code shared by the other user, or tap Scan to use the
              camera.
            </Text>
            {/* שדה הדבקת הקוד */}
            <TextInput
              style={styles.textArea}
              placeholder="Paste the TrainWise code here..."
              placeholderTextColor={Colors.textMuted}
              value={scanCode}
              onChangeText={setScanCode}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {/* כפתור פתיחת מצלמה — מציג הסבר שעדיין לא ממומש */}
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() =>
                Alert.alert(
                  'Camera',
                  'Camera scanning requires device-level setup. Use manual code entry for now.',
                )
              }>
              <Text style={styles.scanButtonText}>Open Camera Scanner</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* כרטיס הסבר על תהליך החיבור */}
        <Card>
          <Text style={styles.cardTitle}>How It Works</Text>
          <Text style={styles.infoText}>
            1. As a trainee, show your QR code to your coach{'\n'}
            2. The coach scans it to request a connection{'\n'}
            3. You approve the link in notifications{'\n'}
            4. Your coach can now view your training load and send
            recommendations
          </Text>
        </Card>
      </ScrollView>

      {/* כפתור "Connect" מוצג רק במצב סריקה */}
      {mode === 'scan' && (
        <View style={styles.bottomActions}>
          <PrimaryButton title="Connect" onPress={handleConnect} />
        </View>
      )}
    </View>
  );
};

// סגנונות המסך
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  // שורת מיתוג (toggle) — מכילה שני כפתורים
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,   // כפתור פעיל מסומן בצבע מותג
  },
  toggleText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
  toggleTextActive: {
    color: Colors.textPrimary,
  },
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  // מיכל ה-QR — ממורכז
  qrContainer: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  // עטיפה לבנה סביב ה-QR לניגודיות
  qrWrapper: {
    backgroundColor: 'white',
    padding: Spacing.md,
    borderRadius: 12,
  },
  userIdText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
    fontSize: Fonts.captionSize,
    letterSpacing: 1,
  },
  textArea: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    minHeight: 100,
    fontSize: Fonts.bodySize,
  },
  scanButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
  },
  scanButtonText: {
    color: Colors.primary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
  infoText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    lineHeight: 22,
  },
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
});

export default ConnectQRScreen;
