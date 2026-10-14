"""Real TV AVD validation against credential-free API fixtures and original AV controls."""
import json,pathlib,re,subprocess,time,urllib.request,xml.etree.ElementTree as ET
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
def snapshot(name):
 (OUT/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
 result=adb('shell','am','instrument','-w','com.oriontv.danmaku.inspect/.Inspector')
 (OUT/(name+'-inspection.txt')).write_bytes(result)
 assert b'INSTRUMENTATION_CODE: -1' in result,'Accessibility inspection failed'
 match=re.search(rb'INSTRUMENTATION_RESULT: xml=(.*?)\nINSTRUMENTATION_CODE:',result,re.S);assert match
 (OUT/(name+'.xml')).write_bytes(match[1]);root=ET.fromstring(match[1])
 text=' '.join(n.get('content-desc','')+' '+n.get('text','') for n in root.iter('node'))
 badge=re.search(r'PROBE loaded=\S+.*? loading=(?:true|false)',text);assert badge,text[:300]
 fields=dict(re.findall(r'(\w+)=(\S+)',badge[0]))
 parsed={k:(True if v=='true' else False if v=='false' else float(v)) for k,v in fields.items()}
 parsed['focus']=[n.get('content-desc') for n in root.iter('node') if n.get('focused')=='true']
 parsed['message']=next((n.get('content-desc')[15:] for n in root.iter('node') if n.get('content-desc','').startswith('DANMAKU_STATUS ')),'')
 (OUT/(name+'.json')).write_text(json.dumps(parsed,indent=2));print(name,parsed)
 return parsed
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
 while (not playing['loaded'] or playing['loading']) and time.monotonic()<deadline:
  time.sleep(2);playing=snapshot('01-playing')
 assert playing['loaded'] and playing['playing'] and playing['comments']==10000 and playing['match']==2 and 0<playing['active']<=4,playing
 press('player-pause');time.sleep(3)
 paused=snapshot('02-paused');assert not paused['playing'],paused
 time.sleep(2);stable=snapshot('03-paused-stable');assert abs(stable['position']-paused['position'])<200,(paused,stable)
 press('probe-forward');sought=snapshot('04-paused-seek');assert not sought['playing'] and sought['position']>=stable['position']+9000,(stable,sought)
 press('probe-back');rewound=snapshot('05-paused-rewind');assert abs(rewound['position']-stable['position'])<300,(stable,rewound)
 press('player-pause');resumed=snapshot('06-resumed');assert resumed['playing'],resumed
 press('probe-rate');rate=snapshot('07-rate');assert rate['rate']==2,rate
 press('danmaku-toggle');off=snapshot('08-off');assert off['playing'] and not off['enabled'] and off['active']==0,off
 press('danmaku-toggle');press('danmaku-density');density=snapshot('09-density');assert density['density']==4 and density['active']<=4,density
 press('probe-next');time.sleep(4);episode=snapshot('10-next-episode');assert episode['episode']==3 and episode['match']==3 and episode['playing'] and episode['position']<40000,episode
 (OUT/'result.json').write_text(json.dumps({'passed':True,'stage':'B','nativeVideo':True,'nativeAPI':True,'comments':10000,'pause':True,'resume':True,'seek':True,'rewind':True,'rate2':True,'density':True,'toggle':True,'episode':True,'hardware':'cloud Android TV API29 x86, not Dangbei D5X'},indent=2))
finally:
 (OUT/'failure-or-final.png').write_bytes(adb('exec-out','screencap','-p'));(OUT/'logcat.txt').write_bytes(adb('logcat','-d'))
 (OUT/'meminfo.txt').write_bytes(adb('shell','dumpsys','meminfo','com.oriontv.danmaku.dev'))
 server.terminate()
