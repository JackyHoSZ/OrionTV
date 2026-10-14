import { canonicalTitle, episodeOf, seasonOf, matchFileName, reliableMatch, mediaKey, sourceKey } from '../matching';
import { DanmakuMedia, DanmakuMatch } from '../types';
const media: DanmakuMedia={title:'庆余年第二季',year:'2024',season:2,episode:2,episodeTitle:'第2集',movie:false,source:'a',sourceId:'1'};
const match: DanmakuMatch={animeId:1,episodeId:2,animeTitle:'庆余年第二季(2024)【电视剧】from 360',episodeTitle:'【qq】 第2集'};
describe('safe automatic identities',()=>{
 test('multi-season exact episode and year accepted',()=>{expect(reliableMatch(media,[match])).toEqual(match);expect(matchFileName(media)).toContain('S02E02');});
 test.each(['【qq】 第1集','【qq】 第10集','特别篇','第1-2集'])('wrong/special episode %s is not auto matched',episodeTitle=>{expect(reliableMatch(media,[{...match,episodeTitle}])).toBeNull();});
 test.each(['庆余年第一季(2024)','庆余年第二季(2019)','庆余年(2024)'])('wrong/unknown season or wrong year %s rejected',animeTitle=>expect(reliableMatch(media,[{...match,animeTitle}])).toBeNull());
 test('multiple possible results require manual selection',()=>expect(reliableMatch(media,[match,{...match,episodeId:3}])).toBeNull());
 test('single-episode movie matches without inventing an episode',()=>{const film={...media,title:'流浪地球',year:'2019',movie:true};const result={...match,animeTitle:'流浪地球(2019)【电影】',episodeTitle:'正片'};expect(reliableMatch(film,[result])).toEqual(result);expect(matchFileName(film)).toBe('流浪地球(2019)');});
 test('special or merged input requires manual selection',()=>{expect(matchFileName({...media,episodeTitle:'特别篇'})).toBeNull();expect(matchFileName({...media,episodeTitle:'第1-2集'})).toBeNull();});
 test('unusual starting episode and explicit native episode labels',()=>{expect(episodeOf('第 12 集')).toBe(12);expect(episodeOf('第十集')).toBe(10);expect(seasonOf('剧 Season 2')).toBe(2);expect(episodeOf('S03E09')).toBe(9);});
 test('manual mapping identity separates season/year/source without tying it to one URL',()=>{expect(mediaKey(media)).not.toBe(mediaKey({...media,season:1}));expect(mediaKey(media)).not.toBe(mediaKey({...media,year:'2019'}));expect(mediaKey(media)).toBe(mediaKey({...media,source:'b'}));expect(sourceKey(media)).not.toBe(sourceKey({...media,source:'b'}));});
 test('canonical title preserves the work identity',()=>expect(canonicalTitle(match.animeTitle)).toBe('庆余年'));
 test('a numeric movie title is not mistaken for its release year',()=>{
  const film={...media,title:'1917',year:'2019',movie:true};
  expect(reliableMatch(film,[{...match,animeTitle:'1917(2019)',episodeTitle:'正片'}])).not.toBeNull();
 });
 test('known episode identities survive alternate labels while special episodes stay distinct',()=>{
  expect(mediaKey(media)).toBe(mediaKey({...media,source:'b',episodeTitle:'第二集'}));
  expect(mediaKey(media)).not.toBe(mediaKey({...media,episode:10,episodeTitle:'第10集'}));
  expect(mediaKey({...media,episode:undefined,episodeTitle:'特别篇'})).not.toBe(mediaKey({...media,episode:undefined,episodeTitle:'花絮'}));
 });
 test('movie identity does not depend on source episode labels',()=>{
  expect(mediaKey({...media,movie:true,episodeTitle:'正片'})).toBe(mediaKey({...media,movie:true,season:undefined,episode:undefined,episodeTitle:'HD'}));
 });
});
