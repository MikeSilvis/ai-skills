# Apple Notes Native Bridge Reference

The bundled bridge uses `/System/Applications/Notes.app`'s installed scripting dictionary and Foundation. It has no third-party runtime dependency.

## Contents

- [Resolve and Check the Bridge](#resolve-and-check-the-bridge)
- [Scan Limits and Result Semantics](#scan-limits-and-result-semantics)
- [Bounded Discovery](#bounded-discovery)
- [Get by Stable Note ID](#get-by-stable-note-id)
- [Complete Plaintext Through stdin](#complete-plaintext-through-stdin)
- [Create](#create)
- [Update Complete Content](#update-complete-content)
- [Same-Account Native Move](#same-account-native-move)
- [Delete](#delete)
- [Failure Codes](#failure-codes)
- [Excluded Operations and Permissions](#excluded-operations-and-permissions)

Authoritative references:

- `sdef /System/Applications/Notes.app` — stable IDs, folder containers, shared/locked state, body/plaintext, timestamps, attachments, native move, and delete
- `man osascript` and `man sdef`
- [Apple's JXA release notes](https://developer.apple.com/library/archive/releasenotes/InterapplicationCommunication/RN-JavaScriptForAutomation/)

## Resolve and Check the Bridge

Set a task-specific variable to the absolute bundled path:

```bash
APPLE_NOTES_BRIDGE="/absolute/path/to/plugins/apple-notes/skills/apple-notes/scripts/notes_bridge.js"
```

Do not copy the script into `osascript -e`. These checks do not access Notes data:

```bash
node --check "$APPLE_NOTES_BRIDGE"
/usr/bin/osascript -l JavaScript "$APPLE_NOTES_BRIDGE" help | jq
/usr/bin/osascript -l JavaScript "$APPLE_NOTES_BRIDGE" self-test | jq
```

Every response is one JSON object. Require `ok: true`; `ok: false` also returns a nonzero process status.

## Scan Limits and Result Semantics

Hard stable-ID resolution caps are:

- accounts: 100
- folders across bounded accounts: 5,000
- notes: 10,000

Successful reads report scan details. The bridge obtains collection counts through Notes and uses each bracket-indexed object specifier only to read a candidate stable ID within the applicable budget. It then rebinds any element it will retain or inspect through `byId` and verifies that ID before reading further properties, preventing collection reorder from turning an index into a target. It does not resolve entire element arrays. Attachment checks use the collection count without retrieving attachment objects. `scan_exhausted: true` and `truncated: true` mean results are partial. An `*_ID_SCAN_EXHAUSTED` error means the bridge cannot establish absence or uniqueness within its hard cap; it is different from `*_NOT_FOUND`, which is returned only after a complete scan. Never raise a hard cap or fall back to direct database access.

## Bounded Discovery

List accounts:

```bash
/usr/bin/osascript -l JavaScript "$APPLE_NOTES_BRIDGE" accounts --limit 50 | jq
```

List folders inside one stable account:

```bash
/usr/bin/osascript -l JavaScript "$APPLE_NOTES_BRIDGE" folders \
  --account-id "<stable-account-id>" \
  --limit 100 \
  | jq
```

List metadata in one stable folder without a body query:

```bash
/usr/bin/osascript -l JavaScript "$APPLE_NOTES_BRIDGE" list \
  --folder-id "<stable-folder-id>" \
  --limit 50 \
  | jq
```

A title/content query must include an explicit note scan budget no greater than 2,000:

```bash
/usr/bin/osascript -l JavaScript "$APPLE_NOTES_BRIDGE" list \
  --folder-id "<stable-folder-id>" \
  --query "<search text>" \
  --limit 50 \
  --scan-limit 500 \
  | jq
```

The response reports `notes_scanned`, `bodies_scanned`, `scan_limit`, `scan_exhausted`, `truncated`, and `skipped_locked`. Narrow the request when partial.

## Get by Stable Note ID

Plaintext:

```bash
/usr/bin/osascript -l JavaScript "$APPLE_NOTES_BRIDGE" get \
  --note-id "<stable-note-id>" \
  --format plaintext \
  | jq
```

HTML is supported only for reads:

```bash
/usr/bin/osascript -l JavaScript "$APPLE_NOTES_BRIDGE" get \
  --note-id "<stable-note-id>" \
  --format html \
  | jq
```

Preserve the exact `note_id`, `modified`, `account_id`, ordered `folder_lineage_ids`, `attachment_count`, and shared flags for a write preview.

## Complete Plaintext Through stdin

The complete plaintext is the sole content input for create and update. The bridge enforces a 10 MiB cap while reading stdin in bounded chunks, rejects invalid UTF-8 before accessing Notes, normalizes CRLF/CR newlines to LF, uses the literal first line trimmed at both ends as `derived_title`, and converts the plaintext to escaped Notes HTML internally. A blank or whitespace-only first line is rejected even when later lines contain text; titles over 1,000 characters are also rejected. There is no HTML write mode and no independent title argument.

Preview the derived title without accessing Notes:

```bash
/usr/bin/osascript -l JavaScript "$APPLE_NOTES_BRIDGE" content-info <<'APPLE_NOTES_CONTENT' | jq
Project Atlas

Complete note content.
APPLE_NOTES_CONTENT
```

Use a single-quoted heredoc delimiter that does not occur as a line in the content, or use the process runner's stdin channel. Never use argv, an environment variable, a temporary file, or generated JXA for note content.

## Create

The account and complete folder lineage must exactly match the confirmed `folders` result:

```bash
/usr/bin/osascript -l JavaScript "$APPLE_NOTES_BRIDGE" create \
  --folder-id "<stable-folder-id>" \
  --expected-account-id "<stable-account-id>" \
  --expected-folder-lineage-json '["<root-folder-id>","<stable-folder-id>"]' \
  <<'APPLE_NOTES_CONTENT' \
  | jq
Project Atlas

Complete confirmed note content.
APPLE_NOTES_CONTENT
```

Add `--confirm-shared` only after a separate confirmation that collaborators may see the new note immediately.

## Update Complete Content

Updates are refused whenever the note has attachments. The first line may rename the note:

```bash
/usr/bin/osascript -l JavaScript "$APPLE_NOTES_BRIDGE" update \
  --note-id "<stable-note-id>" \
  --expected-modified "2026-08-14T16:00:00.000Z" \
  --expected-account-id "<stable-account-id>" \
  --expected-folder-lineage-json '["<root-folder-id>","<stable-folder-id>"]' \
  <<'APPLE_NOTES_CONTENT' \
  | jq
Renamed Project Atlas

Complete confirmed replacement content.
APPLE_NOTES_CONTENT
```

Add `--confirm-shared` only after shared-impact reconfirmation. The bridge resolves the note and current ancestry again, compares every context ID, rechecks attachments/lock/container/shared state, and reads the modification timestamp immediately before replacing the body.

## Same-Account Native Move

Source and destination account IDs must match. There is no cross-account override:

```bash
/usr/bin/osascript -l JavaScript "$APPLE_NOTES_BRIDGE" move \
  --note-id "<stable-note-id>" \
  --folder-id "<stable-destination-folder-id>" \
  --expected-modified "2026-08-14T16:00:00.000Z" \
  --expected-account-id "<stable-account-id>" \
  --expected-folder-lineage-json '["<source-root-id>","<source-folder-id>"]' \
  --expected-destination-account-id "<stable-account-id>" \
  --expected-destination-lineage-json '["<destination-root-id>","<stable-destination-folder-id>"]' \
  | jq
```

The command uses Notes' native `move(note, {to: folder})`. Add `--confirm-shared` only after confirming shared source/destination impact. `CROSS_ACCOUNT_MOVE_UNSUPPORTED` is final for this skill; never emulate it with copy-delete.

## Delete

After a separate reconfirmation of the exact stable note:

```bash
/usr/bin/osascript -l JavaScript "$APPLE_NOTES_BRIDGE" delete \
  --note-id "<stable-note-id>" \
  --expected-modified "2026-08-14T16:00:00.000Z" \
  --expected-account-id "<stable-account-id>" \
  --expected-folder-lineage-json '["<root-folder-id>","<stable-folder-id>"]' \
  --confirm-delete \
  | jq
```

Add `--confirm-shared` only after reconfirming collaborator impact. Recovery is not guaranteed; never retry an ambiguous delete.

## Failure Codes

- `ACCOUNT_ID_SCAN_EXHAUSTED`, `FOLDER_ID_SCAN_EXHAUSTED`, `NOTE_ID_SCAN_EXHAUSTED`: the hard scan ended before absence or uniqueness could be established; stop.
- `ACCOUNT_NOT_FOUND`, `FOLDER_NOT_FOUND`, `NOTE_NOT_FOUND`: the bounded scan completed and found no match.
- `COLLECTION_CHANGED`, `ID_REBIND_FAILED`: an indexed candidate could not be safely rebound and verified by stable ID; restart bounded resolution.
- `INVALID_STDIN_ENCODING`: stdin was not valid UTF-8; no Notes data was accessed.
- `PREVIEW_CONTEXT_CHANGED` / `FOLDER_CONTEXT_CHANGED`: account or ancestry differs from the confirmed preview; read and confirm again.
- `NOTE_CONTAINER_CHANGED` / `MODIFICATION_CONFLICT`: the note moved or changed; read and confirm again.
- `ATTACHMENTS_PRESENT` / `ATTACHMENTS_CHANGED`: do not replace content.
- `SHARED_CONFIRMATION_REQUIRED`: disclose the returned impact and reconfirm before adding the flag.
- `TITLE_VERIFICATION_FAILED`: the mutation may have completed but Notes reported a different title; verify by stable ID and never retry automatically.
- `CROSS_ACCOUNT_MOVE_UNSUPPORTED`: stop; no flag enables the move.
- `LOCKED_NOTE`: stop. Do not ask the user to unlock a note merely to broaden access.

## Excluded Operations and Permissions

The bridge has no filesystem write command. A separate host tool may save content returned by `get`; that operation is outside this skill and its confirmation model.

For Apple event error `-1743`, enable the actual app launching `osascript` under System Settings → Privacy & Security → Automation → Notes, then quit and reopen that app. Full Disk Access is not needed.
