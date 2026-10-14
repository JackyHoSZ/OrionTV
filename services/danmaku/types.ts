export type DanmakuMode = 'scroll' | 'top' | 'bottom';
export interface DanmakuComment { id: string; time: number; text: string; color: string; mode: DanmakuMode }
export interface DanmakuEpisode { episodeId: number; episodeTitle: string; episodeNumber?: string|number; url?: string }
export interface DanmakuAnime { animeId: number; bangumiId?: string|number; animeTitle: string; source?: string; typeDescription?: string; episodes?: DanmakuEpisode[] }
export interface DanmakuMatch extends DanmakuEpisode { animeId: number; animeTitle: string; shift?: number }
export interface DanmakuMedia {
  title: string; englishTitle?: string; year?: string; season?: number; episode?: number;
  episodeTitle?: string; movie: boolean; source: string; sourceId: string; duration?: number;
}
export interface DanmakuSettings {
  apiUrl: string; token: string; autoLoad: boolean; enabled: boolean; fontSize: number;
  opacity: number; travelSeconds: number; area: number; maxOnScreen: number;
  perSecond: number; scroll: boolean; top: boolean; bottom: boolean; offset: number;
  deduplicate: boolean; useOriginalColor: boolean; color: string;
}
export const DEFAULT_DANMAKU_SETTINGS: DanmakuSettings = {
  apiUrl: 'https://danmu.vafa.eu.org', token: '', autoLoad: true, enabled: true,
  fontSize: 26, opacity: 0.75, travelSeconds: 8, area: 0.5, maxOnScreen: 4,
  perSecond: 2, scroll: true, top: true, bottom: true, offset: 0, deduplicate: true,
  useOriginalColor: true, color: '#ffffff',
};
