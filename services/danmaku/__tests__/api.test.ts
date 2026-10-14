import { apiRoot, DanmakuAPI, parseComments } from '../api';
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body } as Response);
const fetcher = (fn: any) => fn as typeof fetch;
describe('danmu_api protocol', () => {
  test('root supports separated and already embedded ordinary token', () => {
    for (const base of ['https://example.org', 'https://example.org/key/', 'https://example.org/key/api/v2/']) expect(apiRoot(base, 'key')).toBe('https://example.org/key/api/v2');
    expect(apiRoot('https://example.org', 'a/b')).toBe('https://example.org/a%2Fb/api/v2');
    expect(() => apiRoot('https://user:secret@example.org')).toThrow();
    expect(() => apiRoot('file:///tmp')).toThrow();
  });
  test('normalizes time, modes, colors, invalid comments, empty and large payloads', () => {
    const parsed = parseComments({ videoDuration: 100, comments: [
      { p: '2.5,1,255,qq', m: '蓝色' }, { p: '1,5,16777215,qq', m: '顶部' },
      { p: '3,4,16711680,qq', m: '底部' }, { p: 'NaN,1,0,x', m: 'bad' }, { p: '0,1,0,x', m: '' },
    ] });
    expect(parsed.comments.map(c => [c.time,c.mode,c.color])).toEqual([[1,'top','#ffffff'],[2.5,'scroll','#0000ff'],[3,'bottom','#ff0000']]);
    expect(parsed.duration).toBe(100);
    expect(parseComments({comments:[]}).comments).toEqual([]);
    expect(() => parseComments({comments:'bad'})).toThrow();
    expect(() => parseComments({success:false,errorCode:403,comments:[]})).toThrow();
    expect(parseComments({ comments: Array.from({length:10000},(_,i)=>({p:`${i/10},1,16777215,x`,m:'弹幕'+i})) }).comments).toHaveLength(10000);
  });
  test.each([401,403,500])('HTTP %s is safe and never contains address/token', async status => {
    const f = jest.fn(async()=>response({},status));
    const api = new DanmakuAPI('https://example.org','private-value',100,fetcher(f));
    await expect(api.search('test')).rejects.toMatchObject({ code: 'HTTP_'+status });
    expect(f).toHaveBeenCalledTimes(1);
  });
  test('invalid JSON and invalid success shape are rejected', async()=>{
    const bad = {ok:true,status:200,json:async()=>{throw new SyntaxError('secret');}};
    await expect(new DanmakuAPI('https://example.org','',100,fetcher(async()=>bad)).search('test')).rejects.toMatchObject({code:'JSON'});
    await expect(new DanmakuAPI('https://example.org','',100,fetcher(async()=>response({success:true}))).search('test')).rejects.toMatchObject({code:'FORMAT'});
  });
  test('episode lookup uses the Dandan animeId instead of a vendor-specific string bangumiId',async()=>{
    const f=jest.fn(async()=>response({success:true,bangumi:{episodes:[{episodeId:11161,episodeTitle:'【qq】 第2集',episodeNumber:'2'}]}}));
    const api=new DanmakuAPI('https://example.org','',100,fetcher(f));
    await expect(api.episodes({animeId:2125916,bangumiId:'mzc002002kqssyu',animeTitle:'庆余年第二季'})).resolves.toHaveLength(1);
    expect(f).toHaveBeenCalledWith('https://example.org/api/v2/bangumi/2125916',expect.anything());
  });
  test('deduplicates concurrent requests and caches a session response', async()=>{
    const f=jest.fn(async()=>response({success:true,animes:[]})); const api=new DanmakuAPI('https://example.org','',100,fetcher(f));
    await Promise.all([api.search('a'),api.search('a')]); await api.search('a'); expect(f).toHaveBeenCalledTimes(1);
  });
  test('a temporary semantic API error is retried by a later user request rather than cached',async()=>{
    const f=jest.fn().mockResolvedValueOnce(response({success:false,errorCode:500})).mockResolvedValueOnce(response({success:true,animes:[]}));
    const api=new DanmakuAPI('https://example.org','',100,fetcher(f));
    await expect(api.search('a')).rejects.toMatchObject({code:'FORMAT'});
    await expect(api.search('a')).resolves.toEqual([]);expect(f).toHaveBeenCalledTimes(2);
  });
  test('cancel one subscriber without cancelling a still-used request', async()=>{
    let resolve!: (r:Response)=>void;
    const f=jest.fn(()=>new Promise<Response>(r=>{resolve=r;}));const api=new DanmakuAPI('https://example.org','',500,fetcher(f));
    const c=new AbortController();const first=api.search('a',c.signal);const second=api.search('a');c.abort();
    await expect(first).rejects.toMatchObject({code:'CANCELLED'});resolve(response({success:true,animes:[]}));await expect(second).resolves.toEqual([]);
  });
  test('times out and aborts a hung transport', async()=>{
    const f=fetcher((_u:any,o:any)=>new Promise((_r,reject)=>o.signal.addEventListener('abort',()=>reject(new Error('AbortError')))));
    await expect(new DanmakuAPI('https://example.org','',15,f).search('a')).rejects.toMatchObject({code:'TIMEOUT'});
  });
  test('transient disconnection retries once and then fails independently of video',async()=>{
    const f=jest.fn(async()=>{throw new Error('network');});
    await expect(new DanmakuAPI('https://example.org','',100,fetcher(f)).search('a')).rejects.toMatchObject({code:'NETWORK'});expect(f).toHaveBeenCalledTimes(2);
  });
});
