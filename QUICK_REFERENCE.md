# Quick Reference Guide

## 🎯 Agent Cheat Sheet

### Agent Commands
```bash
/agent planner    # Switch to planning mode
/agent builder    # Switch to coding mode
/agent reviewer    # Switch to review mode
/agent debugger    # Switch to troubleshooting
/agent beads-manager  # Switch to task management
```

### Shortcuts
```bash
/plan "request"       # Quick planning
/build "request"      # Quick building
/review "target"       # Quick review
/debug "issue"         # Quick debugging
```

### Beads Commands
```bash
/beads-ready           # Check ready tasks (Ctrl+B)
/beads-create "task"   # Create new task
/beads-status          # Check all tasks
/land-plane           # End session safely
/agent-coord status   # Check coordination
```

## 🔄 Workflows at a Glance

### New Feature
```
/agent planner "Add X" → /agent builder → /agent reviewer
```

### Bug Fix
```
/agent debugger "X broken" → /agent builder → /agent reviewer
```

### Quick Task
```
/agent builder "Fix X" → commit → /land-plane
```

## 📋 Task Priority Guide

- **P0**: Critical, blocking work/production
- **P1**: High priority, important features
- **P2**: Medium, standard work
- **P3**: Low, nice-to-have

## 🏷️ Task Types

- `bug`: Defects and issues
- `feature`: New functionality
- `task`: Work items, maintenance
- `epic`: Large features (with sub-tasks)

## 🎮 Keybinds

- `Ctrl+B`: Check ready tasks
- `Ctrl+Shift+B`: Create task
- `Ctrl+Alt+B`: Sync Beads

## 🚨 Critical Rules

- ALWAYS reference task IDs in commits: `(bd-xxx)`
- NEVER end session without `/land-plane`
- P0 tasks need immediate attention
- Always run `bd sync` before stopping

## 🤝 Handoff Examples

**Planner → Builder:**
```
"📋 Plan complete (bd-a1b2). Architecture designed. Ready for implementation."
```

**Builder → Reviewer:**
```
"✅ Implementation complete (bd-a1b2). Tests passing. Ready for review."
```

**Debugger → Builder:**
```
"🔍 Root cause found (bd-c3d4). Memory leak in connection pool. Fix documented."
```

## 📞 When to Use Which Agent

| Situation | Agent | Command |
|-----------|--------|---------|
| Complex feature unclear | planner | `/agent planner "Build X with Y"` |
| Clear requirements | builder | `/agent builder "Implement X"` |
| Code review needed | reviewer | `/agent reviewer "Check recent PRs"` |
| Something broken | debugger | `/agent debugger "X not working"` |
| Session management | beads-manager | `/land-plane` |

## 🔧 Quick Setup Commands

```bash
# Install Beads
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash

# Setup in project
bd init && bd hooks install

# Copy this config
cp -r . /path/to/your/project/
```

## 📚 Documentation Links

- [AGENTS.md](AGENTS.md) - Complete agent instructions and workflows
- [README.md](README.md) - Project setup and overview
- [Commands](.opencode/command/) - Custom commands
- [Beads Docs](https://github.com/steveyegge/beads)

---

**Remember**: Specialized agents + Beads tracking = efficient, coordinated development!