"""Real TV AVD validation against credential-free API fixtures and original AV controls."""
import os,json,pathlib,re,subprocess,time,urllib.request,xml.etree.ElementTree as ET
OUT=pathlib.Path('test-results/emulator');OUT.mkdir(parents=True,exist_ok=True)
for old in OUT.iterdir():
 if old.is_file():old.unlink()
def adb(*args):return subprocess.check_output(['adb',*args],timeout=45)
def keys(*codes,focus=None):
 args=['shell','am','instrument','-w','-e','keys',','.join(map(str,codes))]
 if focus:args+=['-e','focus',focus]
 result=adb(*args,'com.oriontv.danmaku.inspect/.Inspector')
 assert b'INSTRUMENTATION_CODE: -1' in result,'Remote injection/focus failed: '+result.decode()[:300]
def press(label):keys(23,focus=label);time.sleep(1)
def inspect(name,compact=False):
 args=['shell','am','instrument','-w']
 if compact:args+=['-e','compact','1']
 result=adb(*args,'com.oriontv.danmaku.inspect/.Inspector')
 (OUT/(name+'-inspection.txt')).write_bytes(result)
 assert b'INSTRUMENTATION_CODE: -1' in result,'Accessibility inspection failed'
 match=re.search(rb'INSTRUMENTATION_RESULT: xml=(.*?)\nINSTRUMENTATION_CODE:',result,re.S);assert match
 (OUT/(name+'.xml')).write_bytes(match[1]);root=ET.fromstring(match[1])
 text=' '.join(n.get('content-desc','')+' '+n.get('text','') for n in root.iter('node'))
 (OUT/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
 return root,text
def snapshot(name):
 root,text=inspect(name,compact=True)
 badge=re.search(r'PROBE loaded=\S+.*? loading=(?:true|false)',text)
 if not badge:return None
 fields=dict(re.findall(r'(\w+)=(\S+)',badge[0]))
 parsed={k:(True if v=='true' else False if v=='false' else v if k=='color' else float(v)) for k,v in fields.items()}
 parsed['capturedAt']=time.time()
 parsed['focus']=[n.get('content-desc') for n in root.iter('node') if n.get('focused')=='true']
 parsed['message']=next((n.get('content-desc')[15:] for n in root.iter('node') if n.get('content-desc','').startswith('DANMAKU_STATUS ')),'')
 (OUT/(name+'.json')).write_text(json.dumps(parsed,indent=2));print(name,parsed,flush=True)
 return parsed
def type_text(label,value):
 result=adb('shell','am','instrument','-w','-e','focus',label,'-e','text',value,'com.oriontv.danmaku.inspect/.Inspector')
 assert b'INSTRUMENTATION_CODE: -1' in result,result.decode()[:300]
 time.sleep(1)
def wait_panel(name,phrase,timeout=45):
 deadline=time.monotonic()+timeout
 root,text=inspect(name)
 while phrase not in text and time.monotonic()<deadline:
  time.sleep(1);root,text=inspect(name)
 assert phrase in text,text[:300]
 return root,text
def wait_state(name,predicate,timeout=60):
 deadline=time.monotonic()+timeout
 state=snapshot(name)
 while (state is None or not predicate(state)) and time.monotonic()<deadline:
  time.sleep(1);state=snapshot(name)
 assert state is not None and predicate(state),state
 return state
def wait_panel_setting(name,identifier,expected,timeout=45):
 deadline=time.monotonic()+timeout
 while True:
  root,text=inspect(name)
  status=next((n.get('text','') for n in root.iter('node') if n.get('content-desc')=='danmaku-panel-status'),'')
  target=next((n for n in root.iter('node') if n.get('content-desc')==identifier),None)
  value=' '.join(n.get('text','') for n in target.iter('node')) if target is not None else text
  if expected in value and '处理中' not in status:return
  assert time.monotonic()<deadline,(identifier,value,status)
  time.sleep(1)
server=subprocess.Popen(['python3','scripts/danmaku-fixture-server.py'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
try:
 time.sleep(1)
 assert server.poll() is None,'Fixture server exited'
 assert json.load(urllib.request.urlopen('http://127.0.0.1:8765/health'))['fixture']
 adb('reverse','tcp:8765','tcp:8765')
 adb('install','-r','-g','test-results/inspector/inspector.apk');adb('install','-r','artifacts/OrionTV-Danmaku-e2e.apk');adb('logcat','-c')
 adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','oriontv-danmaku://danmaku-test','com.oriontv.danmaku.dev');time.sleep(14)
 deadline=time.monotonic()+75
 playing=snapshot('01-playing')
 while (playing is None or not playing['loaded'] or playing['loading']) and time.monotonic()<deadline:
  time.sleep(2);playing=snapshot('01-playing')
 assert playing is not None and playing['loaded'] and playing['playing'] and playing['comments']==10000 and playing['match']==2 and 0<playing['active']<=4,playing
 press('player-pause');time.sleep(3)
 paused=wait_state('02-paused',lambda s:not s['intent'] and not s['playing'])
 time.sleep(2);stable=snapshot('03-paused-stable');assert abs(stable['position']-paused['position'])<200,(paused,stable)
 press('probe-forward');sought=wait_state('04-paused-seek',lambda s:not s['playing'] and s['position']>=stable['position']+9000)
 press('probe-back');rewound=wait_state('05-paused-rewind',lambda s:abs(s['position']-stable['position'])<300)
 press('player-pause');resumed=wait_state('06-resumed',lambda s:s['playing'])
 press('probe-rate');rate=wait_state('07-rate',lambda s:s['rate']==2)
 press('danmaku-toggle');off=wait_state('08-off',lambda s:s['playing'] and not s['enabled'] and s['active']==0 and not s['saving'])
 press('danmaku-toggle');wait_state('08a-on',lambda s:s['enabled'] and not s['saving'])
 press('danmaku-density');density=wait_state('09-density',lambda s:s['density']==4 and s['active']<=4)
 press('probe-next');time.sleep(4);episode=wait_state('10-next-episode',lambda s:s['episode']==3 and s['match']==3 and s['playing']);assert episode['position']<40000,episode
 press('probe-normal');wait_state('11-normal-rate',lambda s:s['rate']==1)
 press('danmaku-settings');wait_panel('12-settings-panel','播放弹幕设置')
 press('danmaku-font');wait_panel_setting('12a-font','danmaku-font','30')
 press('danmaku-opacity');wait_panel_setting('12b-opacity','danmaku-opacity','100%')
 press('danmaku-offset-plus');wait_panel_setting('12c-offset','offset-label','偏移：1.0 秒')
 press('danmaku-close');configured=wait_state('13-adjusted',lambda s:s['font']==30 and s['opacity']==1 and s['offset']==1 and not s['saving'])
 assert 'danmaku-settings' in configured['focus'],configured
 press('danmaku-settings');press('danmaku-manual');press('danmaku-search-go');wait_panel('14-search-results','danmaku-anime-0')
 press('danmaku-anime-0');wait_panel('15-episode-results','danmaku-episode-1')
 press('danmaku-episode-1');wait_panel('16-confirm','确认加载此弹幕来源')
 press('danmaku-confirm');wait_panel('17-manual-saved','danmaku-manual')
 press('danmaku-close');manual=wait_state('18-manual-loaded',lambda s:s['match']==3 and not s['loading'])
 before_restart=len((OUT/'fixture-requests.jsonl').read_text().splitlines())
 adb('shell','am','force-stop','com.oriontv.danmaku.dev')
 adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','oriontv-danmaku://danmaku-test?reuse=1&episode=3','com.oriontv.danmaku.dev');time.sleep(10)
 persistent=wait_state('19-restarted',lambda s:s['loaded'] and s['match']==3 and not s['loading'],timeout=90)
 assert persistent['font']==30 and persistent['opacity']==1 and persistent['offset']==1,persistent
 operations=[json.loads(line)['operation'] for line in (OUT/'fixture-requests.jsonl').read_text().splitlines()[before_restart:]]
 assert 'search' in operations and 'bangumi' in operations and 'match' not in operations,operations
 press('probe-global');wait_panel('20-global-panel','全局弹幕设置')
 press('danmaku-test-connection');wait_panel('21-connection','连接成功')
 type_text('danmaku-color-input','#ff6600');press('danmaku-color-save')
 wait_panel_setting('22-custom-color','danmaku-original-color','关（使用自选颜色）')
 press('danmaku-close');wait_state('23-custom-color-live',lambda s:s['color']=='ff6600' and not s['saving'])
 extended=os.environ.get('DANMAKU_STABILITY')=='1'
 if extended:
  press('probe-rate125');wait_state('24-rate125',lambda s:s['rate']==1.25)
  press('probe-rate150');wait_state('25-rate150',lambda s:s['rate']==1.5)
  press('probe-normal');wait_state('26-rate1',lambda s:s['rate']==1)
  press('probe-source');source=wait_state('27-source',lambda s:s['loaded'] and s['playing'] and s['match']==3 and s['offset']==0 and not s['loading'])
  def control(status):
   request=urllib.request.Request('http://127.0.0.1:8765/_control',json.dumps({'commentStatus':status}).encode(),{'Content-Type':'application/json'})
   assert json.load(urllib.request.urlopen(request))['fixture']
  control(503)
  press('danmaku-settings');press('danmaku-rematch');press('danmaku-close')
  error=wait_state('28-api-failure',lambda s:s['playing'] and not s['loading'] and s['comments']==0 and '503' in s['message'])
  time.sleep(2);continued=wait_state('29-video-continues',lambda s:s['playing'] and s['position']>error['position']+1000)
  control(200)
  press('danmaku-settings');press('danmaku-rematch');press('danmaku-close')
  wait_state('30-api-recovered',lambda s:s['playing'] and s['match']==3 and s['comments']==10000)
  press('probe-next');wait_state('31-episode2',lambda s:s['loaded'] and s['episode']==2 and s['match']==2 and s['playing'])
  press('probe-end');wait_state('32-auto-next',lambda s:s['loaded'] and s['episode']==3 and s['match']==3 and s['playing'] and s['position']<40000,timeout=90)
  press('probe-movie');wait_state('33-movie',lambda s:s['loaded'] and s['match']==4 and s['playing'] and s['comments']==10000)
 (OUT/'result.json').write_text(json.dumps({'passed':True,'stage':'D' if extended else 'C','rate125And150':extended,'sourceChange':extended,'apiFailureDoesNotBlockVideo':extended,'automaticNextEpisode':extended,'nativeMovieMatch':extended,'nativeVideo':True,'nativeAPI':True,'comments':10000,'pause':True,'resume':True,'seek':True,'rewind':True,'rate2':True,'density':True,'toggle':True,'episode':True,'panel':True,'manualMatch':True,'persistentSettings':True,'perSourceOffset':True,'focusReturn':True,'manualMappingReusedWithoutAutoMatch':True,'globalConnectionTest':True,'customColor':True,'hardware':'cloud Android TV API29 x86, not Dangbei D5X'},indent=2))
finally:
 (OUT/'failure-or-final.png').write_bytes(adb('exec-out','screencap','-p'));(OUT/'logcat.txt').write_bytes(adb('logcat','-d'))
 try:
  adb('root');time.sleep(1)
  pid=adb('shell','pidof','com.oriontv.danmaku.dev').decode().strip()
  if pid:
   adb('shell','kill','-3',pid);time.sleep(2)
   (OUT/'java-threads.txt').write_bytes(adb('shell','cat','/data/anr/*'))
 except Exception:pass
 (OUT/'gfxinfo.txt').write_bytes(adb('shell','dumpsys','gfxinfo','com.oriontv.danmaku.dev','framestats'))
 (OUT/'meminfo.txt').write_bytes(adb('shell','dumpsys','meminfo','com.oriontv.danmaku.dev'))
 server.terminate()
