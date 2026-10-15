# Evidence audit before production APK acceptance

Run 38650229312 (source 6964a29) is successful. Its overlay-retest job ran a real
Android TV API29 x86 AVD; its separately signed delivery job produced ARM32/ARM64
build 35. These were different APKs. Do not call the E2E APK the delivered APK.

Already evidenced: 122 unit tests; native synthetic video/HLS, 10,000 comments,
pause/resume, seek, rates 1.25/1.5/2, DPAD and Back, manual search/episode mapping,
persisted settings, separate source offsets, HTTP503 and recovery, next episode.
See original runtime JSON, screenshots and logcat in artifact 11933808842.

Missing: production APK home/detail/player flow, ADB continuous recording,
complete connectivity loss, native empty data, 100,000-comment stress and native
requests against real VPS data. Prior VPS contract checks were outside the AVD.

Production acceptance compiles a signed universal APK containing ARM32/ARM64 and
x86/x86_64, so the exact delivered file can run on the cloud x86 AVD. It leaves
the E2E route disabled and does not apply native diagnostic patches. No player
engine or production server changes are required. Home/media APIs use isolated
runner fixtures. Real danmu_api requests use a temporary runner HTTPS relay with
the ordinary query credential, never an administrator credential. This does not
prove direct native authenticated TLS from the D5X's home network.
