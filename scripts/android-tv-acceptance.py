"""Production APK acceptance. No test route, JS state injection or patched native engine.
Only the independent UiAutomation inspector and real DPAD key events control the app.
"""
import hashlib,json,os,pathlib,re,shlex,subprocess,time,urllib.request,urllib.parse,xml.etree.ElementTree as ET
from PIL import Image,ImageChops
OUT=pathlib.Path('test-results/acceptance');OUT.mkdir(parents=True,exist_ok=True)
pathlib.Path('test-results/emulator').mkdir(parents=True,exist_ok=True)
PACKAGE='com.oriontv.danmaku.dev';checks=[];record=None;record_name=None
report={'passed':False,'hardware':'Android TV API29 x86 KVM; not Dangbei D5X','productionFixtureRouteEnabled':False,
 'reusedEvidence':{'run':38650229312,'unitTests':122,'nativeRegression':'pause/resume, seek, rates, mapping persistence, source offset, HLS, HTTP503, automatic episode'},
 'realAPITransport':'Native fetch -> credential-free runner relay via adb reverse -> HTTPS VPS. Token only in runner secret; native direct HTTPS with token is not claimed.',
 'checks':checks,'devicePending':['D5X ARM codec/GPU','physical remote key mapping','home LAN and direct VPS HTTPS','long playback/thermal/audio sync']}
def write(): (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,condition,**evidence):
 checks.append({'name':name,'passed':bool(condition),**evidence});write();print(name,json.dumps(checks[-1],ensure_ascii=False),flush=True)
 assert condition,name
def adb(*args,timeout=40):
 if args and args[0]=='shell':args=('shell',shlex.join(args[1:]))
 return subprocess.check_output(['adb',*args],timeout=timeout)
def keys(*codes,focus=None):
 args=['shell','am','instrument','-w','-e','keys',','.join(map(str,codes))]
 if focus:args+=['-e','focus',focus]
 result=adb(*args,'com.oriontv.danmaku.inspect/.Inspector')
 assert b'INSTRUMENTATION_CODE: -1' in result,result.decode()[:300]
def press(label):keys(23,focus=label);time.sleep(.5)
def type_text(label,value):
 result=adb('shell','am','instrument','-w','-e','focus',label,'-e','text',value,'com.oriontv.danmaku.inspect/.Inspector')
 assert b'INSTRUMENTATION_CODE: -1' in result,result.decode()[:300]
 time.sleep(.5)
def image(name):
 p=OUT/(name+'.png');p.write_bytes(adb('exec-out','screencap','-p'));return Image.open(p).convert('RGB')
def inspect(name,shot=True):
 result=adb('shell','am','instrument','-w','com.oriontv.danmaku.inspect/.Inspector')
 match=re.search(rb'INSTRUMENTATION_RESULT: xml=(.*?)\nINSTRUMENTATION_CODE:',result,re.S)
 assert match,result.decode()[:300]
 (OUT/(name+'.xml')).write_bytes(match[1]);root=ET.fromstring(match[1])
 if shot:image(name)
 return root,' '.join(n.get('content-desc','')+' '+n.get('text','') for n in root.iter('node'))
def wait(name,phrase,timeout=60):
 deadline=time.monotonic()+timeout
 while True:
  root,text=inspect(name)
  if phrase in text:return root,text
  assert time.monotonic()<deadline,'Timed out '+name+': '+text[:700]
  time.sleep(1)
def clock(name):
 keys(20);root,text=inspect(name)
 match=re.search(r'(\d+):(\d\d) / 10:00',text)
 assert match,'No loaded native playback clock: '+text[:700]
 return int(match[1])*60+int(match[2])
def overlay(im):
 # Fixture comments are magenta, synthetic video is neutral in the upper half.
 crop=im.crop((0,0,im.width,int(im.height*.48)))
 mask=Image.new('1',crop.size);pixels=[int(r>90 and b>80 and g<r*.55 and g<b*.55) for r,g,b in crop.getdata()];mask.putdata(pixels)
 return mask, sum(pixels)
def control(**values):
 data=json.dumps(values).encode();return json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8765/_acceptance-control',data,{'Content-Type':'application/json'})))
def start_record(name):
 global record,record_name
 record_name=name
 record=subprocess.Popen(['adb','shell','screenrecord','--size','1280x720','--bit-rate','2500000','--time-limit','180','/sdcard/'+name+'.mp4'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
def stop_record():
 global record
 if record is None:return
 pid=adb('shell','pidof','screenrecord').decode().strip()
 if pid:adb('shell','kill','-2',pid)
 try:record.wait(timeout=15)
 except subprocess.TimeoutExpired:record.terminate();record.wait(timeout=5)
 adb('pull','/sdcard/'+record_name+'.mp4',str(OUT/(record_name+'.mp4')),timeout=90)
 record=None
def panel():keys(20);press('danmaku-settings');wait('panel-current','播放弹幕设置')
def rematch(name,phrase):
 panel();press('danmaku-rematch');root,text=wait(name,phrase,timeout=100);return root,text
server=subprocess.Popen(['python3','scripts/acceptance-server.py'],stdout=subprocess.DEVNULL,stderr=open(OUT/'fixture-stderr.txt','w'))
try:
 time.sleep(1);assert server.poll() is None,'Acceptance server did not start'
 apk=next(pathlib.Path('delivery').glob('*.apk'));meta=json.loads(pathlib.Path('delivery/metadata.json').read_text())
 report['apk']={'file':apk.name,'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'versionCode':meta['versionCode'],'bytes':apk.stat().st_size}
 for package in ['com.android.vending','com.google.android.gms']:
  subprocess.run(['adb','shell','pm','disable-user','--user','0',package],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30)
 adb('reverse','tcp:8765','tcp:8765');adb('install','-r','-g','test-results/inspector/inspector.apk');adb('install','-r',str(apk),timeout=90);adb('logcat','-c')
 (OUT/'device.txt').write_bytes(adb('shell','getprop'))
 adb('shell','monkey','-p',PACKAGE,'-c','android.intent.category.LEANBACK_LAUNCHER','1');wait('01-launch','热门剧集',90)
 check('production-apk-launch',True,sha256=report['apk']['sha256'])
 adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','oriontv-danmaku://settings',PACKAGE)
 wait('02-settings','输入服务器地址');type_text('输入服务器地址','http://127.0.0.1:8765');press('保存设置')
 press('danmaku-global-settings');wait('03-global','全局弹幕设置')
 type_text('danmaku-api-address','http://127.0.0.1:8765');press('danmaku-test-connection');wait('04-connection','连接成功',90)
 press('danmaku-close');adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','oriontv-danmaku://',PACKAGE)
 wait('05-home','模拟剧第二季',90)
 check('production-home-catalog',True,backend='isolated authorized fixture; no production login/records')
 # Reposition by accessibility only; all activations and navigation are real DPAD events.
 keys(22,focus='热门剧集');root,_=inspect('06-home-right');right=[n.get('text') or n.get('content-desc') for n in root.iter('node') if n.get('focused')=='true']
 keys(21);root,_=inspect('07-home-left');left=[n.get('text') or n.get('content-desc') for n in root.iter('node') if n.get('focused')=='true']
 check('home-directional-remote',right!=left,right=right,left=left)
 press('模拟剧第二季');wait('08-detail','播放列表');press('第 1 集')
 t1=clock('09-player-start');time.sleep(2);t2=clock('10-player-advances')
 check('original-player-video-advances',t2>t1,beforeSeconds=t1,afterSeconds=t2)
 panel();wait('10a-comments-ready','10000 条',100);press('danmaku-close')
 start_record('01-continuous-player-demo')
 for attempt in range(8):
  a=image('11-scroll-a');time.sleep(.8);b=image('12-scroll-b');ma,ca=overlay(a);mb,cb=overlay(b)
  if ca>100 and cb>100 and ma.tobytes()!=mb.tobytes():break
  time.sleep(.5)
 check('visible-danmaku-scroll',ca>100 and cb>100 and ma.tobytes()!=mb.tobytes(),pixels=[ca,cb])
 keys(20);press('player-pause');time.sleep(1);p1=clock('13-pause');a=image('14-pause-frame-a');time.sleep(2);p2=clock('15-pause-stable');b=image('16-pause-frame-b')
 ma,ca=overlay(a);mb,cb=overlay(b)
 check('pause-video-and-danmaku',p1==p2 and ca>100 and ma.tobytes()==mb.tobytes(),beforeSeconds=p1,afterSeconds=p2,pixels=[ca,cb])
 press('player-pause');time.sleep(2);p3=clock('17-resume');check('resume-video',p3>p2,beforeSeconds=p2,afterSeconds=p3)
 keys(4);keys(22);time.sleep(1);seek=clock('18-seek-right');check('remote-fast-forward',seek>=p3+18,beforeSeconds=p3,afterSeconds=seek)
 # Speed button has no ID in upstream; it is five DPAD steps from the pause control.
 keys(22,22,22,22,focus='player-pause');root,text=inspect('19-speed-button');keys(23);wait('20-speed-panel','播放速度')
 press('2x');time.sleep(1);r1=clock('21-rate2-start');time.sleep(3);r2=clock('22-rate2-end');check('native-rate2-via-original-panel',r2-r1>=5,beforeSeconds=r1,afterSeconds=r2)
 panel();root,text=wait('23-mock-count','10000 条');check('mock-api-10000-loaded',True)
 press('danmaku-limit');root,text=wait('24-density','4 条');check('density-setting-native-panel',True)
 keys(22,focus='danmaku-rematch');root,_=inspect('25-panel-right');check('panel-dpad-right',any(n.get('focused')=='true' and n.get('content-desc')=='danmaku-manual' for n in root.iter('node')))
 keys(21);keys(19);root,_=inspect('26-panel-up');check('panel-dpad-up',any(n.get('focused')=='true' and n.get('content-desc')=='danmaku-close' for n in root.iter('node')))
 keys(20);root,_=inspect('27-panel-down');check('panel-dpad-down',any(n.get('focused')=='true' and n.get('content-desc') in ['danmaku-rematch','danmaku-manual','danmaku-auto'] for n in root.iter('node')))
 keys(4);root,_=inspect('28-back-focus');check('panel-back-and-focus-return',any(n.get('focused')=='true' and n.get('content-desc')=='danmaku-settings' for n in root.iter('node')))
 stop_record()
 control(count=0);rematch('29-empty','0 条');press('danmaku-close');e1=clock('30-empty-playing');time.sleep(2);e2=clock('31-empty-continues');check('empty-api-does-not-block-video',e2>e1)
 control(count=100000);rematch('32-large','100000 条');press('danmaku-close');large1=clock('33-large-playing');time.sleep(5);large2=clock('34-large-continues');check('large-100000-stable',large2>large1)
 (OUT/'large-meminfo.txt').write_bytes(adb('shell','dumpsys','meminfo',PACKAGE))
 # Cut the AVD's entire route to the fixture, including the adb reverse tunnel.
 panel();adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');adb('reverse','--remove','tcp:8765')
 press('danmaku-rematch');wait('35-disconnected','暂时无法连接',100);check('network-disconnection-safe-error',True,method='wifi/data disabled and adb reverse removed')
 check('network-disconnection-process-survives',bool(adb('shell','pidof',PACKAGE).strip()))
 adb('reverse','tcp:8765','tcp:8765');adb('shell','svc','wifi','enable');adb('shell','svc','data','enable');control(count=10000)
 press('danmaku-rematch');wait('36-network-recovered','10000 条',100);press('danmaku-close');rec1=clock('37-recovered-clock');time.sleep(2);rec2=clock('38-recovered-advances');check('network-recovery-video-and-api',rec2>rec1)
 # Switch only this isolated emulator's persisted connection to the secure runner relay.
 adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','oriontv-danmaku://settings',PACKAGE)
 wait('39-settings','danmaku-global-settings');press('danmaku-global-settings');type_text('danmaku-api-address','http://127.0.0.1:8765/real');press('danmaku-test-connection');wait('40-real-connection','连接成功',100);press('danmaku-close')
 adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','oriontv-danmaku://detail?q='+urllib.parse.quote('庆余年第二季'),PACKAGE)
 wait('41-real-metadata','播放列表',90);press('第 1 集');clock('42-real-player')
 start_record('02-real-vps-interface-demo');panel();root,text=inspect('43-real-auto-match')
 # Real programme duration differs from our legal synthetic clip; explicit manual choice is required.
 press('danmaku-manual');press('danmaku-search-go');wait('44-real-search','danmaku-anime-0',110)
 press('danmaku-anime-0');wait('45-real-episodes','danmaku-episode-1',100);press('danmaku-episode-1');wait('46-real-confirm','确认加载此弹幕来源');press('danmaku-confirm')
 root,text=wait('47-real-comments','当前：',110)
 count_match=re.search(r'（(\d+) 条）',text);count=int(count_match[1]) if count_match else 0
 check('real-vps-native-manual-search-episodes-comments',count>0,comments=count,transport='runner HTTPS relay',programme='庆余年第二季第2集',video='synthetic authorized clip; timing alignment not asserted')
 press('danmaku-close');v1=clock('48-real-playing');time.sleep(3);v2=clock('49-real-continues');check('real-vps-payload-does-not-block-player',v2>v1)
 stop_record()
 ops=[json.loads(x) for x in (OUT/'requests.jsonl').read_text().splitlines()]
 upstream=[x for x in ops if x['operation']=='real-upstream'];report['realVPS']=upstream
 check('real-vps-native-auto-match-request',any(x['endpoint']=='/match' and x['status']==200 and x.get('matches',0)>0 for x in upstream))
 logcat=adb('logcat','-d');check('no-app-fatal-exception',b'FATAL EXCEPTION' not in logcat and b'Fatal signal' not in logcat)
 report['passed']=True;write()
finally:
 stop_record()
 try:
  image('99-final-or-failure');(OUT/'logcat.txt').write_bytes(adb('logcat','-d'));(OUT/'meminfo.txt').write_bytes(adb('shell','dumpsys','meminfo',PACKAGE));(OUT/'gfxinfo.txt').write_bytes(adb('shell','dumpsys','gfxinfo',PACKAGE,'framestats'))
  inspect('99-final-hierarchy',False)
 except Exception:pass
 server.terminate();server.wait(timeout=5)
 # Artifact files are scanned independently of GitHub's console masking.
 secret=os.environ.get('ORION_ACCEPTANCE_DANMU_TOKEN','').encode()
 leaked=[p.name for p in OUT.rglob('*') if p.is_file() and secret and secret in p.read_bytes()]
 assert not leaked,'Credential found in acceptance artifact; upload must be blocked'
 (OUT/'credential-scan.json').write_text(json.dumps({'scanned':True,'secretOccurrences':0}))
 write()
