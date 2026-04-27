import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CIRCLE_RADIUS = 118;
const LOGO_SIZE = 160;
const FONT_SIZE = 14;
const CONTAINER_SIZE = (CIRCLE_RADIUS + FONT_SIZE + 14) * 2;

function CurvedText({ text, radius, curveUp }) {
  const chars = text.split('');
  const charStep = (FONT_SIZE * 0.62) / radius;
  const totalAngle = charStep * chars.length;
  const cx = CONTAINER_SIZE / 2;
  const cy = CONTAINER_SIZE / 2;

  const startAngle = curveUp
    ? -Math.PI / 2 - totalAngle / 2
    : Math.PI / 2 - totalAngle / 2;

  return (
    <>
      {chars.map((char, i) => {
        const angle = startAngle + charStep * (i + 0.5);
        const px = cx + radius * Math.cos(angle);
        const py = cy + radius * Math.sin(angle);
        const rotDeg = curveUp
          ? (angle * 180) / Math.PI + 90
          : (angle * 180) / Math.PI - 90;

        return (
          <Text
            key={`c-${i}`}
            style={{
              position: 'absolute',
              left: px - FONT_SIZE * 0.32,
              top: curveUp ? py - FONT_SIZE : py,
              fontSize: FONT_SIZE,
              color: '#00e6c3',
              fontWeight: '700',
              transform: [{ rotate: `${rotDeg}deg` }],
            }}
          >
            {char}
          </Text>
        );
      })}
    </>
  );
}

const WelcomeScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <View style={styles.titleWrapper}>
        <Text style={[styles.titleBase, styles.titleEcho]} numberOfLines={1}>
          Trainwise
        </Text>
        <Text style={[styles.titleBase, styles.titleFront]} numberOfLines={1}>
          Trainwise
        </Text>
      </View>

      <View
        style={[
          styles.circleContainer,
          { width: CONTAINER_SIZE, height: CONTAINER_SIZE },
        ]}
      >
        <Image
          source={require('../../assets/images/wowowow.png')}
          style={[
            styles.logo,
            {
              width: LOGO_SIZE,
              height: LOGO_SIZE,
              top: (CONTAINER_SIZE - LOGO_SIZE) / 2,
              left: (CONTAINER_SIZE - LOGO_SIZE) / 2,
            },
          ]}
          resizeMode="contain"
        />
        <CurvedText text="Protect your health" radius={CIRCLE_RADIUS} curveUp={true} />
        <CurvedText text="and your safety" radius={CIRCLE_RADIUS} curveUp={false} />
      </View>

      <TouchableOpacity
        style={styles.signUpButton}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('SignUp')}
      >
        <Text style={styles.signUpText}>Sign Up</Text>
      </TouchableOpacity>

      <View style={styles.signInRow}>
      <Text style={styles.signInPrompt}>ALREADY HAVE AN ACCOUNT?  SIGN IN </Text>
      <TouchableOpacity activeOpacity={0.75} onPress={() => navigation.navigate('Login')} >
      <Text style={styles.signInHere}>HERE!</Text>
      </TouchableOpacity>
      </View>
     </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#13173d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  titleWrapper: {
    paddingBottom: 8,
    paddingRight: 8,
    marginBottom: 16,
  },
  titleBase: {
    fontSize: 52,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1.5,
  },
  titleEcho: {
    color: '#c524e6',
    position: 'absolute',
    top: 6,
    left: 6,
  },
  titleFront: {
    color: '#ff2c60',
  },
  circleContainer: {
    position: 'relative',
    marginBottom: 28,
  },
  logo: {
    position: 'absolute',
  },
  signUpButton: {
    backgroundColor: '#ff2c60',
    borderWidth: 6,
    borderColor: '#c524e6',
    borderRadius: 32,
    paddingVertical: 14,
    paddingHorizontal: SCREEN_WIDTH * 0.18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  signUpText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  signInPrompt: {
    color: '#ff2c60',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  signInHere: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textDecorationLine: 'underline',
  },
});

export default WelcomeScreen;
