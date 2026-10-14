import React,{useEffect,useState,useRef} from 'react';
import {View,Text,TextInput,StyleSheet} from 'react-native';
import {StyledButton} from '@/components/StyledButton';
import {useDanmakuStore} from '@/stores/danmakuStore';
import {DanmakuError} from '@/services/danmaku/api';
export function DanmakuConnection(){
 const settings=useDanmakuStore(s=>s.settings);
 const [url,setUrl]=useState(settings.apiUrl);const [token,setToken]=useState(settings.token);
 const [message,setMessage]=useState('只填写普通查询 Token，不使用 ADMIN_TOKEN');const [busy,setBusy]=useState(false);const [focus,setFocus]=useState('');
 const controller=useRef<AbortController|null>(null);const alive=useRef(true);
 useEffect(()=>{alive.current=true;void useDanmakuStore.getState().hydrate().then(()=>{if(!alive.current)return;const s=useDanmakuStore.getState().settings;setUrl(s.apiUrl);setToken(s.token);});return()=>{alive.current=false;controller.current?.abort();};},[]);
 const save=async(test=false)=>{setBusy(true);try{
  await useDanmakuStore.getState().setSettings({apiUrl:url,token});
  controller.current?.abort();controller.current=new AbortController();
  if(test)await useDanmakuStore.getState().testConnection(controller.current.signal);
  if(alive.current)setMessage(test?'连接成功':'连接已安全保存');
 }catch(error){if(alive.current)setMessage(error instanceof DanmakuError?error.message:'连接设置保存失败');}finally{if(alive.current)setBusy(false);}};
 return <View style={styles.box}>
  <Text style={styles.title}>弹幕服务</Text>
  <TextInput accessibilityLabel="danmaku-api-address" value={url} onChangeText={setUrl} style={[styles.input,focus==='url'&&styles.focus]} onFocus={()=>setFocus('url')} onBlur={()=>setFocus('')} autoCapitalize="none" autoCorrect={false}/>
  <TextInput accessibilityLabel="danmaku-query-token" value={token} onChangeText={setToken} secureTextEntry style={[styles.input,focus==='token'&&styles.focus]} onFocus={()=>setFocus('token')} onBlur={()=>setFocus('')} placeholder="普通查询 Token" placeholderTextColor="#888" autoCapitalize="none" autoCorrect={false}/>
  <View style={styles.row}><StyledButton text="保存连接" disabled={busy} onPress={()=>void save()}/><StyledButton text={busy?'处理中…':'测试连接'} accessibilityLabel="danmaku-test-connection" disabled={busy} onPress={()=>void save(true)}/></View>
  <Text style={styles.message}>{message}</Text>
 </View>;
}
const styles=StyleSheet.create({box:{padding:20,marginBottom:16,borderWidth:1,borderColor:'#555',borderRadius:12},title:{fontSize:22,color:'#fff',marginBottom:12},input:{fontSize:18,color:'#fff',borderWidth:2,borderColor:'#888',padding:12,marginBottom:12,borderRadius:6},focus:{borderColor:'#2edc8c',backgroundColor:'#16342b'},row:{flexDirection:'row',gap:12},message:{fontSize:16,color:'#ccc',marginTop:12}});
