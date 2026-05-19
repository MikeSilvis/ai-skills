---
name: repo-setup
description: Set up a new or cloned repository for local development. Use when the user asks to scaffold a new project, bootstrap a repo, set up local dev environment, configure local domains/proxy, or get a project running locally.
---

# Repository Setup

## Detect Mode

Determine whether this is a **new repo** (scaffold from scratch) or an **existing repo** (bootstrap for local dev) based on the user's request and the current directory state.

- **New repo**: empty directory, or user says "create", "init", "scaffold", "new project"
- **Existing repo**: has source files, `package.json`, `Gemfile`, `go.mod`, etc.

## New Repo Scaffolding

When creating a new project, ask the user for:
1. **Project name** (if not obvious from the directory)
2. **Stack** (e.g., Node/TypeScript, Ruby/Rails, Go, Swift, Python)
3. **Purpose** (API, web app, CLI tool, library)

Then scaffold based on the stack:

### Common Setup (all projects)

1. Initialize git: `git init` (if not already a repo)
2. Create `.gitignore` appropriate for the stack
3. Create a minimal `README.md` with project name and setup instructions
4. Set up the local proxy if the project serves HTTP:
   ```bash
   proxy add <project-name> <port>
   ```

### Stack-Specific Scaffolding

**Node / TypeScript:**
- `npm init -y` or `pnpm init`
- Add TypeScript if requested: `pnpm add -D typescript @types/node tsx`
- Create `tsconfig.json` with strict mode
- Add scripts to `package.json`: `dev`, `build`, `start`, `test`
- Add `.nvmrc` or `.mise.toml` with the Node version

**Ruby / Rails:**
- `bundle init` or `rails new` as appropriate
- Add `.ruby-version` or `.mise.toml`
- Set up database config if Rails

**Go:**
- `go mod init` with the module path
- Create `cmd/` and `internal/` directory structure
- Add a `Makefile` with `build`, `run`, `test` targets

**Python:**
- Create `pyproject.toml` or `requirements.txt`
- Set up virtual environment
- Add `.python-version` or `.mise.toml`

**Swift / iOS:**
- Use Xcode project or Swift Package Manager as appropriate
- Set up `.mise.toml` for tool versions if needed

### After Scaffolding
- Run initial dependency install
- Verify the project builds/runs
- Make an initial commit with a descriptive message

## Existing Repo Bootstrap

When setting up an existing project for local development:

### 1. Read the Project

- Check for `README.md`, `CONTRIBUTING.md`, `docs/` for setup instructions
- Detect the stack from project files:
  - `package.json` → Node (check for `pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json` to pick the right package manager)
  - `Gemfile` → Ruby
  - `go.mod` → Go
  - `pyproject.toml` / `requirements.txt` → Python
  - `*.xcodeproj` / `Package.swift` → Swift
- Check for `.env.example`, `.env.sample`, or `.env.template`
- Check for `docker-compose.yml`
- Check for `Makefile`, `Procfile`, or `bin/setup`

### 2. Install Dependencies

Run the appropriate install command:
- **Node**: `pnpm install`, `npm install`, or `yarn install` (match the lockfile)
- **Ruby**: `bundle install`
- **Go**: `go mod download`
- **Python**: `pip install -r requirements.txt` or `pip install -e .`
- **Swift**: `swift package resolve`

If a `bin/setup` or `make setup` script exists, prefer running that.

### 3. Environment Configuration

- If `.env.example` exists and `.env` does not, copy it: `cp .env.example .env`
- Prompt the user for any values that need to be filled in (API keys, database URLs, etc.)
- Check for required environment variables referenced in code but missing from `.env`

### 4. Database Setup

If the project uses a database:
- Check if the database server is running (Postgres, MySQL, Redis, etc.)
- Run migrations: `rails db:setup`, `npx prisma migrate dev`, `make db-setup`, etc.
- Seed data if a seed script exists

### 5. Local Proxy Setup

If the project serves HTTP (has a dev server), set up a local domain:

```bash
proxy add <project-name> <port>
```

Detect the port from:
- `package.json` scripts (look for `--port`, `-p`, or common defaults)
- `config/puma.rb`, `Procfile`, `docker-compose.yml`
- Framework defaults (Rails: 3000, Next.js: 3000, Vite: 5173, Go: 8080)

Tell the user:
- The project will be available at `https://<project-name>.local`
- Run `proxy trust` if they haven't already (one-time setup for local HTTPS)

### 6. Verify Everything Works

- Start the dev server
- Confirm it responds (e.g., `curl -sk https://<project-name>.local` or open in browser)
- Run the test suite to verify the setup is correct
- Report any issues found and suggest fixes

## Safety

- Never overwrite existing files without asking (especially `.env`, config files, databases)
- If `bin/setup` exists, read it first to understand what it does before running
- Don't install global packages unless the project explicitly requires them
- Prefer project-local tool versions (`.mise.toml`, `.nvmrc`, `.ruby-version`) over system-wide installs
