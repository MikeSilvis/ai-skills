---
name: android-emulator
description: Build, run, view, and interact with Android apps on an emulator or connected device. Use when the user asks to build, run, install, screenshot, tap, scroll, swipe, type, inspect, record, capture logs, or debug an Android emulator/device.
---

# Android Emulator

Build, install, launch, inspect, and drive Android apps on an emulator or connected device. Use `adb` first because it is stable, scriptable, and available anywhere the Android SDK platform tools are installed. Use Maestro or Appium only when the repo already has that test stack or the user explicitly asks for it.

## Prerequisites

Check the host before interacting:

```bash
command -v adb
adb devices
```

If no device is listed, check for available emulators:

```bash
command -v emulator
emulator -list-avds
```

Start an AVD only when one is clearly available or the repo documents a preferred one:

```bash
emulator -avd <avd-name> -netdelay none -netspeed full
adb wait-for-device
```

If multiple devices are attached, set a serial and pass it to every command:

```bash
export ANDROID_SERIAL=<serial-from-adb-devices>
adb -s "$ANDROID_SERIAL" shell wm size
```

## Build, Install, and Launch

Prefer repo tasks:

```bash
mise run build
```

For Gradle projects without a wrapper task:

```bash
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

For Expo/React Native projects, prefer the repo's documented native command, then fall back to the package manager script:

```bash
pnpm android
```

## React Native and Expo

For React Native apps, the emulator control commands are the same, but bring-up is different:

- Start Metro first and keep it running in a session:

  ```bash
  pnpm start
  ```

- For Expo-managed apps, prefer the repo's script or Expo command:

  ```bash
  pnpm android
  npx expo run:android
  ```

- For bare React Native apps, prefer the repo script, then fall back to:

  ```bash
  npx react-native run-android
  ```

- Connect the emulator back to Metro:

  ```bash
  adb reverse tcp:8081 tcp:8081
  ```

- Read app identity from `app.json`, `app.config.*`, `android/app/build.gradle`, or `android/app/src/main/AndroidManifest.xml`.
- If using Expo Go, launch Expo Go and open the Metro URL instead of installing a project-specific APK.
- If using a custom development client, install the dev-client build and open the app through the dev-client URL/deep link.
- Use React Native `testID` and `accessibilityLabel` when available; they make `uiautomator` targeting much more reliable than coordinate taps.
- Hermes, Metro, Logcat, and native crash output are separate signal sources. Check both Metro output and `adb logcat` when a screen is blank.

Find launchable activities:

```bash
adb shell cmd package resolve-activity --brief <package-name>
adb shell monkey -p <package-name> -c android.intent.category.LAUNCHER 1
```

Restart the app:

```bash
adb shell am force-stop <package-name>
adb shell monkey -p <package-name> -c android.intent.category.LAUNCHER 1
```

## View and Capture

Screenshots and video:

```bash
adb exec-out screencap -p > screenshot.png
adb shell screenrecord /sdcard/screen.mp4
adb pull /sdcard/screen.mp4 .
adb shell rm /sdcard/screen.mp4
```

Device state:

```bash
adb shell wm size
adb shell wm density
adb shell dumpsys window | rg -i 'mCurrentFocus|mFocusedApp'
```

Logs:

```bash
adb logcat -c
adb logcat
adb logcat --pid "$(adb shell pidof <package-name> | tr -d '\r')"
```

Do not dump long logs to the user. Save or summarize relevant errors.

## Interact

Coordinate commands use physical screen pixels from `adb shell wm size`.

```bash
adb shell input tap <x> <y>
adb shell input swipe <x1> <y1> <x2> <y2> <duration-ms>
adb shell input text 'hello%sworld'
adb shell input keyevent KEYCODE_BACK
adb shell input keyevent KEYCODE_HOME
adb shell input keyevent KEYCODE_APP_SWITCH
adb shell input keyevent KEYCODE_ENTER
```

Common scrolls:

```bash
# scroll down
adb shell input swipe 540 1700 540 500 350

# scroll up
adb shell input swipe 540 500 540 1700 350
```

Before tapping arbitrary coordinates, prefer inspecting the UI hierarchy.

## Inspect UI

Use Android's accessibility hierarchy dump:

```bash
adb shell uiautomator dump /sdcard/window.xml
adb exec-out cat /sdcard/window.xml > window.xml
```

Search the XML for text, resource IDs, bounds, and content descriptions:

```bash
rg 'text="|resource-id=|content-desc=|bounds=' window.xml
```

Bounds are pixel rectangles like `[left,top][right,bottom]`. Tap the center:

```text
x = (left + right) / 2
y = (top + bottom) / 2
```

If a target is not present in the hierarchy, report that instead of guessing.

## Permissions and Device State

Grant runtime permissions:

```bash
adb shell pm grant <package-name> android.permission.CAMERA
adb shell pm grant <package-name> android.permission.ACCESS_FINE_LOCATION
```

Set rotation:

```bash
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
```

Open a deep link:

```bash
adb shell am start -a android.intent.action.VIEW -d '<url-or-deep-link>'
```

## Tips

- Use `adb -s <serial>` consistently when more than one device is attached.
- Capture a screenshot before and after a visual interaction.
- Keep emulator startup commands running in a PTY/session if they do not return.
- Prefer the repo's existing E2E framework when it exists; use raw `adb` for ad hoc verification and debugging.
