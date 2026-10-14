import React, { useRef, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { StyledButton } from '@/components/StyledButton';
import { OverlayProbe } from '@/components/danmaku/OverlayProbe';

/** Only the CI APK enables this isolated, credential-free native playback fixture. */
export default function DanmakuTestScreen() {
  const ref = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  if (process.env.EXPO_PUBLIC_DANMAKU_E2E !== '1') return <Text>测试入口未启用</Text>;
  const loaded = status?.isLoaded;
  return <View style={styles.screen}>
    <Video ref={ref} source={require('../assets/danmaku-test.mp4')}
      style={StyleSheet.absoluteFill} resizeMode={ResizeMode.CONTAIN} shouldPlay isLooping
      useNativeControls={false} progressUpdateIntervalMillis={250} onPlaybackStatusUpdate={setStatus} />
    <OverlayProbe status={status} />
    <Text style={styles.status} accessibilityLabel={`PROBE loaded=${!!loaded} playing=${loaded && status.isPlaying} position=${loaded ? status.positionMillis : 0}`}>
      {`PROBE loaded=${!!loaded} playing=${loaded && status.isPlaying} position=${loaded ? status.positionMillis : 0}`}
    </Text>
    <View style={styles.controls}>
      <StyledButton text="暂停 / 继续" accessibilityLabel="probe-pause" hasTVPreferredFocus
        onPress={() => loaded && (status.isPlaying ? ref.current?.pauseAsync() : ref.current?.playAsync())} />
      <StyledButton text="快进 10 秒" accessibilityLabel="probe-seek"
        onPress={() => loaded && ref.current?.setPositionAsync(status.positionMillis + 10000)} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  status: { position: 'absolute', top: 8, left: 12, color: '#fff', fontSize: 16, backgroundColor: '#111' },
  controls: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'center', backgroundColor: '#111b' },
});
