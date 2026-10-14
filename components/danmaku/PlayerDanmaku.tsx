import React,{memo,useEffect,useMemo} from 'react';
import {Platform} from 'react-native';
import usePlayerStore from '@/stores/playerStore';
import useDetailStore from '@/stores/detailStore';
import {useDanmakuStore} from '@/stores/danmakuStore';
import {playbackMedia} from '@/services/danmaku/media';
import {mediaKey,sourceKey} from '@/services/danmaku/matching';
import {DanmakuOverlay} from './DanmakuOverlay';

/** Isolated subscription: comment loading never rerenders the native video component. */
export const PlayerDanmaku=memo(function PlayerDanmaku({onActiveCount}:{onActiveCount?:(count:number)=>void}){
 const detail=useDetailStore(s=>s.detail);
 const index=usePlayerStore(s=>s.currentEpisodeIndex);
 const status=usePlayerStore(s=>s.status);
 const loadedVideoUrl=usePlayerStore(s=>s.loadedVideoUrl);
 const comments=useDanmakuStore(s=>s.comments);
 const settings=useDanmakuStore(s=>s.settings);
 const mediaOffset=useDanmakuStore(s=>s.mediaOffset);
 const loaded=status?.isLoaded;
 const duration=loaded?status.durationMillis:undefined;
 const media=useMemo(()=>detail&&index>=0&&loaded&&loadedVideoUrl===detail.episodes[index]
  ?playbackMedia(detail,index,duration?duration/1000:undefined):null,[detail,index,loaded,loadedVideoUrl,duration]);
 const identity=media?mediaKey(media)+sourceKey(media):'';
 const display=useMemo(()=>({...settings,offset:settings.offset+mediaOffset}),[settings,mediaOffset]);
 useEffect(()=>{
  if(Platform.OS!=='android'||!Platform.isTV)return;
  if(media)void useDanmakuStore.getState().bind(media);
  else useDanmakuStore.getState().clear();
  return()=>useDanmakuStore.getState().clear();
 },[media]);
 if(Platform.OS!=='android'||!Platform.isTV||!media)return null;
 return <DanmakuOverlay comments={comments} settings={display} status={status} identity={identity} onActiveCount={onActiveCount}/>;
});
