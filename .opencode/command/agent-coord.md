# Agent Coordination Commands

Quick commands for multi-agent workflows and coordination.

## Usage

/agent-coord [workflow]

## Available Workflows

### feature-start
Start development of a new feature with full agent coordination:
```
/agent-coord feature-start "Add user profile system"
```
Triggers: Planner → Builder → Reviewer sequence

### bug-fix
Systematic bug fixing workflow:
```
/agent-coord bug-fix "Authentication failing for expired tokens"
```
Triggers: Debugger → Builder → Reviewer sequence

### emergency
Critical issue response workflow:
```
/agent-coord emergency "Production database connection failures"
```
Triggers: Debugger → Builder (parallel) → Reviewer

### review-session
Code review workflow for recent changes:
```
/agent-coord review-session
```
Triggers: Reviewer → (optional) Builder for fixes

### planning-session
Strategic planning for complex features:
```
/agent-coord planning-session "Redesign payment processing system"
```
Triggers: Planner with extended analysis time

## Coordination Features

- **Automatic task creation** in Beads for each step
- **Agent handoff notifications** when each step completes
- **Progress tracking** with task dependencies
- **Quality gates** between each agent transition
- **Automatic status updates** in Beads

## Example Session

```bash
User: /agent-coord feature-start "Add two-factor authentication"

System: 🚀 Starting feature coordination workflow...

📋 **Planner Agent**: Analyzing 2FA requirements...
   - Created task: bd-a1b2 "Design 2FA architecture" (P1)
   - Planning complete. Handing off to Builder...

👷 **Builder Agent**: Implementing 2FA system...
   - Started: bd-a1b2 (in_progress)
   - Created subtask: bd-a1b2.1 "Add TOTP library" (P2)
   - Implementation in progress...

🔍 **Reviewer Agent**: Will review when Builder completes...

Ready for next command. Use /agent-coord status to check progress.
```

## Status Command

Check coordination status:
```bash
/agent-coord status
```

Shows active workflows, agent assignments, and Beads task progress.