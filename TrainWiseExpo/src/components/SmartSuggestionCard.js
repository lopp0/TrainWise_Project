import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import ActivityIcon from './ActivityIcon';
import { getCurrentWeather } from '../api/weatherService';
import { getDailyLoadByUser } from '../services/api';
import { buildSmartSuggestion } from '../utils/smartWorkout';

/**
 * Smart workout suggestion, relocated to the Home screen (item 4) directly under
 * the Add Workout section for accessibility. Foldable. Tapping a suggested
 * activity jumps to AddWorkout pre-selected on the Live tab. Self-contained:
 * fetches weather + the latest AC ratio itself so Home stays simple.
 */
const SmartSuggestionCard = ({ navigation, userId, activityTypes = [], defaultOpen = false }) => {
  const styles = useThemedStyles(makeStyles);
  const Colors = styles._colors;
  const [weather, setWeather] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    let alive = true;
    (async () => {
      let acRatio = null;
      try {
        const res = await getDailyLoadByUser(userId);
        const rows = Array.isArray(res.data) ? res.data : [];
        if (rows.length) {
          const latest = rows.reduce((best, cur) => {
            const bd = new Date(best.date ?? best.Date ?? 0).getTime();
            const cd = new Date(cur.date ?? cur.Date ?? 0).getTime();
            return cd > bd ? cur : best;
          });
          acRatio = latest.aC_Ratio ?? latest.AC_Ratio ?? latest.acRatio ?? null;
        }
      } catch {
        // no load history yet — fine
      }
      try {
        const w = await getCurrentWeather();
        if (!alive) return;
        setWeather(w);
        setSuggestion(buildSmartSuggestion({ weather: w, acRatio }));
      } catch {
        if (!alive) return;
        setSuggestion(buildSmartSuggestion({ weather: null, acRatio }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!suggestion) return null;

  const faceColor = (status) =>
    status === 'good' ? Colors.success : status === 'warn' ? Colors.warning : Colors.danger;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} activeOpacity={0.8} onPress={toggle}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={15} color={Colors.primary} />
          <Text style={styles.headerText}>SMART WORKOUT</Text>
        </View>
        <View style={styles.headerRight}>
          {weather?.tempC != null && (
            <Text style={styles.weather} numberOfLines={1}>
              {Math.round(weather.tempC)}°{weather.description ? ` · ${weather.description}` : ''}
            </Text>
          )}
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.primary} />
        </View>
      </TouchableOpacity>

      <View style={styles.top}>
        <Text style={styles.emoji}>{suggestion.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{suggestion.title}</Text>
        </View>
        <View style={[styles.ratingPill, { borderColor: faceColor(suggestion.rating.faceColor) }]}>
          <Text style={[styles.ratingLabel, { color: faceColor(suggestion.rating.faceColor) }]}>
            {suggestion.rating.label}
          </Text>
          {suggestion.score != null && <Text style={styles.ratingScore}>{suggestion.score}/100</Text>}
        </View>
      </View>

      {open && (
        <>
          <Text style={styles.reason}>{suggestion.reason}</Text>
          {suggestion.factors.length > 0 && (
            <View style={styles.factorRow}>
              {suggestion.factors.map((f) => (
                <View key={f.key} style={styles.factorTile}>
                  <View style={styles.factorIconRow}>
                    <Ionicons name={f.icon} size={15} color={faceColor(f.status)} />
                    <View style={[styles.factorDot, { backgroundColor: faceColor(f.status) }]} />
                  </View>
                  <Text style={styles.factorValue} numberOfLines={1}>{f.value}</Text>
                  <Text style={styles.factorLabel} numberOfLines={1}>{f.label}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.pick}>
            {suggestion.indoorPreferred ? 'Suggested indoor activities' : 'Suggested activities'} · tap to pick
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {suggestion.activities.map((name) => {
              const match = activityTypes.find(
                (a) => (a.typeName || '').toLowerCase() === name.toLowerCase()
              );
              return (
                <TouchableOpacity
                  key={name}
                  style={styles.chip}
                  activeOpacity={0.85}
                  onPress={() =>
                    match &&
                    navigation.navigate('AddWorkout', {
                      preselectActivityTypeId: match.activityTypeID,
                      liveTab: true,
                    })
                  }
                >
                  <ActivityIcon activityTypeId={match?.activityTypeID} typeName={name} size={16} />
                  <Text style={styles.chipText}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
};

const makeStyles = (Colors) => {
  const s = StyleSheet.create({
    card: {
      backgroundColor: Colors.cardBackground,
      borderRadius: 16,
      padding: 16,
      marginTop: 14,
      borderWidth: 1.5,
      borderColor: Colors.primary,
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 6,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, marginLeft: 8 },
    headerText: { color: Colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    weather: { color: Colors.textSecondary, fontSize: 12, flexShrink: 1, textAlign: 'right' },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    emoji: { fontSize: 28 },
    title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '900' },
    reason: { color: Colors.textSecondary, fontSize: 14, lineHeight: 19, marginTop: 10 },
    ratingPill: {
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1.5,
      backgroundColor: Colors.cardBackgroundLight, minWidth: 62,
    },
    ratingLabel: { fontSize: 13, fontWeight: '900' },
    ratingScore: { color: Colors.textMuted, fontSize: 10, marginTop: 1, fontWeight: '700' },
    factorRow: {
      flexDirection: 'row', flexWrap: 'wrap', marginTop: 12,
      backgroundColor: Colors.background, borderRadius: 12, paddingVertical: 8,
      borderWidth: 1, borderColor: Colors.border,
    },
    factorTile: { width: '33.33%', alignItems: 'center', paddingVertical: 6 },
    factorIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    factorDot: { width: 6, height: 6, borderRadius: 3 },
    factorValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', marginTop: 3 },
    factorLabel: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
    pick: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 12 },
    chipRow: { paddingVertical: 8 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: Colors.inputBackground, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
      borderWidth: 1, borderColor: Colors.inputBorder,
    },
    chipText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  });
  s._colors = Colors;
  return s;
};

export default SmartSuggestionCard;
