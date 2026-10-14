import {useDanmakuStore} from '../danmakuStore';
import {DanmakuMedia} from '@/services/danmaku/types';
const mockComments=jest.fn();
jest.mock('@/services/danmaku/api',()=>{
 const actual=jest.requireActual('@/services/danmaku/api');
 return {...actual,DanmakuAPI:jest.fn().mockImplementation(()=>({
  match:jest.fn(async(name:string)=>[{animeId:1,episodeId:name.includes('E02')?2:1,animeTitle:'测试剧(2024)',episodeTitle:name.includes('E02')?'第2集':'第1集'}]),
  comments:(...args:unknown[])=>mockComments(...args),search:jest.fn(async()=>[]),
 }))};
});
jest.mock('@/services/danmaku/storage',()=>{
 const defaults=jest.requireActual('@/services/danmaku/types').DEFAULT_DANMAKU_SETTINGS;const actual=jest.requireActual('@/services/danmaku/storage');return {...actual,DanmakuStorage:{
 loadSettings:async()=>({...defaults,apiUrl:'https://example.org',token:'test-only'}),
 getOffset:async()=>0,getMatch:async()=>null,saveMatch:jest.fn(),saveOffset:jest.fn(),saveSettings:jest.fn(),
 }};
});
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-secure-store',()=>({getItemAsync:jest.fn(),setItemAsync:jest.fn()}));
const media:DanmakuMedia={title:'测试剧',year:'2024',season:1,episode:1,episodeTitle:'第1集',movie:false,source:'fixture',sourceId:'1',duration:60};
test('real store rejects a late previous-episode payload and clears comments on exit',async()=>{
 let first!:(result:any)=>void;let second!:(result:any)=>void;
 mockComments.mockImplementation((id:number)=>new Promise(resolve=>{if(id===1)first=resolve;else second=resolve;}));
 const old=useDanmakuStore.getState().bind(media);
 for(let i=0;i<12&&!first;i++)await Promise.resolve();expect(first).toBeDefined();
 const current=useDanmakuStore.getState().bind({...media,episode:2,episodeTitle:'第2集'});
 for(let i=0;i<12&&!second;i++)await Promise.resolve();expect(second).toBeDefined();
 second({comments:[{id:'new',time:1,text:'第二集',mode:'scroll',color:'#fff'}],duration:60});await current;
 first({comments:[{id:'old',time:1,text:'第一集',mode:'scroll',color:'#fff'}],duration:60});await old;
 expect(useDanmakuStore.getState().comments[0].id).toBe('new');expect(useDanmakuStore.getState().match?.episodeId).toBe(2);
 useDanmakuStore.getState().clear();expect(useDanmakuStore.getState().comments).toEqual([]);
});
test('turning danmaku off cancels an in-flight load without affecting playback',async()=>{
 let finish!:(result:any)=>void;
 mockComments.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const load=useDanmakuStore.getState().bind(media);
 for(let i=0;i<12&&!finish;i++)await Promise.resolve();expect(finish).toBeDefined();
 await useDanmakuStore.getState().setSettings({enabled:false});
 expect(useDanmakuStore.getState().loading).toBe(false);
 finish({comments:[{id:'late',time:1,text:'迟到弹幕',mode:'scroll',color:'#ffffff'}],duration:60});await load;
 expect(useDanmakuStore.getState().comments).toEqual([]);
 useDanmakuStore.getState().clear();
});
test('concurrent settings edits merge after persistence rather than restoring stale fields',async()=>{
 await Promise.all([useDanmakuStore.getState().setSettings({fontSize:30}),useDanmakuStore.getState().setSettings({opacity:0.5})]);
 expect(useDanmakuStore.getState().settings).toMatchObject({fontSize:30,opacity:0.5});
});
