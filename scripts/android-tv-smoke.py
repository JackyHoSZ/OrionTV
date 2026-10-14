"""Actual native video + remote input smoke test, run only on a cloud Android TV AVD."""
import json, pathlib, re, subprocess, time, xml.etree.ElementTree as ET

OUT = pathlib.Path('test-results/emulator')
OUT.mkdir(parents=True, exist_ok=True)

def adb(*args):
    return subprocess.check_output(['adb', *args])

def snapshot(name):
    adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml')
    data = adb('shell', 'cat', '/sdcard/window.xml')
    (OUT / (name + '.xml')).write_bytes(data)
    (OUT / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p'))
    nodes = ET.fromstring(data).iter('node')
    text = ' '.join(n.get('content-desc', '') + ' ' + n.get('text', '') for n in nodes)
    match = re.search(r'PROBE loaded=(true|false) playing=(true|false) position=(\d+)', text)
    assert match, 'Native playback status is missing: ' + text[:400]
    return dict(loaded=match[1] == 'true', playing=match[2] == 'true', position=int(match[3]))

try:
    adb('install', '-r', 'artifacts/OrionTV-Danmaku-e2e.apk')
    adb('logcat', '-c')
    adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'oriontv-danmaku://danmaku-test', 'com.oriontv.danmaku.dev')
    time.sleep(12)
    playing = snapshot('01-playing')
    assert playing['loaded'] and playing['playing'] and playing['position'] > 1000, playing
    adb('shell', 'input', 'keyevent', '23')
    time.sleep(1)
    paused = snapshot('02-paused')
    assert not paused['playing'], paused
    time.sleep(2)
    stable = snapshot('03-paused-stable')
    assert abs(stable['position'] - paused['position']) < 200, (paused, stable)
    adb('shell', 'input', 'keyevent', '23')
    time.sleep(2)
    resumed = snapshot('04-resumed')
    assert resumed['playing'] and resumed['position'] > stable['position'], resumed
    adb('shell', 'input', 'keyevent', '22')
    adb('shell', 'input', 'keyevent', '23')
    time.sleep(1)
    sought = snapshot('05-seek')
    assert sought['position'] >= resumed['position'] + 9000, sought
    (OUT / 'result.json').write_text(json.dumps({'passed': True, 'nativeVideo': True, 'pause': True, 'resume': True, 'remoteSeek': True, 'states': [playing, paused, stable, resumed, sought]}, indent=2))
finally:
    (OUT / 'logcat.txt').write_bytes(adb('logcat', '-d'))
