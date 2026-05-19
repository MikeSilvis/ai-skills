---
name: qa-run
description: Run a full visual and functional QA pass on a web app. Audits every page on desktop and mobile, dispatches fixes to other agents, re-verifies, and opens a PR when everything passes. Works across any web project — detects routes, dev URL, and validate command from the repo. Supports focused modes (e.g. `silly-classic`) that scope the run to a single feature and run domain-specific functional flows (team creation, scoring, winners) on top of the visual audit.
---

# QA Run — Audit, Fix, Verify, Ship

You are the QA agent. Your job is to audit every page of the web app, get issues fixed by other agents, verify the fixes, and open a PR when everything is clean. You do NOT edit source code yourself.

This skill is project-agnostic. Before you begin, discover the project's specifics from the repo itself (dev URL, routes, validate command). Do not hardcode a project name or URL.

## Focused Mode

If the user invokes this skill with a target argument (e.g. `/msilvis:qa-run silly-classic`), scope the run to ONLY that feature:

- Skip route discovery for the rest of the app — only audit the routes listed in the matching focused section below.
- Run the functional flows defined in that section *in addition to* the visual audit. These exercise real user actions (create data, edit state, check derived output) and catch regressions the visual pass can't see.
- The PR title should reflect the scope (e.g. "QA: Silly Classic visual + functional fixes").

Available targets:

- `silly-classic` — see [Silly Classic Focused Mode](#silly-classic-focused-mode) below

If the user did not pass a target, do a full-app audit as normal and skip the focused sections.

## Before You Start

1. **Detect the dev URL.** Check, in order:
   - `CLAUDE.md` / `README.md` for a documented dev URL (e.g. `https://<project>.local`, `http://localhost:3000`)
   - `Caddyfile` or `docker-compose.yml` for a proxy hostname
   - Fall back to `http://localhost:3000`
2. **Confirm the dev server is running** — navigate to the detected URL and verify it loads. If not, tell the user to start dev (e.g. `mise run dev`, `pnpm dev`, or `npm run dev` — pick based on the repo) and stop.
3. **Load browser tools**: `ToolSearch` → `select:mcp__claude-in-chrome__tabs_context_mcp`, then call it. If the repo uses Playwright MCP instead, use those tools.
4. **Discover routes.** Look for:
   - `apps/web/src/lib/routes.ts` or similar route manifest
   - Next.js App Router: `app/**/page.tsx` (or `src/app/**/page.tsx`)
   - Next.js Pages Router: `pages/**/*.tsx`
   - Any framework-specific routing file
   Build the page inventory from what you find. Group into Public / Admin / Member (or similar auth tiers) if the repo has that distinction.
5. **Detect the validate command.** Check `package.json` scripts and `CLAUDE.md`:
   - Prefer `mise run validate` if `.mise.toml` exists and defines it
   - Else `pnpm run validate`, `pnpm run ci`, `npm run validate`, or the documented pre-push check
6. **Create a fresh QA branch**: `git checkout -b qa/visual-audit-$(date +%Y%m%d) main` (use `master` if that's the default).

## The Loop

Repeat this cycle until every page passes on both viewports:

```
AUDIT → DISPATCH FIXES → WAIT → RE-VERIFY → (loop if issues remain)
```

### Phase 1: Audit

For each discovered page, test **both** viewports:

**Desktop (1440×900):**

1. Resize window → 1440×900
2. Navigate to the page URL
3. Read the full page
4. Read console messages → check for JS errors

**Mobile (390×844):**

1. Resize window → 390×844
2. Reload the page
3. Same checks as desktop

**What to check on every page:**

- Layout: centered content, max-width respected, no horizontal overflow
- Typography: clear heading hierarchy, readable body text, no truncation
- Spacing: consistent between sections, cards, elements
- Navigation: header correct, nav links present, dropdowns work
- Images/assets: all load, no broken icons
- Interactive elements: buttons styled, links distinguishable
- Footer: renders fully, links present
- Console: no JS errors or warnings
- **Mobile-specific:** hamburger menu works, touch targets ≥44px, content stacks vertically, text readable without zoom, grids go single-column

**Classify each finding:**

- Clearly broken or wrong → dispatch to feature-builder
- Unsure if it's intentional → ask designer first
- Looks fine → PASS, move on

### Phase 2: Dispatch Fixes

**For clear bugs** — write to `.context/todos.md` for the **feature-builder agent**:

```markdown
## QA Fix — [Page Name] — [Short Description]

**Viewport:** Desktop (1440×900) | Mobile (390×844) | Both
**Page:** [URL]
**What's wrong:** [clear description]
**Expected behavior:** [what it should look like or do]
**Priority:** high | medium
@feature-builder — Please fix this.
```

**For design ambiguity** — write to `.context/notes.md` for the **designer agent**:

```markdown
## QA Question — [Page Name]

**What I see:** [describe the issue and viewport]
**What I expected:** [your best guess]
@designer — Is this intentional or a bug? If it's a bug, what should it look like?
```

Batch all issues for a page together. Don't write one-at-a-time — collect everything from the full audit first, then write all dispatch notes at once.

### Phase 3: Wait & Monitor

After dispatching:

1. Periodically check `.context/todos.md` for completed items (feature-builder will mark them done).
2. Check `.context/notes.md` for designer responses.
3. If the designer says something is a bug, add it to `.context/todos.md` for feature-builder.
4. If the designer says it's intentional, mark it as PASS.

### Phase 4: Re-Verify

Once feature-builder marks fixes as done:

1. Reload the affected pages in **both** viewports.
2. Verify each fix actually resolved the issue.
3. If a fix didn't work or introduced a new problem, update `.context/todos.md` with what's still wrong.
4. Loop back to Phase 2 for any remaining issues.

### Exit Condition

The loop ends when **every page passes on both desktop and mobile** — no layout breaks, no console errors, no visual issues.

## Phase 5: Ship It

Once all pages pass:

1. Run the detected validate command to make sure nothing is broken from the fixes.
2. If validate fails, write the failures to `.context/todos.md` for feature-builder and loop back.
3. Once validate passes, commit all changes and create a PR:

   ```bash
   git add -A
   git commit -m "fix: visual and functional QA fixes

   Automated QA audit found and fixed issues across [N] pages.

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
   git push -u origin HEAD
   gh pr create --title "QA: visual and functional fixes" --body "$(cat <<'EOF'
   ## Summary
   Automated QA audit of all web pages on desktop (1440×900) and mobile (390×844).

   ## Changes
   [list the fixes that were made — read the git diff to summarize]

   ## Tested
   - Every public page on desktop and mobile viewports
   - Auth-gated pages (if accessible)
   - Validate command passes

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

4. Output the PR URL.

## Tick the Test Plan When Run Against an Existing PR

If this skill is invoked against a specific PR (e.g. you're QA'ing a feature branch the bot just opened), each functional flow above corresponds to one or more `- [ ]` items in the PR's `## Test plan`. After every flow that passes, flip its matching boxes from `- [ ]` to `- [x] ` in the PR body.

- Only tick items you genuinely verified. If a flow surfaced a fix-and-loop, only tick the box once the final re-verify passes.
- Use the canonical pattern from the `pr-test-runner` skill — match the unique trailing text of each item, build the new body, run `gh pr edit $PR --body-file <new>`, and never alter the wording of a test plan item. Only flip its leading `[ ]` to `[x]`.
- Re-fetch the body (`gh pr view $PR --json body --jq .body`) right before the edit so you don't clobber concurrent changes. If the test plan changed under you, abort and tell the user.
- Skip this section entirely when the skill is creating its own brand-new QA PR — there is nothing to tick on a body you just wrote.

## Safety

- You do **not** edit source code. You audit and dispatch.
- Do not submit forms, create accounts, or modify data in the app **unless the focused mode you are running explicitly calls for it** (focused functional flows will tell you to create/edit data in an isolated, throwaway browser state).
- If a page requires auth and you're not logged in, mark it SKIP.
- If the dev server goes down mid-run, stop and tell the user.
- Max 3 fix loops per page — if something isn't getting fixed after 3 rounds, flag it to the user instead of looping forever.

---

## Silly Classic Focused Mode

Triggered by `/msilvis:qa-run silly-classic`. Scope: only the Silly Classic event page and its tabs. State lives in `localStorage` (keys prefixed `sillyClassic.`), so everything can be exercised end-to-end in a single browser without touching the backend.

### Scope

Audit only these URLs (both desktop 1440×900 and mobile 390×844):

- `/events/silly-classic` (Overview tab — default)
- `/events/silly-classic?tab=rules`
- `/events/silly-classic?tab=play` (Leaderboard + team entry)
- `/events/silly-classic/register` (must redirect to `?tab=play&action=register` and auto-open the registration sheet — the `action` param is stripped after it's consumed)
- `/events/silly-classic/scorecard` (must redirect to `?tab=play` — the Play tab itself, no auto sheet unless a `team=<id>` param is also present)

Skip all other routes in the app.

**Scrolling + animation gotcha.** `AnimatedSection` fades content in on mount. Before this skill was corrected, sections used `whileInView`, which meant Playwright's `fullPage` screenshot would catch content below the fold at `opacity: 0`. If a future regression reintroduces scroll-gated animations, the Rules tab will look empty in screenshots. If you see a sparse tab with just a heading + one card, scroll the real browser to wake animations before screenshotting, and file a todo to revert to mount-triggered `animate`.

### Setup (before any functional flow)

1. Open the Play tab at `/events/silly-classic?tab=play`.
2. In the browser console, clear prior state so the run is reproducible:
   ```js
   localStorage.removeItem('sillyClassic.teams.v1');
   localStorage.removeItem('sillyClassic.scorecards.v1');
   localStorage.removeItem('sillyClassic.rotations.v1');
   location.reload();
   ```
   Storage shape reminders (from `data/storage.ts`):
   - `sillyClassic.teams.v1` is a `Team[]` array.
   - `sillyClassic.scorecards.v1` is a `Record<teamId, Scorecard>` — **keyed by team id, not an array**. If you seed this by hand, use object form or the app won't read it.
   - `sillyClassic.rotations.v1` holds `{ rotations, generatedAt, teamIdsSnapshot }`. A reconciler runs on `SillyClassic` mount (`reconcileRotations`) that regenerates rotations when `teamIdsSnapshot` drifts from the current teams.
3. Confirm the leaderboard shows its empty state with a "Register a team" CTA.
4. **Create a screenshot folder** so the user can review every key state afterward:
   ```bash
   mkdir -p .context/qa-screenshots/silly-classic-$(date +%Y%m%d-%H%M%S)
   ```
   Save this path as `$SHOT_DIR` for the rest of the run. All screenshots go here, named `NN-<viewport>-<description>.png` (e.g. `03-desktop-leaderboard-4-teams.png`) so they sort chronologically.

Do this once per focused run. Do **not** clear state mid-run — later flows depend on data created by earlier ones.

### Screenshot checklist

Capture screenshots at every checkpoint marked with a **📸** below. Use the Playwright MCP tool `mcp__playwright__browser_take_screenshot` with `filename: "$SHOT_DIR/NN-<viewport>-<description>.png"` and `fullPage: true` unless a sheet/modal is the subject (then `fullPage: false` so the current viewport framing is preserved). Capture both viewports at the end of each flow even if only desktop was active mid-flow — the mobile side is where layout regressions hide.

At the end of the run, list every screenshot in the PR description under a "Screenshots" section grouped by flow so the user can scan them in order.

### Functional Flow 1 — Add & Remove Teams (watch reactivity)

This flow is about **watching the UI react in real time** to roster changes. After each add or remove, confirm the reactive pieces updated before moving on. The pieces that must react every time:

- **Hero stat counter** — the teams count in the hero header
- **Leaderboard row count** — one row per team, ordered by standings
- **Empty state** — "Register a team" CTA appears at 0 teams, disappears at ≥1
- **Rotations storage** — `sillyClassic.rotations.v1` is absent at <2 teams, present at ≥2, and its `teamIdsSnapshot` matches the current team IDs sorted
- **Scorecard matchup pills** — open any existing team's scorecard; when a new team is added that becomes its opponent in a rotation, the "— bye rotation —" pill should flip to "vs <new team name>" without a reload

**📸 Baseline:** before adding anything, screenshot the empty-state leaderboard on both viewports (`01-desktop-empty-state.png`, `01-mobile-empty-state.png`).

#### Add teams

Register **four** teams so rotations and matchups have something to work with (`rotations.ts` needs ≥2 teams; 4 exercises all three rotations cleanly).

For each team in order:

1. Click the "Register team" FAB (or the Register button in the leaderboard empty state for the first one).
2. The registration sheet should slide in from the right with fields: Team Name, Player 1 Name, Player 2 Name.
3. **Validation check (first team only):** try submitting with a 1-character team name. Expect inline error "Must be at least 2 characters" and the form should not submit.
4. Fill valid values and submit. Expect:
   - Toast: "Team registered" with the team name as description
   - Sheet closes, then the scorecard sheet opens automatically for the new team
   - Hero stat counter increments by 1 (watch the number — it must update live, no reload)
   - On return to leaderboard: a new row appears, total row count = team count
5. Close the scorecard sheet and **before registering the next team**, verify the reactive pieces above.

Use these four teams verbatim so score math below is deterministic:

| Team name | Player 1 | Player 2 |
|---|---|---|
| Fairway to Heaven | Jane Doe | John Doe |
| Bogey Nights | Pat Lee | Sam Kim |
| The Mulligans | Alex Rae | Jordan Tess |
| Grip It and Sip It | Chris Vale | Morgan Ford |

**Watch-while-adding checkpoints:**

- **📸** Registration sheet open with fields filled for team 1 (`02-desktop-registration-sheet.png`).
- **📸** Validation error state when submitting a 1-char team name (`03-desktop-registration-validation.png`).
- After team 1: hero shows `1`, leaderboard has 1 row, **no** rotations key in localStorage (needs ≥2). Hero "Rotations" stat reads `0`.
- After team 2: hero shows `2`, 2 rows, `sillyClassic.rotations.v1` now exists, `teamIdsSnapshot` has both IDs sorted. Hero "Rotations" reads `3` (there are always 3 rotation slots defined; with 2 teams, each slot contains the same single pairing).
- Between teams 2 and 3, open team 1's scorecard. With exactly 2 teams, every rotation pairs those two teams (no byes — `generateRotations` fills all 3 rotations with the single possible pairing). All three rotation blocks should read "vs <team 2>". **📸** Capture the scorecard with all three rotations filled (`04-desktop-scorecard-bye-pills.png`). Keep the scorecard sheet open. Register team 3 via the FAB — now with 3 teams each rotation has one pair + one bye; the team facing a bye in a given rotation shows "— bye rotation —". **📸** Capture the post-flip scorecard showing the new mix of vs-opponent + bye pills (`05-desktop-scorecard-bye-filled.png`). Close the scorecard sheet after team 3 is added.
- After team 4: hero shows `4`, 4 rows, all three rotations in `sillyClassic.rotations.v1` have matchups (no bye). **📸** Full leaderboard with 4 teams, both viewports (`06-desktop-leaderboard-4-teams.png`, `06-mobile-leaderboard-4-teams.png`).

**Edit flow:** open "Bogey Nights" (click its row), click the pencil "Edit" button in the sheet header, change Player 2 to "Sam Park", save. Expect:

- Toast "Team updated"
- Sheet subtitle updates to "Pat Lee & Sam Park" immediately
- Leaderboard row subtitle also updates without a reload
- Rotations **do not** regenerate — `sillyClassic.rotations.v1.teamIdsSnapshot` is unchanged from before the edit (rotations only resync when the team **set** changes, not team content)

**Verify:** `JSON.parse(localStorage.getItem('sillyClassic.teams.v1'))` should return 4 teams, and `sillyClassic.rotations.v1.teamIdsSnapshot` should equal the 4 team IDs sorted.

#### Remove teams

There's no in-UI remove button — the app treats removals as an admin-level op. Exercise it through the storage API and `TEAMS_UPDATED_EVENT` so you can verify the UI reacts the same way it would if a remove button existed. Keep the Play tab visible while running these:

Remove one team (e.g. The Mulligans):

```js
const teams = JSON.parse(localStorage.getItem('sillyClassic.teams.v1'));
const removed = teams.find((t) => t.teamName === 'The Mulligans');
const next = teams.filter((t) => t.id !== removed.id);
localStorage.setItem('sillyClassic.teams.v1', JSON.stringify(next));
window.dispatchEvent(new Event('sillyClassic:teams-updated'));
```

Watch and verify **without reloading**:

- Hero teams count decrements (4 → 3)
- That team's leaderboard row disappears; remaining rows reorder if standings change
- `sillyClassic.rotations.v1.teamIdsSnapshot` updates to the remaining 3 IDs sorted (a fresh rotation is generated because the team set changed)
- If the removed team's scorecard sheet was open, the toast "That team no longer exists" fires and `?team=<id>` is stripped from the URL
- Any surviving team whose rotation opponent was the removed team now shows "— bye rotation —" in that rotation block

**📸** Leaderboard with 3 teams (`07-desktop-leaderboard-3-teams.png`).

Remove all the way down to validate the empty / threshold transitions:

1. Remove another team (3 → 2). Rotations key should still exist (>=2 teams). **📸** `08-desktop-leaderboard-2-teams.png`.
2. Remove one more (2 → 1). `sillyClassic.rotations.v1` should be **deleted** from localStorage. Any open scorecard must now show all three rotations as "— bye rotation —". **📸** `09-desktop-leaderboard-1-team.png` plus `10-desktop-scorecard-all-byes.png` if a scorecard is open.
3. Remove the last team (1 → 0). Leaderboard should render the empty state CTA again. Hero teams count = `0`. **📸** `11-desktop-empty-state-returned.png`.

#### Restore before next flow

Flows 2–4 assume the four-team roster. Restore it by repeating the **Add teams** section above (or paste the four teams back into `localStorage` and dispatch the event — either works; registering via the UI is preferred so the flow is also a sanity-check that add-after-empty still works).

### Functional Flow 2 — Modify Scores

Open the scorecard for **Fairway to Heaven** by clicking its row. The editor renders three rotation blocks (holes 1–6, 7–12, 13–18) with a stepper per hole for Score and Beers. The two side-bet inputs live on the par-3 CTP hole (**hole 15**, ft) and a par-5 longest-drive hole (**hole 8**, yd). Hole numbers are sourced from `TOFTREES_SCORECARD` in `data/scorecard.ts` — if they ever change in code, update this skill.

Enter this scorecard (strokes only, no beers yet) for **Fairway to Heaven**:

- Every hole: par (use the `+` stepper — it seeds at par). Total raw strokes = **72**.
- Hole 8 side bet: `285` yd (longest drive)
- Hole 15 side bet: `12` ft (closest to pin)

Expected totals bar: Strokes = **72**, Beer Credit = **—**, Adjusted = **72**, vs Par = **E** (thru 18), Total Beers = **—**.

**📸** Scorecard with all pars entered, no beers yet (`12-desktop-scorecard-pars-only.png`, `12-mobile-scorecard-pars-only.png`).

Now layer beer credit. Add 1 beer to holes 1, 5, 9, 13 (4 beers total). The app applies **½ stroke per beer** (confirmed by UI copy "Every beer you log knocks a half-stroke off your team score"). Expect:

- Total Beers = **4**
- Beer Credit = **−2**  (4 beers × 0.5)
- Adjusted = **70**
- vs Par = **−2**

**📸** Scorecard totals bar showing beer credit math (`13-desktop-scorecard-with-beers.png`).

**Bounds checks** (on any hole's Score stepper):

- Can't go below 1 stroke (the minus button either clears the cell or stops at 1; it should NOT go negative)
- Can't exceed 15 strokes (the `+` button disables at 15)
- Beers capped at 10

**Mulligans:** after rotation 2 a "Front 9 mulligans" bar renders; after rotation 3 a "Back 9 mulligans" bar. Each capped at 2. Verify `+` disables at 2 and `−` disables at 0.

Enter contrasting scores for the other three teams so the leaderboard has a clear winner and loser (remember: beer credit is ½ stroke per beer):

- **Bogey Nights:** every hole = par + 2 (double bogey). Expected raw = 72 + 36 = **108**. No beers → Adjusted = **108**.
- **The Mulligans:** every hole = par + 1 (bogey). Expected raw = **90**. Add 10 beers → Adjusted = **85** (beer credit −5).
- **Grip It and Sip It:** every hole = par. Expected raw = **72**. Add 6 beers → Adjusted = **69** (beer credit −3).

**📸** Rotation matchup footer on Fairway's scorecard showing a "Won by N" / "Lost by N" / "Leading by N" pill for each of the three rotations (`14-desktop-matchup-pills.png`).

### Functional Flow 3 — See Winners & Verify

Close the scorecard and return to the leaderboard.

**Overall standings (sorted by Adjusted, low wins):**

| Place | Team | Adjusted | vs Par | Beers |
|---|---|---|---|---|
| 1 | Grip It and Sip It | 69 | −3 | 6 |
| 2 | Fairway to Heaven | 70 | −2 | 4 |
| 3 | The Mulligans | 85 | +13 | 10 |
| 4 | Bogey Nights | 108 | +36 | 0 |

Verify:

- Rows are ordered 1 → 4 exactly as above.
- Place column shows medals (🥇🥈🥉 or whatever the `placeMedal` style renders) on the top 3.
- `vs Par` cell shows `−3`, `−2`, `+13`, `+36` with appropriate color classes (under-par green, over-par red).
- `Beers` column matches.

**📸** Final standings table with medals and vs-par coloring (`15-desktop-final-standings.png`, `15-mobile-final-standings.png`).
- Clicking row 1 (Grip It and Sip It) opens its scorecard sheet; the totals bar inside should match the leaderboard row.

**Rotation matchups (scorecard footer):**

Open Fairway to Heaven's scorecard. Each rotation block should show a footer with both team totals for the 6 holes in that rotation and a status pill. Expected statuses depend on who Fairway was paired with in each rotation (read from `sillyClassic.rotations.v1`), but the pill MUST be one of: `Won by N`, `Lost by N`, `Tied`, `Leading by N`, `Trailing by N`, `In progress`, `No matchup`, `— bye rotation —`. It must NEVER be blank or show `NaN`.

**Side-bet leaderboards (below the standings):**

- Closest to Pin (hole 15): Fairway to Heaven at 12 ft should be listed (only team with a CTP entry, so they win by default).
- Longest Drive (hole 8): Fairway to Heaven at 285 yd should be listed.

**📸** Side-bet leaderboards section (`16-desktop-side-bets.png`).

**Persistence check:**

1. Hard reload the page.
2. Leaderboard must render identically — same 4 teams, same order, same scores.
3. Open Fairway's scorecard — all strokes, beers, and side-bet entries still present.
4. The "Saved <timestamp>" hint should be visible at the bottom of the scorecard.

**Console check:** no errors or warnings logged during any of the above flows.

### Functional Flow 4 — Edge Cases

1. **Partial scores:** on "The Mulligans", clear strokes on holes 10–18 (stepper `−` until empty). `vs Par` should change to `+9 · thru 9` (or similar partial form). Adjusted drops to the partial total minus beer credit. `holesPlayed` reflects 9. **📸** `17-desktop-partial-round.png`.
2. **Beer credit floor:** on any team, set beers so they exceed strokes (e.g. 50 beers against 30 strokes). `adjustedStrokes` in `computeTotals` (storage.ts) clamps to **0** — never negative. The *leaderboard* displays this as `Adjusted − Par` in the "ADJUSTED" column, so a clamped team with 0 strokes reads as **−72** (0 − 72). That's expected and correct. The bug signal here is if `adjustedStrokes` itself goes negative (e.g. −15 strokes) — which would surface as the adjusted total being smaller than `−par`. **📸** `18-desktop-beer-credit-clamp.png`.
3. **Stale team URL:** paste `/events/silly-classic?tab=play&team=does-not-exist` directly into the address bar. Expect the toast "That team no longer exists" to fire on load and the `?team=` param to be stripped from the URL (the `tab=play` param should remain). **📸** `19-desktop-stale-team-toast.png` (capture quickly — toasts auto-dismiss).

### Dispatch & Exit

Classify findings the same way as the standard loop (feature-builder for clear bugs, designer for ambiguity). Focused-mode findings should tag the flow in the todo title and reference the relevant screenshot path so the fix agent can open it locally:

```markdown
## QA Fix — Silly Classic · Flow 2 · Score modify — Beer credit not clamping

**Viewport:** Both
**Page:** /events/silly-classic?tab=play (scorecard sheet open)
**Screenshot (local):** .context/qa-screenshots/silly-classic-20260423-140530/18-desktop-beer-credit-clamp.png
**What's wrong:** Adjusted went to −3 when beers exceeded strokes.
**Expected behavior:** Adjusted must clamp to 0 (see `computeTotals` in `data/storage.ts`).
**Priority:** high
@feature-builder — Please fix this.
```

**Local review gate — the user approves before anything ships.** Screenshots are for their eyes only; they stay in `.context/` (gitignored) and are never mentioned in the PR or pushed to GitHub.

1. Write `$SHOT_DIR/README.md` with a numbered list of every screenshot captured, grouped by flow, each line formatted `- NN-<viewport>-<description>.png — <what it shows>`.
2. Open the folder for the user and **stop**:
   ```bash
   open $SHOT_DIR
   ```
   Then message the user: "Screenshots are in `$SHOT_DIR` (local only). Review them and reply `yes` to ship the PR, or tell me what's wrong and I'll dispatch fixes."
3. Wait for the user's reply:
   - **yes / looks good / ship it** → proceed to validate + PR. The PR body does **not** mention screenshots at all.
   - **anything else (a finding, a concern, "redo this")** → treat it as a new dispatch, write the todo into `.context/todos.md` for feature-builder, loop back through the relevant flow, regenerate the affected screenshots, and present again.
4. Do **not** `git add` the screenshots. `.context/` is gitignored on this machine.

Exit condition: every flow above passes, visual audit of all five Silly Classic URLs passes on both viewports, validate command passes, every 📸 checkpoint produced a file in `$SHOT_DIR`, **and the user has replied yes to the local review**. Ship as a single PR titled "QA: Silly Classic visual + functional fixes".
