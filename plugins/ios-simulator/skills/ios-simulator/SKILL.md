---
name: ios-simulator
description: Build the current repo's iOS app with xcodebuild and run it on the iOS Simulator. Use when the user asks to build, run, install, or interact with their app on the simulator.
---

# iOS Simulator — Build & Run

Build the iOS app from the current repo, install it on the Simulator, and interact with it.

## Step 1 — Discover the Project

Projects use **Tuist** for project generation and **mise** as the task runner.

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

## Step 5 — Interact with the Running App

Common interactions via `xcrun simctl`:

- **Take a screenshot**: `xcrun simctl io booted screenshot screenshot.png` then show it with the Read tool
- **Record video**: `xcrun simctl io booted recordVideo video.mp4` (Ctrl+C to stop)
- **Open a URL / deep link**: `xcrun simctl openurl booted <url>`
- **Send a push notification**: `xcrun simctl push booted <bundle-id> payload.json`
- **Restart the app**: `xcrun simctl terminate booted <bundle-id>` then `xcrun simctl launch booted <bundle-id>`
- **Uninstall**: `xcrun simctl uninstall booted <bundle-id>`
- **View logs**: `xcrun simctl spawn booted log stream --predicate 'subsystem == "<bundle-id>"' --level debug`
- **Grant permissions** (e.g., camera): `xcrun simctl privacy booted grant camera <bundle-id>`

Use Playwright MCP tools (`browser_take_screenshot`, `browser_snapshot`) if the user wants UI-level assertions or accessibility inspection beyond what simctl provides.

## Tips

- Always build with `-derivedDataPath build/` to keep output predictable and avoid polluting `~/Library/Developer/Xcode/DerivedData`
- If the user says "run" or "build and run", do the full flow (steps 1-4) without asking
- If the build succeeds, don't dump the full xcodebuild output — just confirm success and the device name
- Cache the scheme, device, and bundle ID for the session so repeat builds are fast
