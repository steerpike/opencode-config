# Honeycomb MCP Tools Reference

This project has the Honeycomb MCP configured, giving agents direct access to query production observability data.

## Configuration

The MCP is configured in `opencode.json`:
```json
{
  "mcp": {
    "honeycomb": {
      "type": "remote",
      "url": "https://mcp.honeycomb.io/mcp",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer ${HONEYCOMB_MCP}"
      }
    }
  }
}
```

**Required environment variable:** `HONEYCOMB_MCP` (API key)

## Our Environment

| Setting | Value |
|---------|-------|
| Environment slug | `test` |
| Primary dataset | `opencode-agents` |
| Service name | `opencode-agents` |

## Available MCP Tools

### run_query

Execute queries against Honeycomb datasets. This is the main tool for data analysis.

**Parameters:**
- `environment_slug` (required): Use `"test"`
- `dataset_slug` (required): Use `"opencode-agents"` 
- `query_spec` (required): Query specification object
- `include_samples` (optional): Include raw event samples
- `results_limit` (optional): Max results (default 1000)

**query_spec structure:**
```json
{
  "calculations": [{"op": "COUNT"}],           // Required: aggregations
  "filters": [...],                             // Optional: WHERE clauses
  "breakdowns": ["column1", "column2"],         // Optional: GROUP BY
  "time_range": "24h",                          // Time: "24h", "7d", etc.
  "limit": 20,                                  // Max groups in breakdown
  "granularity": 3600                           // Bucket size in seconds
}
```

**Calculation operations:**
- `COUNT` - Count events (with or without column)
- `SUM`, `AVG`, `MIN`, `MAX` - Numeric aggregations
- `P50`, `P90`, `P95`, `P99` - Percentiles
- `COUNT_DISTINCT` - Unique values
- `HEATMAP` - Distribution visualization

**Filter operators:**
- `=`, `!=`, `>`, `>=`, `<`, `<=` - Comparisons
- `exists`, `does-not-exist` - Null checks
- `contains`, `does-not-contain` - String matching
- `starts-with`, `ends-with` - String prefix/suffix
- `in`, `not-in` - Set membership

### get_trace

Retrieve all spans for a specific trace ID.

**Parameters:**
- `environment_slug` (required): Use `"test"`
- `trace_id` (required): The trace ID to look up
- `time_range` (optional): How far back to search (default "7d")
- `view_mode` (optional): `"auto"`, `"compact"`, `"full"`, `"focused"`

### find_columns

Search for columns by keyword. Useful when you don't know exact column names.

**Parameters:**
- `environment_slug` (required): Use `"test"`
- `input` (required): Search keyword
- `dataset_slug` (optional): Limit to specific dataset

### get_workspace_context

Get overview of available environments and datasets. No parameters required.

### get_dataset

Get detailed schema for a dataset including all columns.

**Parameters:**
- `environment_slug` (required): Use `"test"`
- `dataset_slug` (required): Use `"opencode-agents"`

### find_queries

Search saved and recent queries.

**Parameters:**
- `environment_slug` (required): Use `"test"`
- `input` (required): Search term

### run_bubbleup

Anomaly detection to find what makes a subset of data different.

**Parameters:**
- `query_pk` (required): Query result ID from a previous run_query
- `selection` (required): Time/value selection defining the anomaly

## Key Columns in opencode-agents

### Session-level

| Column | Type | Description |
|--------|------|-------------|
| `name` | string | Span name: `session:main`, `agent:{type}`, `phase:{name}` |
| `session.id` | string | Unique session identifier |
| `session.success` | boolean | Whether session completed successfully |
| `session.duration_ms` | int | Total session duration |
| `session.is_subagent` | boolean | True for delegated subagent sessions |
| `session.parent_id` | string | Parent session for subagents |

### Agent-level

| Column | Type | Description |
|--------|------|-------------|
| `agent.type` | string | `planner`, `builder`, `reviewer`, `debugger` |
| `agent.mode` | string | Agent mode from message |
| `phase.name` | string | `planning`, `implementation`, `review`, `diagnosis` |

### Tool-level

| Column | Type | Description |
|--------|------|-------------|
| `tool.name` | string | Tool name: `read`, `edit`, `bash`, `glob`, etc. |
| `tool.call_id` | string | Unique tool invocation ID |
| `tool.duration_ms` | int | Tool execution time |
| `tool.success` | boolean | Whether tool succeeded |
| `tool.error_message` | string | Error message if failed |
| `tools.summary` | string | Compact summary: `read:5,edit:3,bash:2` |
| `tools.total_count` | int | Total tool executions in session |
| `tools.error_count` | int | Failed tool count |

### Context

| Column | Type | Description |
|--------|------|-------------|
| `beads.task_id` | string | Associated Beads task (e.g., `bd-a1b2`) |
| `git.branch` | string | Git branch name |
| `git.commit` | string | Short commit hash |
| `plugin.version` | string | Tracing plugin version |
| `project.directory` | string | Working directory |

## Example Queries

### Find all errors in last 24 hours
```json
{
  "environment_slug": "test",
  "dataset_slug": "opencode-agents",
  "query_spec": {
    "calculations": [{"op": "COUNT"}],
    "filters": [{"column": "tools.error_count", "op": ">", "value": 0}],
    "breakdowns": ["name", "tool.error_message"],
    "time_range": "24h"
  }
}
```

### Session success rate by agent type
```json
{
  "environment_slug": "test",
  "dataset_slug": "opencode-agents",
  "query_spec": {
    "calculations": [{"op": "COUNT"}],
    "breakdowns": ["agent.type", "session.success"],
    "time_range": "7d"
  }
}
```

### P95 session duration by phase
```json
{
  "environment_slug": "test",
  "dataset_slug": "opencode-agents",
  "query_spec": {
    "calculations": [{"op": "P95", "column": "session.duration_ms"}],
    "breakdowns": ["phase.name"],
    "time_range": "7d"
  }
}
```

### Tool usage breakdown
```json
{
  "environment_slug": "test",
  "dataset_slug": "opencode-agents",
  "query_spec": {
    "calculations": [{"op": "COUNT"}],
    "filters": [{"column": "tool.name", "op": "exists"}],
    "breakdowns": ["tool.name"],
    "time_range": "24h",
    "limit": 20
  }
}
```

### Find work related to a Beads task
```json
{
  "environment_slug": "test",
  "dataset_slug": "opencode-agents",
  "query_spec": {
    "calculations": [{"op": "COUNT"}],
    "filters": [{"column": "beads.task_id", "op": "=", "value": "bd-xyz123"}],
    "breakdowns": ["name", "session.success"],
    "time_range": "7d"
  }
}
```

## Tips

1. **Always use `"test"` for environment_slug** - This is our Honeycomb environment
2. **Start with `find_columns`** if unsure what to query
3. **Use `time_range` strings** like `"24h"`, `"7d"` instead of epoch integers
4. **Include `breakdowns`** to see patterns, not just totals
5. **Use `include_samples: true`** to see actual event data when debugging
