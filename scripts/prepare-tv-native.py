"""Preserve upstream manifest, align only the dev build identity and TV orientation."""
import os, pathlib, xml.etree.ElementTree as ET
p=pathlib.Path('android/app/src/main/AndroidManifest.xml')
ns='http://schemas.android.com/apk/res/android'
ET.register_namespace('android',ns)
tree=ET.parse(p)
app=tree.getroot().find('application')
app.set('{'+ns+'}allowBackup','false')
for activity in app.findall('activity'):
    if activity.get('{'+ns+'}name')=='.MainActivity':
        activity.set('{'+ns+'}screenOrientation','landscape')
        for data in activity.findall('intent-filter/data'):
            if data.get('{'+ns+'}scheme')=='oriontv': data.set('{'+ns+'}scheme','oriontv-danmaku')
            if data.get('{'+ns+'}scheme')=='com.oriontv': data.set('{'+ns+'}scheme','com.oriontv.danmaku.dev')
tree.write(p,encoding='utf-8',xml_declaration=True)

# Keep local settings IO independent from the process-wide Android AsyncTask pool.
properties=pathlib.Path('android/gradle.properties')
value=properties.read_text()
if 'AsyncStorage_dedicatedExecutor=' not in value:value+='\nAsyncStorage_dedicatedExecutor=true\n'
properties.write_text(value)

# Old-architecture RN does not apply reactNativeArchitectures to prebuilt AAR libraries.
# Explicit packaging filters keep the user delivery ARM-only, without changing the engine.
if os.environ.get('ORION_ARM_ONLY')=='1':
    gradle=pathlib.Path('android/app/build.gradle')
    content=gradle.read_text()
    marker='// OrionTV ARM delivery ABI filters'
    if marker not in content:
        needle='defaultConfig {'
        assert content.count(needle)==1,'Expected one Android defaultConfig block'
        content=content.replace(needle,needle+'\n        '+marker+'\n        ndk { abiFilters "armeabi-v7a", "arm64-v8a" }',1)
        gradle.write_text(content)
