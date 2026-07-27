import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet as RNStyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useAuth } from '../api/AuthContext';
import { getNutritionDay, addNutritionEntry, deleteNutritionEntry } from '../services/api';
import { setIntakeToday } from '../utils/calorieLog';
import { lookupBarcode } from '../utils/openFoodFacts';
import ScreenTutorial from '../components/ScreenTutorial';
import { isTutorialDone, markTutorialDone } from '../utils/tutorialManager';

const WATER_QUICK = [250, 500, 750];
const FOOD_BARCODES = ['ean13', 'ean8', 'upc_a', 'upc_e'];

// First-visit walkthrough for the Nutrition screen (shown once, tracked by
// tutorialManager under the 'nutrition' key).
const NUTRITION_TUTORIAL_STEPS = [
  {
    icon: '💧',
    title: 'Log Your Water',
    body: 'Tap 250, 500, or 750 ml to quickly add water. Your daily total is capped at 2 liters.',
  },
  {
    icon: '🍎',
    title: 'Log a Meal',
    body: 'Enter the food name and calorie count, then tap Add. It will appear in your log for today.',
  },
  {
    icon: '📷',
    title: 'Scan a Barcode',
    body: "No time to type? Tap Scan barcode and point your camera at a product — we'll fill in the calories for you.",
  },
  {
    icon: '📊',
    title: "Today's Totals",
    body: 'Everything you log today shows up in the list below, and feeds your calorie ring on the Home screen.',
  },
];

/**
 * #132 — Hydration & nutrition logging (+ #166 barcode scanner).
 * Server-backed daily log: water quick-adds + food (manual or scanned via Open
 * Food Facts). Shows the day's totals and keeps the Home calorie ring (#167) in
 * sync by mirroring the food-calorie total into the local intake store.
 */
const NutritionScreen = ({ navigation }) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;
  const { userId } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [totals, setTotals] = useState({ calories: 0, waterMl: 0 });
  const [foodName, setFoodName] = useState('');
  const [foodCals, setFoodCals] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const scannedRef = React.useRef(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await getNutritionDay(userId);
      const list = Array.isArray(res.data?.entries) ? res.data.entries : [];
      const t = res.data?.totals || { calories: 0, waterMl: 0 };
      setEntries(list);
      setTotals(t);
      // Keep the Home ring (#167) consistent with the server day total.
      setIntakeToday(userId, t.calories || 0);
    } catch {
      // offline — leave the last known state
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  React.useEffect(() => {
    isTutorialDone('nutrition')
      .then((done) => { if (!done) setShowTutorial(true); })
      .catch((e) => console.warn('[NutritionScreen] tutorial check failed:', e.message));
  }, []);

  const handleTutorialFinish = async () => {
    await markTutorialDone('nutrition');
    setShowTutorial(false);
  };

  const addEntry = async (entry) => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      await addNutritionEntry(userId, entry);
      await load();
    } catch (e) {
      Alert.alert('Could not save', e?.response?.data || e?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  // Daily hydration is capped at 2 L. Block once the cap is reached; if the tap
  // would exceed it, add only the amount that fits.
  const WATER_CAP_ML = 2000;
  const addWater = (ml) => {
    const current = totals.waterMl || 0;
    if (current >= WATER_CAP_ML) {
      Alert.alert('Daily limit reached', 'You have logged the 2 L daily maximum.');
      return;
    }
    const toAdd = Math.min(ml, WATER_CAP_ML - current);
    addEntry({ kind: 'water', waterMl: toAdd });
  };

  const addFood = () => {
    const cals = parseInt(String(foodCals).replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(cals) || cals <= 0) {
      Alert.alert('Add calories', 'Enter how many calories this food has.');
      return;
    }
    addEntry({ kind: 'food', name: foodName.trim() || 'Food', calories: cals });
    setFoodName('');
    setFoodCals('');
  };

  const removeEntry = async (id) => {
    try {
      await deleteNutritionEntry(id);
      await load();
    } catch {
      Alert.alert('Could not remove', 'Try again.');
    }
  };

  // #166 — open the scanner (requesting camera permission first).
  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to scan a barcode.');
        return;
      }
    }
    scannedRef.current = false;
    setScanning(true);
  };

  const onBarcode = async ({ data }) => {
    if (scannedRef.current) return; // debounce: the camera fires continuously
    scannedRef.current = true;
    setScanning(false);
    setBusy(true);
    try {
      const product = await lookupBarcode(data);
      if (!product) {
        Alert.alert('Not found', `No product for barcode ${data}. Add it manually.`);
        return;
      }
      // Prefill the manual form so the user can confirm/adjust the serving.
      setFoodName(product.name);
      setFoodCals(product.calories ? String(product.calories) : '');
      if (product.calories) {
        Alert.alert(
          product.name,
          `${product.calories} kcal / 100g${product.brand ? ` · ${product.brand}` : ''}`,
          [
            { text: 'Edit', style: 'cancel' },
            {
              text: 'Log it',
              onPress: () =>
                addEntry({
                  kind: 'food',
                  name: product.name,
                  calories: product.calories,
                  barcode: product.barcode,
                }),
            },
          ]
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const iconFor = (e) => (e.kind === 'water' || e.Kind === 'water' ? 'water' : 'restaurant');
  const labelFor = (e) => {
    const kind = e.kind ?? e.Kind;
    if (kind === 'water') return `Water · ${e.waterMl ?? e.WaterMl} ml`;
    const name = e.name ?? e.Name ?? 'Food';
    const cals = e.calories ?? e.Calories ?? 0;
    return `${name} · ${cals} kcal`;
  };
  const idOf = (e) => e.entryID ?? e.EntryID;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={C.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nutrition & hydration</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Totals */}
          <View style={styles.totalsRow}>
            <View style={styles.totalCard}>
              <Ionicons name="flame" size={20} color={C.primary} />
              <Text style={styles.totalNum}>{totals.calories}</Text>
              <Text style={styles.totalLabel}>kcal eaten</Text>
            </View>
            <View style={styles.totalCard}>
              <Ionicons name="water" size={20} color="#39a0ff" />
              <Text style={styles.totalNum}>{(totals.waterMl / 1000).toFixed(1)}L</Text>
              <Text style={styles.totalLabel}>water</Text>
            </View>
          </View>

          {/* Water */}
          <Text style={styles.sectionTitle}>Add water</Text>
          <View style={styles.quickRow}>
            {WATER_QUICK.map((ml) => (
              <TouchableOpacity key={ml} style={styles.waterBtn} onPress={() => addWater(ml)} disabled={busy} activeOpacity={0.85}>
                <Ionicons name="water-outline" size={16} color="#39a0ff" />
                <Text style={styles.waterText}>{ml} ml</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Food */}
          <Text style={styles.sectionTitle}>Add food</Text>
          <View style={styles.foodRow}>
            <TextInput
              style={[styles.input, { flex: 2 }]}
              value={foodName}
              onChangeText={setFoodName}
              placeholder="Food name"
              placeholderTextColor={C.textMuted}
              maxLength={120}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={foodCals}
              onChangeText={setFoodCals}
              placeholder="kcal"
              placeholderTextColor={C.textMuted}
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
          <View style={styles.foodActions}>
            <TouchableOpacity style={styles.scanBtn} onPress={openScanner} disabled={busy} activeOpacity={0.85}>
              <Ionicons name="barcode-outline" size={18} color={C.primary} />
              <Text style={styles.scanText}>Scan barcode</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addFoodBtn} onPress={addFood} disabled={busy} activeOpacity={0.85}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addFoodText}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* Today's entries */}
          <Text style={styles.sectionTitle}>Today</Text>
          {entries.length === 0 ? (
            <Text style={styles.empty}>Nothing logged yet today.</Text>
          ) : (
            entries.map((e) => (
              <View key={idOf(e)} style={styles.entryRow}>
                <Ionicons
                  name={iconFor(e)}
                  size={18}
                  color={(e.kind ?? e.Kind) === 'water' ? '#39a0ff' : C.primary}
                />
                <Text style={styles.entryLabel} numberOfLines={2}>{labelFor(e)}</Text>
                <TouchableOpacity onPress={() => removeEntry(idOf(e))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={18} color={C.textMuted} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* #166 barcode scanner */}
      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={RNStyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: FOOD_BARCODES }}
            onBarcodeScanned={onBarcode}
          />
          <View style={styles.scanOverlay} pointerEvents="none">
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>Point at a product barcode</Text>
          </View>
          <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setScanning(false)}>
            <Text style={styles.cancelScanText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <ScreenTutorial
        visible={showTutorial}
        steps={NUTRITION_TUTORIAL_STEPS}
        onFinish={handleTutorialFinish}
      />
    </View>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 50,
      paddingBottom: 12,
      paddingHorizontal: 14,
      backgroundColor: C.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '800' },
    content: { padding: 16, paddingBottom: 40 },

    totalsRow: { flexDirection: 'row', gap: 12 },
    totalCard: {
      flex: 1,
      backgroundColor: C.cardBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      paddingVertical: 16,
    },
    totalNum: { color: C.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 6 },
    totalLabel: { color: C.textMuted, fontSize: 12, marginTop: 2 },

    sectionTitle: { color: C.textSecondary, fontSize: 13, fontWeight: '800', marginTop: 20, marginBottom: 10 },

    quickRow: { flexDirection: 'row', gap: 10 },
    waterBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: C.inputBackground,
      borderWidth: 1,
      borderColor: C.inputBorder,
      borderRadius: 12,
      paddingVertical: 12,
    },
    waterText: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },

    foodRow: { flexDirection: 'row', gap: 10 },
    input: {
      backgroundColor: C.inputBackground,
      borderWidth: 1,
      borderColor: C.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: C.textPrimary,
      fontSize: 15,
    },
    foodActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
    scanBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.inputBackground,
      borderWidth: 1,
      borderColor: C.primary,
      borderRadius: 12,
      paddingVertical: 12,
    },
    scanText: { color: C.primary, fontSize: 14, fontWeight: '800' },
    addFoodBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: C.primary,
      borderRadius: 12,
      paddingVertical: 12,
    },
    addFoodText: { color: '#fff', fontSize: 15, fontWeight: '800' },

    empty: { color: C.textMuted, fontSize: 13, fontStyle: 'italic' },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: C.cardBackground,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 8,
    },
    entryLabel: { flex: 1, color: C.textPrimary, fontSize: 14, fontWeight: '600' },

    scanOverlay: { ...RNStyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    scanFrame: {
      width: 260,
      height: 160,
      borderWidth: 3,
      borderColor: '#fff',
      borderRadius: 16,
      backgroundColor: 'transparent',
    },
    scanHint: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 20 },
    cancelScanBtn: {
      position: 'absolute',
      bottom: 50,
      alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 30,
      paddingVertical: 12,
      borderRadius: 24,
    },
    cancelScanText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
  s._colors = C;
  return s;
};

export default NutritionScreen;