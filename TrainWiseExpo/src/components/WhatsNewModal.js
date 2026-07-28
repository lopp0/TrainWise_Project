import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import { APP_VERSION, CHANGELOG } from '../constants/changelog';

/**
 * "What's New" modal (feature #178). Shows the newest changelog entry once per
 * app version. Self-contained: mount it once near the app root; it checks the
 * stored seen-version on mount and shows itself if the version changed.
 */
const SEEN_KEY = '@trainwise_seen_version';

const WhatsNewModal = () => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;
  const [visible, setVisible] = useState(false);
  const entry = CHANGELOG[0];

  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(SEEN_KEY);
        if (seen !== APP_VERSION) setVisible(true);
      } catch {
        // ignore — worst case the modal just doesn't show
      }
    })();
  }, []);

  const dismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(SEEN_KEY, APP_VERSION);
    } catch {
      // best-effort
    }
  };

  if (!entry) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles" size={26} color={C.primary} />
          </View>
          <Text style={styles.title}>{entry.title}</Text>
          <Text style={styles.version}>Version {entry.version}</Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {entry.items.map((it, i) => (
              <View key={i} style={styles.row}>
                <Ionicons name="checkmark-circle" size={18} color={C.primary} style={styles.check} />
                <Text style={styles.item}>{it}</Text>
              </View>
            ))}
          </ScrollView>
          <Pressable style={styles.btn} onPress={dismiss}>
            <Text style={styles.btnText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 24 },
    card: { backgroundColor: C.cardBackground, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.border },
    iconWrap: { alignSelf: 'center', marginBottom: 6 },
    title: { color: C.textPrimary, fontSize: 22, fontWeight: '900', textAlign: 'center' },
    version: { color: C.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
    list: { maxHeight: 280 },
    row: { flexDirection: 'row', gap: 10, marginBottom: 10, paddingRight: 4 },
    check: { marginTop: 1 },
    item: { color: C.textSecondary, fontSize: 14, flex: 1, lineHeight: 20 },
    btn: { marginTop: 16, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
  s._colors = C;
  return s;
};

export default WhatsNewModal;
