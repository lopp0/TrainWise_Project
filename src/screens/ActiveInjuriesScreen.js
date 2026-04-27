import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, Spacing } from '../theme/colors';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import {
  getAllInjuryTypes,
  getActiveInjuriesByUser,
  markInjuryRecovered,
} from '../services/api';
import { useAuth } from '../api/AuthContext';

const ActiveInjuriesScreen = ({ navigation }) => {
  const { userId } = useAuth();
  const [injuryTypes, setInjuryTypes] = useState([]);
  const [activeInjuries, setActiveInjuries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recoveringId, setRecoveringId] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [typesRes, activeRes] = await Promise.all([
        getAllInjuryTypes(),
        getActiveInjuriesByUser(userId),
      ]);
      setInjuryTypes(typesRes.data || []);
      setActiveInjuries(activeRes.data || []);
    } catch (error) {
      console.log('Failed to load active injuries:', error.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const injuryNameById = (id) => {
    const t = injuryTypes.find((i) => i.injuryTypeID === id);
    return t?.injuryName || `Injury #${id}`;
  };

  const handleMarkRecovered = (injury) => {
    Alert.alert(
      'Mark as recovered?',
      'Your load thresholds will return to their normal range.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recovered',
          onPress: async () => {
            setRecoveringId(injury.injuryID);
            try {
              await markInjuryRecovered(injury.injuryID);
              Alert.alert('Recovered', 'Glad you are back! Thresholds reset.');
              await load();
            } catch (error) {
              console.log('Recovery error:', error.message);
              Alert.alert('Error', 'Could not update injury status.');
            } finally {
              setRecoveringId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Active Injuries"
        subtitle="Mark recovered when healed"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : activeInjuries.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No active injuries on file.</Text>
          </Card>
        ) : (
          <Card>
            {activeInjuries.map((inj, idx) => (
              <View
                key={inj.injuryID}
                style={[
                  styles.injuryRow,
                  idx === activeInjuries.length - 1 && styles.lastRow,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.injuryName}>
                    {injuryNameById(inj.injuryTypeID)}
                  </Text>
                  <Text style={styles.injuryMeta}>
                    Severity {inj.severity}/10 ·{' '}
                    {new Date(inj.date).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.recoverBtn}
                  onPress={() => handleMarkRecovered(inj)}
                  disabled={recoveringId === inj.injuryID}
                >
                  {recoveringId === inj.injuryID ? (
                    <ActivityIndicator color={Colors.textPrimary} size="small" />
                  ) : (
                    <Text style={styles.recoverBtnText}>Mark Recovered</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  injuryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.inputBorder,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  injuryName: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.bold,
  },
  injuryMeta: {
    color: Colors.textMuted,
    fontSize: Fonts.captionSize,
    marginTop: 2,
  },
  recoverBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 18,
    minWidth: 130,
    alignItems: 'center',
  },
  recoverBtnText: {
    color: Colors.textPrimary,
    fontSize: Fonts.captionSize,
    fontWeight: Fonts.bold,
  },
});

export default ActiveInjuriesScreen;
