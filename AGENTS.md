# AI Agent Instructions for This Project

This project uses **Beads** for task management and work tracking, plus a **specialized agent suite** for coordinated development. This setup provides a persistent, structured memory system and role-based workflow for AI agents.

## 🤖 Agent Suite Overview

This project includes 5 specialized agents that work together through Beads coordination:

| Agent | Role | Primary Skills | When to Use |
|--------|------|---------------|-------------|
| **planner** | Strategy & Design | Architecture, requirements analysis, planning | New features, major changes, complex tasks |
| **builder** | Implementation | Coding, testing, quality implementation | Writing code, implementing features |
| **reviewer** | Quality Assurance | Code review, security, best practices | PR reviews, quality checks |
| **debugger** | Troubleshooting | Problem diagnosis, root cause analysis | Bugs, performance issues, system failures |
| **beads-manager** | Task Management | Workflow coordination, tracking | Session management, task creation |

## 🎯 Core Workflow

1. **Always check for ready work**: Use `bd ready` before starting new tasks
2. **Track everything**: Create Beads tasks for all non-trivial work items
3. **Reference tasks**: Use Beads IDs (bd-xxx) in git commits
4. **Sync regularly**: Run `bd sync` before ending sessions
5. **Land the plane**: Use the complete workflow to ensure all work is pushed

### Agent-Specific Workflows

#### Standard Feature Development
```
User Request → /agent planner → /agent builder → /agent reviewer → Deploy
```

#### Bug Fixing Process
```
Bug Report → /agent debugger → /agent builder → /agent reviewer → Fix Deployed
```

#### Quick Tasks
```
Clear task → /agent builder (direct implementation)
```

#### Complex Problems
```
Unclear issue → /agent debugger → /agent planner → /agent builder → /agent reviewer
```

## 📋 Essential Beads Commands

```bash
# Check available work
bd ready --json

# Create new task
bd create "Task title" -p [0-3] -t [bug|feature|task|epic] --json

# Update task status
bd update bd-xxx --status in_progress --json

# Close completed task
bd close bd-xxx --reason "Completed" --json

# Show task details
bd show bd-xxx --json

# Sync with git (export/import/commit/push)
bd sync

# List all current tasks
bd list --json
```

## 🏗️ Project Structure

```
<project-root>/
├── .beads/                 # Beads database and metadata
├── AGENTS.md              # This file - project instructions
├── README.md              # Project setup and overview
├── QUICK_REFERENCE.md     # Command cheat sheet
├── opencode.json          # OpenCode configuration
└── .opencode/             # OpenCode custom commands
    ├── command/           # Custom Beads commands
    │   ├── beads-ready.md
    │   ├── beads-create.md
    │   └── land-plane.md
    └── agent/             # Agent configurations
        ├── planner.json
        ├── builder.json
        ├── reviewer.json
        ├── debugger.json
        └── beads-manager.json
```

## 🎨 Coding Standards

### Quality Gates
- **Linting**: Run before commits
- **Testing**: Ensure all tests pass
- **Documentation**: Update relevant docs
- **Git hygiene**: Clean commits with Beads references

### Commit Message Format
```
[type]: description (bd-xxx)

Examples:
fix: Resolve authentication timeout (bd-a1b2)
feat: Add user profile page (bd-c3d4)
docs: Update API documentation (bd-e5f6)
```

### Task Priority Guidelines
- **P0**: Critical, blocking other work or production issues
- **P1**: High priority, important features/bugs
- **P2**: Medium priority, standard work items
- **P3**: Low priority, nice-to-have improvements

## 🔄 Session Workflow

### Starting a Session
1. Pull latest changes: `git pull`
2. Check ready work: `bd ready`
3. Select highest priority ready task
4. Update task: `bd update bd-xxx --status in_progress`

### During Work
1. Create subtasks for complex work
2. Reference parent task in commits
3. Run quality gates regularly
4. Track blockers/dependencies

### Ending a Session (/land-plane)
1. **File remaining work** as Beads tasks
2. **Run quality gates** (lint/test if code changed)
3. **Update Beads issues** (close completed, update status)
4. **MANDATORY**: Push to remote
5. **Clean up** git state
6. **Plan next session** with specific task and prompt

## 🚨 Critical Rules

- **NEVER leave unpushed work** - causes coordination issues
- **ALWAYS sync before ending**: `bd sync`
- **USE task IDs in commits**: (bd-xxx) for traceability
- **P0 tasks require immediate action** - they block others
- **Complete /land-plane fully** - don't stop at git push

## 🛠️ Development Environment

### Required Tools
- `bd` (Beads CLI) - installed globally
- OpenCode with this configuration
- Project-specific tooling (node, elixir, go, etc.)

### Setup Steps
```bash
# Install Beads (if not already installed)
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash

# Initialize Beads in project
bd init

# Install git hooks for automatic sync
bd hooks install
```

## 🎮 Agent Commands

### Switching Agents
```bash
# Switch to specific agent
/agent planner
/agent builder
/agent reviewer
/agent debugger

# One-off command with specific agent
/agent planner "Design new API endpoint structure"
/agent reviewer "Review recent commits in src/auth/"
```

### Quick Agent Access
```bash
# Planning commands
/plan "Add user profile system"
/design "Architecture for microservices"

# Building commands  
/build "Implement user profile API"
/code "Add authentication tests"

# Review commands
/review "Check recent PR for security issues"
/check "Analyze code quality in src/"

# Debug commands
/debug "Investigate API timeout errors"
/troubleshoot "Diagnose performance bottleneck"
```

## 🤝 Agent Coordination

### Handoff Patterns

**Planner → Builder:**
```
Planner: "📋 Implementation plan complete for bd-a1b2. Key points:
   - Use proper authentication patterns
   - Follow project conventions
   - Add comprehensive tests
   Ready for implementation."
   
Builder: "👷 Starting implementation of bd-a1b2 based on plan..."
```

**Builder → Reviewer:**
```
Builder: "✅ Implementation complete (bd-a1b2). 
   - Core functionality implemented
   - Tests passing
   - Documentation updated
   Ready for review."
   
Reviewer: "🔍 Starting code review of bd-a1b2..."
```

**Debugger → Builder:**
```
Debugger: "🔍 Root cause identified for bd-c3d4:
   - Race condition in session handling
   - Missing error handling in timeout scenario
   Fix: Add proper cleanup + error handling"
   
Builder: "🛠️ Implementing fix for bd-c3d4..."
```

### Multi-Agent Sessions
You can have multiple agents working on different tasks simultaneously:

```bash
# Agent 1 works on new feature
/agent builder Implement user registration (bd-a1b2)

# Agent 2 fixes bug in parallel  
/agent debugger Fix login timeout (bd-c3d4)

# Agent 3 reviews completed work
/agent reviewer Review recent PRs
```

## 📊 Agent Specialization

### Choose Planner when:
- Task is complex or unclear
- Need architectural decisions
- Multiple components interact
- Requirements need clarification

### Choose Builder when:
- Requirements are clear
- Following existing patterns
- Implementation is straightforward
- Need to write/test code

### Choose Reviewer when:
- Code quality needs validation
- Security-sensitive changes
- Performance-critical code
- Before merging/deployment

### Choose Debugger when:
- Something isn't working
- Need to understand root causes
- Performance issues
- Complex system problems

### Choose Beads-Manager when:
- Session start/end workflows
- Task creation and tracking
- Multi-agent coordination
- Git workflow management

## 🎯 Technology-Specific Patterns

### Elixir/Phoenix Projects
- Use Phoenix contexts for domain logic
- Follow OTP supervision tree patterns
- Implement proper GenServer lifecycle
- Use Ecto for database operations
- Add ExUnit tests with proper coverage
- Use Guardian for authentication
- Implement LiveView with proper cleanup

### Node.js/TypeScript Projects
- Use TypeScript for type safety
- Follow ESLint/Prettier conventions
- Implement proper error handling
- Add Jest/Vitest test coverage
- Use proper async/await patterns
- Implement proper middleware
- Follow Express/Fastify patterns

### Go Projects
- Follow Go package conventions
- Use proper error handling patterns
- Implement interfaces correctly
- Add comprehensive table-driven tests
- Use context for request management
- Follow Go module structure
- Implement proper goroutine management

## 📝 Example Session

### Starting a New Feature

```bash
# Start session
git pull
bd ready --json

# Agent shows:
# Ready tasks:
# - bd-a1b2: Fix authentication bug (P0)
# - bd-c3d4: Add user profile (P1)

# Complex task: Use planner first
/agent planner "Add user profile with avatar upload and preferences"

# Planner responds with architecture plan and creates tasks:
# Created bd-e5f6: "Design user profile architecture" (P1)
# Created bd-e5f6.1: "Implement avatar upload" (P2)
# Created bd-e5f6.2: "Add user preferences" (P2)

# Switch to builder for implementation
/agent builder "Implement user profile per plan bd-e5f6"

# Builder works and commits:
git commit -m "feat: Add user profile page (bd-e5f6)"

# Auto-trigger reviewer
/agent reviewer "Review user profile implementation"

# End session with complete workflow
/land-plane
```

### Bug Fixing Workflow

```bash
# Bug report comes in
/agent debugger "Users getting 500 errors on profile page"

# Debugger investigates and finds root cause:
# Root cause: Missing null check in user profile controller
# Created bd-g7h8: "Fix null pointer in profile controller" (P0)

# Builder implements fix
/agent builder "Fix profile controller per debugger analysis bd-g7h8"

git commit -m "fix: Resolve profile page crashes (bd-g7h8)"

# Reviewer validates fix
/agent reviewer "Review profile controller fix"

# Emergency complete - push immediately
/land-plane
```

## 🤝 Collaboration

- Multiple agents can work on different ready tasks
- Git hooks prevent sync conflicts
- Task dependencies prevent blocking issues
- Use `bd doctor` to detect orphaned work

### Multi-Agent Coordination

```bash
# Start coordination workflow
/agent-coord feature-start "Add real-time notifications"

# System automatically:
# 1. Creates Beads tasks for each phase
# 2. Assigns appropriate agents
# 3. Tracks progress between agents
# 4. Ensures quality handoffs

# Check coordination status
/agent-coord status
```

## 📚 Additional Resources

- [Beads Documentation](https://github.com/steveyegge/beads)
- [OpenCode Documentation](https://opencode.ai/docs)
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Command cheat sheet
- Technology-specific documentation in project docs/

---

**Remember**: The goal is structured, trackable work that persists across sessions and agents. When in doubt, create a Beads task and reference it!