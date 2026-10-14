import { DanmakuAnime, DanmakuComment, DanmakuMatch } from './types';

export class DanmakuError extends Error {
  constructor(public code: string) {
    const messages: Record<string, string> = {
      CONFIG: '请检查弹幕服务器地址和普通查询 Token', TIMEOUT: '弹幕请求超时，请稍后重试',
      NETWORK: '弹幕服务暂时无法连接', JSON: '弹幕服务返回了异常 JSON',
      FORMAT: '弹幕服务返回格式不正确', CANCELLED: '弹幕请求已取消',
      HTTP_401: '弹幕查询 Token 无效或未填写', HTTP_403: '弹幕服务拒绝访问',
    };
    super(messages[code] || (/^HTTP_\d+$/.test(code) ? `弹幕服务 HTTP ${code.slice(5)}` : '弹幕请求失败'));
    this.name = 'DanmakuError';
  }
}

/** Accept a host, host/TOKEN, or host/TOKEN/api/v2; never append TOKEN twice. */
export function apiRoot(address: string, token = ''): string {
  let base = address.trim().replace(/\/+$/, '').replace(/\/api\/v2$/, '');
  if (!/^https?:\/\/[^\s/?#@]+(?:\/[^\s?#]*)?$/.test(base)) throw new DanmakuError('CONFIG');
  const clean = token.trim();
  if (clean) {
    const encoded = encodeURIComponent(clean);
    const last = base.slice(base.lastIndexOf('/') + 1);
    if (last !== encoded && last !== clean) base += '/' + encoded;
  }
  return base + '/api/v2';
}

function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DanmakuError('FORMAT');
  return value as Record<string, any>;
}
function successful(value: unknown) {
  const data = object(value);
  if (data.success === false || (data.errorCode && data.errorCode !== 0)) throw new DanmakuError('FORMAT');
  return data;
}
function validatePayload(path:string,value:unknown):void {
  const data=successful(value);
  if(path.startsWith('/comment/')&&!Array.isArray(data.comments))throw new DanmakuError('FORMAT');
  if(path.startsWith('/search/')&&!Array.isArray(data.animes))throw new DanmakuError('FORMAT');
  if(path==='/match'&&(typeof data.isMatched!=='boolean'||!Array.isArray(data.matches)))throw new DanmakuError('FORMAT');
  if(path.startsWith('/bangumi/')&&!Array.isArray(object(data.bangumi).episodes))throw new DanmakuError('FORMAT');
}
function episode(value: unknown): DanmakuMatch {
  const item = object(value);
  if (!Number.isSafeInteger(Number(item.episodeId)) || Number(item.episodeId) <= 0 || typeof item.episodeTitle !== 'string') throw new DanmakuError('FORMAT');
  return { ...item, episodeId: Number(item.episodeId), animeId: Number(item.animeId || 0),
    animeTitle: String(item.animeTitle || ''), episodeTitle: item.episodeTitle } as DanmakuMatch;
}
export function parseComments(value: unknown): { comments: DanmakuComment[]; duration: number } {
  const data = successful(value);
  if (!Array.isArray(data.comments)) throw new DanmakuError('FORMAT');
  const comments: DanmakuComment[] = [];
  // The renderer never mounts this full array. Bound payload work to prevent pathological inputs.
  data.comments.slice(0, 150000).forEach((raw: unknown, i: number) => {
    if (!raw || typeof raw !== 'object') return;
    const c = raw as Record<string, any>;
    const p = typeof c.p === 'string' ? c.p.split(',') : [];
    const time = Number(p[0] ?? c.t);
    const mode = Number(p[1] ?? c.mode ?? 1);
    const color = Number(p[2] ?? c.color ?? 16777215);
    const text = typeof c.m === 'string' ? c.m.trim() : '';
    if (!Number.isFinite(time) || time < 0 || time > 86400 || !text || text.length > 300 || ![1, 4, 5].includes(mode)) return;
    comments.push({ id: String(c.cid ?? i) + ':' + i, time, text,
      mode: mode === 4 ? 'bottom' : mode === 5 ? 'top' : 'scroll',
      color: '#' + (Number.isFinite(color) ? Math.floor(Math.max(0, Math.min(0xffffff, color))) : 0xffffff).toString(16).padStart(6, '0') });
  });
  comments.sort((a, b) => a.time - b.time);
  const duration = Number(data.videoDuration);
  return { comments, duration: Number.isFinite(duration) && duration > 0 ? duration : 0 };
}

interface Flight { controller: AbortController; promise: Promise<any>; users: number }
export class DanmakuAPI {
  private root: string;
  private cache = new Map<string, { expires: number; value: any }>();
  private flights = new Map<string, Flight>();
  constructor(address: string, token: string, private timeoutMs = 45000, private fetcher: typeof fetch = fetch) {
    this.root = apiRoot(address, token);
  }
  clearCache(){this.cache.clear();}
  private async perform(path: string, body: unknown, signal: AbortSignal): Promise<any> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      let timedOut = false;
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort);
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeoutMs);
      try {
        if (signal.aborted) throw new DanmakuError('CANCELLED');
        const response = await this.fetcher(this.root + path, {
          method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
          headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit',
        });
        if (!response.ok) throw new DanmakuError('HTTP_' + response.status);
        try { return await response.json(); } catch { throw new DanmakuError('JSON'); }
      } catch (error) {
        if (signal.aborted) throw new DanmakuError('CANCELLED');
        const safe = timedOut ? new DanmakuError('TIMEOUT') : error instanceof DanmakuError ? error : new DanmakuError('NETWORK');
        if (attempt === 0 && ['NETWORK', 'HTTP_502', 'HTTP_503', 'HTTP_504'].includes(safe.code)) continue;
        throw safe;
      } finally {
        clearTimeout(timer); signal.removeEventListener('abort', abort);
      }
    }
  }
  private request(path: string, body?: unknown, signal?: AbortSignal): Promise<any> {
    if (signal?.aborted) return Promise.reject(new DanmakuError('CANCELLED'));
    const key = path + JSON.stringify(body ?? null);
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.value);
    let flight = this.flights.get(key);
    if (!flight || flight.controller.signal.aborted) {
      const controller = new AbortController();
      flight = { controller, users: 0, promise: Promise.resolve() };
      const own = flight;
      own.promise = this.perform(path, body, controller.signal).then(value => {
        validatePayload(path,value); // Neither API errors nor malformed envelopes enter the success cache.
        this.cache.delete(key); this.cache.set(key, { value, expires: Date.now() + 600000 });
        while (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value!);
        // Keep session comment memory bounded independently of the number of metadata entries.
        while ([...this.cache.values()].reduce((n, item) => n + (Array.isArray(item.value?.comments) ? item.value.comments.length : 0), 0) > 100000) {
          this.cache.delete(this.cache.keys().next().value!);
        }
        return value;
      }).finally(() => { if (this.flights.get(key) === own) this.flights.delete(key); });
      this.flights.set(key, own);
    }
    const shared = flight;
    shared.users++;
    return new Promise((resolve, reject) => {
      let finished = false;
      const release = () => {
        if (finished) return false;
        finished = true; signal?.removeEventListener('abort', cancel); shared.users--;
        if (!shared.users) shared.controller.abort();
        return true;
      };
      const cancel = () => { if (release()) reject(new DanmakuError('CANCELLED')); };
      signal?.addEventListener('abort', cancel);
      shared.promise.then(value => { if (release()) resolve(value); }, error => { if (release()) reject(error); });
      if (signal?.aborted) cancel();
    });
  }
  async test(signal?: AbortSignal): Promise<void> { await this.search('连接测试', signal); }
  async match(fileName: string, signal?: AbortSignal): Promise<DanmakuMatch[]> {
    const data = successful(await this.request('/match', { fileName }, signal));
    if (typeof data.isMatched !== 'boolean' || !Array.isArray(data.matches)) throw new DanmakuError('FORMAT');
    return data.isMatched ? data.matches.map(episode) : [];
  }
  async search(keyword: string, signal?: AbortSignal): Promise<DanmakuAnime[]> {
    const data = successful(await this.request('/search/anime?keyword=' + encodeURIComponent(keyword), undefined, signal));
    if (!Array.isArray(data.animes)) throw new DanmakuError('FORMAT');
    return data.animes.map((v: unknown) => { const a = object(v);
      if (!Number.isSafeInteger(Number(a.animeId)) || typeof a.animeTitle !== 'string') throw new DanmakuError('FORMAT');
      return { ...a, animeId: Number(a.animeId) } as DanmakuAnime;
    });
  }
  async episodes(anime: DanmakuAnime, signal?: AbortSignal): Promise<DanmakuMatch[]> {
    const data = successful(await this.request('/bangumi/' + anime.animeId, undefined, signal));
    const bangumi = object(data.bangumi);
    if (!Array.isArray(bangumi.episodes)) throw new DanmakuError('FORMAT');
    return bangumi.episodes.map((v: unknown) => ({ ...episode(v), animeId: anime.animeId, animeTitle: anime.animeTitle }));
  }
  async searchEpisodes(keyword: string, signal?: AbortSignal): Promise<DanmakuAnime[]> {
    const data = successful(await this.request('/search/episodes?anime=' + encodeURIComponent(keyword), undefined, signal));
    if (!Array.isArray(data.animes)) throw new DanmakuError('FORMAT');
    return data.animes.map((v: unknown) => { const a = object(v);
      if (!Array.isArray(a.episodes)) throw new DanmakuError('FORMAT');
      if (!Number.isSafeInteger(Number(a.animeId)) || typeof a.animeTitle !== 'string') throw new DanmakuError('FORMAT');
      return { ...a, animeId: Number(a.animeId), animeTitle: a.animeTitle, episodes: a.episodes.map(episode) };
    });
  }
  async comments(id: number, signal?: AbortSignal) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new DanmakuError('FORMAT');
    return parseComments(await this.request('/comment/' + id + '?format=json&duration=true', undefined, signal));
  }
}
