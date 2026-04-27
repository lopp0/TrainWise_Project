// מסך הרשמה ראשוני — פרטים אישיים, גיל/משקל/גובה, רמת אימון, תפקיד
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  FlatList,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
// SafeAreaView — מגן על notch
import { SafeAreaView } from 'react-native-safe-area-context';
// שליטה בשורת הסטטוס
import { StatusBar } from 'expo-status-bar';
// אייקוני חץ וסימון
import { Ionicons } from '@expo/vector-icons';
// בחירת תמונה מגלריה
import * as ImagePicker from 'expo-image-picker';

// רוחב המסך לחישוב גדלים יחסיים
const { width: SCREEN_W } = Dimensions.get('window');
// גודל עיגולי הבחירה לתפקיד (Trainer/Trainee/Both) — 3 עיגולים שורה
const CIRCLE_SIZE = Math.floor((SCREEN_W - 48 - 32) / 3);

// ─── Dropdown מקומי (בלי תלות ב-ComboBox) ────────────────────────
// props: items (מערך {label, value}), value, onChange, placeholder
const DropDown = ({ items, value, onChange, placeholder }) => {
  // האם הרשימה פתוחה
  const [open, setOpen] = useState(false);
  // החיפוש של ה-item הנבחר
  const selected = items.find(i => i.value === value);

  return (
    <>
      {/* שדה הבחירה — לחיצה פותחת Modal */}
      <TouchableOpacity style={dd.field} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[dd.text, !selected && dd.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#aaa" />
      </TouchableOpacity>

      {/* Modal הרשימה */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* לחיצה על הרקע סוגרת */}
        <Pressable style={dd.backdrop} onPress={() => setOpen(false)}>
          {/* עצירת הפצת לחיצה מהגיליון */}
          <Pressable style={dd.sheet} onPress={() => {}}>
            <Text style={dd.sheetTitle}>{placeholder}</Text>
            {/* רשימת אפשרויות */}
            <FlatList
              data={items}
              keyExtractor={item => String(item.value)}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const isSel = item.value === value;
                return (
                  <TouchableOpacity
                    style={[dd.item, isSel && dd.itemSel]}
                    onPress={() => { onChange(item.value); setOpen(false); }}
                  >
                    <Text style={[dd.itemText, isSel && dd.itemTextSel]}>{item.label}</Text>
                    {/* ✓ לפריט הנבחר */}
                    {isSel && <Ionicons name="checkmark" size={16} color="#ff2c60" />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

// סגנונות ה-Dropdown המקומי
const dd = StyleSheet.create({
  // שדה בחירה — לבן עם מסגרת מנטה
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#87ffd7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  text: { color: '#13173d', fontSize: 12, flex: 1, marginRight: 4 },
  placeholder: { color: '#bbb' },
  // overlay כהה
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  // גיליון הרשימה — כחול כהה
  sheet: { backgroundColor: '#1d2155', borderRadius: 14, padding: 14 },
  sheetTitle: {
    color: '#ff2c60',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  // פריט ברשימה
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2f6a',
  },
  // פריט נבחר — רקע כחול
  itemSel: { backgroundColor: '#2a2f6a' },
  itemText: { color: '#fff', fontSize: 14 },
  // טקסט נבחר — ורוד ומודגש
  itemTextSel: { color: '#ff2c60', fontWeight: '700' },
});

// ─── ערכי הגלגלת ─────────────────────────────────────────────────
// גיל: 13–99 (87 ערכים)
const AGE_VALUES    = Array.from({ length: 87  }, (_, i) => i + 13);
// משקל: 30–300 ק"ג (271 ערכים)
const WEIGHT_VALUES = Array.from({ length: 271 }, (_, i) => i + 30);
// גובה: 120–250 ס"מ (131 ערכים)
const HEIGHT_VALUES = Array.from({ length: 131 }, (_, i) => i + 120);

// ─── קומפוננט WheelPicker — גלגלת גלילה לבחירת מספר ────────────
// גובה כל שורה
const ITEM_H = 40;
// מספר שורות גלויות — חייב להיות אי-זוגי כדי שהמרכז יהיה חד-משמעי
const VISIBLE = 5;
// מספר שורות "כרית" מעל ומתחת (= 2) כדי שהערך הראשון/אחרון יגיע למרכז
const HALF = Math.floor(VISIBLE / 2);

// props: values (מערך), selected (ערך נוכחי), onSelect (callback), unit (יחידה)
const WheelPicker = ({ values, selected, onSelect, unit }) => {
  // ref ל-ScrollView לגלילה פרוגרמטית
  const ref = useRef(null);
  // אינדקס הבחירה — מבוטח: לא שלילי
  const safeIndex = Math.max(0, values.indexOf(selected));

  // גלילה לערך הנבחר לאחר שה-layout מוכן (60ms delay)
  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: safeIndex * ITEM_H, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, []);

  // בסיום תנועת גלילה — מחשב איזה ערך נמצא במרכז
  const onMomentumEnd = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    // הגבלת האינדקס לתחום התקין
    const clamped = Math.max(0, Math.min(idx, values.length - 1));
    onSelect(values[clamped]);
  };

  // שורות null מעל ומתחת — מאפשרות לערכים הראשון/אחרון להגיע למרכז
  const padded = [...Array(HALF).fill(null), ...values, ...Array(HALF).fill(null)];

  return (
    <View style={wp.outer}>
      {/* הדגשת השורה המרכזית — מוצב מאחורי הטקסט */}
      <View pointerEvents="none" style={wp.highlight} />
      {/* גלגלת הגלילה */}
      <ScrollView
        ref={ref}
        style={wp.scroll}
        snapToInterval={ITEM_H}          // מנגנן "snap" — תמיד מיישר לשורה
        decelerationRate="fast"           // עצירה מהירה
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        nestedScrollEnabled               // מאפשר גלילה בתוך ScrollView חיצוני
        scrollEventThrottle={16}
      >
        {padded.map((val, i) => {
          // האם זה הערך הנבחר (אינו null)
          const isSel = val !== null && val === selected;
          return (
            <View key={i} style={wp.item}>
              {/* הצגת הערך עם יחידה; null מוצג כרקע ריק */}
              <Text style={[wp.text, isSel && wp.textSel]}>
                {val !== null ? `${val}${unit ?? ''}` : ''}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

// סגנונות WheelPicker
const wp = StyleSheet.create({
  // מיכל — חותך ל-5 שורות
  outer: { height: ITEM_H * VISIBLE, overflow: 'hidden' },
  // הדגשת המרכז — מסגרת מנטה חצי-שקופה
  highlight: {
    position: 'absolute',
    top: ITEM_H * HALF,          // ממוקם בשורה המרכזית
    left: 0,
    right: 0,
    height: ITEM_H,
    backgroundColor: 'rgba(135,255,215,0.12)',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#87ffd7',
    zIndex: 1,
  },
  scroll: { flex: 1 },
  // שורה יחידה
  item: { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  // טקסט לא נבחר — שקוף למחצה
  text: { color: 'rgba(19,23,61,0.3)', fontSize: 13, fontWeight: '500' },
  // טקסט נבחר — מודגש וגדול יותר
  textSel: { color: '#13173d', fontSize: 16, fontWeight: '900' },
});

// ─── נתוני Dropdown ───────────────────────────────────────────────
// רמת אימון
const TRAINING_LEVEL_ITEMS = [
  { label: 'Beginner',  value: 'Beginner'  },
  { label: 'Regular',   value: 'Regular'   },
  { label: 'Advanced',  value: 'Advanced'  },
];
// הערכת אימונים שבועיים
const WEEKLY_EST_ITEMS = [
  { label: 'Low (0–1 time per week)', value: 'Low'    },
  { label: 'Medium (2–4)',            value: 'Medium' },
  { label: 'High (5+)',               value: 'High'   },
];

// ─── מסך הרשמה ────────────────────────────────────────────────────
const SignUpScreen = ({ navigation }) => {
  // ref לגלילה פרוגרמטית (שמורה לשימוש עתידי)
  const scrollRef = useRef(null);

  // שדות הטופס עם ערכי ברירת מחדל
  const [name, setName] = useState('');
  const [profileImage, setProfileImage] = useState(null); // URI מהגלריה
  const [sex, setSex] = useState(null);                   // 'male' / 'female' / null
  const [age, setAge] = useState(25);
  const [weight, setWeight] = useState(70);               // ק"ג
  const [height, setHeight] = useState(170);              // ס"מ
  const [trainingLevel, setTrainingLevel] = useState(null);
  const [weeklyEst, setWeeklyEst] = useState(null);
  const [role, setRole] = useState(null);                 // 'trainer' / 'trainee' / 'both'

  // בחירת תמונת פרופיל מהגלריה
  const pickImage = async () => {
    // בקשת הרשאת גלריה
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'We need access to your photo library to upload a profile picture.');
      return;
    }
    // פתיחת בוחר תמונות — חיתוך ריבועי, איכות 80%
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    // שמירת ה-URI אם הבחירה לא בוטלה
    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  // כפתור Next פעיל רק אם כל שדות החובה מלאים
  const canProceed =
    name.trim().length > 0 &&
    sex !== null &&
    trainingLevel !== null &&
    weeklyEst !== null &&
    role !== null;

  // מעבר לשלב הסופי של ההרשמה עם כל הפרמטרים
  const handleNext = () => {
    if (!canProceed) return;
    // העברת כל הנתונים שהוזנו בשלב זה ל-SignUpFinal
    navigation.navigate('SignUpFinal', { name, age, weight, height, sex, trainingLevel, weeklyEst, role, profileImage });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      {/* KeyboardAvoidingView — מונע מהמקלדת לכסות שדות */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* כותרת "Sign Up" עם אפקט echo */}
          <View style={s.titleWrapper}>
            {/* שכבת הצל — סגולה */}
            <Text style={[s.titleBase, s.titleEcho]}>Sign Up</Text>
            {/* שכבת החזית — ורוד */}
            <Text style={[s.titleBase, s.titleFront]}>Sign Up</Text>
          </View>

          {/* קטע 1: פרטים אישיים */}
          <Text style={s.sectionHeading}>PLEASE FILL OUT THE INFORMATION BELLOW:</Text>

          {/* שם */}
          <Text style={s.fieldLabel}>WHAT SHOULD WE CALL YOU?</Text>
          <TextInput
            style={s.input}
            placeholder="Your name here..."
            placeholderTextColor="rgba(19,23,61,0.35)"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"    // אות ראשונה של כל מילה גדולה
          />

          {/* כפתור העלאת תמונה — מציג תמונה שנבחרה או אייקון ענן */}
          <TouchableOpacity style={s.uploadBtn} onPress={pickImage} activeOpacity={0.8}>
            {profileImage ? (
              // הצגת התמונה שנבחרה
              <Image source={{ uri: profileImage }} style={s.uploadedImage} />
            ) : (
              // placeholder — אייקון ענן + טקסט
              <>
                <Ionicons name="cloud-upload-outline" size={34} color="#87ffd7" />
                <Text style={s.uploadText}>Upload your{'\n'}image here</Text>
              </>
            )}
          </TouchableOpacity>

          {/* בחירת מגדר — שני כפתורי תמונה */}
          <View style={s.sexSection}>
            <Text style={s.sexHeading}>Select your sex</Text>
            <Text style={s.sexSubLabel}>Click the sex that represents you</Text>
            <View style={s.sexRow}>
              {/* זכר — תמונה 001 (נבחר) / 000 (לא נבחר) */}
              <TouchableOpacity
                style={s.sexBtn}
                onPress={() => setSex(sex === 'male' ? null : 'male')}   // toggle
                activeOpacity={0.85}
              >
                <Image
                  source={
                    sex === 'male'
                      ? require('../../assets/images/001.png')   // גרסה נבחרת
                      : require('../../assets/images/000.png')   // גרסה רגילה
                  }
                  style={s.sexImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              {/* נקבה — תמונה 003 (נבחר) / 002 (לא נבחר) */}
              <TouchableOpacity
                style={s.sexBtn}
                onPress={() => setSex(sex === 'female' ? null : 'female')}
                activeOpacity={0.85}
              >
                <Image
                  source={
                    sex === 'female'
                      ? require('../../assets/images/003.png')
                      : require('../../assets/images/002.png')
                  }
                  style={s.sexImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* קטע 2: נתונים סטטיסטיים — 3 גלגלות אחד ליד השני */}
          <Text style={[s.sectionHeading, { marginTop: 30 }]}>INSERT YOUR STATS:</Text>
          <View style={s.statsRow}>
            {/* גלגלת גיל */}
            <View style={s.statBox}>
              <Text style={s.statLabel}>Select age</Text>
              <WheelPicker values={AGE_VALUES} selected={age} onSelect={setAge} />
            </View>
            {/* מרווח */}
            <View style={{ width: 8 }} />
            {/* גלגלת משקל */}
            <View style={s.statBox}>
              <Text style={s.statLabel}>Select weight</Text>
              <WheelPicker values={WEIGHT_VALUES} selected={weight} onSelect={setWeight} unit=" kg" />
            </View>
            <View style={{ width: 8 }} />
            {/* גלגלת גובה */}
            <View style={s.statBox}>
              <Text style={s.statLabel}>Select height</Text>
              <WheelPicker values={HEIGHT_VALUES} selected={height} onSelect={setHeight} unit=" cm" />
            </View>
          </View>

          {/* רמת אימון */}
          <Text style={[s.sectionHeading, { marginTop: 20 }]}>What is your training level?</Text>
          <DropDown
            items={TRAINING_LEVEL_ITEMS}
            value={trainingLevel}
            onChange={setTrainingLevel}
            placeholder="Select here..."
          />

          {/* הערכה שבועית */}
          <Text style={[s.sectionHeading, { marginTop: 20 }]}>What is your weekly training estimate?</Text>
          <DropDown
            items={WEEKLY_EST_ITEMS}
            value={weeklyEst}
            onChange={setWeeklyEst}
            placeholder="Select here..."
          />
          {/* הסבר מדוע נשאל — מניעת עומס יתר */}
          <Text style={s.helperNote}>That will help us prevent overload and potential injuries</Text>

          {/* בחירת תפקיד — 3 עיגולים: Trainer / Trainee / Both */}
          <Text style={[s.sectionHeading, { marginTop: 24, alignSelf: 'center' }]}>I am a:</Text>
          <View style={s.roleRow}>
            {[
              { value: 'trainer',  label: 'Trainer'  },
              { value: 'trainee',  label: 'Trainee'  },
              { value: 'both',     label: 'Both'     },
            ].map(({ value, label }) => (
              // עיגול בחירה — מודגש כשנבחר
              <TouchableOpacity
                key={value}
                style={[s.roleCircle, role === value && s.roleCircleSelected]}
                onPress={() => setRole(value)}
                activeOpacity={0.8}
              >
                <Text style={s.roleText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* כפתור Next — מושבת כשהטופס לא שלם */}
          <TouchableOpacity
            style={[s.nextBtn, !canProceed && s.btnDisabled]}
            activeOpacity={canProceed ? 0.82 : 1}
            onPress={handleNext}
            disabled={!canProceed}
          >
            <Text style={s.nextBtnText}>Next</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// סגנונות המסך
const s = StyleSheet.create({
  // רקע כחול כהה — עקבי עם WelcomeScreen
  safe: { flex: 1, backgroundColor: '#13173d' },
  // גלילה מרכוזית
  scroll: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },

  // כותרת — עטיפה לשתי שכבות
  titleWrapper: { paddingBottom: 8, paddingRight: 8, marginBottom: 14 },
  titleBase: {
    fontSize: 52,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
    transform: [{ rotate: '-3deg' }],  // הטיה קלה
  },
  titleEcho: { color: '#c524e6', position: 'absolute', top: 5, left: 5 },
  titleFront: { color: '#ff2c60' },

  // כותרות קטעים ותוויות שדות
  sectionHeading: {
    alignSelf: 'flex-start',
    color: '#ff2c60',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textDecorationLine: 'underline',
    marginBottom: 12,
  },
  fieldLabel: {
    alignSelf: 'flex-start',
    color: '#ff2c60',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textDecorationLine: 'underline',
    marginBottom: 8,
  },
  centeredLabel: {
    alignSelf: 'center',
    textAlign: 'center',
  },

  // שדה קלט — לבן עם מסגרת מנטה
  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#87ffd7',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#13173d',
  },

  // אזור העלאת תמונה — מסגרת מקוטעת
  uploadBtn: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#87ffd7',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    gap: 10,
  },
  uploadText: {
    color: '#87ffd7',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
  },
  // תמונה שהועלתה — עגולה
  uploadedImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  // קטע בחירת מגדר
  sexSection: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 16,
  },
  sexHeading: {
    color: '#ff2c60',
    fontSize: 15,
    fontWeight: '900',
    textDecorationLine: 'underline',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  sexSubLabel: {
    color: '#a0a0c0',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 18,
    textAlign: 'center',
  },
  sexRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
  },
  sexBtn: {
    alignItems: 'center',
  },
  sexImage: {
    width: 120,
    height: 200,
  },

  // שורת גלגלות הסטטיסטיקה
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 4,
  },
  // קופסת גלגלת יחידה
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#87ffd7',
    borderRadius: 10,
    overflow: 'hidden',   // חותך את הגלגלת לגבולות הקופסה
  },
  statLabel: {
    color: '#ff2c60',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    textDecorationLine: 'underline',
    paddingTop: 7,
    paddingBottom: 2,
  },

  // הערה מסבירה
  helperNote: {
    color: '#a0a0c0',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },

  // שורת עיגולי תפקיד
  roleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 14,
    marginBottom: 8,
  },
  // עיגול בחירה — כחול כהה ברירת מחדל
  roleCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: '#242749',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // עיגול נבחר — מנטה בהיר
  roleCircleSelected: {
    backgroundColor: '#59e5c2',
  },
  roleText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  // כפתור Next
  nextBtn: {
    marginTop: 26,
    width: '55%',
    backgroundColor: '#ff2c60',
    borderWidth: 5,
    borderColor: '#c524e6',
    borderRadius: 32,
    paddingVertical: 13,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  // מושבת — שקיפות גבוהה
  btnDisabled: {
    opacity: 0.35,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
  },

});

export default SignUpScreen;
