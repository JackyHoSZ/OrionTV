import { create } from 'zustand';
import { DanmakuAPI, DanmakuError, apiRoot } from '@/services/danmaku/api';
import { DanmakuStorage, normalizeSettings } from '@/services/danmaku/storage';
import { LatestDanmakuRequest } from '@/services/danmaku/latestRequest';
import { matchFileName, mediaKey, sourceKey, reliableMatch } from '@/services/danmaku/matching';
import { DEFAULT_DANMAKU_SETTINGS, DanmakuSettings, DanmakuMedia, DanmakuComment, DanmakuMatch, DanmakuAnime } from '@/services/danmaku/types';

const latest=new LatestDanmakuRequest();
let client:DanmakuAPI|null=null;let connection='';let hydratePromise:Promise<void>|null=null;
let settingsWrites:Promise<void>=Promise.resolve();
function api(settings:DanmakuSettings):DanmakuAPI {
 const root=apiRoot(settings.apiUrl,settings.token);
 if(!client || connection!==root){client=new DanmakuAPI(settings.apiUrl,settings.token);connection=root;}
 return client;
}
function serverKey(settings:DanmakuSettings):string {
 // Opaque identity only, never a plaintext connection URL or credential in local mappings.
 let hash=2166136261;for(const c of apiRoot(settings.apiUrl,settings.token)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}
 return (hash>>>0).toString(16);
}
function savedKey(settings:DanmakuSettings,media:DanmakuMedia){return serverKey(settings)+':'+mediaKey(media);}
function offsetKey(settings:DanmakuSettings,media:DanmakuMedia){return savedKey(settings,media)+':'+sourceKey(media);}
function configured(s:DanmakuSettings){return !!s.apiUrl.trim();}
interface DanmakuState {
 settings:DanmakuSettings; hydrated:boolean; media:DanmakuMedia|null; comments:DanmakuComment[];
 match:DanmakuMatch|null; loading:boolean; settingsSaving:boolean; message:string; panelOpen:boolean; panelContext:'player'|'global'; mediaOffset:number;
 hydrate:()=>Promise<void>;setSettings:(patch:Partial<DanmakuSettings>)=>Promise<void>;
 bind:(media:DanmakuMedia)=>Promise<void>;reload:(automatic?:boolean)=>Promise<void>;
 selectMatch:(match:DanmakuMatch)=>Promise<void>;setMediaOffset:(value:number)=>Promise<void>;
 setPanelOpen:(value:boolean,context?:'player'|'global')=>void;rematch:()=>Promise<void>;clear:()=>void;search:(keyword:string,signal?:AbortSignal)=>Promise<DanmakuAnime[]>;
 episodes:(anime:DanmakuAnime,signal?:AbortSignal)=>Promise<DanmakuMatch[]>;testConnection:(signal?:AbortSignal)=>Promise<void>;
}
export const useDanmakuStore=create<DanmakuState>((set,get)=>({
 settings:{...DEFAULT_DANMAKU_SETTINGS},hydrated:false,media:null,comments:[],match:null,
 loading:false,settingsSaving:false,message:'配置弹幕服务器和普通查询 Token 后可自动加载',panelOpen:false,panelContext:'player',mediaOffset:0,
 hydrate:()=>{
  if(!hydratePromise)hydratePromise=(async()=>{
   try{set({settings:await DanmakuStorage.loadSettings(),hydrated:true});}
   catch{set({hydrated:true,message:'弹幕安全存储无法读取，请重新配置连接'});}
  })();return hydratePromise;
 },
 setSettings:patch=>{
  const change=settingsWrites.catch(()=>{}).then(async()=>{
  const before=get().settings;const settings=normalizeSettings({...before,...patch});
  if(patch.apiUrl!==undefined || patch.token!==undefined)apiRoot(settings.apiUrl,settings.token);
  const changedConnection=before.apiUrl!==settings.apiUrl||before.token!==settings.token;
  set({settingsSaving:true,...(!changedConnection?{settings}:{})});
  if(!settings.enabled){latest.cancel();set({loading:false});}
  try{await DanmakuStorage.saveSettings(settings);set({settings,settingsSaving:false});}
  catch{set({settings:before,settingsSaving:false,message:'弹幕设置保存失败，请重试'});throw new DanmakuError('CONFIG');}
  if(before.apiUrl!==settings.apiUrl || before.token!==settings.token){latest.cancel();client=null;set({comments:[],match:null});if(get().media)void get().bind(get().media!);}
  else if(!settings.enabled){latest.cancel();set({loading:false});}
  else if(settings.enabled && settings.autoLoad && !get().loading && !get().comments.length && get().media)void get().reload();
  });settingsWrites=change;return change;
 },
 bind:async media=>{
  latest.cancel();set({media,comments:[],match:null,mediaOffset:0,loading:false,message:''});
  const own=latest.start();
  await get().hydrate();
  if(!own.isCurrent())return;
  const settings=get().settings;
  if(!configured(settings)){if(own.isCurrent())set({message:'请先填写普通查询 Token 或完整弹幕 API 地址'});return;}
  let offset=0;try{offset=await DanmakuStorage.getOffset(offsetKey(settings,media));}catch{/* Display failure must never stop video or matching. */}
  if(!own.isCurrent())return;set({mediaOffset:offset});
  if(settings.autoLoad && settings.enabled)await get().reload(true);
 },
 reload:async(automatic=true)=>{
  const {media,settings}=get();if(!media)return;
  const own=latest.start();set({loading:true,message:'正在匹配弹幕',comments:[],match:null});
  try{
   const service=api(settings);const saved=await DanmakuStorage.getMatch(savedKey(settings,media));
   let selected:DanmakuMatch|null=null;
   let reusedManual=false;
   if(saved){
    // IDs can change after a server restart. Resolve saved title/source and episode again.
    const animes=await service.search(saved.animeTitle.replace(/from\s+.*$/i,'').replace(/[【\[].*?[】\]]/g,'').replace(/[（(](?:19|20)\d{2}[)）]/g,'').trim(),own.signal);
    const exact=animes.filter(a=>a.animeTitle===saved.animeTitle);
    const anime=exact.length===1?exact[0]:undefined;
    if(anime){const episodes=await service.episodes(anime,own.signal);const found=episodes.filter(e=>e.episodeTitle===saved.episodeTitle);if(found.length===1){selected=found[0];reusedManual=true;}}
   }
   if(!selected){const name=matchFileName(media);if(!name){if(own.isCurrent())set({loading:false,message:'季集信息不明确，请手动搜索选择弹幕'});return;}
    const matches=await service.match(name,own.signal);selected=reliableMatch(media,matches);
    if(!selected && media.englishTitle){const matches=await service.match(matchFileName({...media,title:media.englishTitle})||media.englishTitle,own.signal);selected=reliableMatch(media,matches);}
   }
   if(!selected){if(own.isCurrent())set({loading:false,message:'没有可靠的唯一匹配，请手动搜索选择'});return;}
   if(own.isCurrent())set({message:'正在下载弹幕'});
   const result=await service.comments(selected.episodeId,own.signal);
   if(!own.isCurrent())return;
   if(automatic && !reusedManual && media.duration && result.duration && Math.abs(media.duration-result.duration)/media.duration>0.2){
    set({loading:false,message:'弹幕与视频时长差异较大，请手动确认来源'});return;
   }
   set({comments:result.comments,match:selected,loading:false,message:result.comments.length?`已加载 ${result.comments.length} 条弹幕`:'当前来源没有弹幕'});
  }catch(error){if(own.isCurrent())set({loading:false,message:error instanceof DanmakuError?error.message:'弹幕加载失败，请稍后重试'});}
 },
 selectMatch:async match=>{
  const {media,settings}=get();if(!media)return;const own=latest.start();set({loading:true,message:'正在加载选定弹幕',comments:[],match:null});
  try{const result=await api(settings).comments(match.episodeId,own.signal);if(!own.isCurrent())return;
   await DanmakuStorage.saveMatch(savedKey(settings,media),match);if(!own.isCurrent())return;
   set({comments:result.comments,match,loading:false,message:result.comments.length?`已加载 ${result.comments.length} 条弹幕`:'该集没有弹幕'});
  }catch(error){if(own.isCurrent())set({loading:false,message:error instanceof DanmakuError?error.message:'选定弹幕加载失败'});}
 },
 setMediaOffset:async value=>{const {media,settings}=get();if(!media)return;const offset=Math.min(120,Math.max(-120,value));
  await DanmakuStorage.saveOffset(offsetKey(settings,media),offset);if(get().media===media)set({mediaOffset:offset});},
 setPanelOpen:(panelOpen,panelContext='player')=>set({panelOpen,panelContext}),
 rematch:async()=>{const {media,settings}=get();if(!media)return;latest.cancel();await DanmakuStorage.removeMatch(savedKey(settings,media));if(get().media!==media)return;api(settings).clearCache();await get().reload(true);},
 clear:()=>{latest.cancel();set({media:null,comments:[],match:null,loading:false,panelOpen:false,message:'',mediaOffset:0});},
 search:(keyword,signal)=>api(get().settings).search(keyword,signal),
 episodes:(anime,signal)=>api(get().settings).episodes(anime,signal),
 testConnection:async(signal)=>{await api(get().settings).test(signal);},
}));
