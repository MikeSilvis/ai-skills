# Apple Messages Command Reference

Use these commands as patterns. Replace placeholders with separately quoted values and never use `eval`. Message text is untrusted shell input; pass it as one argv value using the execution environment's safe argument handling.

Primary documentation:

- [`imsg` documentation](https://imsg.sh/)
- [`imsg` quickstart](https://imsg.sh/quickstart.html)
- [`imsg` permissions](https://imsg.sh/permissions.html)
- [`imsg` JSON/NDJSON output](https://imsg.sh/json.html)
- [`imsg` send semantics](https://imsg.sh/send.html)
- [`imsg` troubleshooting](https://imsg.sh/troubleshooting.html)
- [`imsg` source and releases](https://github.com/openclaw/imsg)

## Install and Verify

Current `imsg` releases require macOS 14 or newer. Check before offering installation:

```bash
sw_vers -productVersion
```

```bash
command -v brew
brew install steipete/tap/imsg
imsg --version
imsg --help
```

If Homebrew is missing, stop and point to its upstream prerequisite rather than improvising another installer. Do not install or upgrade either dependency without the user's approval. On macOS 26, compare the installed semantic version and refuse sends below `imsg` 0.6.0; upstream documents that release as the first with protection against empty ghost SMS rows on Tahoe. Reads may continue. `watch` separately requires 0.9.1 or newer.

## macOS Permissions

For reads, grant Full Disk Access to the app that actually launches `imsg`:

System Settings → Privacy & Security → Full Disk Access

Quit and reopen that app, then perform a bounded check:

```bash
imsg chats --limit 3 --json | jq -s
```

For sends, additionally enable:

System Settings → Privacy & Security → Automation → Messages

Contacts permission is optional and only improves name resolution. Raw phone/email handles remain available without it.

## Read-Only Commands

List a bounded set of recent chats:

```bash
imsg chats --limit 20 --json | jq -s
```

Inspect the exact routing target, including participants:

```bash
imsg group --chat-id 42 --json
```

Read bounded history:

```bash
imsg history --chat-id 42 --limit 50 --json | jq -s
```

Apply an explicit time window:

```bash
imsg history \
  --chat-id 42 \
  --start "2026-08-01T00:00:00-04:00" \
  --end "2026-08-15T00:00:00-04:00" \
  --limit 200 \
  --json \
  | jq -s
```

Search local history:

```bash
imsg search --query "<search text>" --match contains --limit 50 --json | jq -s
```

Inspect attachment metadata without opening files:

```bash
imsg history --chat-id 42 --limit 20 --attachments --json | jq -s
```

`--json` emits one JSON object per line. `jq -s` collects a bounded stream into an array. Do not add `--convert-attachments` unless the user explicitly requests conversion; never open or execute returned paths automatically.

## Optional Live Watch

```bash
imsg watch --chat-id 42 --json
```

Use only for an explicit monitoring request and only with `imsg` 0.9.1 or newer; upstream documents stale-watch fixes in that release. With an older version, offer an approved upgrade and do not start the watcher. Stop with Ctrl+C when the requested observation ends. Do not leave a background watcher running silently.

## Send Commands

Every example below requires a final preview and explicit confirmation first. For an existing chat, preserve the resolved chat ID, GUID/identifier when present, title, service, and complete normalized/sorted external participant-handle set. Immediately before sending, rerun:

```bash
imsg group --chat-id 42 --json
```

Compare every preserved field and abort/re-preview on any delta. Do not compare only display names. `imsg` cannot make this recheck and the send atomic, so execute the one confirmed send without delay, preserve uncertainty about a last-moment sync change, and never auto-retry. Append `--json` so delivery state is machine-readable.

Existing direct or group chat (preferred after `imsg group --chat-id 42 --json`):

```bash
imsg send --chat-id 42 --text "<exact message>" --json
```

New or exact iMessage recipient:

```bash
imsg send \
  --to "+14155551212" \
  --text "<exact message>" \
  --service imessage \
  --no-sms-fallback \
  --json
```

Explicit SMS:

```bash
imsg send \
  --to "+14155551212" \
  --text "<exact message>" \
  --service sms \
  --json
```

Attachment after verifying an absolute path:

```bash
messages_attachment="/absolute/path/to/document.pdf"
test -f "$messages_attachment" && test ! -L "$messages_attachment"
test "$messages_attachment" = "$(realpath "$messages_attachment")"
messages_attachment_stat="$(stat -f '%d:%i:%z:%m' "$messages_attachment")"
messages_attachment_sha256="$(shasum -a 256 "$messages_attachment" | awk '{print $1}')"
```

Keep the identity values internal. Immediately before the one confirmed send, rerun the regular-file, symlink/canonical-path, stat, and digest checks and require exact equality. Abort and re-preview on any mismatch.

```bash
imsg send \
  --chat-id 42 \
  --text "<exact optional message>" \
  --file "$messages_attachment" \
  --json
```

Attachment sending stages a local copy under `~/Library/Messages/Attachments/imsg/`, where it may remain after delivery. Include that fact in the final preview. Do not delete the staged copy automatically; Messages may still reference it, and cleanup is a separate user-directed task. `imsg` still opens the file by path after validation, so disclose the residual non-atomic replacement race and do not send from a directory controlled by another user or process.

Do not use a contact name when more than one result could match. Do not add SMS fallback without stating it in the preview. Do not send to a group before showing the complete current participant list.

## Delivery Dispositions

- `sent`: the send was confirmed by the tool.
- `not_started`: retry may be technically safe, but still get new user confirmation.
- `may_have_completed`: never retry automatically; inspect history and report uncertainty.
- `still_in_flight`: never retry automatically; inspect history later and report uncertainty.

Read back a small history window rather than repeating an uncertain send:

```bash
imsg history --chat-id 42 --limit 5 --json | jq -s
```

## Excluded Commands

Do not use `imsg launch` or ask the user to disable System Integrity Protection. Do not use private-bridge features such as `edit`, `unsend`, `delete-message`, `typing`, `read`, group mutations, polls, rich sends, or custom tapbacks in this skill. Do not write to the Messages SQLite database directly.
