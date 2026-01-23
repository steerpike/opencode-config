# OpenCode Configuration

A portable OpenCode configuration with specialized agents, custom commands, and optional integrations for Beads task management and Honeycomb tracing.

## Using This Config in Your Project

### Prerequisites

- [OpenCode](https://opencode.ai) installed
- [Bun](https://bun.sh) installed (for plugin dependencies)
- (Optional) [Beads CLI](https://github.com/steveyegge/beads) for task tracking
- (Optional) `HONEYCOMB_API_KEY` environment variable for distributed tracing

### Quick Start

1. **Copy core files** to your project:

```bash
cp opencode.json /path/to/your/project/
cp AGENTS.md /path/to/your/project/
cp -r .opencode /path/to/your/project/
```

2. **Install plugin dependencies**:

```bash
cd /path/to/your/project/.opencode
bun install
```

3. **(Optional) Initialize Beads** for task tracking:

```bash
cd /path/to/your/project
bd init
bd hooks install  # Optional: auto-sync on git operations
```

### What's Included

| File/Directory | Purpose |
|----------------|---------|
| `opencode.json` | Main config: agents, commands, tools, permissions |
| `AGENTS.md` | Instructions automatically loaded by OpenCode |
| `.opencode/agent/` | Agent definitions (planner, builder, reviewer, debugger) |
| `.opencode/command/` | Custom slash commands |
| `.opencode/plugins/` | Honeycomb tracing plugin |

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `HONEYCOMB_API_KEY` | No | Enables distributed tracing to Honeycomb |
| `HONEYCOMB_DATASET` | No | Dataset name (defaults to `opencode-agents`) |

---

## Agent Suite

| Agent | Role | Best For |
|-------|------|----------|
| **planner** | Strategy & Design | New features, architecture, complex requirements |
| **builder** | Implementation | Clear requirements, coding, testing |
| **reviewer** | Quality Assurance | Code reviews, security checks, validation |
| **debugger** | Troubleshooting | Bug investigation, performance issues |

### Agent Commands

```bash
/agent planner "Design user auth system"
/agent builder "Implement JWT middleware"
/agent reviewer "Review auth implementation"
/agent debugger "Login timeout issue"
```

### Workflows

**Feature Development:**
```
/agent planner → /agent builder → /agent reviewer → Deploy
```

**Bug Fix:**
```
/agent debugger → /agent builder → /agent reviewer → Fix
```

**Quick Task:**
```
/agent builder → commit → done
```

---

## Beads Integration (Optional)

If using Beads for task tracking:

### Commands

```bash
/beads-ready      # Check ready tasks
/beads-create     # Create new task
/beads-status     # Check all tasks
/land-plane       # End session safely (sync + push)
```

### Task Priorities

- **P0**: Critical, blocking work/production
- **P1**: High priority, important features
- **P2**: Medium, standard work
- **P3**: Low, nice-to-have

### Commit Format

```bash
git commit -m "feat: Add JWT middleware (bd-a1b2)"
```

---

## Customization

### Add project-specific instructions

Edit `opencode.json` to include your project's docs:

```json
{
  "instructions": [
    "CONTRIBUTING.md",
    "docs/architecture.md"
  ]
}
```

### Add custom commands

Create `.md` files in `.opencode/command/` following existing patterns.

### Modify agent permissions

Edit the `agent` and `permission` sections in `opencode.json`.

---

## Troubleshooting

### Beads sync conflicts

```bash
git checkout --theirs .beads/issues.jsonl
bd import -i .beads/issues.jsonl
```

### Plugin not loading

Ensure dependencies are installed:
```bash
cd .opencode && bun install
```

---

## Links

- [OpenCode Documentation](https://opencode.ai/docs)
- [Beads Documentation](https://github.com/steveyegge/beads)
