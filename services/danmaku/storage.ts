import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DEFAULT_DANMAKU_SETTINGS, DanmakuSettings, DanmakuMatch } from './types';

const SETTINGS='orion_danmaku_settings_v1';
const CONNECTION='orion_danmaku_connection_v1';
const MAPPINGS='orion_danmaku_mappings_v1';
const OFFSETS='orion_danmaku_offsets_v1';
let writes: Promise<void>=Promise.resolve();
function serial(task:()=>Promise<void>):Promise<void> {
 const own=writes.catch(()=>{}).then(task);writes=own;return own;
}
const clamp=(value:unknown,fallback:number,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
export function normalizeSettings(input: Partial<DanmakuSettings>):DanmakuSettings {
 const s={...DEFAULT_DANMAKU_SETTINGS,...input};
 return {...s,apiUrl:typeof s.apiUrl==='string'?s.apiUrl.slice(0,1024):'',token:typeof s.token==='string'?s.token.slice(0,512):'',
  fontSize:clamp(s.fontSize,26,16,40),opacity:clamp(s.opacity,0.75,0.1,1),travelSeconds:clamp(s.travelSeconds,8,4,16),
  area:clamp(s.area,0.5,0.25,1),maxOnScreen:Math.round(clamp(s.maxOnScreen,4,1,24)),
  perSecond:[0,1,2,4].includes(s.perSecond)?s.perSecond:2,offset:clamp(s.offset,0,-120,120),
  autoLoad:typeof s.autoLoad==='boolean'?s.autoLoad:true, enabled:typeof s.enabled==='boolean'?s.enabled:true,
  scroll:typeof s.scroll==='boolean'?s.scroll:true,top:typeof s.top==='boolean'?s.top:true,bottom:typeof s.bottom==='boolean'?s.bottom:true,
  deduplicate:typeof s.deduplicate==='boolean'?s.deduplicate:true,useOriginalColor:typeof s.useOriginalColor==='boolean'?s.useOriginalColor:true,
  color:/^#[0-9a-f]{6}$/i.test(s.color)?s.color:'#ffffff'};
}
async function readMap<T>(key:string):Promise<Record<string,T>> {
 const raw=await AsyncStorage.getItem(key);if(!raw)return {};
 try {const data=JSON.parse(raw);return data&&typeof data==='object'&&!Array.isArray(data)?data:{};}catch{return {};}
}
async function writeEntry<T>(key:string,identity:string,value:T):Promise<void> {
 return serial(async()=>{const map=await readMap<T>(key);delete map[identity];map[identity]=value;
  const entries=Object.entries(map).slice(-200);await AsyncStorage.setItem(key,JSON.stringify(Object.fromEntries(entries)));});
}
export const DanmakuStorage={
 async loadSettings():Promise<DanmakuSettings> {
  const [settings,secret]=await Promise.all([AsyncStorage.getItem(SETTINGS),SecureStore.getItemAsync(CONNECTION)]);
  let data={};let connection={};
  try{data=settings?JSON.parse(settings):{};}catch{}
  try{connection=secret?JSON.parse(secret):{};}catch{}
  return normalizeSettings({...data,...connection});
 },
 async saveSettings(settings:DanmakuSettings):Promise<void> {
  const {apiUrl,token,...display}=normalizeSettings(settings);
  return serial(async()=>{
   await SecureStore.setItemAsync(CONNECTION,JSON.stringify({apiUrl,token}));
   await AsyncStorage.setItem(SETTINGS,JSON.stringify(display));
  });
 },
 async getMatch(key:string):Promise<DanmakuMatch|null>{return (await readMap<DanmakuMatch>(MAPPINGS))[key]||null;},
 async saveMatch(key:string,match:DanmakuMatch){
  const {animeId,animeTitle,episodeId,episodeTitle,shift}=match;
  await writeEntry(MAPPINGS,key,{animeId,animeTitle,episodeId,episodeTitle,shift});
 },
 async getOffset(key:string):Promise<number>{const value=(await readMap<number>(OFFSETS))[key];return clamp(value,0,-120,120);},
 async saveOffset(key:string,offset:number){await writeEntry(OFFSETS,key,clamp(offset,0,-120,120));},
};
