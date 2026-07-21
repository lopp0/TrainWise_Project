import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemedStyles } from '../theme/useThemedStyles';
import { getGPTResponse } from '../api/openai';
import { buildDataContext } from '../utils/aiDataContext';

/**
 * #153 — AI "your week in review". Builds a prompt from the week's training data
 * (reusing the #176 data-context builder) and asks the model for a short,
 * data-grounded summary + one actionable tip. Cached per ISO week per user so it
 * generates at most once a week and never auto-spends on the API.
 *
 * props: { userId, logs, activityTypes }
 */
const isoWeekKey = (d = new Date()) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const WeekReviewCard = ({ userId, logs, activityTypes }) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(false);

  const cacheKey = `@trainwise_week_review_${userId}_${isoWeekKey()}`;

  useEffect(() => {
    AsyncStorage.getItem(cacheKey).then((v) => { if (v) setText(v); }).catch(() => {});
  }, [cacheKey]);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const context = buildDataContext(logs, activityTypes);
      const messages = [
        {
          role: 'system',
          content:
            'You are TrainWise AI, writing a short weekly training recap for a recreational athlete. ' +
            'Ground every statement in the numbers provided. Structure: one encouraging headline sentence, ' +
            '2-3 bullet observations (volume, consistency, load balance), then one concrete tip for next week. ' +
            'Under 120 words. Be warm and specific, not generic.',
        },
        { role: 'user', content: `Here is my training data:\n${context}\n\nWrite my week in review.` },
      ];
      const reply = await getGPTResponse(messages);
      if (reply) {
        setText(reply);
        AsyncStorage.setItem(cacheKey, reply).catch(() => {});
      }
    } catch {
      setText('Could not generate your review right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [logs, activityTypes, cacheKey]);

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} activeOpacity={0.85} onPress={toggle}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={16} color={C.primary} />
          <Text style={styles.headerTitle}>YOUR WEEK IN REVIEW</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.primary} />
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.primary} />
              <Text style={styles.thinking}>Reviewing your week…</Text>
            </View>
          ) : text ? (
            <>
              <Text style={styles.review}>{text}</Text>
              <TouchableOpacity onPress={generate} style={styles.regen}>
                <Ionicons name="refresh" size={13} color={C.textSecondary} />
                <Text style={styles.regenText}>Regenerate</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.blurb}>
                Get an AI-written recap of your training this week with one tip for next week.
              </Text>
              <TouchableOpacity style={styles.genBtn} onPress={generate} activeOpacity={0.85}>
                <Ionicons name="sparkles" size={15} color="#fff" />
                <Text style={styles.genBtnText}>Generate weekly insight</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    card: {
      backgroundColor: C.cardBackground, borderRadius: 14, padding: 16, marginTop: 14,
      borderWidth: 1, borderColor: C.border,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    headerTitle: { color: C.primary, fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
    body: { marginTop: 12 },
    center: { alignItems: 'center', paddingVertical: 12, gap: 8 },
    thinking: { color: C.textMuted, fontSize: 12, fontStyle: 'italic' },
    blurb: { color: C.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 12 },
    review: { color: C.textPrimary, fontSize: 14, lineHeight: 21 },
    genBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: C.primary, borderRadius: 12, paddingVertical: 11,
    },
    genBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    regen: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', marginTop: 10 },
    regenText: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
  });
  s._colors = C;
  return s;
};

export default WeekReviewCard;
