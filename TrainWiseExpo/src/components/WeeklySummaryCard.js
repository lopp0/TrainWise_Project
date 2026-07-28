import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemedStyles } from '../theme/useThemedStyles';
import ActivityIcon from './ActivityIcon';
import { computeWeeklySummary } from '../utils/weeklyStats';
import { getGPTResponse } from '../api/openai';
import { buildDataContext } from '../utils/aiDataContext';

/**
 * "THIS WEEK" — unified weekly card (merges the old "This week at a glance"
 * stat grid with the #153 AI "week in review"). All stats derive from the
 * confirmed ActivityLogs already fetched by HomeScreen (`logs`); the AI recap is
 * generated on tap and cached per ISO week per user (never auto-spends).
 * Collapsed by default.
 */
const isoWeekKey = (d = new Date()) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};
// Module-level sub-component receives `styles` as a prop (it can't close over
// the component-scoped themed styles otherwise — see lessons 2026-05-31).
const Stat = ({ icon, value, label, valueColor, delta, deltaColor, styles }) => (
  <View style={styles.statBox}>
    <View style={styles.statIconRow}>{icon}</View>
    <Text style={[styles.statValue, valueColor && { color: valueColor }]} numberOfLines={1}>
      {value}
    </Text>
    {/* #118 — week-over-week delta chip (▲/▼ vs last week). */}
    {delta ? (
      <Text style={[styles.statDelta, deltaColor && { color: deltaColor }]} numberOfLines={1}>
        {delta}
      </Text>
    ) : null}
    <Text style={styles.statLabel} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

// AC ratio → zone color (matches getBarColor / determineLevel thresholds:
// <0.8 green, 0.8–1.3 yellow, >1.3 red).
const acColorFor = (r) => {
  if (!r || r <= 0) return null;
  if (r < 0.8) return '#00e676';
  if (r <= 1.3) return '#ffee58';
  return '#f44336';
};

const WeeklySummaryCard = ({ logs, activityTypes, experienceLevel = 1, userId }) => {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false); // collapsed by default
  const summary = useMemo(
    () => computeWeeklySummary(logs, activityTypes, experienceLevel),
    [logs, activityTypes, experienceLevel]
  );

  // AI "week in review" (merged in) — cached per ISO week per user.
  const [aiText, setAiText] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const cacheKey = `@trainwise_week_review_${userId}_${isoWeekKey()}`;

  useEffect(() => {
    AsyncStorage.getItem(cacheKey).then((v) => { if (v) setAiText(v); }).catch(() => {});
  }, [cacheKey]);

  const generate = useCallback(async () => {
    setAiLoading(true);
    try {
      const context = buildDataContext(logs, activityTypes, experienceLevel);
      const messages = [
        {
          role: 'system',
          content:
            'You are TrainWise AI, writing a short weekly training recap for a recreational athlete. ' +
            'Ground EVERY statement in the numbers provided and never invent or round up figures. ' +
            'When you say "this week", use ONLY the THIS WEEK line; the 28-day numbers are background ' +
            'context and must never be described as "this week". Structure: one encouraging headline ' +
            'sentence, 2-3 bullet observations (volume, consistency, load balance), then one concrete ' +
            'tip for next week. Under 120 words. Be warm and specific, not generic.',
        },
        { role: 'user', content: `Here is my training data:\n${context}\n\nWrite my week in review.` },
      ];
      const reply = await getGPTResponse(messages);
      if (reply) {
        setAiText(reply);
        AsyncStorage.setItem(cacheKey, reply).catch(() => {});
      }
    } catch {
      setAiText('Could not generate your review right now. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }, [logs, activityTypes, cacheKey]);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  // #118 — directional delta chips. Load up = green, down = orange (kept from
  // the original convention); sessions follow the same. Neutral when no change
  // or no prior-week baseline.
  const arrow = (n) => (n > 0 ? '▲' : n < 0 ? '▼' : '');
  const upColor = (n) => (n > 0 ? '#00e676' : n < 0 ? '#ff9800' : styles._muted);

  const loadDelta =
    summary.deltaPct == null || summary.deltaPct === 0
      ? null
      : `${arrow(summary.deltaPct)} ${Math.abs(summary.deltaPct)}%`;
  const sessDelta =
    !summary.sessionsDelta ? null : `${arrow(summary.sessionsDelta)} ${Math.abs(summary.sessionsDelta)}`;
  const acDelta =
    summary.acRatioDelta == null || summary.acRatioDelta === 0
      ? null
      : `${arrow(summary.acRatioDelta)} ${Math.abs(summary.acRatioDelta).toFixed(2)}`;
  const acColor = acColorFor(summary.acRatio);

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} activeOpacity={0.8} onPress={toggle}>
        <View style={styles.headerLeft}>
          <Ionicons name="stats-chart" size={16} color={styles._primary} />
          <Text style={styles.headerTitle}>THIS WEEK AT A GLANCE</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={styles._primary} />
      </TouchableOpacity>

      {open &&
        (!summary.hasData ? (
          <Text style={styles.empty}>No workouts logged this week yet.</Text>
        ) : (
         <>
          <View style={styles.grid}>
            <Stat
              styles={styles}
              icon={<Ionicons name="barbell" size={18} color={styles._primary} />}
              value={String(summary.sessions)}
              label="Sessions"
              delta={sessDelta}
              deltaColor={upColor(summary.sessionsDelta)}
            />
            <Stat
              styles={styles}
              icon={<Ionicons name="pulse" size={18} color={styles._primary} />}
              value={String(summary.totalLoad)}
              label="Total load"
              delta={loadDelta}
              deltaColor={upColor(summary.deltaPct)}
            />
            <Stat
              styles={styles}
              icon={
                summary.longest && (summary.longest.activityTypeId != null || summary.longest.typeName) ? (
                  <ActivityIcon
                    activityTypeId={summary.longest.activityTypeId}
                    typeName={summary.longest.typeName}
                    size={18}
                  />
                ) : (
                  <Ionicons name="time" size={18} color={styles._primary} />
                )
              }
              value={summary.longest ? `${summary.longest.duration}m` : '—'}
              label={summary.longest?.typeName ? `Longest · ${summary.longest.typeName}` : 'Longest'}
            />
            <Stat
              styles={styles}
              icon={
                summary.mostFrequent ? (
                  <ActivityIcon
                    activityTypeId={summary.mostFrequent.activityTypeId}
                    typeName={summary.mostFrequent.typeName}
                    size={18}
                  />
                ) : (
                  <Ionicons name="repeat" size={18} color={styles._primary} />
                )
              }
              value={summary.mostFrequent ? `×${summary.mostFrequent.count}` : '—'}
              label={summary.mostFrequent?.typeName ? `Top · ${summary.mostFrequent.typeName}` : 'Top activity'}
            />
            <Stat
              styles={styles}
              icon={<Ionicons name="flame" size={18} color="#ff7a00" />}
              value={String(summary.streak)}
              label="Day streak"
            />
            {/* #118 — AC ratio with its own week-over-week delta. */}
            <Stat
              styles={styles}
              icon={
                <Ionicons
                  name="speedometer"
                  size={18}
                  color={acColor || styles._muted}
                />
              }
              value={summary.acRatio > 0 ? summary.acRatio.toFixed(2) : '—'}
              valueColor={acColor || undefined}
              delta={acDelta}
              deltaColor={styles._muted}
              label="AC ratio"
            />
          </View>

          {/* AI "week in review" (merged) */}
          <View style={styles.aiSection}>
            <View style={styles.aiHeader}>
              <Ionicons name="sparkles" size={14} color={styles._primary} />
              <Text style={styles.aiTitle}>AI RECAP</Text>
            </View>
            {aiLoading ? (
              <View style={styles.aiCenter}>
                <ActivityIndicator color={styles._primary} />
                <Text style={styles.aiThinking}>Reviewing your week…</Text>
              </View>
            ) : aiText ? (
              <>
                <Text style={styles.aiText}>{aiText}</Text>
                <TouchableOpacity onPress={generate} style={styles.regen}>
                  <Ionicons name="refresh" size={13} color={styles._muted} />
                  <Text style={styles.regenText}>Regenerate</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.genBtn} onPress={generate} activeOpacity={0.85}>
                <Ionicons name="sparkles" size={15} color="#fff" />
                <Text style={styles.genBtnText}>Generate weekly insight</Text>
              </TouchableOpacity>
            )}
          </View>
         </>
        ))}
    </View>
  );
};

const makeStyles = (Colors) => {
  const s = StyleSheet.create({
    card: {
      backgroundColor: Colors.cardBackground,
      borderRadius: 14,
      padding: 16,
      // No horizontal margin: HomeScreen's ScrollView already pads 16 so the
      // card lines up with the chart / Add-Workout cards above it (item 2).
      marginTop: 14,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    headerTitle: {
      color: Colors.primary,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    empty: {
      color: Colors.textSecondary,
      fontSize: 13,
      marginTop: 12,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    statBox: {
      width: '48%',
      backgroundColor: Colors.background,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 10,
      marginBottom: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Colors.border,
    },
    statIconRow: { height: 22, justifyContent: 'center' },
    statValue: {
      color: Colors.textPrimary,
      fontSize: 19,
      fontWeight: '800',
      marginTop: 2,
    },
    statDelta: {
      fontSize: 11,
      fontWeight: '800',
      marginTop: 1,
    },
    statLabel: {
      color: Colors.textSecondary,
      fontSize: 11,
      marginTop: 2,
      textAlign: 'center',
    },
    aiSection: {
      marginTop: 6, paddingTop: 12,
      borderTopWidth: 1, borderTopColor: Colors.border,
    },
    aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    aiTitle: { color: Colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
    aiCenter: { alignItems: 'center', paddingVertical: 10, gap: 8 },
    aiThinking: { color: Colors.textMuted, fontSize: 12, fontStyle: 'italic' },
    aiText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 21 },
    genBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 11,
    },
    genBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    regen: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', marginTop: 10 },
    regenText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  });
  s._primary = Colors.primary;
  s._muted = Colors.textMuted;
  return s;
};

export default WeeklySummaryCard;
