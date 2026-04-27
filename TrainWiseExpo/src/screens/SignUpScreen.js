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
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_W } = Dimensions.get('window');
const CIRCLE_SIZE = Math.floor((SCREEN_W - 48 - 32) / 3);

// ─── Local styled dropdown ────────────────────────────────────────
const DropDown = ({ items, value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const selected = items.find(i => i.value === value);

  return (
    <>
      <TouchableOpacity style={dd.field} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[dd.text, !selected && dd.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#aaa" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={dd.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={dd.sheet} onPress={() => {}}>
            <Text style={dd.sheetTitle}>{placeholder}</Text>
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

const dd = StyleSheet.create({
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#1d2155', borderRadius: 14, padding: 14 },
  sheetTitle: {
    color: '#ff2c60',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2f6a',
  },
  itemSel: { backgroundColor: '#2a2f6a' },
  itemText: { color: '#fff', fontSize: 14 },
  itemTextSel: { color: '#ff2c60', fontWeight: '700' },
});

// ─── Wheel picker data ────────────────────────────────────────────
const AGE_VALUES    = Array.from({ length: 87  }, (_, i) => i + 13);  // 13–99
const WEIGHT_VALUES = Array.from({ length: 271 }, (_, i) => i + 30);  // 30–300
const HEIGHT_VALUES = Array.from({ length: 131 }, (_, i) => i + 120); // 120–250

// ─── Wheel picker component ───────────────────────────────────────
const ITEM_H = 40;
const VISIBLE = 5;          // must be odd so centre slot is unambiguous
const HALF = Math.floor(VISIBLE / 2); // = 2  (padding rows top & bottom)

const WheelPicker = ({ values, selected, onSelect, unit }) => {
  const ref = useRef(null);
  const safeIndex = Math.max(0, values.indexOf(selected));

  // Scroll to the pre-selected value after the layout pass
  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: safeIndex * ITEM_H, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, []);

  const onMomentumEnd = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, values.length - 1));
    onSelect(values[clamped]);
  };

  // Null rows at top/bottom so first and last values can reach centre
  const padded = [...Array(HALF).fill(null), ...values, ...Array(HALF).fill(null)];

  return (
    <View style={wp.outer}>
      {/* Centre-slot highlight sits behind the text */}
      <View pointerEvents="none" style={wp.highlight} />
      <ScrollView
        ref={ref}
        style={wp.scroll}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        nestedScrollEnabled
        scrollEventThrottle={16}
      >
        {padded.map((val, i) => {
          const isSel = val !== null && val === selected;
          return (
            <View key={i} style={wp.item}>
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

const wp = StyleSheet.create({
  outer: { height: ITEM_H * VISIBLE, overflow: 'hidden' },
  highlight: {
    position: 'absolute',
    top: ITEM_H * HALF,
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
  item: { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  text: { color: 'rgba(19,23,61,0.3)', fontSize: 13, fontWeight: '500' },
  textSel: { color: '#13173d', fontSize: 16, fontWeight: '900' },
});

// ─── Dropdown data ────────────────────────────────────────────────
const TRAINING_LEVEL_ITEMS = [
  { label: 'Beginner',  value: 'Beginner'  },
  { label: 'Regular',   value: 'Regular'   },
  { label: 'Advanced',  value: 'Advanced'  },
];
const WEEKLY_EST_ITEMS = [
  { label: 'Low (0–1 time per week)', value: 'Low'    },
  { label: 'Medium (2–4)',            value: 'Medium' },
  { label: 'High (5+)',               value: 'High'   },
];

// ─── Screen ───────────────────────────────────────────────────────
const SignUpScreen = ({ navigation }) => {
  const scrollRef = useRef(null);

  const [name, setName] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [sex, setSex] = useState(null);
  const [age, setAge] = useState(25);
  const [weight, setWeight] = useState(70);
  const [height, setHeight] = useState(170);
  const [trainingLevel, setTrainingLevel] = useState(null);
  const [weeklyEst, setWeeklyEst] = useState(null);
  const [role, setRole] = useState(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'We need access to your photo library to upload a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const canProceed =
    name.trim().length > 0 &&
    sex !== null &&
    trainingLevel !== null &&
    weeklyEst !== null &&
    role !== null;

  const handleNext = () => {
    if (!canProceed) return;
    navigation.navigate('SignUpFinal', { name, age, weight, height, sex, trainingLevel, weeklyEst, role, profileImage });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Title ─────────────────────────────────────── */}
          <View style={s.titleWrapper}>
            <Text style={[s.titleBase, s.titleEcho]}>Sign Up</Text>
            <Text style={[s.titleBase, s.titleFront]}>Sign Up</Text>
          </View>

          {/* ── Section 1: Personal info ───────────────────── */}
          <Text style={s.sectionHeading}>PLEASE FILL OUT THE INFORMATION BELLOW:</Text>

          <Text style={s.fieldLabel}>WHAT SHOULD WE CALL YOU?</Text>
          <TextInput
            style={s.input}
            placeholder="Your name here..."
            placeholderTextColor="rgba(19,23,61,0.35)"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          {/* Upload image */}
          <TouchableOpacity style={s.uploadBtn} onPress={pickImage} activeOpacity={0.8}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={s.uploadedImage} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={34} color="#87ffd7" />
                <Text style={s.uploadText}>Upload your{'\n'}image here</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sex selection */}
          <View style={s.sexSection}>
            <Text style={s.sexHeading}>Select your sex</Text>
            <Text style={s.sexSubLabel}>Click the sex that represents you</Text>
            <View style={s.sexRow}>
              <TouchableOpacity
                style={s.sexBtn}
                onPress={() => setSex(sex === 'male' ? null : 'male')}
                activeOpacity={0.85}
              >
                <Image
                  source={
                    sex === 'male'
                      ? require('../../assets/images/001.png')
                      : require('../../assets/images/000.png')
                  }
                  style={s.sexImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>

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

          {/* ── Section 2: Stats ───────────────────────────── */}
          <Text style={[s.sectionHeading, { marginTop: 30 }]}>INSERT YOUR STATS:</Text>
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statLabel}>Select age</Text>
              <WheelPicker values={AGE_VALUES} selected={age} onSelect={setAge} />
            </View>
            <View style={{ width: 8 }} />
            <View style={s.statBox}>
              <Text style={s.statLabel}>Select weight</Text>
              <WheelPicker values={WEIGHT_VALUES} selected={weight} onSelect={setWeight} unit=" kg" />
            </View>
            <View style={{ width: 8 }} />
            <View style={s.statBox}>
              <Text style={s.statLabel}>Select height</Text>
              <WheelPicker values={HEIGHT_VALUES} selected={height} onSelect={setHeight} unit=" cm" />
            </View>
          </View>

          <Text style={[s.sectionHeading, { marginTop: 20 }]}>What is your training level?</Text>
          <DropDown
            items={TRAINING_LEVEL_ITEMS}
            value={trainingLevel}
            onChange={setTrainingLevel}
            placeholder="Select here..."
          />

          <Text style={[s.sectionHeading, { marginTop: 20 }]}>What is your weekly training estimate?</Text>
          <DropDown
            items={WEEKLY_EST_ITEMS}
            value={weeklyEst}
            onChange={setWeeklyEst}
            placeholder="Select here..."
          />
          <Text style={s.helperNote}>That will help us prevent overload and potential injuries</Text>

          {/* ── I am a ────────────────────────────────────── */}
          <Text style={[s.sectionHeading, { marginTop: 24, alignSelf: 'center' }]}>I am a:</Text>
          <View style={s.roleRow}>
            {[
              { value: 'trainer',  label: 'Trainer'  },
              { value: 'trainee',  label: 'Trainee'  },
              { value: 'both',     label: 'Both'     },
            ].map(({ value, label }) => (
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#13173d' },
  scroll: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },

  // Title
  titleWrapper: { paddingBottom: 8, paddingRight: 8, marginBottom: 14 },
  titleBase: {
    fontSize: 52,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
    transform: [{ rotate: '-3deg' }],
  },
  titleEcho: { color: '#c524e6', position: 'absolute', top: 5, left: 5 },
  titleFront: { color: '#ff2c60' },

  // Section headings & field labels
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

  // Input
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

  // Upload button
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
  uploadedImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  // Sex
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

  // Stats row
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#87ffd7',
    borderRadius: 10,
    overflow: 'hidden',
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

  // Helper note
  helperNote: {
    color: '#a0a0c0',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },

  // Role circles
  roleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 14,
    marginBottom: 8,
  },
  roleCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: '#242749',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCircleSelected: {
    backgroundColor: '#59e5c2',
  },
  roleText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Next button
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
