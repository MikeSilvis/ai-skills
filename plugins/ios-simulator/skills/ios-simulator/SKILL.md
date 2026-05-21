---
name: ios-simulator
description: Build, run, view, and interact with iOS apps on the Apple Simulator. Use when the user asks to build, run, install, stream, screenshot, tap, scroll, swipe, rotate, grant permissions, or inspect an app on an iOS/iPadOS/watchOS Simulator.
---

# iOS Simulator

Build the iOS app from the current repo, install it on the Simulator, and interact with it. Use `xcrun simctl` for device lifecycle and app management. Use `npx serve-sim` when the task requires visual control: streaming the simulator, tapping, swiping, scrolling, rotating, reading accessibility state, or granting simulator permissions through one command surface.

## Capability Matrix

| Need | Use |
| --- | --- |
| Boot, install, launch, open URL, push, privacy, screenshot, record video | `xcrun simctl` |
| View the simulator in a browser/preview | `npx serve-sim --detach -q` |
| Tap, swipe, scroll, drag, rotate, hardware buttons | `npx serve-sim` |
| Inspect UI affordances before tapping | `curl http://localhost:3100/ax` after starting `serve-sim` |
| Android emulator interaction | Use the `android-emulator` skill instead |

## Prerequisites

Before using `serve-sim`, verify:

```bash
uname -s
xcrun --version
node --version
xcrun simctl list devices booted
```

Requirements:

- macOS host (`Darwin`)
- Xcode command line tools available through `xcrun`
- Node.js 18+
- A booted Apple Simulator for interaction commands

If no simulator is booted, choose the repo's preferred simulator when configured, otherwise boot an available iPhone simulator:

```bash
xcrun simctl list devices available
xcrun simctl boot "<device name>"
xcrun simctl bootstatus booted -b
```

## Step 1 — Discover the Project

Prefer the repo's own task runner and project generator.

1. Read the `mise.toml` or `.mise.toml` at the repo root to find available tasks and tool versions
2. Run `mise run generate` (or the equivalent Tuist generate task) if the `.xcworkspace`/`.xcodeproj` hasn't been generated yet
3. List available schemes: `tuist graph` or `xcodebuild -list` on the generated workspace
4. Ask the user which scheme to use if there are multiple app targets

## Step 2 — Pick a Simulator

The repo defines which simulators are available. Check for simulator configuration in:

1. `.mise.toml` / `mise.toml` — look for simulator-related tasks or environment variables
2. `Matchfile`, `Fastfile`, or other config files that specify device names
3. `Project.swift` / Tuist manifests — look for destination or test plan configs

Boot the simulator defined by the repo. If multiple are configured, ask the user which one. If none are booted:

```bash
xcrun simctl boot "<device name from repo config>"
```

## Step 3 — Build for Simulator

Prefer mise tasks when available:

```bash
mise run build
```

If no mise build task exists or a custom destination is needed, fall back to xcodebuild:

```bash
xcodebuild build \
  -workspace <workspace> \
  -scheme <scheme> \
  -destination 'platform=iOS Simulator,name=<device name>' \
  -derivedDataPath build/ \
  2>&1
```

- Parse the output for `BUILD SUCCEEDED` or `BUILD FAILED`
- On failure, show the relevant error lines and stop
- The built `.app` bundle will be at `build/Build/Products/Debug-iphonesimulator/<AppName>.app`

## Step 4 — Install & Launch

```bash
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/<AppName>.app
xcrun simctl launch booted <bundle-id>
```

To find the bundle ID:

```bash
defaults read build/Build/Products/Debug-iphonesimulator/<AppName>.app/Info.plist CFBundleIdentifier
```

Open the Simulator UI so the user can see it:

```bash
open -a Simulator
```

## React Native and Expo

For React Native apps, the simulator control commands are the same, but bring-up is different:

- Start Metro first and keep it running in a session:

  ```bash
  pnpm start
  ```

- For Expo-managed apps, prefer the repo's script or Expo command:

  ```bash
  pnpm ios
  npx expo run:ios
  ```

- For bare React Native apps, prefer the repo's native script, then fall back to:

  ```bash
  npx react-native run-ios
  ```

- Read app identity from `app.json`, `app.config.*`, `ios/*/Info.plist`, or generated native project files before launching or granting permissions.
- If using Expo Go, launch Expo Go and open the Metro URL instead of installing a project-specific `.app`.
- If using a custom development client, install the dev-client build and open the app through the dev-client URL/deep link.
- Use React Native `testID` and `accessibilityLabel` when available; they make accessibility-tree targeting much more reliable than coordinate taps.
- Hermes, Metro, and native logs are separate signal sources. Check both Metro output and simulator logs when a screen is blank.

## Step 5 — Manage with simctl

Common interactions via `xcrun simctl`:

- **Take a screenshot**: `xcrun simctl io booted screenshot screenshot.png` then show it with the Read tool
- **Record video**: `xcrun simctl io booted recordVideo video.mp4` (Ctrl+C to stop)
- **Open a URL / deep link**: `xcrun simctl openurl booted <url>`
- **Send a push notification**: `xcrun simctl push booted <bundle-id> payload.json`
- **Restart the app**: `xcrun simctl terminate booted <bundle-id>` then `xcrun simctl launch booted <bundle-id>`
- **Uninstall**: `xcrun simctl uninstall booted <bundle-id>`
- **View logs**: `xcrun simctl spawn booted log stream --predicate 'subsystem == "<bundle-id>"' --level debug`
- **Grant permissions** (e.g., camera): `xcrun simctl privacy booted grant camera <bundle-id>`

## Step 6 — View and Drive with serve-sim

Start a preview/control server:

```bash
npx serve-sim --detach -q
```

The JSON response includes:

- `url`: browser UI for the live simulator preview, usually `http://localhost:3200`
- `streamUrl`: raw simulator stream, usually `http://localhost:3100`

If a browser/preview tool is available, open the `url`. Always surface the URL plainly so the user can open it manually.

Interaction commands:

```bash
npx serve-sim tap 0.5 0.5
npx serve-sim gesture '{"type":"swipe","from":[0.5,0.8],"to":[0.5,0.2],"duration":0.35}'
npx serve-sim button home
npx serve-sim rotate landscape_left
npx serve-sim permissions grant camera <bundle-id>
curl http://localhost:3100/ax
```

Rules:

- Coordinates are normalized from `0` to `1`, with `(0, 0)` at the top-left.
- Use `tap` for single taps. Do not synthesize taps with separate gesture begin/end calls.
- Inspect accessibility data before tapping when a semantic target is available.
- If multiple simulators are booted, pass `-d <udid-or-device-name>` to `serve-sim`.
- Stop helpers when done unless the user asks to keep the stream running:

```bash
npx serve-sim --kill
```

## Tips

- Always build with `-derivedDataPath build/` to keep output predictable and avoid polluting `~/Library/Developer/Xcode/DerivedData`
- If the user says "run" or "build and run", do the full flow (steps 1-4) without asking
- If the build succeeds, don't dump the full xcodebuild output — just confirm success and the device name
- Cache the scheme, device, and bundle ID for the session so repeat builds are fast
- For visual bugs, capture a screenshot before and after interactions.
