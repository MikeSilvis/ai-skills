---
name: coolify-disk-cleanup
description: Free disk space on a Coolify server via the web app's built-in terminal. Use when Coolify warns about low disk space, or the user says "clean up coolify disk", "free space on the server", "coolify is running out of room", or similar. Related to the `coolify` skill — same login, but drives the in-app terminal instead of the dashboard pages.
---

# Coolify Disk Cleanup

Free disk space on a Coolify server by opening the in-app terminal (Playwright) and running Docker/system prune commands. The Coolify low-disk warning fires often, so this skill exists to make the cleanup a one-shot.

## Step 1 — Load Credentials & Login

Same as the `coolify` skill — read `~/Development/dotfiles/.env` for `COOLIFY_URL`, `COOLIFY_EMAIL`, `COOLIFY_PASSWORD`. **Never log or echo credentials.**

1. `browser_navigate` to `${COOLIFY_URL}/login`
2. `browser_fill_form` — email field has `name="email"`, password is the other textbox
3. `browser_click` the "Login" button
4. Confirm redirect to `${COOLIFY_URL}/`

## Step 2 — Open the Server Terminal

Coolify exposes a top-level terminal page (not per-server URL):

1. `browser_navigate` to `${COOLIFY_URL}/terminal`
2. The page shows a combobox of servers + containers ("Select a server or container") and a **Connect** button. Use `browser_fill_form` to set the combobox to the server name (default: `localhost`). If multiple servers exist, ask the user which one — never guess.
3. Click **Connect**. xterm.js connects via websocket; the prompt (`root@hostname:~#`) appears within ~1s.
4. Confirm by reading the xterm buffer (see Step 3).

## Step 3 — Capture Baseline Disk Usage & How to Read the Terminal

**Sending input**: `browser_type` with `target: ".xterm-helper-textarea"` and `submit: true`. The Coolify terminal is a real xterm.js with a hidden textarea overlay — clicking the visible terminal pane is not required.

**Reading output**: don't bother with `browser_snapshot` — xterm renders to a canvas, the a11y tree is empty. Use:
```js
() => document.querySelector('.xterm-rows')?.innerText
```
This returns only the **visible viewport** (~24 lines), not scrollback. Long commands like `docker builder prune` stream past quickly; the totals you care about (`Total reclaimed space`, the prompt return) stay on screen because they appear last. For very long output, slice the last 500–1000 chars and look for the totals line.

Send `df -h /` and capture the **Avail** and **Use%** values for `/`. If `Use%` < 50%, stop — there's nothing to do.

## Step 4 — Run Cleanup Commands

**Run everything as one detached script with output to a log file.** Do NOT send commands sequentially through xterm and poll the viewport — the websocket will drop on long prunes and you'll have to reconnect mid-run. With a log file, disconnects are harmless: reconnect and `tail` the log.

Write the script and start it in one shot. The whole thing should be one `browser_type` call:

```bash
cat > /tmp/coolify-cleanup.sh <<'EOF'
#!/usr/bin/env bash
set +e
LOG=/tmp/coolify-cleanup.log
: > $LOG
echo "=== START $(date -Is) ===" >> $LOG
echo "--- BEFORE ---" >> $LOG; df -h / >> $LOG
echo "--- BUILDER PRUNE ---" >> $LOG; docker builder prune -af >> $LOG 2>&1
echo "--- SYSTEM PRUNE ---" >> $LOG; docker system prune -af >> $LOG 2>&1
echo "--- COOLIFY LOGS ---" >> $LOG
find /data/coolify/applications -name "*.log" -mtime +7 -delete 2>>$LOG
find /data/coolify -name "deployment-*" -type d -mtime +14 -exec rm -rf {} + 2>>$LOG
echo "--- JOURNALD ---" >> $LOG; journalctl --vacuum-time=7d >> $LOG 2>&1
echo "--- APT CLEAN ---" >> $LOG; apt-get clean >> $LOG 2>&1
echo "--- AFTER ---" >> $LOG; df -h / >> $LOG
echo "=== DONE $(date -Is) ===" >> $LOG
EOF
chmod +x /tmp/coolify-cleanup.sh
nohup /tmp/coolify-cleanup.sh > /dev/null 2>&1 &
echo "STARTED PID=$!"
```

Then poll for completion. Expect **3–6 minutes** total on a busy Coolify host (system prune dominates). Use 60–90s between polls; do not poll faster.

```bash
pgrep -af coolify-cleanup.sh || tail -50 /tmp/coolify-cleanup.log
```

When `pgrep` returns empty, the run is finished — `tail -200 /tmp/coolify-cleanup.log` to extract:
- `Total reclaimed space:` lines from each prune
- `Vacuuming done, freed XM` from journald
- The two `df -h /` snapshots (BEFORE / AFTER)

**`docker volume prune` is intentionally NOT in this script** — it requires explicit user confirmation before each run (see Safety). If confirmed, run it as a separate one-liner and append the result to the report.

**If the websocket drops** during the wait, reconnect via Step 2, re-run the `pgrep` check, and continue tailing the log. The script keeps running on the host regardless.

## Step 5 — Capture After Disk Usage

Run `df -h /` again and diff against the baseline.

## Step 6 — Report

Report a concise summary to the user:

- Before: `<avail> free (<use%> used)`
- After: `<avail> free (<use%> used)`
- Reclaimed: per-command breakdown (builder cache, system prune, volumes if run, logs)
- Any commands that were skipped and why (e.g., volume prune skipped — not confirmed)

If `Use%` is still above 80% after cleanup, surface that and suggest the next step (large container investigation: `docker ps -s --format '{{.Names}}\t{{.Size}}' | sort -k2 -h`).

## Safety

- **Always ask before `docker volume prune`** — anonymous volumes from stopped containers (e.g., a Postgres that's currently down for maintenance) will be wiped. Named, in-use volumes are safe.
- Never run `rm -rf /` style commands or anything that touches `/data/coolify/databases`, `/data/coolify/backups`, or `/data/coolify/ssh`.
- If `df` shows `/` is already below 50% used, tell the user there's nothing to do instead of running prune commands for no reason.
- This skill is destructive in the "you can't get the deleted images back without re-pulling" sense. It is not destructive to running services — pruned items are by definition unused.

## Timing & Tips

- Total wall time is typically **3–6 minutes**, dominated by `docker system prune`. Poll every 60–90s — do not sample faster.
- Gate progress on `pgrep -af coolify-cleanup.sh` returning empty, not on viewport text. The xterm viewport only shows ~24 lines, so anything you care about scrolls off — read `/tmp/coolify-cleanup.log` instead.
- Reading output: `browser_evaluate` on `.xterm-rows` for live status; `tail /tmp/coolify-cleanup.log` (via the terminal) for the actual results. Skip `browser_snapshot` entirely — xterm renders to canvas and the a11y tree is empty.
- Websocket disconnects are expected and harmless when you've followed Step 4 (detached script + log file). Reconnect, re-check `pgrep`, keep tailing.
