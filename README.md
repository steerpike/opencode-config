# OpenCode + Beads Integration Setup

This directory contains a complete **AI-powered development workflow** that combines OpenCode with **Beads task management** and a **specialized agent suite** for coordinated development.

## Quick Setup

1. **Install Beads** (if not already installed):
```bash
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
```

2. **Copy configuration files** to your project:
```bash
# Copy OpenCode config
cp opencode.json /path/to/your/project/

# Copy AGENTS.md template
cp AGENTS.md /path/to/your/project/

# Copy custom commands
cp -r .opencode/command /path/to/your/project/.opencode/
cp -r .opencode/agent /path/to/your/project/.opencode/
```

3. **Initialize Beads** in your project:
```bash
cd /path/to/your/project
bd init
bd hooks install  # Install git hooks for auto-sync
```

## Files Included

### `opencode.json`
- Main OpenCode configuration with Beads integration
- Custom commands for task management
- Proper tool permissions and keybinds
- Beads-specific instructions path

### `AGENTS.md`
- Complete project instructions and agent workflows
- Technology-specific patterns (Elixir, Node.js, Go)
- Session management guidelines
- Agent coordination examples

### `.opencode/command/`
- **`beads-ready.md`**: Check available tasks
- **`beads-create.md`**: Create new tasks with proper formatting  
- **`land-plane.md`**: Complete session end workflow

### `.opencode/agent/` - Specialized Agent Suite
- **`planner.json`**: Strategy & architecture specialist
- **`builder.json`**: Implementation & coding specialist  
- **`reviewer.json`**: Code quality & security reviewer
- **`debugger.json`**: Problem diagnosis & troubleshooting
- **`beads-manager.json`**: Task tracking & workflow coordinator

## 🤖 Agent Suite Overview

| Agent | Role | Best For |
|--------|------|----------|
| **planner** | Strategy & Design | New features, architecture, complex requirements |
| **builder** | Implementation | Clear requirements, coding, testing |
| **reviewer** | Quality Assurance | Code reviews, security checks, validation |
| **debugger** | Troubleshooting | Bug investigation, performance issues |
| **beads-manager** | Workflow Coordination | Task tracking, session management |

## 🔄 Standard Workflows

### Feature Development
```
User Request → /agent planner → /agent builder → /agent reviewer → Deploy
```

### Bug Fixing  
```
Bug Report → /agent debugger → /agent builder → /agent reviewer → Fix
```

### Quick Tasks
```
Clear request → /agent builder (direct implementation)
```

## 📋 Daily Workflow

### Starting a session:
```bash
git pull
/beads-ready  # or Ctrl+B
# Select highest priority task

# Complex task? Start with planner
/agent planner "Add user authentication system"

# Clear task? Go direct to builder
/agent builder "Fix login validation bug"
```

### During work:
```bash
# Make commits with task references
git commit -m "feat: Add JWT middleware (bd-a1b2)"

# Update task status
bd update bd-a1b2 --status in_progress

# Need review? Switch agents
/agent reviewer "Check authentication implementation"
```

### Ending a session:
```bash
/land-plane  # MANDATORY - completes full workflow
# Ensures all work is pushed and tasks are updated
```

## Customization

### Modify priorities:
Edit the priority guidelines in `AGENTS.md` to match your team's workflow.

### Add custom commands:
Create new `.md` files in `.opencode/command/` following the existing pattern.

### Update tool permissions:
Modify the `permissions` section in `opencode.json` based on your security requirements.

## 🚀 Integration Benefits

1. **Persistent memory**: Tasks survive across sessions and agents via Beads
2. **Agent specialization**: Each AI agent focuses on their core competency
3. **Workflow coordination**: Handoffs between agents are structured and tracked
4. **Dependency tracking**: Blockers and relationships are managed automatically  
5. **Git integration**: Automatic syncing and versioned task history
6. **Multi-agent safety**: Multiple agents can work on different ready tasks safely
7. **Quality enforcement**: Land-plane workflow ensures no work is left stranded
8. **Context preservation**: Beads provides structured memory across agent switches

## Troubleshooting

### Sync conflicts:
```bash
git checkout --theirs .beads/issues.jsonl
bd import -i .beads/issues.jsonl
```

### Daemon issues:
```bash
bd --no-daemon
```

### Git hooks not working:
```bash
bd hooks install --force
```

## Support

- [Beads Documentation](https://github.com/steveyegge/beads)
- [OpenCode Documentation](https://opencode.ai/docs)
- Create an issue in the respective repositories for bugs

---

## 📚 Additional Documentation

- **[AGENTS.md](AGENTS.md)** - Complete agent instructions, workflows, and technology patterns
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Command cheat sheet and fast access
- **[Commands](.opencode/command/)** - Custom commands for Beads and agent coordination
- **[Agent Configurations](.opencode/agent/)** - Individual agent settings and permissions

---

This setup provides a complete foundation for **AI-powered development** with specialized agents, structured task management, and coordinated multi-agent workflows.