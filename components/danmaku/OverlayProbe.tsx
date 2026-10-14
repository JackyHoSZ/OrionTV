import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AVPlaybackStatus } from 'expo-av';

/** Stage A only: a non-focusable sibling above the existing Expo AV video. */
export function OverlayProbe({ status }: { status: AVPlaybackStatus | null }) {
  const { width } = useWindowDimensions();
  const phase = useRef(new Animated.Value(0)).current;
  const loaded = status?.isLoaded;
  const position = loaded ? status.positionMillis : 0;
  const playing = loaded && status.isPlaying && !status.isBuffering;
  const rate = loaded ? status.rate : 1;
  useEffect(() => {
    phase.stopAnimation();
    const current = (position / 1000) % 8;
    phase.setValue(current);
    if (playing) {
      const animation = Animated.timing(phase, {
        toValue: Math.min(8, current + 0.5 * rate),
        duration: 500,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }
  }, [phase, position, playing, rate]);
  return (
    <View pointerEvents="none" focusable={false} style={styles.overlay}>
      {[0, 1, 2].map((lane) => (
        <Animated.Text key={lane} style={[styles.comment, {
          top: 50 + lane * 50,
          transform: [{ translateX: phase.interpolate({ inputRange: [0, 8], outputRange: [width, -450] }) }],
        }]}>
          {`OVERLAY ${lane + 1} · 弹幕覆盖验证`}
        </Animated.Text>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  comment: { position: 'absolute', color: '#ffffff', fontSize: 26, fontWeight: 'bold',
    textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 3 },
});
