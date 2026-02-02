# Observability-Driven Development

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

## Quick Reference

### Beads Commands
```bash
bd ready              # Show prioritized work
bd create "title" -p 2 -t task
bd update ID --status in_progress
bd close ID --reason "Completed"
bd sync               # Export and push to git
```

### Honeycomb Queries (via MCP)
```
# Recent errors
error.type EXISTS

# Sessions by outcome
GROUP BY session.success

# Slow operations
session.duration_ms > 5000

# Filter by task
beads.task_id = "bd-xxx"
```

## Commit Format

```
type: description (bd-xxx)

Examples:
fix: resolve timeout in session handling (bd-a1b2)
feat: add user profile endpoint (bd-c3d4)
```

Always push before ending a session. Use `/land-plane` for the complete workflow.
