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
