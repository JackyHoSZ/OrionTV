import {focusTV} from '@/utils/tvFocus';
import React,{useEffect,useRef} from 'react';
import {View,Text,StyleSheet} from 'react-native';
import Constants from 'expo-constants';
import {StyledButton} from '@/components/StyledButton';
import {useDanmakuStore} from '@/stores/danmakuStore';
import {DanmakuPanel} from './DanmakuPanel';
export function DanmakuSettingsSection(){
 const button=useRef<View>(null);const open=useDanmakuStore(s=>s.panelOpen&&s.panelContext==='global');const previous=useRef(false);
 useEffect(()=>{const restore=previous.current&&!open;previous.current=open;if(restore){const timer=setTimeout(()=>focusTV(button.current),180);return()=>clearTimeout(timer);}},[open]);
 return <View style={styles.box}>
  <StyledButton ref={button} text="弹幕设置" accessibilityLabel="danmaku-global-settings" onPress={()=>useDanmakuStore.getState().setPanelOpen(true,'global')}/>
  <Text style={styles.text}>独立弹幕版 · {Constants.expoConfig?.version} · 构建 {Constants.expoConfig?.extra?.danmakuBuild||'local'}</Text>
  <Text style={styles.text}>构建时间：{Constants.expoConfig?.extra?.danmakuBuiltAt||'本地开发'}。更新请安装本 Fork 的同签名 APK。</Text>
  <DanmakuPanel context="global"/>
 </View>;
}
const styles=StyleSheet.create({box:{padding:18,borderWidth:1,borderColor:'#555',borderRadius:12},text:{fontSize:16,color:'#bac4cd',marginTop:12}});
