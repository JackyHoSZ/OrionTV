import { DanmakuMatch, DanmakuMedia } from './types';
const digits: Record<string, number> = {零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
export function numberText(text: string): number | undefined {
  if (/^\d+$/.test(text)) return Number(text);
  if (text === '十') return 10;
  if (text.includes('十')) { const [a,b]=text.split('十'); return (digits[a] ?? 1)*10+(digits[b] ?? 0); }
  return digits[text];
}
export function seasonOf(title: string): number | undefined {
  const m=title.match(/第\s*([一二三四五六七八九十两\d]+)\s*季|\bS(\d{1,2})(?:E\d+)?\b|season\s*(\d+)/i);
  return m ? numberText(m[1] || m[2] || m[3]) : undefined;
}
export function episodeOf(title: string): number | undefined {
  if (/(特别|番外|花絮|预告|SP\b|OVA|\d+\s*[-~至]\s*\d+)/i.test(title)) return undefined;
  const m=title.match(/第\s*([一二三四五六七八九十两\d]+)\s*集|\bS\d{1,2}E(\d+)\b|(?:^|\s)EP?\s*(\d+)(?:\D|$)/i);
  return m ? numberText(m[1] || m[2] || m[3]) : /^\d+$/.test(title.trim()) ? Number(title) : undefined;
}
export function canonicalTitle(title: string): string {
  return title.toLowerCase().replace(/from\s+.*$/i,'').replace(/[【\[].*?[】\]]/g,'')
    .replace(/[（(](?:19|20)\d{2}[)）]/g,'').replace(/第\s*[一二三四五六七八九十两\d]+\s*季/g,'')
    .replace(/\bseason\s*\d+\b|\bS\d{1,2}(?:E\d+)?\b/gi,'').replace(/[\s.·_\-:：]/g,'').trim();
}
export function matchFileName(media: DanmakuMedia): string | null {
  if (!media.title.trim()) return null;
  if (!media.movie && (!media.episode || (media.episodeTitle && episodeOf(media.episodeTitle) === undefined))) return null;
  const year=/^(19|20)\d{2}$/.test(media.year || '') ? `(${media.year})` : '';
  // Explicit season in the title is preserved as well as Sxx syntax for danmu_api.
  return `${media.title}${year}${media.movie ? '' : ` S${String(media.season || 1).padStart(2,'0')}E${String(media.episode).padStart(2,'0')}`}`;
}
export function reliableMatch(media: DanmakuMedia, matches: DanmakuMatch[]): DanmakuMatch | null {
  const wanted=canonicalTitle(media.title);
  const candidates=matches.filter(m=>{
    if (!wanted || ![wanted, media.englishTitle && canonicalTitle(media.englishTitle)].includes(canonicalTitle(m.animeTitle))) return false;
    const year=m.animeTitle.match(/[（(\[]((?:19|20)\d{2})[)）\]]/)?.[1];
    if (media.year && year && media.year !== year) return false;
    const season=seasonOf(m.animeTitle);
    if (!media.movie && media.season && media.season > 1 && season !== media.season) return false;
    if (!media.movie && (!media.season || media.season === 1) && season && season !== 1) return false;
    if (!media.movie && episodeOf(m.episodeTitle) !== media.episode) return false;
    return true;
  });
  // Multiple plausible sources/years are not silently resolved to the first item.
  return candidates.length === 1 ? candidates[0] : null;
}
export function mediaKey(media: DanmakuMedia): string {
  // A known episode number survives differing source labels such as 第2集 / 第二集.
  const label=media.movie?'':media.episode!==undefined?'':(media.episodeTitle||'').replace(/\s/g,'').toLowerCase();
  return JSON.stringify([canonicalTitle(media.title), media.year || '', media.movie ? 'movie' : 'series', media.movie?'':media.season ?? '?', media.movie?'':media.episode ?? '?', label]);
}
export function sourceKey(media: DanmakuMedia): string { return JSON.stringify([media.source, media.sourceId]); }
