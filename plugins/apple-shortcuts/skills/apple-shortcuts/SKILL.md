---
name: apple-shortcuts
description: List, open for human review, run, and sign Apple Shortcuts on macOS. Use when the user asks to discover shortcut names or folders, open a shortcut in the app, run an existing shortcut with file input or output, or sign a shortcut file for sharing.
---

# Apple Shortcuts

Use the built-in `shortcuts` command-line tool. Stay on its documented list, view, run, and sign surface; do not construct or modify undocumented shortcut archives.

## Operating contract

- Treat a shortcut as executable automation, not inert data. It may send content, delete files, invoke shell commands, upload data, access private apps, or control physical devices.
- List shortcut metadata before resolving a request. Prefer a stable identifier for `run` when names collide; `view` accepts only a name and cannot deterministically select among duplicate names.
- Open an unfamiliar shortcut in Shortcuts for human review before running it. `shortcuts view` is not a machine-verifiable safety audit.
- Consider an explicit request to run an exact, understood shortcut authorization for that run. Ask for confirmation when the shortcut is ambiguous, unfamiliar, downloaded, destructive, externally communicative, privacy-sensitive, or capable of physical effects.
- Review the exact input paths, output path, requested output type, and known side effects at the confirmation boundary.
- Bind every input to a canonical non-symlink path plus device/inode/size/mtime and SHA-256, and bind the output's canonical non-symlink parent plus device/inode. Immediately recheck those identities and require the output leaf to be absent by both `-e` and `-L` before execution.
- Never overwrite an existing output or signed shortcut file. The CLI lacks an atomic no-clobber flag, so disclose the residual path race and use a dedicated location not writable by another user/process.
- Minimize returned content. Do not print sensitive shortcut output merely to prove execution.
- Run a shortcut at most once unless the user explicitly asks to retry; retries may duplicate side effects.

## Workflow

1. Confirm this is macOS and `shortcuts` is available. Do not install an imitation command when it is absent.
2. Classify the request as discovery, review, execution, or signing.
3. Read [references/commands.md](references/commands.md) for the supported syntax and diagnostics.
4. List only the folder or shortcut metadata needed to resolve the target. If multiple identifiers share a name, identifiers can disambiguate execution, but refuse CLI-based `view` for that name and have the user select the exact shortcut manually in the Shortcuts app.
5. For execution, establish the shortcut's identity, intended inputs, output destination, and understood effects. Use the confirmation rules above. The CLI cannot hash or version a shortcut's action graph, so manual review cannot prove it stayed unchanged before a later CLI run.
6. For an unfamiliar or high-impact shortcut, prefer the user running it directly from the just-reviewed Shortcuts UI; otherwise reconfirm that residual review/run gap. Revalidate all input/output path identities, then run the exact command once without delay. Capture output only when required and keep it in a user-approved location.
7. Verify using the command's exit status and the expected output artifact or user-visible result. Do not rerun solely because a shortcut returned no stdout.
8. Report the shortcut name or identifier, whether it completed, and where any output was written. Redact private inputs and output values.

## Discovery and review

Use folder-scoped listing where possible. `shortcuts list --show-identifiers` emits names and identifiers but does not expose actions or permissions. If consequences are not already known and the name is unique, use `shortcuts view <name>` and ask the user to review the workflow in the Shortcuts app. When duplicate names exist, the CLI cannot encode the identifier for `view`; refuse deterministic CLI review and ask the user to open the exact item manually in Shortcuts instead.

Do not infer safety from a familiar name. A shortcut can be renamed without changing its actions.

## Running shortcuts

Use file inputs because the CLI does not accept arbitrary text on stdin. Prefer identifiers for execution after discovery. Treat every input file as data that the shortcut may disclose according to its actions.

Before using input or output paths:

- Resolve each to a lexically normalized absolute location and require `realpath` equality so symlink components are rejected.
- Capture each input's device/inode/size/mtime and SHA-256, and the output parent's device/inode.
- Check the output leaf with both `test ! -e` and `test ! -L` so a dangling symlink is not mistaken for absence.
- Revalidate every identity immediately before `shortcuts run`; abort and reconfirm on any delta.
- Create parent directories only when requested.
- Avoid temporary paths for output the user expects to keep.

If the shortcut prompts interactively, explain that user interaction may be required. Do not bypass macOS privacy or app permission prompts.

## Signing shortcut files

Signing establishes who may import the file; it does not review the workflow for safety. The signing service sends a copy of the shortcut to Apple for validation, and `people-who-know-me` embeds information that lets recipients verify the signer through their contacts. Disclose both facts and obtain explicit confirmation immediately before signing, especially when the shortcut contains private data or credentials. Inspect unfamiliar or downloaded content in the app first. Default to `people-who-know-me`; use `anyone` only when the user explicitly requests broader distribution. Bind/recheck the unsigned file and output parent exactly as for run inputs/outputs, keep the unsigned input intact, and write to a distinct absent output path.

## Boundaries

- Do not claim the CLI can create, edit, export, or introspect shortcut actions.
- Do not reverse-engineer or rewrite serialized `.shortcut` or plist internals as a fallback.
- Do not run downloaded shortcuts until the user has reviewed them in the Shortcuts app.
- Do not bypass TCC, app authentication, device unlock, or confirmation prompts.
- Do not expose shortcut names, folder names, inputs, or outputs unrelated to the request.
