import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import { EXERCISES, MUSCLE_GROUPS } from '../constants/exerciseCatalog';

/**
 * #164 — Exercise library / catalog. Browsable, searchable, filter-by-muscle
 * list of exercises with instructions (bundled offline; no backend). Tap an
 * exercise to expand its instructions.
 */
const ExerciseLibraryScreen = ({ navigation }) => {
  const styles = useThemedStyles(makeStyles);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('All');
  const [expandedId, setExpandedId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter((e) => {
      if (group !== 'All' && e.muscle !== group) return false;
      if (q && !e.name.toLowerCase().includes(q) && !e.muscle.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, group]);

  const toggle = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((cur) => (cur === id ? null : id));
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Exercise Library"
        subtitle="How-to guide · each tagged by activity"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {MUSCLE_GROUPS.map((g) => {
            const active = group === g;
            return (
              <TouchableOpacity
                key={g}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setGroup(g)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{g}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {filtered.length === 0 ? (
          <Text style={styles.empty}>No exercises match.</Text>
        ) : (
          filtered.map((e) => {
            const open = expandedId === e.id;
            return (
              <TouchableOpacity key={e.id} style={styles.item} activeOpacity={0.85} onPress={() => toggle(e.id)}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemIcon}>
                    <Ionicons name={e.icon} size={22} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.itemName}>{e.name}</Text>
                      <View style={styles.activityPill}>
                        <Text style={styles.activityPillText}>{e.activity}</Text>
                      </View>
                    </View>
                    <Text style={styles.itemMeta}>{e.muscle} · {e.equipment}</Text>
                  </View>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
                </View>
                {open && <Text style={styles.instructions}>{e.instructions}</Text>}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: C.inputBackground,
    borderWidth: 1,
    borderColor: C.inputBorder,
  },
  search: { flex: 1, color: C.textPrimary, fontSize: 15, paddingVertical: 10 },
  chipRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: C.cardBackground,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.textSecondary, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  empty: { color: C.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },
  item: {
    backgroundColor: C.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardBackgroundLight,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  itemName: { color: C.textPrimary, fontSize: 15, fontWeight: '800' },
  activityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: C.primary + '22',
    borderWidth: 1,
    borderColor: C.primary,
  },
  activityPillText: { color: C.primary, fontSize: 10, fontWeight: '800' },
  itemMeta: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  instructions: { color: C.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 10 },
});

export default ExerciseLibraryScreen;
