import {playbackMedia} from '../media';
const detail={title:'测试剧第二季',year:'2024',source:'fixture',id:1,type_name:'国产剧',episodes:['a','b'],episodes_titles:['第12集','第13集']};
test('native metadata uses real episode labels rather than array index',()=>expect(playbackMedia(detail,0,60)).toMatchObject({season:2,episode:12,duration:60,year:'2024',movie:false}));
test('merged and special episodes do not get an invented regular episode identity',()=>expect(playbackMedia({...detail,episodes_titles:['第1-2集']},0).episode).toBeUndefined());
test('movie genre and single stream are recognized without appending S01E01',()=>expect(playbackMedia({...detail,title:'流浪地球',type_name:'科幻片',episodes:['a'],episodes_titles:['正片']},0)).toMatchObject({movie:true,episode:undefined}));
test('missing labels fall back to index only for a known series',()=>expect(playbackMedia({...detail,episodes_titles:undefined},1).episode).toBe(2));
test('an unclassified single stream without labels requires manual selection, not an invented movie',()=>expect(playbackMedia({...detail,title:'未知作品',type_name:'',episodes:['a'],episodes_titles:undefined},0)).toMatchObject({movie:false,episode:undefined}));
test('剧情片 is a movie genre despite containing the character 剧',()=>expect(playbackMedia({...detail,title:'测试电影',type_name:'剧情片',episodes:['a'],episodes_titles:['正片']},0).movie).toBe(true));
