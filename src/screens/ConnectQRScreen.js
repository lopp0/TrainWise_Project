import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {Colors, Fonts, Spacing} from '../theme/colors';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../api/AuthContext';

const ConnectQRScreen = ({navigation}) => {
  const { userId } = useAuth();
  const [mode, setMode] = useState('show'); // 'show' | 'scan'
  const [scanCode, setScanCode] = useState('');

  // Payload embedded in the QR code
  const qrPayload = JSON.stringify({
    app: 'TrainWise',
    type: 'coach-connect',
    userId: userId,
    timestamp: Date.now(),
  });

  const handleConnect = () => {
    if (!scanCode.trim()) {
      Alert.alert('Missing Code', 'Please enter or scan a connection code');
      return;
    }
    try {
      const data = JSON.parse(scanCode);
      if (data.app !== 'TrainWise') {
        throw new Error('Invalid code');
      }
      Alert.alert(
        'Connection Requested',
        `A connection request has been sent to user #${data.userId}. They will be notified to approve.`,
        [{text: 'OK', onPress: () => navigation.goBack()}],
      );
    } catch (e) {
      Alert.alert('Invalid Code', 'That does not look like a TrainWise code.');
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Connect"
        subtitle="Coach / Trainee link"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Mode toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              mode === 'show' && styles.toggleButtonActive,
            ]}
            onPress={() => setMode('show')}>
            <Text
              style={[
                styles.toggleText,
                mode === 'show' && styles.toggleTextActive,
              ]}>
              My QR Code
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              mode === 'scan' && styles.toggleButtonActive,
            ]}
            onPress={() => setMode('scan')}>
            <Text
              style={[
                styles.toggleText,
                mode === 'scan' && styles.toggleTextActive,
              ]}>
              Scan Code
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'show' ? (
          <Card>
            <Text style={styles.cardTitle}>Share Your Code</Text>
            <Text style={styles.description}>
              Show this QR code to your coach or trainee so they can connect
              with you.
            </Text>
            <View style={styles.qrContainer}>
              <View style={styles.qrWrapper}>
                <QRCode
                  value={qrPayload}
                  size={220}
                  backgroundColor="white"
                  color={Colors.background}
                />
              </View>
            </View>
            <Text style={styles.userIdText}>User ID: #{userId}</Text>
          </Card>
        ) : (
          <Card>
            <Text style={styles.cardTitle}>Enter Connection Code</Text>
            <Text style={styles.description}>
              Paste the code shared by the other user, or tap Scan to use the
              camera.
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="Paste the TrainWise code here..."
              placeholderTextColor={Colors.textMuted}
              value={scanCode}
              onChangeText={setScanCode}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() =>
                Alert.alert(
                  'Camera',
                  'Camera scanning requires device-level setup. Use manual code entry for now.',
                )
              }>
              <Text style={styles.scanButtonText}>Open Camera Scanner</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Info card */}
        <Card>
          <Text style={styles.cardTitle}>How It Works</Text>
          <Text style={styles.infoText}>
            1. As a trainee, show your QR code to your coach{'\n'}
            2. The coach scans it to request a connection{'\n'}
            3. You approve the link in notifications{'\n'}
            4. Your coach can now view your training load and send
            recommendations
          </Text>
        </Card>
      </ScrollView>

      {mode === 'scan' && (
        <View style={styles.bottomActions}>
          <PrimaryButton title="Connect" onPress={handleConnect} />
        </View>
      )}
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
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
  toggleTextActive: {
    color: Colors.textPrimary,
  },
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
  qrContainer: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  qrWrapper: {
    backgroundColor: 'white',
    padding: Spacing.md,
    borderRadius: 12,
  },
  userIdText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
    fontSize: Fonts.captionSize,
    letterSpacing: 1,
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
  scanButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
  },
  scanButtonText: {
    color: Colors.primary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
  infoText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    lineHeight: 22,
  },
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
});

export default ConnectQRScreen;
