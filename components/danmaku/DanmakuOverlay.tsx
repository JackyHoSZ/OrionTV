import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AVPlaybackStatus } from 'expo-av';
import { ActiveDanmaku, DanmakuScheduler, VideoClock } from '@/services/danmaku/timeline';
import { DanmakuComment, DanmakuSettings } from '@/services/danmaku/types';

interface Props { comments:DanmakuComment[];settings:DanmakuSettings;status:AVPlaybackStatus|null;identity:string;onActiveCount?:(count:number)=>void }
const Comment=memo(function Comment({entry,clock,settings,width}:{entry:ActiveDanmaku;clock:VideoClock;settings:DanmakuSettings;width:number}){
 const x=useRef(new Animated.Value(width)).current;
 useEffect(()=>{
  x.stopAnimation();
  if(entry.comment.mode!=='scroll')return;
  const position=clock.position-settings.offset;
  const fraction=Math.max(0,Math.min(1,(position-entry.start)/(entry.end-entry.start)));
  x.setValue(width-(width+entry.width)*fraction);
  if(clock.playing&&!clock.buffering){const animation=Animated.timing(x,{toValue:-entry.width,duration:Math.max(1,(entry.end-position)*1000/Math.max(0.1,clock.rate)),easing:Easing.linear,useNativeDriver:true});animation.start();return()=>animation.stop();}
 },[x,entry,clock,settings.offset,width]);
 return <Animated.Text numberOfLines={1} ellipsizeMode="clip" accessible={false}
  style={[styles.text,{top:entry.lane*settings.fontSize*1.4+8,fontSize:settings.fontSize,width:entry.width,
   opacity:settings.opacity,color:settings.useOriginalColor?entry.comment.color:settings.color,
   left:entry.comment.mode==='scroll'?0:(width-entry.width)/2,
   transform:entry.comment.mode==='scroll'?[{translateX:x}]:[]}]}>{entry.comment.text}</Animated.Text>;
});
export const DanmakuOverlay=memo(function DanmakuOverlay({comments,settings,status,identity,onActiveCount}:Props){
 const {width,height}=useWindowDimensions();
 const session=useMemo(()=>({identity,scheduler:new DanmakuScheduler(comments,settings,width,height)}),[comments,settings,width,height,identity]);
 const scheduler=session.scheduler;
 const [active,setActive]=useState<ActiveDanmaku[]>([]);
 const clock:VideoClock=useMemo(()=>status?.isLoaded?{position:status.positionMillis/1000,playing:status.isPlaying,buffering:status.isBuffering,rate:status.rate}:{position:0,playing:false,buffering:true,rate:1},[status]);
 useEffect(()=>{
  const next=settings.enabled?scheduler.update(clock):[];
  setActive(previous=>previous.length===next.length&&previous.every((e,i)=>e===next[i])?previous:next);
  onActiveCount?.(next.length);
 },[scheduler,clock,settings.enabled,onActiveCount]);
 useEffect(()=>()=>{scheduler.reset();},[scheduler]);
 if(!settings.enabled)return null;
 return <View pointerEvents="none" focusable={false} accessible={false} importantForAccessibility="no-hide-descendants" style={styles.overlay}>
  {active.map(entry=><Comment key={identity+':'+entry.comment.id} entry={entry} clock={clock} settings={settings} width={width}/>)}
 </View>;
});
const styles=StyleSheet.create({overlay:{...StyleSheet.absoluteFillObject,overflow:'hidden'},text:{position:'absolute',fontWeight:'bold',textShadowColor:'#000',textShadowOffset:{width:1,height:1},textShadowRadius:3}});
