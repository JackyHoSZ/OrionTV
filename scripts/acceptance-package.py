"""Always retain failed-run diagnostics, but never upload an artifact containing the query secret."""
import hashlib,json,os,subprocess,urllib.parse
from pathlib import Path
out=Path('test-results/acceptance');out.mkdir(parents=True,exist_ok=True)
token=os.environ.get('ORION_ACCEPTANCE_DANMU_TOKEN','')
needles=[s.encode() for s in [token,urllib.parse.quote(token,safe='')] if s]
for folder in [out,Path('delivery')]:
 for p in folder.rglob('*'):
  if p.is_file():assert not any(n in p.read_bytes() for n in needles),'Artifact credential scan failed'
videos=[]
for video in out.glob('*.mp4'):
 result=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,r_frame_rate','-of','json',str(video)]))
 videos.append({'file':video.name,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),**result})
 duration=float(result['format']['duration'])
 for index,second in enumerate([min(10,duration/4),duration/2,max(0,duration-5)]):
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(second),'-i',str(video),'-frames:v','1',str(out/(video.stem+f'-preview-{index}.jpg'))],check=True)
(out/'videos.json').write_text(json.dumps(videos,indent=2))
(out/'credential-scan.json').write_text(json.dumps({'scanned':True,'secretOccurrences':0,'includesDeliveryAPK':True}))
report=json.loads((out/'report.json').read_text()) if (out/'report.json').exists() else {'passed':False,'checks':[]}
lines=['# OrionTV production APK cloud acceptance',f'Run: https://github.com/{os.environ["GITHUB_REPOSITORY"]}/actions/runs/{os.environ["GITHUB_RUN_ID"]}',
 f'Source: {os.environ["GITHUB_SHA"]}',f'Overall runtime assertions passed: {report["passed"]}',
 '','This installs the signed production universal APK from delivery/, with E2E route disabled.',
 'Android TV API29 x86 KVM, synthetic H.264/AAC/HLS video; no commercial programme footage.',
 'The VPS query secret is held by a runner-only HTTPS relay. Direct native authenticated VPS TLS and D5X are pending.',
 'Previous successful run 38650229312 supplies 122 unit tests and the complete specialized native regression; not rerun unnecessarily.',
 '','| Runtime check | Passed |','| --- | --- |']
lines += [f'| {x["name"]} | {x["passed"]} |' for x in report['checks']]
lines+=['','## ADB screen recordings (uncut files; up to 180 seconds each)']
lines += [f'- {v["file"]}: {float(v["format"]["duration"]):.1f} seconds' for v in videos]
lines+=['','## Still requires Dangbei D5X','ARM decoder and GPU composition, physical remote, direct home-network/VPS HTTPS, extended playback/thermal behavior and audio synchronization.',
 'No MoonTVPlus, Cloudflare, D1, VPS configuration or production viewing records were changed.']
(out/'REPORT.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({'reportPassed':report['passed'],'videos':len(videos),'credentialOccurrences':0}))
