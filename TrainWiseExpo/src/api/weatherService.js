import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * weatherService — current conditions for the user's location via Google's
 * Weather API + Air Quality API (both SEPARATE SKUs from the Maps SDK; they do
 * NOT consume the map-load quota, but each must be enabled in the Google Cloud
 * console and the project must have a billing account linked).
 *
 * Returns a rich, multi-factor snapshot the smart-workout engine scores on:
 *   tempC, feelsLikeC, humidity (%), windKph, windGustKph, uvIndex,
 *   precipProb (%), cloudCover (%), conditionType, description, isDaytime,
 *   aqi (Universal AQI 0–100, higher = cleaner), aqiCategory, aqiPollutant.
 *
 * Everything is best-effort: any missing field comes back null and the smart
 * engine simply skips that factor. Cached ~1h so usage stays tiny.
 */

const API_KEY =
  Constants?.expoConfig?.android?.config?.googleMaps?.apiKey ||
  '***REMOVED***';

const CACHE_KEY = '@trainwise_weather_cache';
const CACHE_MS = 60 * 60 * 1000; // 1 hour

// Pull the user's coordinates (last-known is instant; fall back to a fresh
// low-accuracy fix). Throws if permission is denied.
const getCoords = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  let pos = await Location.getLastKnownPositionAsync();
  if (!pos) {
    pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  }
  return pos.coords;
};

// Google Weather API — currentConditions:lookup (GET).
const fetchWeather = async (latitude, longitude) => {
  const url =
    'https://weather.googleapis.com/v1/currentConditions:lookup' +
    `?key=${API_KEY}&unitsSystem=METRIC` +
    `&location.latitude=${latitude}&location.longitude=${longitude}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Weather API ${res.status}: ${body.slice(0, 140)}`);
  }
  const json = await res.json();

  return {
    tempC: json?.temperature?.degrees ?? null,
    feelsLikeC: json?.feelsLikeTemperature?.degrees ?? null,
    humidity: json?.relativeHumidity ?? null, // integer %
    windKph: json?.wind?.speed?.value ?? null,
    windGustKph: json?.wind?.gust?.value ?? null,
    windDir: json?.wind?.direction?.cardinal ?? null,
    uvIndex: json?.uvIndex ?? null,
    precipProb: json?.precipitation?.probability?.percent ?? null,
    cloudCover: json?.cloudCover ?? null,
    conditionType: json?.weatherCondition?.type ?? null,
    description: json?.weatherCondition?.description?.text ?? '',
    isDaytime: json?.isDaytime ?? true,
  };
};

// Google Air Quality API — currentConditions:lookup (POST). Universal AQI is
// 0–100 where HIGHER is cleaner. Best-effort: returns nulls on any failure so
// a disabled SKU never blocks the weather card.
const fetchAirQuality = async (latitude, longitude) => {
  try {
    const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: { latitude, longitude } }),
    });
    if (!res.ok) return { aqi: null, aqiCategory: null, aqiPollutant: null };
    const json = await res.json();
    const idx = Array.isArray(json?.indexes) ? json.indexes[0] : null;
    return {
      aqi: idx?.aqi ?? null,
      aqiCategory: idx?.category ?? null,
      aqiPollutant: idx?.dominantPollutant ?? null,
    };
  } catch {
    return { aqi: null, aqiCategory: null, aqiPollutant: null };
  }
};

export const getCurrentWeather = async () => {
  // Serve from cache to keep API calls minimal.
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (c && Date.now() - c.ts < CACHE_MS && c.data) return c.data;
    }
  } catch {
    // ignore cache errors
  }

  const { latitude, longitude } = await getCoords();

  // Weather is required; air quality is a bonus factor. Run them together but
  // don't let a missing Air Quality SKU sink the whole call.
  const [weather, air] = await Promise.all([
    fetchWeather(latitude, longitude),
    fetchAirQuality(latitude, longitude),
  ]);

  const data = { ...weather, ...air };

  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore cache write errors
  }
  return data;
};

export default { getCurrentWeather };
