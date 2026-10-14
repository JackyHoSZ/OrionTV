#!/usr/bin/env bash
set -euo pipefail
SDK="${ANDROID_HOME:-/usr/local/lib/android/sdk}"
BUILD_TOOLS="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
mkdir -p test-results/inspector/classes test-results/inspector/dex
javac -source 8 -target 8 -classpath "$PLATFORM" -d test-results/inspector/classes scripts/android-inspector/Inspector.java
"$BUILD_TOOLS/d8" --lib "$PLATFORM" --min-api 23 --output test-results/inspector/dex test-results/inspector/classes/com/oriontv/danmaku/inspect/Inspector.class
"$BUILD_TOOLS/aapt" package -f -M scripts/android-inspector/AndroidManifest.xml -I "$PLATFORM" -F test-results/inspector/unsigned.apk
(cd test-results/inspector/dex && zip -q ../unsigned.apk classes.dex)
keytool -genkeypair -keystore test-results/inspector/ci.p12 -storetype PKCS12 -storepass testonly-ci -keypass testonly-ci -alias inspector -dname 'CN=CI Test Inspector' -keyalg RSA -validity 2 -noprompt
"$BUILD_TOOLS/apksigner" sign --ks test-results/inspector/ci.p12 --ks-pass pass:testonly-ci --out test-results/inspector/inspector.apk test-results/inspector/unsigned.apk
