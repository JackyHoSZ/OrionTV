"""Cloud-only probe JS rebuild, reusing the already compiled unchanged native engine."""
import pathlib,zipfile,subprocess,os,base64
apk=pathlib.Path('artifacts/OrionTV-Danmaku-e2e.apk')
with zipfile.ZipFile(apk) as z:
 videos=[n for n in z.namelist() if n.endswith('.mp4')]
 assert len(videos)==1
 pathlib.Path('assets/danmaku-test.mp4').write_bytes(z.read(videos[0]))
subprocess.run(['yarn','expo','export','--platform','android','--output-dir','test-results/rebundle'],check=True)
bundles=list(pathlib.Path('test-results/rebundle/_expo/static/js/android').glob('*.js'))+list(pathlib.Path('test-results/rebundle/_expo/static/js/android').glob('*.hbc'))
assert len(bundles)==1,bundles
patched=apk.with_name('patched-unsigned.apk')
with zipfile.ZipFile(apk) as source,zipfile.ZipFile(patched,'w') as dest:
 for entry in source.infolist():
  if entry.filename.startswith('META-INF/'):continue
  dest.writestr(entry,bundles[0].read_bytes() if entry.filename=='assets/index.android.bundle' else source.read(entry.filename))
tools=pathlib.Path(os.environ.get('ANDROID_HOME','/usr/local/lib/android/sdk'))/'build-tools/34.0.0'
aligned=apk.with_name('patched-aligned.apk')
subprocess.run([str(tools/'zipalign'),'-f','4',str(patched),str(aligned)],check=True)
key=pathlib.Path(os.environ['RUNNER_TEMP'])/'orion-probe.p12';key.write_bytes(base64.b64decode(os.environ['ORION_SIGNING_P12']));key.chmod(0o600)
try:
 subprocess.run([str(tools/'apksigner'),'sign','--ks',str(key),'--ks-pass','env:ORION_SIGNING_PASSWORD','--out',str(apk),str(aligned)],check=True)
finally:key.unlink(missing_ok=True)
patched.unlink();aligned.unlink()
