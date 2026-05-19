---
name: signoz-logs
description: Query and analyze SigNoz logs, traces, and observability data. Use when the user asks to check logs, investigate errors, debug issues, or pull data from SigNoz.
---

# SigNoz Observability

Logs in SigNoz are shared across multiple services (each GitHub repo = one service). **Always filter by service** to avoid mixing unrelated logs.

## Step 1 — Determine the Service

Identify the service name from context:
- Check the current repo name — it usually maps to the service (e.g., `lumina` repo → `lumina-server` service)
- If unclear, list services first: use `mcp__Signoz__signoz_list_services` with `timeRange: "7d"`
- If the user doesn't specify a service, **ask them** or infer from the current working directory

## Step 2 — Choose the Right Tool

### Logs

| Goal | Tool | Key params |
|------|------|------------|
| Recent logs (flexible query) | `signoz_search_logs` | `service`, `severity`, `timeRange`, `searchText`, `query` |
| Logs for a specific service | `signoz_search_logs_by_service` | `service` (required), `severity`, `searchText`, `timeRange` |
| Error logs only | `signoz_get_error_logs` | `service`, `timeRange` |
| Aggregate stats (counts, rates) | `signoz_aggregate_logs` | `aggregation`, `groupBy`, `service`, `severity` |
| Logs tied to an alert | `signoz_get_logs_for_alert` | `alertId` |
| Discover log fields | `signoz_get_logs_available_fields` | `searchText` |
| Get field values | `signoz_get_logs_field_values` | `fieldName` |

### Traces

| Goal | Tool | Key params |
|------|------|------------|
| Search traces by service | `signoz_search_traces_by_service` | `service` (required), `operation`, `error`, `timeRange` |
| Trace detail (all spans) | `signoz_get_trace_details` | `traceId` |
| Span hierarchy | `signoz_get_trace_span_hierarchy` | `traceId` |
| Error analysis | `signoz_get_trace_error_analysis` | `service`, `operation`, `timeRange` |
| Aggregate trace stats | `signoz_aggregate_traces` | `aggregation`, `groupBy`, `service` |
| Top operations | `signoz_get_service_top_operations` | `service` |

### Metrics, Alerts & Dashboards

| Goal | Tool | Key params |
|------|------|------------|
| List services | `signoz_list_services` | `timeRange` |
| List metric keys | `signoz_list_metric_keys` | — |
| Search metrics | `signoz_search_metric_by_text` | `searchText` |
| List alerts | `signoz_list_alerts` | — |
| Alert details | `signoz_get_alert` | `ruleId` |
| Alert history | `signoz_get_alert_history` | `ruleId`, `timeRange` |
| List dashboards | `signoz_list_dashboards` | — |
| Get dashboard | `signoz_get_dashboard` | `uuid` |
| Create dashboard | `signoz_create_dashboard` | (complex, see tool schema) |
| Raw query builder | `signoz_execute_builder_query` | `query` (Query Builder v5 JSON) |

**Always pass the `service` parameter when available.** Use `limit: "25"` for initial queries — you can paginate with `offset` if needed.

## Step 3 — Parse Large Responses with `parse-signoz`

SigNoz MCP responses are often too large for direct display and get saved to a temp file. **Never read the raw file with the Read tool** — it will exceed token limits.

Use the `parse-signoz` script to extract and format the data in a single Bash call:

```bash
PS=~/Development/dotfiles/bin/parse-signoz

# Summary: severity counts + unique messages (best default)
$PS logs "$FILE"

# Chronological list with timestamps and service names
$PS logs:timeline "$FILE"

# Only ERROR/FATAL entries with file/error attributes
$PS logs:errors "$FILE"

# Full detail: all entries with file, function, source, line
$PS logs:detail "$FILE"

# Aggregation results as a table
$PS aggregate "$FILE"

# Service list with health stats
$PS services "$FILE"

# Count rows in the response
$PS count "$FILE"

# Extract inner JSON for manual jq exploration
$PS raw "$FILE" | jq '.some.path'
```

`$FILE` is the temp file path from the MCP tool result message (e.g., `/Users/.../.claude/projects/.../tool-results/mcp-Signoz-signoz_search_logs-*.txt`).

### Workflow

1. Call the SigNoz MCP tool
2. If the response is small enough, it displays inline — summarize directly
3. If it gets saved to a file, run `parse-signoz <command> "$FILE"` via Bash
4. Present the formatted output to the user

## Step 4 — Present Results

Always present a concise summary to the user:
1. **Counts by severity** — how many INFO, WARN, ERROR, FATAL
2. **Unique error messages** — deduplicated list of distinct error bodies
3. **Time range** — when the earliest and latest logs occurred
4. **Actionable items** — highlight anything that looks like a real problem vs. routine noise

## Tips

- For error investigation, start with `signoz_get_error_logs` filtered by service — it's the fastest path
- Use `signoz_aggregate_logs` with `groupBy: "body"` to find the most frequent log messages
- The `query` param on `signoz_search_logs` supports SigNoz search syntax: `"service.name = 'my-svc' AND http.status_code >= 400"`
- When the user says "check the logs" without more context, default to errors in the last hour for the current service
- For latency investigation, use `signoz_aggregate_traces` with `aggregation: "p99"` and `aggregateOn: "durationNano"`
- Prefer `parse-signoz logs` over manual jq — it handles the MCP wrapper format automatically and saves tokens
