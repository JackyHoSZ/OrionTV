"""Credential-free API and authorized synthetic media for the cloud AVD only."""
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
import json,re,urllib.parse,time
video=Path('assets/danmaku-test.mp4')
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def reply(self,data,status=200):
  label=next((name for name in ['match','comment','bangumi','search'] if '/'+name in self.path),'other')
  with Path('test-results/emulator/fixture-requests.jsonl').open('a') as log:log.write(json.dumps({'time':time.time(),'operation':label,'status':status,'comments':len(data.get('comments',[]))})+'\n')
  body=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
  if self.path=='/api/v2/match':
   match=re.search(r'E(\d+)',body.get('fileName',''));number=int(match[1]) if match else 2
   return self.reply({'success':True,'isMatched':True,'matches':[{'animeId':1,'episodeId':number,'animeTitle':'模拟剧第二季(2024) from fixture','episodeTitle':f'第{number}集'}]})
  self.reply({},404)
 def do_GET(self):
  path=urllib.parse.urlsplit(self.path).path
  if path=='/health':return self.reply({'fixture':True})
  if path=='/video.mp4':
   size=video.stat().st_size;start=0;end=size-1;partial=self.headers.get('Range')
   if partial:
    m=re.fullmatch(r'bytes=(\d+)-(\d*)',partial)
    if not m:return self.reply({},416)
    start=int(m[1]);end=min(size-1,int(m[2]) if m[2] else size-1)
   self.send_response(206 if partial else 200);self.send_header('Content-Type','video/mp4');self.send_header('Accept-Ranges','bytes');self.send_header('Content-Length',str(end-start+1))
   if partial:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
   self.end_headers()
   try:
    with video.open('rb') as f:
     f.seek(start);remaining=end-start+1
     while remaining:
      data=f.read(min(65536,remaining))
      if not data:break
      self.wfile.write(data);remaining-=len(data)
   except (BrokenPipeError,ConnectionResetError):pass
   return
  if path.startswith('/api/v2/comment/'):
   n=int(path.rsplit('/',1)[1]);return self.reply({'success':True,'videoDuration':600,'comments':[{'cid':i,'p':f'{i/30},1,16777215,fixture','m':f'第{n}集 模拟弹幕 {i}'} for i in range(10000)]})
  if path=='/api/v2/search/anime':return self.reply({'success':True,'animes':[{'animeId':1,'animeTitle':'模拟剧第二季(2024) from fixture','source':'fixture'}]})
  if path=='/api/v2/bangumi/1':return self.reply({'success':True,'bangumi':{'episodes':[{'episodeId':n,'episodeTitle':f'第{n}集'} for n in [2,3]]}})
  self.reply({},404)
ThreadingHTTPServer(('0.0.0.0',8765),Handler).serve_forever()
