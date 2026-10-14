import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {DanmakuStorage,normalizeSettings} from '../storage';
import {DEFAULT_DANMAKU_SETTINGS as defaults} from '../types';
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-secure-store',()=>{
 const data:Record<string,string>={};return {getItemAsync:jest.fn(async(k:string)=>data[k]||null),setItemAsync:jest.fn(async(k:string,v:string)=>{data[k]=v;})};
});
test('settings reload and connection/token are never written to plain AsyncStorage',async()=>{
 const settings={...defaults,apiUrl:'https://example.org/private-token',token:'private-token',perSecond:1,maxOnScreen:3};
 await DanmakuStorage.saveSettings(settings);expect(await DanmakuStorage.loadSettings()).toEqual(settings);
 const keys=await AsyncStorage.getAllKeys();const data=await AsyncStorage.multiGet(keys);
 expect(JSON.stringify(data)).not.toContain('private-token');expect(SecureStore.setItemAsync).toHaveBeenCalled();
});
test('manual match and per-source offset are independent, survive reload, and do not contain a provider URL',async()=>{
 await DanmakuStorage.saveMatch('film:season2:ep2',{animeId:1,animeTitle:'test',episodeId:2,episodeTitle:'第2集',url:'https://source/?secret'});
 expect(await DanmakuStorage.getMatch('film:season2:ep1')).toBeNull();expect(await DanmakuStorage.getMatch('film:season2:ep2')).toMatchObject({episodeId:2});
 await DanmakuStorage.saveOffset('film:source-a',2);await DanmakuStorage.saveOffset('film:source-b',-1);
 expect(await DanmakuStorage.getOffset('film:source-a')).toBe(2);expect(await DanmakuStorage.getOffset('film:source-b')).toBe(-1);
 expect(JSON.stringify(await AsyncStorage.multiGet(await AsyncStorage.getAllKeys()))).not.toContain('source/?secret');
});
test('malformed persisted settings are bounded, preventing unbounded density or animation values',()=>{
 expect(normalizeSettings({...defaults,maxOnScreen:999,fontSize:-5,opacity:99,perSecond:999})).toMatchObject({maxOnScreen:24,fontSize:16,opacity:1,perSecond:2});
});
