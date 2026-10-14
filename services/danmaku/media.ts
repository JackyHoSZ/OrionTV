import { DanmakuMedia } from './types';
import { episodeOf, seasonOf } from './matching';
interface PlaybackMetadata {
 title:string;year?:string;source:string;id:string|number;type_name?:string;
 episodes:string[];episodes_titles?:string[];season?:number;english_title?:string;original_title?:string;
}
export function playbackMedia(detail:PlaybackMetadata,index:number,duration?:number):DanmakuMedia {
 const label=detail.episodes_titles?.[index] || `第${index+1}集`;
 const genre=detail.type_name || '';
 const movie=detail.episodes.length===1 && (/(电影|动作片|喜剧片|科幻片|爱情片|恐怖片|剧情片|战争片|惊悚片|movie|film)/i.test(genre) ||
  (!/(剧|动漫|综艺|series|show)/i.test(genre) && !seasonOf(detail.title) && (/^(正片|HD|BD|1080|720|高清)/i.test(label) || !detail.episodes_titles?.length)));
 const season=detail.season || seasonOf(detail.title);
 return {title:detail.title,englishTitle:detail.english_title || detail.original_title,year:detail.year,
  source:detail.source,sourceId:String(detail.id),movie,season,episode:movie?undefined:episodeOf(label),episodeTitle:label,duration};
}
