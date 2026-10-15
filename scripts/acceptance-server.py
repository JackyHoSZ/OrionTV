"""Runner-only fixtures and read-only HTTPS VPS relay. Credentials never enter the APK.

The relay is explicit: native client -> adb reverse -> runner -> existing VPS.
It forwards only query APIs, strips provider URLs, and logs counts/status, not bodies.
"""
import importlib.util,json,os,re,time,urllib.parse,urllib.request,urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer
spec=importlib.util.spec_from_file_location('fixture','scripts/danmaku-fixture-server.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
OUT=Path('test-results/acceptance');OUT.mkdir(parents=True,exist_ok=True)
TOKEN=os.environ.get('ORION_ACCEPTANCE_DANMU_TOKEN','')
state={'count':10000,'commentStatus':200}
def event(**values):
 with (OUT/'requests.jsonl').open('a') as f:f.write(json.dumps({'time':time.time(),**values},ensure_ascii=False)+'\n')
def selected(item,keys):return {k:item[k] for k in keys if k in item}
def sanitize(data):
 result=selected(data,['success','errorCode','isMatched','videoDuration'])
 if 'matches' in data:result['matches']=[selected(x,['animeId','animeTitle','episodeId','episodeTitle','shift']) for x in data['matches']]
 if 'animes' in data:result['animes']=[selected(x,['animeId','animeTitle','source','typeDescription']) for x in data['animes']]
 if 'bangumi' in data:result['bangumi']={'episodes':[selected(x,['episodeId','episodeTitle','episodeNumber']) for x in data['bangumi'].get('episodes',[])]}
 if 'comments' in data:result['comments']=[{'cid':x.get('cid',i),'p':','.join(str(x.get('p','')).split(',')[:3]),'m':x.get('m','')} for i,x in enumerate(data['comments'])]
 return result
class Handler(base.Handler):
 def reply(self,data,status=200):
  p=urllib.parse.urlsplit(self.path).path
  event(operation=p,status=status,comments=len(data.get('comments',[])) if isinstance(data,dict) else None)
  body=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers()
  try:self.wfile.write(body)
  except (BrokenPipeError,ConnectionResetError):pass
 def real(self,payload=None):
  start=time.monotonic();part=self.path.removeprefix('/real/api/v2')
  if not TOKEN:return self.reply({'success':False},503)
  path=urllib.parse.urlsplit(part).path
  if not (path in ['/match','/search/anime'] or re.fullmatch(r'/(?:comment|bangumi)/\d+',path)):return self.reply({},404)
  try:
   request=urllib.request.Request('https://danmu.vafa.eu.org/'+urllib.parse.quote(TOKEN,safe='')+'/api/v2'+part,
    json.dumps(payload).encode() if payload is not None else None,{'Content-Type':'application/json','Accept':'application/json'})
   with urllib.request.urlopen(request,timeout=65) as response:data=json.load(response);status=response.status
   clean=sanitize(data)
   event(operation='real-upstream',endpoint=path,status=status,elapsedSeconds=round(time.monotonic()-start,3),matches=len(clean.get('matches',[])),animes=len(clean.get('animes',[])),comments=len(clean.get('comments',[])))
   return self.reply(clean,status)
  except Exception as e:
   status=e.code if isinstance(e,urllib.error.HTTPError) else 502
   event(operation='real-upstream',endpoint=path,status=status,errorClass=type(e).__name__)
   return self.reply({'success':False},status)
 def do_POST(self):
  if self.path.startswith('/real/api/v2/'):
   return self.real(json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}'))
  if self.path=='/_acceptance-control':
   values=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
   state.update({k:values[k] for k in ['count','commentStatus'] if k in values});return self.reply({'fixture':True,**state})
  if self.path in ['/api/login','/api/logout']:return self.reply({'ok':True})
  return super().do_POST()
 def do_GET(self):
  parsed=urllib.parse.urlsplit(self.path);p=parsed.path
  if p.startswith('/real/api/v2/'):return self.real()
  if p=='/api/server-config':return self.reply({'SiteName':'OrionTV Cloud Acceptance','StorageType':'localstorage'})
  if p=='/api/search/resources':return self.reply([{'key':'fixture','name':'Authorized synthetic video','api':'fixture'}])
  if p in ['/api/search/one','/api/search']:
   q=urllib.parse.parse_qs(parsed.query).get('q',['模拟剧第二季'])[0]
   return self.reply({'results':[{'id':1,'source':'fixture','source_name':'Authorized synthetic video','title':q,'year':'2024','type_name':'国产剧','season':2,'poster':'fixture','desc':'Generated synthetic media. No copyrighted programme is served.','episodes':['http://127.0.0.1:8765/hls/index.m3u8?episode=2','http://127.0.0.1:8765/hls/index.m3u8?episode=3'],'episodes_titles':['第2集','第3集']}]})
  if p=='/api/douban':return self.reply({'code':200,'message':'authorized fixture','list':[{'title':'模拟剧第二季','poster':'fixture','rate':'9.0','year':'2024'},{'title':'庆余年第二季','poster':'fixture','rate':'9.0','year':'2024'}]})
  if p=='/api/image-proxy':
   body=Path('assets/images/icon.png').read_bytes();self.send_response(200);self.send_header('Content-Type','image/png');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
  if p in ['/api/playrecords','/api/favorites']:return self.reply({})
  if p=='/api/searchhistory':return self.reply([])
  if p.startswith('/api/v2/comment/'):
   if state['commentStatus']!=200:return self.reply({'success':False},state['commentStatus'])
   count=state['count'];return self.reply({'success':True,'videoDuration':600,'comments':[{'cid':i,'p':f'{i*600/max(count,1)},1,16711935','m':f'Cloud danmaku {i:06d}'} for i in range(count)]})
  return super().do_GET()
ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
