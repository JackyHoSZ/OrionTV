import React,{memo,useEffect,useRef,useState} from 'react';
import {Text,View,StyleSheet} from 'react-native';
import {Video} from 'expo-av';
import {useLocalSearchParams} from 'expo-router';
import {storageConfig} from '@/services/storageConfig';
import {StyledButton} from '@/components/StyledButton';
import {PlayerControls} from '@/components/PlayerControls';
import {PlayerDanmaku} from '@/components/danmaku/PlayerDanmaku';
import {useVideoHandlers} from '@/hooks/useVideoHandlers';
import usePlayerStore,{selectCurrentEpisode} from '@/stores/playerStore';
import useDetailStore from '@/stores/detailStore';
import {useDanmakuStore} from '@/stores/danmakuStore';
import {DanmakuPanel} from '@/components/danmaku/DanmakuPanel';
import {DEFAULT_DANMAKU_SETTINGS} from '@/services/danmaku/types';
const NativeVideo=memo(Video);
/** The production APK disables this route. No real credentials or video are included. */
export default function DanmakuTestScreen(){
 const ref=useRef<Video>(null);const params=useLocalSearchParams<{reuse?:string;episode?:string}>();
 const p=usePlayerStore();const d=useDanmakuStore();
 const currentEpisode=usePlayerStore(selectCurrentEpisode);
 const [active,setActive]=useState(0);const [ready,setReady]=useState(false);
 const detail=useDetailStore(s=>s.detail);
 const {videoProps}=useVideoHandlers({videoRef:ref,currentEpisode,initialPosition:p.initialPosition,playbackRate:p.playbackRate,handlePlaybackStatusUpdate:p.handlePlaybackStatusUpdate,deviceType:'tv',detail:detail||undefined});
 useEffect(()=>{
  if(process.env.EXPO_PUBLIC_DANMAKU_E2E!=='1')return;
  let mounted=true;
  void(async()=>{
   await useDanmakuStore.getState().hydrate();
   storageConfig.setStorageType('localstorage');
   if(params.reuse!=='1')await useDanmakuStore.getState().setSettings({...DEFAULT_DANMAKU_SETTINGS,apiUrl:'http://127.0.0.1:8765',token:''});
   const episodes=[2,3].map(n=>`http://127.0.0.1:8765/video.mp4?episode=${n}`);
   useDetailStore.setState({detail:{id:1,title:'模拟剧第二季',year:'2024',type_name:'国产剧',poster:'',source:'fixture',source_name:'授权模拟源',episodes,episodes_titles:['第2集','第3集']}});
   usePlayerStore.setState({episodes:episodes.map((url,i)=>({url,title:`第${i+2}集`})),currentEpisodeIndex:params.episode==='3'?1:0,videoRef:ref,shouldPlay:true,isLoading:false,showControls:true});
   if(mounted)setReady(true);
  })();
  return()=>{mounted=false;useDanmakuStore.getState().clear();usePlayerStore.getState().reset();};
 // The fixture seeds exactly once; production never runs this effect.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 if(process.env.EXPO_PUBLIC_DANMAKU_E2E!=='1')return <Text>测试入口未启用</Text>;
 const status=p.status;const loaded=status?.isLoaded;
 const badge=`PROBE loaded=${!!loaded} playing=${loaded&&status.isPlaying} position=${loaded?status.positionMillis:0} rate=${loaded?status.rate:0} intent=${p.shouldPlay} nativeIntent=${loaded&&status.shouldPlay} episode=${p.currentEpisodeIndex+2} comments=${d.comments.length} active=${active} enabled=${d.settings.enabled} density=${d.settings.perSecond} match=${d.match?.episodeId||0} saving=${d.settingsSaving} font=${d.settings.fontSize} opacity=${d.settings.opacity} offset=${d.mediaOffset} color=${d.settings.color.slice(1)} loading=${d.loading}`;
 return <View style={styles.screen}>
  {ready&&<NativeVideo key={currentEpisode?.url} ref={ref} style={StyleSheet.absoluteFill} {...videoProps}/>}
  <PlayerDanmaku onActiveCount={setActive}/>
  <DanmakuPanel/>
  <DanmakuPanel context="global"/>
  <PlayerControls showControls setShowControls={p.setShowControls}/>
  <Text style={styles.badge} accessibilityLabel={badge}>{badge}</Text>
  <Text style={styles.message} accessibilityLabel={'DANMAKU_STATUS '+d.message}>{d.message}</Text>
  <View style={styles.actions}>
   <StyledButton text="后退10秒" accessibilityLabel="probe-back" onPress={()=>p.seek(-10000)}/>
   <StyledButton text="前进10秒" accessibilityLabel="probe-forward" onPress={()=>p.seek(10000)}/>
   <StyledButton text="全局设置" accessibilityLabel="probe-global" onPress={()=>d.setPanelOpen(true,'global')}/>
   <StyledButton text="1.25倍速" accessibilityLabel="probe-rate125" onPress={()=>p.setPlaybackRate(1.25)}/>
   <StyledButton text="1.5倍速" accessibilityLabel="probe-rate150" onPress={()=>p.setPlaybackRate(1.5)}/>
   <StyledButton text="正常速度" accessibilityLabel="probe-normal" onPress={()=>p.setPlaybackRate(1)}/>
   <StyledButton text="2倍速" accessibilityLabel="probe-rate" onPress={()=>p.setPlaybackRate(2)}/>
   <StyledButton text="换模拟源" accessibilityLabel="probe-source" onPress={()=>{const old=useDetailStore.getState().detail!;const episodes=old.episodes.map(url=>url+'&source=b');useDetailStore.setState({detail:{...old,source:'fixture-b',episodes}});usePlayerStore.setState({episodes:episodes.map((url,i)=>({url,title:`第${i+2}集`})),status:null,loadedVideoUrl:null});}}/>
   <StyledButton text="模拟电影" accessibilityLabel="probe-movie" onPress={()=>{const url='http://127.0.0.1:8765/hls/index.m3u8?movie=1';useDetailStore.setState({detail:{id:2,title:'模拟电影',year:'2024',type_name:'科幻片',poster:'',source:'fixture',source_name:'授权模拟源',episodes:[url],episodes_titles:['正片']}});usePlayerStore.setState({episodes:[{url,title:'正片'}],currentEpisodeIndex:0,initialPosition:0,status:null,loadedVideoUrl:null,shouldPlay:true});}}/>
   <StyledButton text="自动下一集" accessibilityLabel="probe-end" onPress={()=>void ref.current?.setPositionAsync(599000)}/>
   <StyledButton text="下一集" accessibilityLabel="probe-next" onPress={()=>p.playEpisode(p.currentEpisodeIndex?0:1)}/>
  </View>
 </View>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#000'},badge:{position:'absolute',top:8,left:8,color:'#fff',fontSize:13,backgroundColor:'#111'},message:{position:'absolute',top:95,left:8,color:'#fff',fontSize:16},actions:{position:'absolute',top:38,left:8,right:8,flexDirection:'row',flexWrap:'wrap',gap:4}});
