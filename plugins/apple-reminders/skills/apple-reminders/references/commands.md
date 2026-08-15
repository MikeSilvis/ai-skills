# Apple Reminders command reference

Use these recipes with `remindctl`, an MIT-licensed CLI that reads and writes Reminders through Apple's public EventKit API. Its project documentation is at <https://github.com/openclaw/remindctl>; version history is in the [upstream changelog](https://github.com/openclaw/remindctl/blob/main/CHANGELOG.md).

Angle-bracketed values are placeholders. Pass user-provided text as discrete process arguments whenever the execution tool supports an argv array. If a shell command is required, quote each value safely; never interpolate reminder text into shell syntax.

## Setup and permissions

Check the host and existing installation without changing state:

```bash
uname -s
command -v brew
command -v remindctl
remindctl --version
remindctl status --json --no-input
remindctl doctor --for-agent
```

Requirements are macOS 14 or newer, `remindctl` 0.3.4 or newer, and Reminders access for the actual host process running the command. Earlier releases lack command coverage and fixes this skill relies on for preserving omitted fields and bounding EventKit/geocoding work; refuse affected operations and offer an approved upgrade. With user approval, install the released Homebrew package. If Homebrew is missing, stop and point to its upstream prerequisite rather than improvising another installer:

```bash
brew install steipete/tap/remindctl
```

Request the normal EventKit permission prompt:

```bash
remindctl authorize
remindctl status --json --no-input
```

If access is denied, the user must enable the relevant terminal or agent host under **System Settings > Privacy & Security > Reminders**. When no prompt appears, this bounded AppleScript count can trigger the system prompt without returning reminder titles:

```bash
osascript -e 'tell application "Reminders" to count reminders'
```

Run it only after explaining that it opens a macOS permission prompt. Do not use `tccutil reset`, and do not claim a grant succeeded until `remindctl status --json --no-input` confirms it. For SSH or a background agent, permissions belong to the process and Mac that actually execute `remindctl`.

## Stable reads

Prefer JSON for parsing and `--no-input` for noninteractive behavior:

```bash
remindctl list --json --no-input
remindctl today --json --no-input
remindctl show tomorrow --json --no-input
remindctl show week --json --no-input
remindctl show overdue --json --no-input
remindctl show upcoming --json --no-input
remindctl show open --json --no-input
remindctl show completed --json --no-input
remindctl search "<query>" --json --no-input
remindctl search "<query>" --list "<exact list name>" --json --no-input
remindctl info "<full stable reminder ID>" --json --no-input
```

An unambiguous prefix may help a read-only discovery step, but every edit, completion, deletion, opening, or other write must use the full stable ID returned by JSON. Numeric row indexes are view-dependent and are safe only within the exact human-facing listing that produced them, never for a later write. When a list name is ambiguous, list the IDs and use one explicitly:

```bash
remindctl list --json --no-input
remindctl list --list-id "<stable list ID>" --json --no-input
remindctl show overdue --list-id "<stable list ID>" --json --no-input
```

Use table output only for a human-facing scan:

```bash
remindctl today --format table --no-input
```

Export is read-only but can expose many private notes and URLs. Keep the scope narrow:

```bash
remindctl export --list "<exact list name>" --export-format csv --no-input
remindctl export --list "<exact list name>" --json --no-input
```

## Date interpretation

Supported due values include `today`, `tomorrow`, `YYYY-MM-DD`, `YYYY-MM-DD HH:mm`, an ISO 8601 date-time with an offset, and a local ISO 8601 date-time without an offset.

- A date-only due value is all-day.
- A date-time due value is timed.
- A timed reminder gets a due-time alarm by default.
- Use an explicit offset when the user's intent depends on a timezone.
- Repeat the resolved absolute date and timezone to the user before a write.

Examples:

```bash
remindctl add "<title>" --list-id "<list ID>" --due "2026-08-18" --json --no-input
remindctl add "<title>" --list-id "<list ID>" --due "2026-08-18T09:00:00-04:00" --json --no-input
```

## Create and edit

Inspect lists before creating. Include only options the user requested; omitted fields should remain unset or unchanged.

```bash
remindctl add "<title>" \
  --list-id "<list ID>" \
  --due "<resolved due value>" \
  --json --no-input
```

Optional public EventKit fields include notes, URL, priority, a simple recurrence, a specific alarm, and a location trigger. Check the installed version's help before composing optional flags:

```bash
remindctl add --help
remindctl edit --help
```

Representative forms:

```bash
remindctl add "<title>" --list-id "<list ID>" --due tomorrow --repeat weekly --json --no-input
remindctl add "<title>" --list-id "<list ID>" --due "2026-08-18 09:00" --alarm "2026-08-18 08:45" --json --no-input
remindctl edit "<reminder ID>" --title "<new title>" --json --no-input
remindctl edit "<reminder ID>" --due "<new due value>" --json --no-input
remindctl edit "<reminder ID>" --clear-alarm --json --no-input
remindctl edit "<reminder ID>" --no-repeat --json --no-input
```

Before any edit, preserve the resolved reminder's `lastModifiedDate`, title, containing-list ID, due state, and recurrence from its JSON. Immediately before the edit, run `remindctl info` again and compare those fields; abort and re-preview on any delta. Do not run an occurrence-specific edit. For a repeating reminder, proceed only after the user explicitly confirms changing the whole repeating item; otherwise open it in Reminders for native UI review.

Create or rename a list only when explicitly requested:

```bash
remindctl list "<new list name>" --create --json --no-input
remindctl list --list-id "<list ID>" --rename "<new name>" --no-input
```

Current `remindctl` versions do not emit JSON for list rename. Use the exit status, then rerun `remindctl list --json --no-input` and verify the same stable list ID.

## Complete and delete

Resolve every target to a stable ID and show the selected set before completing multiple reminders:

```bash
remindctl complete "<reminder ID>" --json --no-input
remindctl complete "<ID 1>" "<ID 2>" --json --no-input
```

Inspect recurrence first and retain the reminder's `lastModifiedDate`, title, list ID, due state, and recurrence. Immediately before completion, re-read and compare the snapshot; abort on any delta. Completing a repeating reminder advances the series and may create a new incomplete occurrence with a different ID; disclose this behavior and verify the completed item plus the next occurrence. Do not use edit or delete for a request that names only one occurrence.

Deletion requires an explicit confirmation in conversation and the CLI's force flag. Never add `--force` merely to bypass a prompt:

```bash
remindctl delete "<reminder ID>" --force --json --no-input
remindctl list --list-id "<list ID>" --delete --force --no-input
```

Before deleting a reminder, inspect recurrence and retain the exact stable ID, `lastModifiedDate`, title, containing-list ID, due state, and recurrence shown in the confirmation. Immediately before `--force`, re-read and compare every field; abort and reconfirm on any delta. Require explicit whole-series confirmation for a repeating item; the CLI cannot safely delete one occurrence.

Before deleting a list, capture its stable ID/name and the complete sorted set of contained reminder IDs, then tell the user what will be affected. Immediately before `--force`, re-read the same stable list and compare its name plus the complete item-ID set; an added, removed, or moved reminder invalidates confirmation. The CLI cannot make this comparison and deletion atomic, so execute without delay, preserve uncertainty, and never retry automatically. List deletion does not emit JSON in current versions; use the exit status and verify the stable list ID is absent from a fresh JSON listing.

## Read-back verification

After create or edit, take the stable ID from the JSON result and read it back:

```bash
remindctl info "<returned reminder ID>" --json --no-input
```

After a nonrecurring completion, read the same ID and confirm its completed state. For a recurring completion, use the command's returned JSON as evidence for the completed occurrence, then locate and inspect the newly generated next occurrence without requiring the old ID to keep resolving. After deletion, query the same ID once; an expected not-found response verifies removal. Do not turn a transient sync or permission error into an automatic second mutation.

For lists, rerun `remindctl list --json --no-input` and compare the stable list ID and name.

## Opening the native app

Open a resolved reminder or list for user inspection:

```bash
remindctl open "<reminder ID>"
remindctl open "<list ID>"
```

The positional form accepts a resolved reminder or list ID. Do not fall back to `open --list <name>` when duplicate list names exist because that form cannot encode the stable-ID choice. Deep links are best-effort. A failure to focus the correct UI does not imply the underlying read or write failed; rely on JSON read-back.

## Public API limits

EventKit does not currently expose native sections, tags, smart lists, file or image attachments, or the private Urgent flag. Stop and explain the limitation when a request requires one of those features. Direct modification of Reminders databases and private frameworks is unsupported and unsafe.
