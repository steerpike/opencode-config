# Create Beads Task

Create a new task in Beads with proper formatting, priority, and type classification.

## Usage

/beads-create "Task title here" [options]

## Options

- **Priority**: `-p 0/1/2/3` (default: 2)
  - P0: Critical, blocking other work
  - P1: High priority, important feature/fix
  - P2: Medium priority, standard work
  - P3: Low priority, nice-to-have

- **Type**: `-t bug/feature/task/epic` (default: task)
  - `bug`: Software defects and issues
  - `feature`: New functionality
  - `task`: Work items, chores, maintenance
  - `epic`: Large features spanning multiple tasks

## Examples

```bash
# Create a critical bug fix
/beads-create "Fix authentication timeout in production" -p 0 -t bug

# Create a high-priority feature
/beads-create "Add user profile page with avatar upload" -p 1 -t feature

# Create a standard task
/beads-create "Update API documentation for v2 endpoint" -p 2 -t task

# Simple task (defaults to P2, task type)
/beads-create "Code review for PR #123"
```

## What it does

1. Creates the Beads task with proper JSON formatting
2. Returns the task ID (e.g., `bd-a1b2`) for reference
3. Shows confirmation and next steps
4. Suggests related tasks or dependencies if applicable

## Output format

```
✅ Created task bd-a1b2: "Fix authentication timeout in production"
📍 Priority: P0 (Critical)
🏷️  Type: bug
📝 Next steps: 
   - Run /beads-ready to see all available work
   - Use bd-a1b2 in commit messages: "Fix auth validation (bd-a1b2)"
```

## Best practices

- Use specific, actionable titles
- Set appropriate priority levels
- Consider if this task blocks other work (should be P0)
- Use the returned task ID in git commits for traceability