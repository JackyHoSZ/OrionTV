"""Cloud only: remux our own authorized synthetic video, without a codec change."""
from pathlib import Path
import os,subprocess
if os.environ.get('DANMAKU_STABILITY')=='1':
 out=Path('assets/danmaku-hls');out.mkdir(exist_ok=True)
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i','assets/danmaku-test.mp4','-c','copy','-hls_time','6','-hls_playlist_type','vod','-hls_segment_filename',str(out/'segment%03d.ts'),str(out/'index.m3u8')],check=True)
