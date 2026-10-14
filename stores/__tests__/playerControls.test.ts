import usePlayerStore from '../playerStore';
import useDetailStore from '../detailStore';
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-toast-message',()=>({show:jest.fn()}));
const loaded={isLoaded:true,isPlaying:true,shouldPlay:true,positionMillis:8000,durationMillis:100000,rate:1,isBuffering:false,uri:'fixture'} as const;
beforeEach(()=>{usePlayerStore.getState().reset();useDetailStore.setState({detail:null});usePlayerStore.setState({status:loaded as any});});
test('pause intent changes before native call and survives a late playing callback',async()=>{
 let finish!:(value:any)=>void;
 const pauseAsync=jest.fn(()=>{expect(usePlayerStore.getState().shouldPlay).toBe(false);return new Promise(resolve=>{finish=resolve;});});
 usePlayerStore.setState({videoRef:{current:{pauseAsync} as any}});
 const pending=usePlayerStore.getState().togglePlayPause();
 usePlayerStore.getState().handlePlaybackStatusUpdate({...loaded,positionMillis:8500} as any);
 expect(usePlayerStore.getState().shouldPlay).toBe(false);finish({...loaded,isPlaying:false,shouldPlay:false});await pending;
 expect(pauseAsync).toHaveBeenCalledTimes(1);
});
test('rate intent changes before native call, so a status rerender cannot restore the old rate',async()=>{
 const setRateAsync=jest.fn(async()=>{expect(usePlayerStore.getState().playbackRate).toBe(2);return {...loaded,rate:2};});
 usePlayerStore.setState({videoRef:{current:{setRateAsync} as any}});await usePlayerStore.getState().setPlaybackRate(2);
 expect(setRateAsync).toHaveBeenCalledWith(2,true);expect(usePlayerStore.getState().playbackRate).toBe(2);
});
test('seek uses milliseconds and clamps to the actual duration',async()=>{
 const setPositionAsync=jest.fn(async()=>loaded);usePlayerStore.setState({videoRef:{current:{setPositionAsync} as any}});
 await usePlayerStore.getState().seek(-10000);expect(setPositionAsync).toHaveBeenLastCalledWith(0);
 await usePlayerStore.getState().seek(200000);expect(setPositionAsync).toHaveBeenLastCalledWith(100000);
});
test('changing episode clears old playback status and starts the new episode',async()=>{
 const replayAsync=jest.fn(async()=>loaded);usePlayerStore.setState({videoRef:{current:{replayAsync} as any},episodes:[{url:'a',title:'第12集'},{url:'b',title:'第13集'}],shouldPlay:false});
 await usePlayerStore.getState().playEpisode(1);expect(usePlayerStore.getState()).toMatchObject({status:null,shouldPlay:true,currentEpisodeIndex:1,initialPosition:0});
});
