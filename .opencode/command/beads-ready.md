# Beads Ready Check

Check Beads for tasks that are ready to work on (no open blockers) and provide a clear summary.

## Usage

/beads-ready

## What it does

- Runs `bd ready --json` to get ready tasks
- Provides a prioritized list of available work
- Shows task IDs, titles, and priorities
- Helps decide what to work on next

## Output format

1. **Priority 0 (Critical)** - Urgent tasks blocking others
2. **Priority 1 (High)** - Important features/fixes  
3. **Priority 2 (Medium)** - Standard work items
4. **Priority 3 (Low)** - Nice-to-have improvements

## Example

```bash
User: /beads-ready

Agent: Here are the ready tasks:

**P0 - Critical:**
- bd-a1b2: Fix authentication bug in API endpoint
- bd-c3d4: Resolve database connection timeout

**P1 - High:**
- bd-e5f6: Add user profile page
- bd-g7h8: Implement email notifications

**P2 - Medium:**
- bd-i9j0: Update documentation
- bd-k1l2: Add unit tests for auth module

Recommendation: Start with bd-a1b2 (authentication bug) as it's P0 and likely blocking other work.
```

## Integration

This command integrates with OpenCode's command system to provide quick access to your Beads workspace, ensuring you always know what's ready to work on.