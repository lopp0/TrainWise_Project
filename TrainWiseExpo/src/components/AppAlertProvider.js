import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * AppAlertProvider — branded replacement for the system Alert.
 *
 * Strategy: instead of editing the ~46 `Alert.alert(...)` call sites across the
 * app, we monkey-patch `Alert.alert` once (below) so every existing call routes
 * into this themed popup. The original Alert is kept as a fallback for the brief
 * window before the provider mounts (and to avoid recursion).
 *
 * Signature matches Alert.alert(title, message?, buttons?), so call sites are
 * unchanged. The 4th `options` arg is ignored.
 */

const originalAlert = Alert.alert.bind(Alert);

// Set by the mounted provider; null before mount.
let externalShow = null;

export const appAlert = (title, message, buttons) => {
  if (externalShow) externalShow({ title, message, buttons });
  else originalAlert(title, message, buttons);
};

// Redirect every Alert.alert in the app to the branded popup. Done at module
// load (App.js imports this module), so it's in effect before any alert fires.
Alert.alert = appAlert;

const AppAlertContext = createContext({ alert: appAlert });
export const useAppAlert = () => useContext(AppAlertContext);

export const AppAlertProvider = ({ children }) => {
  const styles = useThemedStyles(makeStyles);
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    externalShow = (cfg) => setDialog(cfg);
    return () => {
      externalShow = null;
    };
  }, []);

  const close = useCallback(() => setDialog(null), []);

  const handlePress = (btn) => {
    setDialog(null);
    // Defer so the modal is gone before any navigation in onPress runs.
    if (btn?.onPress) setTimeout(() => btn.onPress(), 0);
  };

  const buttons =
    dialog?.buttons && dialog.buttons.length ? dialog.buttons : [{ text: 'OK' }];
  const stacked = buttons.length > 2; // 3+ buttons → vertical

  return (
    <AppAlertContext.Provider value={{ alert: appAlert }}>
      {children}
      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            {!!dialog?.title && <Text style={styles.title}>{dialog.title}</Text>}
            {dialog?.message != null && dialog.message !== '' && (
              <Text style={styles.message}>{String(dialog.message)}</Text>
            )}
            <View style={[styles.btnRow, stacked && styles.btnCol]}>
              {buttons.map((b, i) => {
                const isCancel = b.style === 'cancel';
                const isDestructive = b.style === 'destructive';
                return (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.85}
                    onPress={() => handlePress(b)}
                    style={[
                      styles.btn,
                      stacked && styles.btnStacked,
                      isCancel && styles.btnCancel,
                      isDestructive && styles.btnDestructive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        isCancel && styles.btnTextCancel,
                        isDestructive && styles.btnTextDestructive,
                      ]}
                    >
                      {b.text || 'OK'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </AppAlertContext.Provider>
  );
};

const makeStyles = (C) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: C.cardBackground,
      borderRadius: 16,
      padding: 22,
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    title: {
      color: C.primary,
      fontSize: 18,
      fontWeight: '900',
      marginBottom: 8,
    },
    message: {
      color: C.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 18,
    },
    btnRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    btnCol: { flexDirection: 'column-reverse', alignItems: 'stretch' },
    btn: {
      paddingVertical: 11,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 88,
    },
    btnStacked: { marginTop: 8 },
    btnCancel: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: C.border,
    },
    btnDestructive: { backgroundColor: C.danger },
    btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    btnTextCancel: { color: C.textSecondary },
    btnTextDestructive: { color: '#fff' },
  });

export default AppAlertProvider;
