---
name: coolify
description: Manage Coolify self-hosting platform via the official `coolify` CLI. Use when the user asks to deploy, check status, manage apps/databases/services, read logs, or edit environment variables in Coolify. Falls back to browser automation only for deployment build logs and the in-app terminal, which the API does not expose.
---

# Coolify

Drive Coolify with the official CLI (`coolify`, from `coollabsio/coolify-cli`). It talks to the Coolify API with a saved API token — no browser, no password login, no Playwright.

**Use the CLI for everything it covers.** Fall back to the browser only for what the API genuinely does not expose — deployment build logs and the server shell chief among them (see [Browser Fallback](#browser-fallback)).

**Reads always work; writes depend on the token's permission scope.** Before you promise to make a change in Coolify, confirm the saved token can actually write — see [Token Permissions](#token-permissions). A read-only token passes every connectivity check and fails only at the write itself.

Full command catalog: `references/commands.md`. Exhaustive upstream reference: <https://raw.githubusercontent.com/coollabsio/coolify-cli/main/llms-full.txt>.

## Safety

- **Never pass `-s` / `--show-sensitive` unless the user explicitly asks for a secret value.** These tokens often carry sensitive-data permission, so `-s` dumps real secrets (API keys, DB URLs, passwords) straight into the transcript. Without it every value renders as `********`, which is what you want almost always.
- **Never echo the API token.** Keep it in a shell variable or read it from a file inline so the value stays out of the transcript — and never install one from the clipboard (see [Bootstrap](#bootstrap) for why).
- **Check write scope before committing to a write.** Saying "I'll set that env var for you" and then hitting a 403 mid-task is worse than checking first — especially during a migration or cutover, where the fallback is the user doing it by hand under time pressure. See [Token Permissions](#token-permissions).
- Confirm before `delete`, `stop`, `database delete`, and `app env delete` — these are destructive and mostly irreversible. `restart` and `deploy` cause brief downtime; say so before running them.
- `app env sync` **updates and creates but never deletes**. It cannot be used to remove a variable — use `app env delete` for that.

## Bootstrap

Check first — if `coolify context verify` succeeds, skip this entire section.

```bash
coolify context verify
```

Expected: `✓ Connection successful` / `✓ Authentication valid` / `✓ Coolify version: <x>`. This proves the token is *valid*. It says nothing about what the token is allowed to do — go to [Token Permissions](#token-permissions) next.

If the binary is missing:

```bash
brew install coollabsio/coolify-cli/coolify-cli
```

### Where the token actually lives

**The CLI reads its token from the context stored in `~/.config/coolify/config.json`.** `~/.config/coolify/token` is only a convenience copy — writing to it changes nothing until the value is handed to `coolify context add`. Anyone who "fixes" the token by overwriting that file alone will watch the old token keep being used and conclude, wrongly, that the new one is broken too.

That file is also not guaranteed to hold a token. It has held a live Postgres connection string, pasted in by a clipboard-based install recipe at a moment when the clipboard held a database URL from an earlier step. So validate the shape before installing anything — a Coolify token is Laravel Sanctum format, `<id>|<48 chars>`:

```bash
tr -d '\n' < ~/.config/coolify/token | grep -qE '^[0-9]+\|[A-Za-z0-9]{40,}$' && echo "looks like a token" || echo "NOT a token — do not install this"
```

### Adding a context

`~/Development/dotfiles/.env` holds `COOLIFY_URL`. Mint a token at `${COOLIFY_URL}/security/api-tokens` — pick **write** (or root) unless the task is genuinely read-only.

Prompt for the value rather than reading it from the clipboard or a file. `read -rs` keeps it off the screen, out of the shell history, and immune to whatever `pbpaste` happens to be holding:

```bash
URL=$(grep '^COOLIFY_URL=' ~/Development/dotfiles/.env | cut -d= -f2- | tr -d '"'); URL="${URL%/}"
read -rs -p "Coolify API token: " T && printf '%s' "$T" > ~/.config/coolify/token && chmod 600 ~/.config/coolify/token
coolify context add -d "${URL#https://}" "$URL" "$T" && coolify context verify
unset T
```

Replacing the token on a context that already exists is a one-liner — no need to re-add it:

```bash
read -rs -p "Coolify API token: " T && coolify context set-token <context-name> "$T" && coolify context verify; unset T
```

Minting the token is a dashboard action behind the login. If a guardrail blocks that login, hand *only that step* to the user — stage everything else, then ask them to paste the token into the `read -rs` prompt.

`coolify context list` shows all contexts with tokens masked — safe to run.

## Token Permissions

`context verify` passes identically for a read-only token and a write token. Every read — `app list`, `app env list`, `app logs`, `resources list`, even `deploy` — works fine. The first sign of trouble is the write itself:

```
API error 403 on applications/<uuid>/envs: Missing required permissions: write
```

So the only real check is to attempt a write. Probe with a throwaway key, then clean it up:

```bash
coolify app env create <app-uuid> --key _WRITE_PROBE --value ok
coolify app env list <app-uuid> --format json | jq -r '.[] | select(.key=="_WRITE_PROBE") | .uuid'
coolify app env delete <app-uuid> <env-uuid-from-above>
```

The probe is safe: Coolify does not hot-reload env changes, so an unused key that is created and deleted without a redeploy never reaches the running app.

Run this **before** telling the user you'll make a change for them — not after. If it 403s, say so up front and route the change to the dashboard, rather than discovering the limitation halfway through a cutover. Fixing it means minting a token with write or root permission at `${COOLIFY_URL}/security/api-tokens` and re-running [Adding a context](#adding-a-context). Permissions are chosen when the token is created, so plan on issuing a new one rather than editing the existing one.

## What Actually Lives Here

**Siltop is the only project in Coolify.** Other services that used to run here have moved off it. A short `app list` — one application, no databases, no services — is the expected, healthy state, not a symptom of a scoping problem and not a reason to go hunting.

If you're asked to do something in Coolify for a project that isn't Siltop, the likely answer is that it isn't hosted on Coolify anymore. Say so and ask where it lives now, rather than assuming the CLI is hiding it.

One caveat if that ever changes: an API token is scoped to a single Coolify team, so `app list` and friends only return that team's resources. There is currently one team (`Root Team`), so this cannot bite today — `coolify team current` confirms it. If a second team appears, add a separate context for it, omitting `-d` so it doesn't steal the default, and select it per command with `coolify --context <name> <cmd>`.

## Discover UUIDs

Every command takes a Coolify UUID (never a numeric ID — teams are the sole exception, they use numeric IDs). Discover rather than hardcode:

```bash
coolify resources list              # everything the token can see, with type + status
coolify projects list               # project UUIDs
coolify projects get <project-uuid> # environment UUIDs within a project
coolify app list                    # app uuid, name, status, git_branch, fqdn
coolify server list                 # server UUIDs (IP/user/port masked without -s)
```

Add `--format json` when you need to parse; `--format pretty` when debugging. Table is the default and is the most readable for reporting back to the user.

## Check Status

```bash
coolify resources list
coolify app get <app-uuid>
```

`status` reads `running:healthy`, `running:unhealthy`, `exited`, or `stopped`. `app get --format json` returns the full config — build pack, health check path, ports, domains, git repo/branch — which is usually what you actually need when diagnosing "why is this behaving oddly".

## Deploy and Lifecycle

```bash
coolify deploy name <app-name>          # deploy by name — easier than UUID
coolify deploy uuid <app-uuid>
coolify deploy batch api,worker,web     # several at once
coolify deploy uuid <uuid> --force      # force rebuild, ignoring cache
coolify deploy list                     # in-flight deployments (empty when nothing is running)
coolify deploy cancel <deployment-uuid>

coolify app restart <app-uuid>
coolify app stop <app-uuid>
coolify app start <app-uuid>
```

`deploy list` shows only active/queued deployments — it returns `No data` when nothing is deploying. For deployment *history*, use `app deployments list` below.

## Diagnose a Failed Deploy

```bash
coolify app deployments list <app-uuid>
```

Returns the recent deployments with `deployment_uuid`, `status` (`finished` / `failed` / `in_progress`), commit SHA, and server. Identify the newest `failed` row.

**Build logs are not available through the CLI.** On Coolify 4.x the `GET /api/v1/deployments/{uuid}` response contains no `logs` field at all, so `coolify app deployments logs` prints `No logs available for deployment <uuid> (Status: ...)` for *every* deployment, finished or failed. This is an API gap, not a permissions problem and not log retention — do not burn turns retrying it with different flags. Go to [Browser Fallback](#browser-fallback) for the actual build output.

What the CLI *can* tell you before you open a browser: which commit failed, whether later deploys succeeded (so the failure is already resolved), and the app's current health:

```bash
coolify app deployments list <app-uuid> --format json
coolify app get <app-uuid>            # is it running now despite the failed deploy?
coolify app logs <app-uuid> -n 200    # runtime errors, which often explain the failure
```

## Runtime Logs

Container logs *do* work over the API — this is different from build logs:

```bash
coolify app logs <app-uuid> -n 200
coolify app logs <app-uuid> -f                 # follow, like tail -f
coolify app logs <app-uuid> --show-timestamps
coolify app logs <app-uuid> --service web      # one container in a compose app
coolify database logs <db-uuid>
coolify service logs <svc-uuid> --sub-service-name <name>
```

Default is 100 lines. For JSON-structured app logs, pipe through `jq` to filter by level rather than eyeballing the raw stream.

## Environment Variables

```bash
coolify app env list <app-uuid>                     # values masked — the safe default
coolify app env get <app-uuid> <KEY>
coolify app env create <app-uuid> --key API_KEY --value <value>
coolify app env update <app-uuid> <KEY> --value <value>
coolify app env delete <app-uuid> <env-uuid>        # takes the env UUID, not the key
coolify app env sync <app-uuid> --file .env         # update existing + create missing
```

Notes that matter:

- `env list` is a read and always works; `create`, `update`, `delete`, and `sync` are writes and need a write-scoped token. A read-only token returns `403 ... Missing required permissions: write` — check [Token Permissions](#token-permissions) before you promise an env change.
- `env list` shows `is_buildtime`, `is_runtime`, `is_preview`, `is_literal`, `is_shared` per row — check these before overwriting, since build-time-only vars behave differently from runtime ones.
- `--build-time` and `--runtime` both default to **true** on create/update. Pass them deliberately.
- `env delete` needs the variable's UUID (from `env list`), while `env get`/`env update` accept either the UUID or the key.
- Coolify does not hot-reload env changes. **Redeploy or restart for a new value to take effect** — tell the user that's coming before you do it.
- `database env` and `service env` mirror these commands; `service env` has no `--preview`.

## Browser Fallback

Two things the API does not expose. For these, and only these, drive the dashboard with the Playwright MCP.

Credentials: `~/Development/dotfiles/.env` → `COOLIFY_URL`, `COOLIFY_EMAIL`, `COOLIFY_PASSWORD`. Navigate to `${COOLIFY_URL}/login`, fill `name="email"` + the other textbox, click Login, confirm redirect to `/`. Never log credentials. **If a guardrail blocks the password entry, stop and hand the login to the user** — then continue from the authenticated session.

### 1. Deployment build logs

Navigate to `…/application/{app_id}/deployment/{deployment_id}`. The accessibility snapshot **will not** show log text — logs live in `div.flex.flex-col.overflow-y-auto.p-2.px-4` and one child holds thousands of lines. Pull `innerText` directly:

```js
() => {
  const c = document.querySelector('.flex.flex-col.overflow-y-auto.p-2.px-4');
  if (!c) return 'Log container not found';
  const last = c.children[c.children.length - 1];
  return last ? last.innerText.split('\n').slice(-200).join('\n') : 'empty';
}
```

Search for `error`, `failed`, `unhealthy`, `exit code`. Summarize root cause in 2–3 sentences and let the user decide next steps.

Dashboard URLs are `…/project/{project_uuid}/environment/{environment_uuid}/application/{app_uuid}` — all three UUIDs come from `projects list`, `projects get`, and `app list`, so build the URL from CLI output instead of guessing. App-level suffixes: `/deployment`, `/deployment/{id}`, `/logs`, `/environment-variables`.

### 2. Server shell / disk cleanup

`${COOLIFY_URL}/terminal` — see the separate `coolify-disk-cleanup` skill, which owns that workflow end to end.

Also dashboard-only: Shared Variables (team-wide env), notification/webhook config, and anything under team settings.

## Tips

- Prefer `deploy name` over `deploy uuid` — names are stable and readable in your summary back to the user.
- `--format json | jq` beats parsing the box-drawing table output.
- `coolify app update` changes config (branch, domains, build/start commands, health check) without a redeploy; follow with `coolify deploy` to apply.
- `coolify --context <name> <cmd>` overrides the default context per invocation. The CLI ships prebuilt `cloud` and `localhost` contexts alongside the real one, so check `coolify context list` if a command returns surprising data — you may be pointed at the wrong instance.
- `coolify update` upgrades the CLI itself.
