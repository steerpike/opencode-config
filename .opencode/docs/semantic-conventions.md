# OpenTelemetry Semantic Conventions Reference

This document provides guidelines for instrumentation in this project, following OpenTelemetry semantic conventions.

## Core Principle: Context Without Noise

Every attribute should answer a debugging question. If you can't write a Honeycomb query that uses the attribute, don't add it.

**Ask yourself:**
- "If this fails at 3am, what do I need to know?"
- "What would I GROUP BY to find patterns?"
- "Can I answer this question with existing attributes?"

## Attribute Categories

### Session Attributes

| Attribute | Requirement | Type | Description |
|-----------|-------------|------|-------------|
| `session.id` | Required | string | Unique identifier for the session |
| `session.success` | Required | boolean | Whether the session completed successfully |
| `session.duration_ms` | Recommended | int | Total session duration in milliseconds |
| `session.is_subagent` | Recommended | boolean | Whether this is a delegated subagent session |
| `session.parent_id` | Conditional | string | Parent session ID (if subagent) |

### GenAI Attributes (OTel Standard)

| Attribute | Requirement | Type | Description |
|-----------|-------------|------|-------------|
| `gen_ai.operation.name` | Required | string | Operation type: `chat`, `generate_content` |
| `gen_ai.request.model` | Required | string | Model requested (e.g., `claude-sonnet-4-20250514`) |
| `gen_ai.response.model` | Recommended | string | Model that actually responded |
| `gen_ai.provider.name` | Recommended | string | Provider (e.g., `anthropic`, `openai`) |
| `gen_ai.usage.input_tokens` | Recommended | int | Input token count |
| `gen_ai.usage.output_tokens` | Recommended | int | Output token count |
| `gen_ai.response.finish_reasons` | Recommended | string[] | Why generation stopped |

### Error Attributes (OTel Standard)

| Attribute | Requirement | Type | Description |
|-----------|-------------|------|-------------|
| `error.type` | Required (on errors) | string | Error class/code (e.g., `TimeoutError`, `500`) |
| `exception.message` | Recommended | string | Human-readable error message |
| `exception.stacktrace` | Opt-in | string | Full stack trace (can be large) |

### Code Attributes (OTel Standard)

| Attribute | Requirement | Type | Description |
|-----------|-------------|------|-------------|
| `code.function` | Recommended | string | Function/method name |
| `code.filepath` | Recommended | string | Source file path |
| `code.lineno` | Opt-in | int | Line number |
| `code.namespace` | Opt-in | string | Module/package namespace |

### Custom Attributes (This Project)

| Attribute | Requirement | Type | Description |
|-----------|-------------|------|-------------|
| `beads.task_id` | Recommended | string | Associated Beads task (e.g., `bd-a1b2`) |
| `phase.name` | Required (phases) | string | Workflow phase: `planning`, `implementation`, `review`, `diagnosis` |
| `agent.type` | Required (agents) | string | Agent type: `planner`, `builder`, `reviewer`, `debugger` |
| `tools.summary` | Recommended | string | Compact tool breakdown (e.g., `read:5,edit:3`) |
| `tools.total_count` | Recommended | int | Total tool executions |
| `tools.error_count` | Recommended | int | Failed tool count |

### Git Context

| Attribute | Requirement | Type | Description |
|-----------|-------------|------|-------------|
| `git.branch` | Recommended | string | Current branch name |
| `git.commit` | Recommended | string | Short commit hash |

## Naming Conventions

### Use OTel Conventions First

Before creating a custom attribute, check if OTel has a standard:
- [General attributes](https://opentelemetry.io/docs/specs/semconv/general/attributes/)
- [GenAI attributes](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/)
- [Error attributes](https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-spans/)

### Custom Attribute Naming

When OTel doesn't have a standard:

```
namespace.specific_name

Examples:
- beads.task_id        ✓ (namespaced, specific)
- phase.name           ✓ (namespaced, specific)
- tools.error_count    ✓ (namespaced, specific)
- task_id              ✗ (no namespace)
- data                 ✗ (too vague)
```

**Rules:**
- Use lowercase with underscores: `snake_case`
- Namespace with dot separator: `category.attribute`
- Be specific: `session.duration_ms` not `duration`
- Include units in name: `_ms`, `_bytes`, `_count`

## Anti-Patterns

### Don't Add Attributes "Just in Case"

```
❌ span.setAttribute("request.headers", JSON.stringify(headers))
❌ span.setAttribute("response.body", responseText)
❌ span.setAttribute("debug.info", "might be useful")

✓ span.setAttribute("request.content_length", headers["content-length"])
✓ span.setAttribute("response.status_code", 200)
```

### Don't Duplicate Information

```
❌ Adding timestamp attributes (spans have start/end times)
❌ Adding trace_id as attribute (it's in the span context)
❌ Adding both error.message AND exception.message
```

### Don't Use High-Cardinality Unbounded Values

```
❌ span.setAttribute("user.email", email)  // PII + unbounded
❌ span.setAttribute("request.body", body)  // Unbounded size
❌ span.setAttribute("stack.trace", trace)  // Use events instead

✓ span.setAttribute("user.tier", "premium")  // Bounded enum
✓ span.setAttribute("request.size_bytes", 1024)  // Numeric
✓ span.addEvent("exception", { "exception.stacktrace": trace })
```

### Don't Create Attributes You Won't Query

Before adding an attribute, write the Honeycomb query:

```
// If you can't write this query, don't add the attribute
WHERE my_new_attribute = "some_value"
GROUP BY my_new_attribute
```

## Structured vs String Attributes

### Prefer Structured Types

```
❌ span.setAttribute("tools.counts", "read:5,edit:3")  // String parsing needed
✓ span.setAttribute("tools.read_count", 5)
✓ span.setAttribute("tools.edit_count", 3)

❌ span.setAttribute("success", "true")  // String boolean
✓ span.setAttribute("success", true)    // Actual boolean

❌ span.setAttribute("duration", "500ms")  // String with unit
✓ span.setAttribute("duration_ms", 500)   // Number, unit in name
```

### Use Events for Variable/Large Data

```
// Good: Events for tool executions
span.addEvent("tool.read.start", {
  "tool.name": "read",
  "tool.call_id": callId,
})

// Good: Events for errors with details
span.addEvent("tool.error", {
  "tool.name": "bash",
  "error.message": "Command failed",
})
```

## Query Examples

These are the queries your attributes should support:

```honeycomb
# Find all errors
WHERE error.type EXISTS

# Success rate by model
GROUP BY gen_ai.request.model
CALCULATE PERCENTAGE(session.success = true)

# Slow sessions
WHERE session.duration_ms > 10000

# Work by task
WHERE beads.task_id = "bd-a1b2"

# Tool usage patterns
GROUP BY tools.summary
COUNT

# Errors by phase
WHERE tools.error_count > 0
GROUP BY phase.name
```

## Migration Notes

When aligning with OTel conventions, prefer:

| Current (Custom) | OTel Standard |
|------------------|---------------|
| `model.id` | `gen_ai.request.model` or `gen_ai.response.model` |
| `provider.id` | `gen_ai.provider.name` |
| `tokens.input` | `gen_ai.usage.input_tokens` |
| `tokens.output` | `gen_ai.usage.output_tokens` |

Custom attributes that don't have OTel equivalents can remain:
- `phase.name`, `agent.type` (workflow-specific)
- `beads.task_id` (project-specific correlation)
- `tools.*` (aggregation attributes)
