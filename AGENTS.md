# Observability-Driven Development

## Quick Start - What's Available

This project has two key integrations you should use immediately:

### Beads (Task Tracking)
```bash
bd ready                    # See prioritized work
bd show <id>                # Get task details  
bd update <id> --status in_progress
bd close <id> --reason "Done"
```

### Honeycomb MCP (Observability)
You have direct access to Honeycomb via MCP tools. Use them to query production data:

| MCP Tool | Use For |
|----------|---------|
| `run_query` | Query sessions, errors, performance data |
| `get_trace` | Inspect a specific trace by ID |
| `find_columns` | Discover available attributes to query |
| `get_workspace_context` | See available environments/datasets |

**Environment:** `test`  
**Dataset:** `opencode-agents`

Example query for recent errors:
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

---

## Philosophy

Production is the only environment that matters. Every unit of work emits one wide event with all the context needed to debug without reproduction.

**Core principles:**
- One wide event per unit of work (session, request, operation)
- High cardinality is good - slice by user, feature, version, path
- Ask new questions without deploying new code
- The trace is the test - verify changes by querying production

This approach comes from Charity Majors and the Honeycomb school of observability. We don't debug locally and hope it works in prod. We instrument thoroughly and debug with real data.

## Workflow

### Before You Act
1. Query Honeycomb for recent errors, anomalies, or relevant traces
2. Understand current behavior before planning changes
3. If fixing a bug, find the trace that shows the problem first

### When You Build
1. Ensure changes are observable (structured attributes, not printf)
2. Follow OTel semantic conventions for attribute naming
3. Add context that answers "why did this happen?" not just "what happened"
4. Every attribute should have a query that uses it

### After You Ship
1. Verify the change in Honeycomb - can you find it?
2. Check for unexpected errors or latency changes
3. The trace proves it works, not local tests

## Honeycomb MCP Reference

### Available Tools

The Honeycomb MCP provides these tools (invoke via MCP, not bash):

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `run_query` | Execute queries with filters, breakdowns, aggregations | `environment_slug`, `dataset_slug`, `query_spec` |
| `get_trace` | Retrieve all spans for a trace ID | `environment_slug`, `trace_id`, `time_range` |
| `find_columns` | Search for columns by keyword | `environment_slug`, `input` |
| `find_queries` | Search saved/recent queries | `environment_slug`, `input` |
| `get_dataset` | Get schema with columns | `environment_slug`, `dataset_slug` |
| `get_workspace_context` | List environments and datasets | (none) |
| `run_bubbleup` | Anomaly detection on query results | `query_pk`, `selection` |

### Common Queries

**Find sessions with errors:**
```json
{
  "environment_slug": "test",
  "dataset_slug": "opencode-agents",
  "query_spec": {
    "calculations": [{"op": "COUNT"}],
    "filters": [{"column": "session.success", "op": "=", "value": false}],
    "breakdowns": ["name", "status_message"],
    "time_range": "7d"
  }
}
```

**Session success rate by agent type:**
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

**Tool usage patterns:**
```json
{
  "environment_slug": "test",
  "dataset_slug": "opencode-agents",
  "query_spec": {
    "calculations": [{"op": "COUNT"}],
    "breakdowns": ["tool.name"],
    "time_range": "24h",
    "limit": 20
  }
}
```

**Slow sessions (P95 latency):**
```json
{
  "environment_slug": "test",
  "dataset_slug": "opencode-agents",
  "query_spec": {
    "calculations": [{"op": "P95", "column": "duration_ms"}],
    "breakdowns": ["name"],
    "time_range": "7d"
  }
}
```

### Key Columns in opencode-agents

| Column | Type | Description |
|--------|------|-------------|
| `name` | string | Span name (e.g., `session:main`, `agent:planner`, `tool.read.start`) |
| `session.success` | boolean | Whether session completed successfully |
| `session.duration_ms` | int | Total session time |
| `agent.type` | string | Agent type: `planner`, `builder`, `reviewer`, `debugger` |
| `phase.name` | string | Workflow phase: `planning`, `implementation`, `review`, `diagnosis` |
| `tool.name` | string | Tool that was executed |
| `tool.error_message` | string | Error message if tool failed |
| `tools.error_count` | int | Count of tool errors in session |
| `tools.summary` | string | Compact tool breakdown (e.g., `read:5,edit:3`) |
| `beads.task_id` | string | Associated Beads task ID |
| `git.branch` | string | Git branch name |
| `plugin.version` | string | Tracing plugin version |

## Beads Task Tracking

### Commands

```bash
bd ready              # Show prioritized work (no blockers)
bd list               # Show all issues
bd show <id>          # Get issue details
bd create "title" -p 2 -t task    # Create new task
bd update <id> --status in_progress
bd close <id> --reason "Completed"
bd sync               # Export and push to git
```

### Workflow

1. **Start session**: Run `bd ready` to see available work
2. **Pick a task**: Use `bd update <id> --status in_progress`
3. **Reference in commits**: Include task ID in commit messages
4. **Complete**: Use `bd close <id> --reason "..."` when done
5. **End session**: Run `/land-plane` to sync everything

### Priority Levels

| Priority | Meaning | Use For |
|----------|---------|---------|
| P0 | Critical | Blocking issues, production outages |
| P1 | High | Important features, significant bugs |
| P2 | Medium | Standard work items |
| P3 | Low | Nice-to-have, cleanup |

## Semantic Conventions

All instrumentation follows OpenTelemetry semantic conventions. See `.opencode/docs/semantic-conventions.md` for:
- Required vs optional attributes by category
- Naming conventions and patterns
- Guidelines for adding context without noise
- Anti-patterns to avoid

## Project Structure

```
opencode.json                    # Agent configs, tools, permissions, commands
.opencode/
  agent/                         # Specialized agent prompts (planner, builder, etc.)
  plugins/honeycomb-tracing.ts   # Telemetry instrumentation
  docs/semantic-conventions.md   # OTel attribute reference
  prompts/orchestrator.md        # Main agent behavior
.beads/                          # Task tracking (local, not observability-related)
```

## Agents

This project uses specialized agents for different phases of work:

| Agent | Phase | Use When |
|-------|-------|----------|
| planner | planning | Requirements unclear, architecture decisions needed |
| builder | implementation | Requirements clear, ready to write code |
| reviewer | review | Code ready for quality/security review |
| debugger | diagnosis | Something broken, need to investigate |

Agent prompts live in `.opencode/agent/*.json`. Invoke with `@agent_name` or via the Task tool.

## Commit Format

```
type: description (bd-xxx)

Examples:
fix: resolve timeout in session handling (bd-a1b2)
feat: add user profile endpoint (bd-c3d4)
```

Always push before ending a session. Use `/land-plane` for the complete workflow.
