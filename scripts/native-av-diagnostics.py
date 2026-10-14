"""CI-only native trace points; never used when building the user APK."""
from pathlib import Path
base=Path('node_modules/expo-av/android/src/main/java/expo/modules/av')
p=base/'AVModule.kt';s=p.read_text()
for name,args in [('setStatusForVideo','tag: Int, status: ReadableArguments, promise: KotlinPromise'),('getStatusForVideo','tag: Int, promise: KotlinPromise')]:
 needle=f'AsyncFunction("{name}") {{ {args} ->'
 assert needle in s
 s=s.replace(needle,needle+f'\n      android.util.Log.i("OrionAvProbe", "{name} ENTER tag=$tag")')
p.write_text(s)
p=base/'ViewUtils.kt';s=p.read_text();needle='val videoWrapperView = moduleRegistry.getModule(UIManager::class.java).resolveView(viewTag) as VideoViewWrapper?'
assert needle in s;s=s.replace(needle,'android.util.Log.i("OrionAvProbe", "UI RESOLVE tag=$viewTag")\n      '+needle)
needle='callback.runWithVideoView(videoView)';s=s.replace(needle,needle+'\n        android.util.Log.i("OrionAvProbe", "UI DONE tag=$viewTag")');p.write_text(s)
p=base/'video/VideoViewModule.kt';s=p.read_text();needle='Prop("status") { view: VideoViewWrapper, status: ReadableMap ->';assert needle in s
s=s.replace(needle,needle+'\n        if(status.hasKey("shouldPlay")) android.util.Log.i("OrionAvProbe", "PROP intent=${status.getBoolean(\"shouldPlay\")}")');p.write_text(s)
# Trace only operation stages, never keys or values. The delivery job does not run this script.
p=Path('node_modules/@react-native-async-storage/async-storage/android/src/main/java/com/reactnativecommunity/asyncstorage/AsyncStorageModule.java')
s=p.read_text();start=s.index('public void multiSet(');end=s.index('public void multiRemove(',start)
part=s[start:end];brace=part.index('{')
part=part[:brace+1]+'\n    android.util.Log.i("OrionStorageProbe", "SET requested");'+part[brace+1:]
needle='protected void doInBackgroundGuarded(Void... params) {'
assert needle in part
part=part.replace(needle,needle+'\n        android.util.Log.i("OrionStorageProbe", "SET running dedicated="+BuildConfig.AsyncStorage_useDedicatedExecutor);',1)
needle='if (error != null) {';assert needle in part
part=part.replace(needle,'android.util.Log.i("OrionStorageProbe", "SET completed");\n        '+needle,1)
s=s[:start]+part+s[end:];p.write_text(s)
