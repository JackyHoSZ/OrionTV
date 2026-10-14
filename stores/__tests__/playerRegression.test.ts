import usePlayerStore from '../playerStore';
import useDetailStore from '../detailStore';
import {PlayRecordManager,PlayerSettingsManager} from '@/services/storage';
import {storageConfig} from '@/services/storageConfig';
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-toast-message',()=>({show:jest.fn()}));
const detail={id:1,title:'测试剧第二季',year:'2024',source:'fixture',source_name:'模拟源',poster:'',episodes:['a','b'],episodes_titles:['第12集','第13集']};
beforeEach(()=>{usePlayerStore.getState().reset();storageConfig.setStorageType('localstorage');useDetailStore.setState({detail,searchResults:[detail]});});
test('original loadVideo restores record position, playback rate and actual episode labels',async()=>{
 await PlayRecordManager.save('fixture','1',{title:detail.title,cover:'',index:1,total_episodes:2,play_time:42,total_time:600,source_name:'模拟源',year:'2024'});
 await PlayerSettingsManager.save('fixture','1',{playbackRate:1.5});
 await usePlayerStore.getState().loadVideo({source:'fixture',id:'1',title:detail.title,episodeIndex:0});
 expect(usePlayerStore.getState()).toMatchObject({initialPosition:42000,playbackRate:1.5,currentEpisodeIndex:0,shouldPlay:true});
 expect(usePlayerStore.getState().episodes[0].title).toBe('第12集');
});
test('native finish and configured outro still advance via the original episode method',()=>{
 const status={isLoaded:true,isPlaying:true,shouldPlay:true,positionMillis:600000,durationMillis:600000,rate:1,isBuffering:false,didJustFinish:true} as const;
 useDetailStore.setState({detail:null});
 usePlayerStore.setState({episodes:detail.episodes.map((url,i)=>({url,title:detail.episodes_titles[i]})),currentEpisodeIndex:0});
 usePlayerStore.getState().handlePlaybackStatusUpdate(status as any);
 expect(usePlayerStore.getState().currentEpisodeIndex).toBe(1);
 usePlayerStore.setState({currentEpisodeIndex:0,outroStartTime:10000});
 usePlayerStore.getState().handlePlaybackStatusUpdate({...status,positionMillis:591000,didJustFinish:false} as any);
 expect(usePlayerStore.getState().currentEpisodeIndex).toBe(1);
});
