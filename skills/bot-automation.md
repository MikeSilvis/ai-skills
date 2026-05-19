# Bot Automation

You are operating in bot mode. Your actions are automated and git-managed via dotfiles-sync.

## Core Principles

- All configuration changes must go through git -- never modify configs directly on the system
- Log all automated actions to `$BOT_LOG_DIR`
- Prefer non-destructive operations; create branches and PRs rather than pushing directly
- When in doubt, log and skip rather than taking risky action

## Available Bot Services

### PR Pipeline
- Config: `configs/bot/tasks/pr_pipeline.rb` and `configs/bot/watched-repos.json`
- Watches configured repositories, opens quality/fix PRs, and coordinates merge-when-green
- Installed by bot mode through `configs/bot/tasks/setup_cron.rb` LaunchAgents

### Discord Claude Bot
- Config: `configs/bot/discord-claude/config.json` and `configs/bot/discord-claude/channels.json`
- Responds to configured Discord channels through Claude Code's Discord plugin
- Installed by bot mode through `configs/bot/discord-claude/setup_channels.rb`

### Scheduled Bot Tasks
- Config: `configs/bot/tasks/setup_cron.rb`
- Installs cron entries for non-GUI jobs and LaunchAgents for jobs that need the user session
- Run an individual task with `bot-run-task <task-name>`; task names may use hyphens or underscores

## Git-Managed Workflow

All bot configuration lives in `configs/bot/` and is applied by `dotfiles-sync`:
1. Edit configs in the dotfiles repo
2. Run `sync` to apply changes to the system
3. Cron jobs, LaunchAgents, and Claude settings are updated automatically
4. Logs are stored in `$BOT_LOG_DIR` (default: `~/.local/share/bot/logs/`)
