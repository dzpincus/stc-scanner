/**
 * Scan Banner
 * Non-blocking feedback strip over the camera. Fades in, holds, fades out; never
 * needs a tap, so the line keeps moving. Modals stay for cases that need a decision.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

export type BannerKind = 'success' | 'warning' | 'info';

export interface BannerMessage {
  /** Change this on every show so repeated identical messages re-animate. */
  key: number;
  kind: BannerKind;
  title: string;
  subtitle?: string;
}

const COLORS: Record<BannerKind, string> = {
  success: Colors.success,
  warning: Colors.warning,
  info: Colors.info,
};
const ICONS: Record<BannerKind, keyof typeof MaterialIcons.glyphMap> = {
  success: 'check-circle',
  warning: 'info',
  info: 'info',
};

export const BANNER_VISIBLE_MS = 1500;

export const ScanBanner: React.FC<{ message: BannerMessage | null }> = ({ message }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(BANNER_VISIBLE_MS),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [message?.key, opacity]);

  if (!message) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.banner, { opacity, backgroundColor: COLORS[message.kind] }]}>
      <MaterialIcons name={ICONS[message.kind]} size={28} color="#fff" />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {message.title}
        </Text>
        {message.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {message.subtitle}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 88,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
    zIndex: 10,
  },
  text: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.9,
    marginTop: 2,
  },
});
