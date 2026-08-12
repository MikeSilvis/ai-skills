# Coolify CLI — Full Command Catalog

Reference for `coolify` (coollabsio/coolify-cli). Load when the main skill's common workflows don't cover the task.

Upstream exhaustive reference: <https://raw.githubusercontent.com/coollabsio/coolify-cli/main/llms-full.txt>

## Global Flags

Available on every command:

- `--context <name>` — use a specific saved context instead of the default
- `--token <token>` — override the token from config
- `--format table|json|pretty` — output format (`table` is default)
- `-s, --show-sensitive` — reveal masked values. **Dumps real secrets; only with explicit user request.**
- `--debug` — debug output

UUIDs identify every resource. Teams are the only exception — they use numeric IDs.

## Contexts

```
coolify context list
coolify context add <name> <url> <token>     [-d|--default] [-f|--force]
coolify context get <name>
coolify context delete <name>
coolify context set-token <name> <token>
coolify context set-default <name>
coolify context update <name> [--name <new>] [--url <new>] [--token <new>]
coolify context use <name>
coolify context verify                        # connection + auth check
coolify context version                       # Coolify API version
```

Coolify Cloud uses the prebuilt `cloud` context: `coolify context set-token cloud <token>`.

## Meta

```
coolify version            # CLI version
coolify update             # update the CLI
coolify config             # config file location
coolify completion bash|zsh|fish|powershell
```

## Discovery

```
coolify resources list                  # every resource with type + status
coolify projects list
coolify projects get <uuid>             # environments in a project
coolify projects create --name <name> [--description <text>]
coolify tag list
coolify team list | current
coolify team get <team_id>
coolify team members list [team_id]
```

## Servers

`server` and `servers` are interchangeable.

```
coolify server list
coolify server get <uuid> [--resources]
coolify server add <name> <ip> <private_key_uuid> [-p <port>] [-u <user>] [--validate]
coolify server remove <uuid>
coolify server validate <uuid>
coolify server domains <uuid>
coolify server destinations list <server_uuid>
coolify server destinations create <server_uuid>
coolify server hetzner|digitalocean|vultr        # provider options + provisioning
```

## Applications

```
coolify app list
coolify app get <uuid>
coolify app delete <uuid> [-f]
coolify app start|stop|restart <uuid>
coolify app move <uuid> --environment-uuid <uuid>
coolify app tag list|add|remove
coolify app previews delete <app_uuid> <pr_id> [--force]
```

### Logs

```
coolify app logs <uuid> [-n <lines>] [-f] [--show-timestamps] [--service <name>]
```

Default 100 lines. `--service` selects one container in a Docker Compose app.

### Update config

```
coolify app update <uuid> [flags]
```

Flags: `--name` `--description` `--git-branch` `--git-repository` `--domains` `--compose-domain <service>=<url>[,<url>]` (repeatable; replaces existing mapping) `--build-command` `--start-command` `--install-command` `--base-directory` `--publish-directory` `--dockerfile` `--docker-image` `--docker-tag` `--ports-exposes` `--ports-mappings` `--health-check-enabled` `--health-check-path`

Config changes do not deploy themselves — follow with `coolify deploy`.

### Create

```
coolify app create public       --server-uuid --project-uuid (--environment-name|--environment-uuid) \
                                --git-repository --git-branch --build-pack --ports-exposes [--domains] [--instant-deploy]
coolify app create github       <same> --github-app-uuid <uuid>       # --git-repository is owner/repo
coolify app create deploy-key   <same> --private-key-uuid <uuid>      # --git-repository is an SSH URL
coolify app create dockerfile   --dockerfile <content> --server-uuid --project-uuid (--environment-*)
coolify app create dockerimage  --docker-registry-image-name <image> [--docker-registry-image-tag <tag>] \
                                --ports-exposes --server-uuid --project-uuid (--environment-*)
```

`--build-pack`: `nixpacks` | `static` | `dockerfile` | `dockercompose`.

Additional create flags: `--name` `--description` `--base-directory` `--publish-directory` `--build-command` `--start-command` `--install-command` `--health-check-enabled` `--health-check-path` `--limits-memory` `--limits-cpus` `--ports-mappings` `--git-commit-sha` `--destination-uuid` `--dockerfile-target-build` `--tag` `--tags`

### Deployments

```
coolify app deployments list <app-uuid>
coolify app deployments logs <app-uuid> [deployment-uuid] [-n <lines>] [-f] [--debuglogs]
```

**`deployments logs` returns nothing on Coolify 4.x** — the API response carries no `logs` field. Use the browser fallback in the main skill.

### Environment variables

```
coolify app env list <app_uuid>
coolify app env get <app_uuid> <env_uuid_or_key>
coolify app env create <app_uuid> --key <k> --value <v> [--preview] [--build-time] [--runtime] [--comment] [--is-literal] [--is-multiline]
coolify app env update <app_uuid> <env_uuid_or_key> --value <v> [--key <new>] [same flags]
coolify app env delete <app_uuid> <env_uuid> [--force]
coolify app env sync <app_uuid> -f <path> [--build-time] [--runtime] [--preview] [--is-literal]
```

`--build-time` and `--runtime` default to true. `sync` updates existing and creates missing; it never deletes.

### Storage

```
coolify app storage list <app_uuid>
coolify app storage create <app_uuid> --type persistent|file --mount-path <path> \
    [--name] [--host-path] [--content] [--is-directory] [--fs-path]
coolify app storage update <app_uuid> --uuid <storage_uuid> --type <type> [--is-preview-suffix-enabled] [...]
coolify app storage delete <app_uuid> <storage_uuid>
```

`--name` / `--host-path` are persistent-only; `--content` / `--is-directory` / `--fs-path` are file-only (`--fs-path` required with `--is-directory`).

## Databases

Types: `postgresql` `mysql` `mariadb` `mongodb` `redis` `keydb` `clickhouse` `dragonfly`

```
coolify database list
coolify database get <uuid>
coolify database create <type> --server-uuid --project-uuid (--environment-name|--environment-uuid) \
    [--destination-uuid] [--name] [--description] [--image] [--instant-deploy] [--is-public] [--public-port] \
    [--limits-memory] [--limits-cpus] [type-specific flags] [--tag] [--tags]
coolify database update <uuid>
coolify database delete <uuid> [--delete-configurations] [--delete-volumes] [--docker-cleanup] [--delete-connected-networks]
coolify database start|stop|restart <uuid>
coolify database logs <uuid>
coolify database move <uuid> --environment-uuid <uuid>
coolify database tag list|add|remove
```

All four `database delete` sub-flags default to **true** — deleting removes volumes and data.

### Backups

```
coolify database backup list <db_uuid>
coolify database backup create <db_uuid> --frequency "<cron>" [--enabled] [--save-s3] [--s3-storage-uuid] \
    [--databases-to-backup <list>] [--dump-all] [--timeout <s>] [--disable-local-backup] \
    [--retention-amount-locally] [--retention-days-locally] [--retention-max-storage-locally] \
    [--retention-amount-s3] [--retention-days-s3] [--retention-max-storage-s3]
coolify database backup update <db_uuid> <backup_uuid>
coolify database backup delete <db_uuid> <backup_uuid>
coolify database backup trigger <db_uuid> <backup_uuid>          # run one now
coolify database backup executions <db_uuid> <backup_uuid>
coolify database backup delete-execution <db_uuid> <backup_uuid> <execution_uuid>
```

### Database env / storage

```
coolify database env list|get|create|update|delete|sync <db_uuid> [...]
coolify database storage list|create|update|delete <db_uuid> [...]
```

`database env create` supports `--is-shown-once`; it has no `--preview`, `--build-time`, or `--runtime`.

## Services

```
coolify service list
coolify service get <uuid>
coolify service create --list-types                     # all one-click types
coolify service create <type> --server-uuid --project-uuid (--environment-*) \
    [--name] [--description] [--docker-compose <content>] [--destination-uuid] [--instant-deploy] [--tag] [--tags]
coolify service start|stop|restart|delete <uuid>
coolify service logs <uuid> --sub-service-name <name>
coolify service move <uuid> --environment-uuid <uuid>
coolify service tag list|add|remove
```

### Sub-resources

```
coolify service application list|get|update|logs|start|restart|stop <service_uuid> [<application_uuid>]
coolify service database    list|get|update|logs|start|restart|stop <service_uuid> [<database_uuid>]
coolify service env         list|get|create|update|delete|sync <service_uuid> [...]      # no --preview
coolify service storage     list|create|update|delete <service_uuid> [...]              # create needs --resource-uuid
```

## Deployments

```
coolify deploy uuid <uuid>          [--force] [--pull-request-id <id>] [--docker-tag <tag>]
coolify deploy name <name>          [same flags]
coolify deploy batch <n1,n2,...>    [same flags]
coolify deploy list                 # active/queued only — empty when idle
coolify deploy get <deployment-uuid>
coolify deploy cancel <deployment-uuid> [-f]
```

`--docker-tag` requires Coolify `4.0.0-beta.471+`.

## GitHub Apps

```
coolify github list
coolify github get <app_uuid>
coolify github create --name --html-url --app-id --installation-id --client-id --client-secret --private-key-uuid \
    [--api-url] [--organization] [--custom-user] [--custom-port] [--webhook-secret] [--system-wide]
coolify github update <app_uuid>
coolify github delete <app_uuid> [-f]
coolify github repos <app_uuid>
coolify github branches <app_uuid> <owner/repo>
```

## Destinations, Keys, Cloud Tokens

```
coolify destination list [--server <server_uuid>]
coolify destination get <uuid>
coolify destination create --server <uuid> --network <name> [--type standalone|swarm]
coolify destination delete <uuid>

coolify private-key list                          # also: private-keys, key, keys
coolify private-key add <name> <key_content_or_file_path>
coolify private-key remove <uuid>

coolify cloud-token list|get|create|update|delete|validate     # Hetzner, DigitalOcean, Vultr
```

## Coolify v5 Mesh (alpha)

These bypass the API and SSH into servers directly to manage a WireGuard/Podman mesh. Both trees require `--servers` and `--ssh-key`.

```
coolify init plan|bootstrap|extend|upgrade --servers <list> --ssh-key <path>
coolify firewall containers|list|allow|revoke --servers <list> --ssh-key <path>
```

Run `coolify init --help` / `coolify firewall --help` for the full flag set. Treat as experimental; confirm with the user before running anything beyond `init plan` and `firewall list`.
