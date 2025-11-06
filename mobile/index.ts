// CRITICAL: Polyfills MUST come BEFORE any other imports
// These ensure crypto.getRandomValues() and URL APIs are available globally
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Expo Router entry point
import 'expo-router/entry';
