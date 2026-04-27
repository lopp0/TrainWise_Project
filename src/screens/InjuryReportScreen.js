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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {Colors, Fonts, Spacing} from '../theme/colors';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import ComboBox from '../components/ComboBox';
import {
  getAllInjuryTypes,
  createInjuryReport,
  getActiveInjuriesByUser,
} from '../services/api';
import { useAuth } from '../api/AuthContext';


const InjuryReportScreen = ({navigation}) => {
  const { userId } = useAuth();
  const [injuryTypes, setInjuryTypes] = useState([]);
  const [selectedInjury, setSelectedInjury] = useState(null);
  const [severity, setSeverity] = useState(5);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    loadInjuryTypes();
    loadActiveCount();
  }, []);

  // Refresh active count whenever the screen regains focus
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadActiveCount);
    return unsub;
  }, [navigation]);

  const loadActiveCount = async () => {
    if (!userId) return;
    try {
      const response = await getActiveInjuriesByUser(userId);
      setActiveCount((response.data || []).length);
    } catch (error) {
      console.log('Failed to load active injuries:', error.message);
      setActiveCount(0);
    }
  };

  const loadInjuryTypes = async () => {
    setLoading(true);
    try {
      const response = await getAllInjuryTypes();
      setInjuryTypes(response.data || []);
    } catch (error) {
      console.log('Failed to load injury types:', error.message);
      setInjuryTypes([
        {injuryTypeID: 1, injuryName: 'Knee Pain'},
        {injuryTypeID: 2, injuryName: 'Shin Splints'},
        {injuryTypeID: 3, injuryName: 'Lower Back Pain'},
        {injuryTypeID: 4, injuryName: 'Ankle Sprain'},
        {injuryTypeID: 5, injuryName: 'Shoulder Strain'},
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedInjury) {
      Alert.alert('Missing Info', 'Please select an injury type');
      return;
    }

    setSubmitting(true);
    try {
      await createInjuryReport({
        userID: userId,
        injuryTypeID: selectedInjury.injuryTypeID,
        date: new Date().toISOString().split('T')[0],
        severity: severity,
        notes: notes,
        isActiveInjury: true,
      });
      Alert.alert(
        'Report Submitted',
        'Your injury has been recorded. The app will adjust your load thresholds accordingly.',
      );
      setSelectedInjury(null);
      setSeverity(5);
      setNotes('');
      await loadActiveCount();
    } catch (error) {
      console.log('Submit error:', error.message);
      Alert.alert('Error', 'Could not submit injury report. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Injury Report"
        subtitle="Record a new injury"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Drill-down to active injuries list */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ActiveInjuries')}
        >
          <Card>
            <View style={styles.activeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Active Injuries</Text>
                <Text style={styles.activeMeta}>
                  {activeCount === 0
                    ? 'No active injuries on file'
                    : `${activeCount} active${activeCount === 1 ? '' : ' injuries'} — tap to manage`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
            </View>
          </Card>
        </TouchableOpacity>

        {/* Injury Type */}
        <Card>
          <Text style={styles.cardTitle}>Injury Type</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <ComboBox
              items={injuryTypes}
              selectedValue={selectedInjury?.injuryTypeID}
              onChange={(item) => setSelectedInjury(item)}
              labelKey="injuryName"
              valueKey="injuryTypeID"
              placeholder="Select injury type"
            />
          )}
        </Card>

        {/* Severity */}
        <Card>
          <Text style={styles.cardTitle}>Severity: {severity}/10</Text>
          <View style={styles.severityRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.severityDot,
                  severity >= val && styles.severityDotActive,
                ]}
                onPress={() => setSeverity(val)}
              />
            ))}
          </View>
          <View style={styles.severityLabels}>
            <Text style={styles.severityLabelText}>Mild</Text>
            <Text style={styles.severityLabelText}>Severe</Text>
          </View>
        </Card>

        {/* Notes */}
        <Card>
          <Text style={styles.cardTitle}>Doctor Recommendation / Notes</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describe symptoms or medical advice..."
            placeholderTextColor={Colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </Card>
      </ScrollView>

      <View style={styles.bottomActions}>
        <PrimaryButton
          title="Submit Report"
          onPress={handleSubmit}
          loading={submitting}
        />
      </View>
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
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeMeta: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: Spacing.md,
  },
  severityDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  severityDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  severityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  severityLabelText: {
    color: Colors.textMuted,
    fontSize: Fonts.captionSize,
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
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
});

export default InjuryReportScreen;
