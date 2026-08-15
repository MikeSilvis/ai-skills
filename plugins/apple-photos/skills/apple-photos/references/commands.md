# Apple Photos Command Reference

Use these commands as patterns. Replace every placeholder with a separately quoted value; do not type the angle brackets literally. Check `osxphotos help <command>` on the installed version before using an option not listed here.

Primary documentation:

- [OSXPhotos overview](https://rhettbull.github.io/osxphotos/overview.html)
- [OSXPhotos CLI reference](https://rhettbull.github.io/osxphotos/cli/)
- [OSXPhotos export tutorial](https://rhettbull.github.io/osxphotos/tutorial.html)
- [OSXPhotos source and releases](https://github.com/RhetTbull/osxphotos)
- [OSXPhotos supported operating systems](https://github.com/RhetTbull/osxphotos#supported-operating-systems)
- [OSXPhotos files created](https://github.com/RhetTbull/osxphotos#files-created-by-osxphotos)

## Install and Diagnose

Install the tool with Python 3.12 to avoid dependency-version drift across macOS environments:

```bash
command -v uv
uv tool install --python 3.12 osxphotos
sw_vers -productVersion
osxphotos --version
osxphotos help query
osxphotos help export
osxphotos info
```

If `uv` is missing, stop and give the user the upstream `uv` installation prerequisite; do not improvise another package manager or install it automatically. Do not install or upgrade either dependency without the user's approval. If `osxphotos info` reports that the library database cannot be opened, grant Full Disk Access to the app that actually launches the command, quit that app completely, reopen it, and retry the read. A read-only query may specify a non-default library after resolving its absolute path:

```bash
osxphotos info --library "/absolute/path/Family.photoslibrary"
```

Exports and all Photos-library mutations must target the active/last-opened library, because Photos automation writes against that library and cannot safely be redirected by trusting `--library`. Open the intended library in Photos, then run this without an override before the dry run and again immediately before the final command:

```bash
osxphotos info
```

Record and compare the exact reported library path. Every export and `batch-edit` command in this reference intentionally omits `--library`. If the path changes, stop and repeat target resolution, dry run, and confirmation.

## Read-Only Inventory

```bash
osxphotos albums --json
osxphotos persons --json
osxphotos keywords --json
osxphotos places --json
```

These catalogs can reveal sensitive names and locations. Run only the inventory needed for the request.

## Count, Query, and Resolve UUIDs

Count first:

```bash
osxphotos query --album "<album>" --count
osxphotos query --person "<person>" --from-date "2026-01-01" --to-date "2026-02-01" --count
osxphotos query --keyword "<keyword>" --favorite --count
```

Return a compact result set:

```bash
osxphotos query \
  --album "<album>" \
  --from-date "2026-01-01" \
  --to-date "2026-02-01" \
  --field uuid "{uuid}" \
  --field filename "{original_name}" \
  --field created "{created}" \
  --field title "{title}" \
  --field albums "{folder_album}" \
  --json
```

Resolve a specific asset before acting:

```bash
osxphotos query \
  --uuid "<photo-uuid>" \
  --field uuid "{uuid}" \
  --field filename "{original_name}" \
  --field created "{created}" \
  --field title "{title}" \
  --field description "{descr}" \
  --field keywords "{keyword}" \
  --field albums "{folder_album}" \
  --json
```

Useful documented filters include `--name`, `--title`, `--description`, `--place`, `--keyword`, `--person`, `--album`, `--folder`, `--favorite`, `--only-photos`, `--only-movies`, `--from-date`, `--to-date`, `--added-in-last`, `--selected`, and `--uuid`.

## Audit Shared Scope Before a Write

First record `sw_vers -productVersion` and check the current upstream support notice. OSXPhotos currently cannot read Shared Albums on macOS 26.x. On that OS, do not run or trust `--shared` as evidence of absence: report Shared Album membership and destination status as unknown. Other supported shared-state filters may still be useful, but the overall audit is partial.

Where supported, repeat the exact resolved `--uuid` arguments for each count. Different filter types are combined, so each result is the intersection of the target UUID set and that shared state:

```bash
osxphotos query --uuid "<photo-uuid>" --shared --count
osxphotos query --uuid "<photo-uuid>" --shared-library --count
osxphotos query --uuid "<photo-uuid>" --shared-moment --count
osxphotos query --uuid "<photo-uuid>" --syndicated --count
```

Use the supported checks before an export and before `batch-edit`, and carry unsupported states forward as `unknown`. For exports, disclose that a local copy can expose shared content but does not itself change collaborator state. For metadata writes, disclose that a Shared Library change may sync to participants. Before `--add-to-album`, inspect the destination in Photos to determine whether it is a shared album. The `albums` command does not reliably distinguish that status, and macOS 26.x cannot supply it through OSXPhotos; if it remains unknown, do not proceed until the user explicitly confirms the potential subscriber exposure.

## Export

By default, `export` includes original and edited versions plus associated Live Photo, burst, and RAW components. Choose variants explicitly and preview before writing.

`--dry-run` still requires the destination directory to exist. If it is absent, show the absolute path and get approval before creating that dedicated directory. This skill never uses `--report`: it is a metadata-bearing output and current versions can create or truncate it, including during a dry run.

Normal exports create a hidden `.osxphotos_export.db` that upstream warns may contain sensitive people and location metadata. Every export in this skill uses `--no-exportdb`, especially for share-bound output. Disclose that this prevents later incremental `--update`; this skill intentionally does not support `--update`, `--force-update`, or persistent `--exportdb` state.

Bind the reviewed destination before the dry run. The input must already be a lexically normalized absolute path; equality with `realpath` rejects a symlink leaf or ancestor. Capture the existing directory's device/inode identity without logging unrelated contents:

```bash
photos_export_dest="/absolute/new/export-directory"
test -d "$photos_export_dest" && test ! -L "$photos_export_dest"
test "$photos_export_dest" = "$(realpath "$photos_export_dest")"
photos_export_identity="$(stat -f '%d:%i' "$photos_export_dest")"
```

Preview one resolved asset, including both original and edited variants and JSON sidecars:

```bash
osxphotos export "$photos_export_dest" \
  --uuid "<photo-uuid>" \
  --sidecar json \
  --no-exportdb \
  --dry-run \
  --verbose
```

After the preview matches and the user confirms the exact final command, re-run the source/shared checks and then re-bind the destination immediately before execution:

```bash
test -d "$photos_export_dest" && test ! -L "$photos_export_dest"
test "$photos_export_dest" = "$(realpath "$photos_export_dest")"
test "$photos_export_identity" = "$(stat -f '%d:%i' "$photos_export_dest")"

osxphotos export "$photos_export_dest" \
  --uuid "<photo-uuid>" \
  --sidecar json \
  --no-exportdb \
  --verbose
```

The final command differs only by removal of `--dry-run`. Do not make any other selection or variant change. The CLI still opens the directory by path after the check, so disclose the residual non-atomic replacement race and stop if the destination is in a location controlled by another user or process.

Variant controls:

```bash
# Original only
osxphotos export "$photos_export_dest" \
  --uuid "<photo-uuid>" \
  --skip-edited \
  --no-exportdb \
  --dry-run \
  --verbose

# Current edited version when one exists; otherwise the original
osxphotos export "$photos_export_dest" \
  --uuid "<photo-uuid>" \
  --skip-original-if-edited \
  --no-exportdb \
  --dry-run \
  --verbose
```

Add `--skip-live`, `--skip-raw`, or `--skip-bursts` only when the user does not want those associated components. Add `--download-missing` only after disclosing and confirming the iCloud/network behavior. Never add `--overwrite` or `--cleanup`.

## Preview and Apply Album or Metadata Changes

Use `batch-edit` and a UUID whenever possible. First inspect the raw literal values for every `--title`, `--description`, `--keyword`, `--album`, and `--add-to-album` option. Reject the operation if any value contains `{` or `}`: these options are processed by the osxphotos template system. Do not escape, strip, or reinterpret the braces.

After verifying the active library with `osxphotos info`, resolving the UUID, auditing its shared states, confirming the destination album is not shared or explicitly reconfirming potential exposure, and validating that the album literal contains no braces, preview:

```bash
osxphotos batch-edit \
  --uuid "<photo-uuid>" \
  --add-to-album "<album>" \
  --dry-run \
  --verbose
```

After an exact preview and fresh confirmation, rerun `osxphotos info`, the compact UUID/current-value query, supported shared-state counts, and destination shared-status check. If any value differs from the confirmed snapshot, stop and re-preview; otherwise remove only `--dry-run` and execute without delay:

```bash
osxphotos batch-edit \
  --uuid "<photo-uuid>" \
  --add-to-album "<album>" \
  --verbose
```

Additive metadata examples follow the same shared-state audit, brace rejection, active-library recheck, and preview/apply pair:

```bash
osxphotos batch-edit --uuid "<photo-uuid>" --keyword "<keyword>" --dry-run --verbose
osxphotos batch-edit --uuid "<photo-uuid>" --title "<title>" --dry-run --verbose
osxphotos batch-edit --uuid "<photo-uuid>" --description "<description>" --dry-run --verbose
osxphotos batch-edit --uuid "<photo-uuid>" --set-favorite --dry-run --verbose
```

Re-run the compact UUID query after applying a change. Album additions cannot be undone by `batch-edit --undo`, so confirmation and post-write verification are mandatory.

## Excluded Operations

Do not use these in this skill:

- `--cleanup`, `--overwrite`, or export-database delete options
- `import`, `push-exif`, `sync`, `timewarp`, `repair`, or direct database writes
- `--replace-keywords` or clearing metadata without a separate, explicit destructive-change request
- `--query-function` or `run` with remote code

No command in this skill deletes Photos assets or albums.
