"""Cloud delivery only. Decode the personal signing key outside the artifact directory."""
from pathlib import Path
from datetime import datetime,timezone
import base64,hashlib,json,os,re,subprocess,zipfile
assert os.environ.get('EXPO_PUBLIC_DANMAKU_E2E')!='1','Refuse to deliver an enabled fixture build'
source=Path('android/app/build/outputs/apk/release/app-release.apk')
tools=Path(os.environ['ANDROID_HOME'])/'build-tools/34.0.0'
out=Path('delivery');out.mkdir(exist_ok=True)
build=os.environ['ORION_BUILD_NUMBER'];version=json.loads(Path('package.json').read_text())['version']
apk=out/f'OrionTV-Danmaku-dev-{version}-b{build}-arm.apk'
key=Path(os.environ['RUNNER_TEMP'])/'orion-danmaku-signing.p12'
key.write_bytes(base64.b64decode(os.environ['ORION_SIGNING_P12']));key.chmod(0o600)
try:
 subprocess.run([str(tools/'apksigner'),'sign','--ks',str(key),'--ks-pass','env:ORION_SIGNING_PASSWORD','--out',str(apk),str(source)],check=True)
finally:key.unlink(missing_ok=True)
verification=subprocess.check_output([str(tools/'apksigner'),'verify','--verbose','--print-certs',str(apk)],text=True)
(out/'signature.txt').write_text(verification)
badging=subprocess.check_output([str(tools/'aapt'),'dump','badging',str(apk)],text=True)
(out/'manifest.txt').write_text(badging)
package=re.search(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'",badging)
assert package and package[1]=='com.oriontv.danmaku.dev' and package[3]==version
assert 'application-debuggable' not in badging
with zipfile.ZipFile(apk) as z:abis=sorted({n.split('/')[1] for n in z.namelist() if n.startswith('lib/') and n.endswith('.so')})
assert set(abis)=={'armeabi-v7a','arm64-v8a'},abis
digest=hashlib.sha256(apk.read_bytes()).hexdigest()
metadata={'file':apk.name,'package':package[1],'version':package[3],'versionCode':int(package[2]),'build':build,'builtAt':datetime.now(timezone.utc).isoformat(),'bytes':apk.stat().st_size,'sha256':digest,'abis':abis,'fixtureEnabled':False,'signature':'stable personal key in GitHub Actions Secrets','hardwareVerified':False}
(out/'metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
(out/'SHA256SUMS.txt').write_text(digest+'  '+apk.name+'\n')
print(json.dumps(metadata,ensure_ascii=False))
