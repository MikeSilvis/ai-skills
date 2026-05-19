---
name: coolify
description: Manage Coolify self-hosting platform via Playwright browser automation. Use when the user asks to deploy, check status, manage services, view logs, or configure anything in Coolify.
---

# Coolify

Drive the Coolify dashboard with the Playwright MCP. The two common tasks are **diagnosing a failed deploy** and **editing env vars** — they get top billing below.

## Login

Read `~/Development/dotfiles/.env` for `COOLIFY_URL`, `COOLIFY_EMAIL`, `COOLIFY_PASSWORD`. Never log credentials.

1. `browser_navigate` → `${COOLIFY_URL}/login`
2. `browser_fill_form` — email field is `name="email"`, password is the other textbox
3. `browser_click` "Login" — confirm redirect to `/` (title `[Coolify] Dashboard | Coolify`)

If the URL stays on `/login`, snapshot to diagnose.

## Known IDs

Navigate directly — don't waste snapshots discovering these:

- **Siltop**: `/project/yigq03fkxrvp4lr52i5bp566/environment/chsb8glurvyjrlj9l4yuojdt/application/n12dggw9rku2pkxisijlwjnz` (db `dxut8rqjkfjqktdgofa9kgp4`)
- **D2 Ghost**: `/project/us04gc844kssg8g80wo04kss/environment/t4kckks4gwos08w08w0o008o`
- **Logs**: `/project/z40wssk4wws0swgowwk0o8w0/environment/u44k4w4gg8ooc0w88co840ok`
- **Lumina**: `/project/h4gocsooggokgoo0g8wgosk4/environment/twcs44gwgw8s0ok84skc0sow`
- **Portal**: `/project/i8oc84kkw0ok4wossos4co4c/environment/uwo0okwg0g884cgogo4o84wo`

For unknown projects, snapshot `/` once to grab IDs.

App-level URL suffixes: `/deployment`, `/deployment/{id}`, `/logs`, `/environment-variables`.

## Diagnose a Failed Deploy

1. Go to `…/application/{app_id}/deployment` — heading shows `Deployments (N)`, paginated 10 per page. Each row has Status (`Success`/`Failed`), commit SHA + message, duration, age, and Webhook/Manual.
2. Click into the latest **Failed** row → `…/deployment/{deployment_id}`.
3. **The accessibility snapshot will not show log text** — logs live in `div.flex.flex-col.overflow-y-auto.p-2.px-4` and one child element typically holds thousands of lines. Pull the last child's `innerText` directly:

   ```js
   () => {
     const c = document.querySelector('.flex.flex-col.overflow-y-auto.p-2.px-4');
     if (!c) return 'Log container not found';
     const last = c.children[c.children.length - 1];
     return last ? last.innerText.split('\n').slice(-200).join('\n') : 'empty';
   }
   ```

4. Search the output for `error`, `failed`, `unhealthy`, `exit code`. Summarize the root cause to the user in 2–3 sentences and let them decide next steps. The standard branch → PR → merge → redeploy flow is covered by the global git rules — don't reinvent it here.

## Edit Environment Variables

URL: `…/application/{app_id}/environment-variables`. Page splits into **Production Environment Variables** and **Preview Deployments Environment Variables**, each rendered as a list of inline rows.

Each row has three text inputs (`name="key"`, `name="value"` (type=password — toggle to reveal), `name="comment"`) plus four checkboxes (Build Variable, Multiline, Literal, Shared) and per-row **Update / Lock / Delete** buttons. A locked variable can't be edited until unlocked.

Above the list:
- **+ Add** — opens a "New Environment Variable" modal with the same fields. Submit to create.
- **Developer view** — toggles a bulk `KEY=value` textarea for paste-in edits; click again or **Save** to commit.

After any change Coolify shows a **"Confirm Application Stopping?"** modal — confirming triggers a restart so the new value takes effect. Tell the user this will cause a brief restart before clicking through.

For org-wide values, the project page has a **Shared Variables** tab — prefer it when the same secret is reused across apps in the team.

## Other Actions

- **Status**: snapshot `/` — projects show inline; click into a project to see Applications/Databases with `running`/`stopped`/`failed` badges.
- **Redeploy / Stop**: top nav of any application page has Redeploy and Stop buttons. Confirm destructive actions before clicking.
- **App logs** (not deploy logs): `…/application/{app_id}/logs`.
- **Webhook config** (Notifications → Webhook tab): per-team setup. For the Siltop deploy-status webhook contract, see `apps/web/app/api/v1/webhooks/coolify/route.ts` in the Siltop repo.

## Tips

- Navigate by URL, not by clicking through menus.
- Snapshot only when you need element refs or to read dynamic content; prefer `browser_evaluate` for log-style content that the a11y tree drops.
- After a mutation, snapshot once to confirm.
