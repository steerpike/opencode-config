# Land The Plane

Complete the current work session by finishing all tasks, running quality gates, and ensuring everything is pushed to remote.

## Usage

/land-plane

## What it does

This is a CRITICAL workflow that MUST complete fully. The plane is NOT landed until `git push` succeeds.

### 1. File remaining work
- Creates Beads tasks for any unfinished work
- Documents follow-up items
- Ensures no work is forgotten

### 2. Run quality gates (if code changes were made)
- Runs linter: `golangci-lint run ./...` or equivalent
- Runs tests: `go test ./...` or project-specific test command
- Creates P0 issues for any failing quality gates

### 3. Update Beads issues
- Closes completed tasks: `bd close bd-xxx --reason "Completed"`
- Updates task statuses
- Ensures accurate project state

### 4. MANDATORY: Push to remote
```bash
git pull --rebase
# Resolve conflicts if needed
bd sync
git push  # NON-NEGOTIABLE - MUST COMPLETE
git status  # MUST show "up to date with origin/main"
```

### 5. Clean up
```bash
git stash clear
git remote prune origin
```

### 6. Verify and plan next session
- Confirm clean git state
- Recommend next task to work on
- Provide session summary

## CRITICAL RULES

- ✅ The plane has NOT landed until `git push` completes successfully
- ❌ NEVER stop before `git push` - that leaves work stranded locally  
- ❌ NEVER say "ready to push when you are!" - YOU must push
- ⚠️  If `git push` fails, resolve the issue and retry until it succeeds
- 🎯 The user is coordinating multiple agents - unpushed work breaks their workflow

## Example session

```bash
User: /land-plane

Agent: Landing the plane - executing complete workflow...

1. Filing remaining work:
   ✅ Created bd-e5f6: "Add integration tests for sync" (P2)

2. Running quality gates:
   ✅ Linter: All checks passed
   ✅ Tests: 142/142 passing

3. Updating Beads issues:
   ✅ Closed bd-a1b2: "Fix auth validation" 
   ✅ Closed bd-c3d4: "Add retry logic"

4. Pushing to remote (MANDATORY):
   ✅ git pull --rebase successful
   ✅ bd sync completed
   ✅ git push successful
   ✅ git status shows "up to date with origin/main"

5. Cleaning up:
   ✅ git stash cleared
   ✅ remote branches pruned

6. Session complete:
   🎯 Ready tasks: bd-g7h8 (P1), bd-i9j0 (P2)
   📋 Next session prompt: "Continue work on bd-g7h8: Implement user profile page. Backend is complete, need to add frontend components and tests."

The plane has landed successfully! All changes are pushed and the workspace is clean.
```

## When to use

- End of work session
- Before switching to different project
- When user says "let's wrap up" or "land the plane"
- Any time you need to ensure all work is safely stored and pushed

This command prevents the common problem of agents leaving work uncommitted or unpushed, which causes coordination issues when multiple agents work on the same project.