---
name: circleci-failing-builds
description: Diagnose and fix failing CircleCI builds. Use when the user asks to investigate CI failures, fix a broken build, or debug CircleCI pipeline issues.
---

# CircleCI Failing Build Resolution

## Quick Start — Use the Script

**Always use `cci-failed-logs` first.** It handles token auth, org/repo detection, pipeline discovery, and log fetching in a single non-interactive call.

```bash
CCI=~/Development/dotfiles/bin/cci-failed-logs

# Latest failures on current branch (most common)
$CCI

# Specific branch
$CCI --branch main

# Specific job number (from a CircleCI URL — fastest, skips discovery)
$CCI --job 333

# Just list which jobs failed, no logs
$CCI --summary

# Limit log output per step (default: 200 lines)
$CCI --max-lines 50
```

**If the user provides a CircleCI URL**, extract the job number (last path segment) and use `--job`:
```
https://app.circleci.com/pipelines/github/ORG/REPO/PIPELINE_NUM/workflows/WORKFLOW_ID/jobs/JOB_NUMBER
                                                                                             ^^^^^^^^^^
$CCI --job JOB_NUMBER
```

### Output Format

The script outputs structured, machine-readable text:
```
project: Org/Repo
branch: feature-branch
pipeline: uuid
failed_jobs: 2

=== JOB: test-suite (#333) ===
--- STEP: Run tests [failed] ---
<log lines, truncated to --max-lines>
--- END STEP ---
=== END JOB ===
```

## Workflow

1. **Run the script** — start with `$CCI` or `$CCI --job NUMBER`
2. **Read the failed step logs** — they're already filtered to just failures
3. **Classify the failure** (see below)
4. **Fix locally** — apply the minimal fix
5. **Validate locally** — run the same command that failed in CI
6. **Only push once local validation passes**

## Failure Classification

- **Test failure**: Read the test, understand what it expects, fix the code or update the test if the behavior change is intentional.
- **Lint / format**: Run the linter locally, apply auto-fixes where available, manually fix what remains.
- **Dependency**: Check lockfiles, ensure versions are pinned correctly, run `bundle install` / `npm install` / equivalent.
- **Config error**: Validate `.circleci/config.yml` syntax with `circleci config validate` if the CLI is installed.
- **Timeout / flaky**: Identify if the failure is non-deterministic. If flaky, note it to the user rather than making speculative fixes.

## Fallback — Manual API Calls

Only use raw API calls if the script fails or you need data it doesn't provide.

```bash
TOKEN=$(grep 'token:' ~/.circleci/cli.yml | awk '{print $2}')

# v1.1 API (more reliable with personal tokens)
# Get step-level detail for a specific job
curl -sf -H "Circle-Token: $TOKEN" \
  "https://circleci.com/api/v1.1/project/github/ORG/REPO/JOB_NUMBER" \
  | jq '[.steps[] | select(.actions[0].status == "failed") | {name: .name, status: .actions[0].status, output_url: .actions[0].output_url}]'

# Fetch log output from a failed step's output_url
curl -s "OUTPUT_URL" | gunzip 2>/dev/null | jq -r '.[].message'

# List recent failed builds for a branch
curl -sf -H "Circle-Token: $TOKEN" \
  "https://circleci.com/api/v1.1/project/github/ORG/REPO/tree/BRANCH?limit=10&filter=failed"
```

**IMPORTANT:** The v2 API often returns 404 with personal API tokens (`CCIPAT_...`). Always prefer v1.1. Note v1.1 uses `github` (not `gh`) as the VCS prefix.

## Safety

- Never modify `.circleci/config.yml` in ways that skip tests, disable checks, or weaken the pipeline.
- If a fix involves changing CI configuration, explain what changed and why.
- If the failure looks like a flaky test or infrastructure issue (not a code problem), tell the user rather than making unnecessary code changes.
