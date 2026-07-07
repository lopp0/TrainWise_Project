import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Fonts, Spacing } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import { useAuth } from '../api/AuthContext';
import {
  getCoachByUserId,
  connectCoachTrainee,
} from '../services/api';
import { sendLocalNotification } from '../api/NotificationService';

/**
 * Coach <-> trainee linking via QR.
 *
 * Each user shows a QR encoding their identity (and, for coaches, their
 * CoachID). The other party connects by either scanning live or uploading a
 * saved QR image. A link always pairs exactly one coach with one trainee:
 *   - coach scans trainee  -> connect(myCoachId, trainee.userId)
 *   - trainee scans coach  -> connect(coach.coachId, myUserId)
 */
const ConnectQRScreen = ({ navigation }) => {
  const { userId, user } = useAuth();
  const isCoach = !!user?.isCoach;
  const styles = useThemedStyles(makeStyles);

  const [mode, setMode] = useState('show'); // 'show' | 'scan'
  const [myCoachId, setMyCoachId] = useState(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false); // live camera active
  const [busy, setBusy] = useState(false); // connect/decode in flight
  const handledRef = useRef(false); // guard against duplicate scans

  // Swipe pager state: page 0 = My QR Code (mode 'show'), page 1 = Connect ('scan').
  const scrollRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pageOf = (m) => (m === 'scan' ? 1 : 0);
  const switchMode = (next) => {
    setMode(next);
    if (size.w > 0) scrollRef.current?.scrollTo({ x: pageOf(next) * size.w, animated: true });
  };
  const onPagerMomentumEnd = (e) => {
    if (size.w <= 0) return;
    const page = Math.round(e.nativeEvent.contentOffset.x / size.w);
    const next = page === 1 ? 'scan' : 'show';
    if (next !== mode) setMode(next);
  };

  // Resolve this user's CoachID so their QR can carry it (trainees skip this).
  const fetchMyCoachId = useCallback(async () => {
    if (!isCoach || !userId) return null;
    try {
      const res = await getCoachByUserId(userId);
      const id = res.data?.coachID ?? res.data?.CoachID ?? null;
      setMyCoachId(id);
      return id;
    } catch (e) {
      // Don't swallow silently — log the real cause. Common failure modes:
      // 404 means no Coach row was created for this user (e.g. signed up
      // as trainee then flipped to coach), 500 means the BL/DAL threw.
      const status = e?.response?.status;
      console.warn('[ConnectQR] getCoachByUserId failed:', status, e?.response?.data || e?.message);
      return null;
    }
  }, [isCoach, userId]);

  useEffect(() => {
    fetchMyCoachId();
  }, [fetchMyCoachId]);

  const qrPayload = JSON.stringify({
    app: 'TrainWise',
    type: 'connect',
    role: isCoach ? 'coach' : 'trainee',
    userId,
    coachId: myCoachId,
  });

  // Decide the (coachId, traineeUserId) pair from the scanned payload + my role.
  const resolvePair = useCallback(
    (data) => {
      const theirRole = data.role || 'trainee';
      if (isCoach && theirRole === 'trainee') {
        if (!myCoachId) {
          throw new Error('Your coach profile is still loading. Try again in a moment.');
        }
        return { coachId: myCoachId, traineeId: data.userId, traineeLabel: `user #${data.userId}` };
      }
      if (!isCoach && theirRole === 'coach') {
        if (!data.coachId) {
          throw new Error("That coach's code is missing its coach ID. Ask them to refresh their QR.");
        }
        return { coachId: data.coachId, traineeId: userId, traineeLabel: 'you' };
      }
      if (isCoach && theirRole === 'coach') {
        throw new Error('Both codes are coaches. A link needs one coach and one trainee.');
      }
      throw new Error('Both codes are trainees. A link needs one coach and one trainee.');
    },
    [isCoach, myCoachId, userId]
  );

  const doConnect = useCallback(
    async (rawValue) => {
      setBusy(true);
      try {
        const data = JSON.parse(rawValue);
        if (data.app !== 'TrainWise') throw new Error('Not a TrainWise code.');

        // When I'm a coach and my CoachID hasn't loaded yet (initial fetch
        // raced or failed), try once more inline before refusing — the
        // previous behavior left the user permanently stuck if the
        // background fetch errored on app start.
        if (isCoach && !myCoachId) {
          const retried = await fetchMyCoachId();
          if (!retried) {
            throw new Error(
              'Could not load your coach profile. Make sure you signed up with a Coach role and try again.'
            );
          }
        }

        const { coachId, traineeId, traineeLabel } = resolvePair(data);
        await connectCoachTrainee(coachId, traineeId);

        // Fire a notification on THIS device immediately (the other party gets
        // theirs from the background poll when their app next checks in).
        sendLocalNotification(
          'Connected 🤝',
          isCoach
            ? `You're now coaching ${traineeLabel}.`
            : "You're now connected with your coach."
        );

        Alert.alert(
          'Connected',
          isCoach
            ? `You are now following ${traineeLabel}.`
            : 'You are now connected to your coach.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } catch (e) {
        // 409 = the coach/trainee pair already exists. Show it as an
        // informational "already connected" message, not a failure.
        if (e.response?.status === 409) {
          Alert.alert(
            'Already connected',
            String(e.response?.data || 'You are already connected with this user.'),
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        const msg =
          e.response?.data ||
          (e instanceof SyntaxError ? 'That QR code is not a valid TrainWise code.' : e.message) ||
          'Could not connect.';
        Alert.alert('Connection failed', String(msg));
        // Allow another attempt after a failure.
        handledRef.current = false;
      } finally {
        setBusy(false);
      }
    },
    [resolvePair, isCoach, myCoachId, fetchMyCoachId, navigation]
  );

  const handleBarcodeScanned = useCallback(
    ({ data }) => {
      if (handledRef.current) return;
      handledRef.current = true;
      setScanning(false);
      doConnect(data);
    },
    [doConnect]
  );

  const startLiveScan = async () => {
    let granted = permission?.granted;
    if (!granted) {
      const res = await requestPermission();
      granted = res.granted;
    }
    if (!granted) {
      Alert.alert(
        'Camera permission needed',
        'Enable camera access in settings to scan QR codes, or upload a saved image instead.'
      );
      return;
    }
    handledRef.current = false;
    setScanning(true);
  };

  const uploadQrImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload a QR image.');
      return;
    }
    // expo-image-picker SDK 54 removed the `MediaTypeOptions` enum — the
    // accessor returns undefined and the picker call throws
    // "undefined is not a function" before it ever opens. The array form
    // ['images'] is the supported syntax in SDK 54+.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;

    const uri = result.assets[0].uri;
    setBusy(true);
    try {
      // expo-camera 17 exposes scanFromURLAsync as a module-level function,
      // not a static on CameraView. Calling CameraView.scanFromURLAsync
      // dereferences undefined and throws before any image is read.
      const scanned = await scanFromURLAsync(uri, ['qr']);
      if (!scanned || scanned.length === 0) {
        Alert.alert(
          'No code found',
          'No QR code was detected in that image. Make sure the QR fills most of the frame and the photo is sharp.'
        );
        return;
      }
      handledRef.current = true;
      await doConnect(scanned[0].data);
    } catch (e) {
      // Surface the real cause so the user can act on it (permission, file
      // missing, decoder failure) instead of always seeing "try a clearer
      // photo" — which is misleading when the failure is structural.
      const detail = e?.message ? `\n\n${e.message}` : '';
      Alert.alert('Could not read that image', `Try a different photo.${detail}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Connect"
        subtitle="Coach / Trainee link"
        onBack={() => navigation.goBack()}
      />

      {/* Mode toggle (also reflects / drives the swipe position) */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, mode === 'show' && styles.toggleButtonActive]}
          onPress={() => {
            setScanning(false);
            switchMode('show');
          }}
        >
          <Text style={[styles.toggleText, mode === 'show' && styles.toggleTextActive]}>
            My QR Code
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, mode === 'scan' && styles.toggleButtonActive]}
          onPress={() => switchMode('scan')}
        >
          <Text style={[styles.toggleText, mode === 'scan' && styles.toggleTextActive]}>
            Connect
          </Text>
        </TouchableOpacity>
      </View>

      {scanning ? (
        // Full-bleed live scanner
        <View style={styles.scannerWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>Point at a TrainWise QR code</Text>
          </View>
          <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setScanning(false)}>
            <Text style={styles.cancelScanText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Swipe horizontally between My QR Code (page 0) and Connect (page 1)
        <View
          style={{ flex: 1 }}
          onLayout={(e) => {
            const { width: w, height: h } = e.nativeEvent.layout;
            if (w !== size.w || h !== size.h) setSize({ w, h });
          }}
        >
          {size.h > 0 && (
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: pageOf(mode) * size.w, y: 0 }}
              onMomentumScrollEnd={onPagerMomentumEnd}
              scrollEventThrottle={16}
            >
              {/* Page 0 — My QR Code */}
              <View style={{ width: size.w, height: size.h }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                  <Card>
                    <Text style={styles.cardTitle}>Share Your Code</Text>
                    <Text style={styles.description}>
                      {isCoach
                        ? 'Show this to a trainee so they can link with you, or swipe to Connect to scan theirs.'
                        : 'Show this to your coach so they can add you, or swipe to Connect to scan their code.'}
                    </Text>
                    <View style={styles.qrContainer}>
                      <View style={styles.qrWrapper}>
                        <QRCode value={qrPayload} size={220} backgroundColor="white" color="#0A1628" />
                      </View>
                    </View>
                    <Text style={styles.userIdText}>
                      {isCoach ? 'COACH' : 'TRAINEE'} · User #{userId}
                    </Text>
                  </Card>
                  <Card>
                    <Text style={styles.cardTitle}>How It Works</Text>
                    <Text style={styles.infoText}>
                      1. A coach and a trainee open this screen{'\n'}
                      2. One shows their QR code, the other swipes to Connect{'\n'}
                      3. Scan live or upload a saved image of the code{'\n'}
                      4. The coach can now see the trainee&apos;s training load and send
                      recommendations
                    </Text>
                  </Card>
                </ScrollView>
              </View>

              {/* Page 1 — Connect */}
              <View style={{ width: size.w, height: size.h }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                  <Card>
                    <Text style={styles.cardTitle}>Connect with a Code</Text>
                    <Text style={styles.description}>
                      Scan a TrainWise QR code live, or upload a saved QR image from your
                      gallery.
                    </Text>
                    <TouchableOpacity style={styles.primaryAction} onPress={startLiveScan} disabled={busy}>
                      <Text style={styles.primaryActionText}>Scan with camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryAction} onPress={uploadQrImage} disabled={busy}>
                      <Text style={styles.secondaryActionText}>Upload QR image</Text>
                    </TouchableOpacity>
                    {busy && (
                      <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.md }} />
                    )}
                  </Card>
                  <Card>
                    <Text style={styles.cardTitle}>How It Works</Text>
                    <Text style={styles.infoText}>
                      1. A coach and a trainee open this screen{'\n'}
                      2. One shows their QR code, the other swipes to Connect{'\n'}
                      3. Scan live or upload a saved image of the code{'\n'}
                      4. The coach can now see the trainee&apos;s training load and send
                      recommendations
                    </Text>
                  </Card>
                </ScrollView>
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const makeStyles = (Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: Spacing.xxl },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleButtonActive: { backgroundColor: Colors.primary },
  toggleText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
  toggleTextActive: { color: Colors.textPrimary },
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  qrContainer: { alignItems: 'center', marginVertical: Spacing.md },
  qrWrapper: { backgroundColor: 'white', padding: Spacing.md, borderRadius: 12 },
  userIdText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
    fontSize: Fonts.captionSize,
    letterSpacing: 1,
  },
  primaryAction: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  primaryActionText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.bold,
  },
  secondaryAction: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: Colors.primary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
  infoText: { color: Colors.textPrimary, fontSize: Fonts.bodySize, lineHeight: 22 },

  // Live scanner
  scannerWrap: { flex: 1, backgroundColor: '#000' },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 18,
    backgroundColor: 'transparent',
  },
  scanHint: {
    color: '#fff',
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
    marginTop: Spacing.lg,
  },
  cancelScanBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 30,
  },
  cancelScanText: { color: '#fff', fontSize: Fonts.bodySize, fontWeight: Fonts.bold },
});

export default ConnectQRScreen;
