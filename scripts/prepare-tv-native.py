"""Preserve upstream manifest, align only the dev build identity and TV orientation."""
import pathlib, xml.etree.ElementTree as ET
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
