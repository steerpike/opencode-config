/**
 * Honeycomb Distributed Tracing Plugin for OpenCode
 * 
 * v8 - Phase-based telemetry structure
 * 
 * Changes in v8:
 * - MAJOR: Switched from individual tool spans to phase-based spans
 * - Tools are now captured as span events instead of separate spans
 * - Added tool aggregation (counts, errors) as span attributes
 * - Added phase mapping for agent types (planner→planning, builder→implementation, etc.)
 * - Added Beads task ID extraction from session title/prompt
 * - Removed backward compatibility with tool spans (clean break)
 * 
 * Span Hierarchy (NEW):
 * - session:main (root)
 *   - phase:{name} (planning, implementation, review, diagnosis, coordination)
 *     - agent:{type} (planner, builder, reviewer, debugger, beads-manager)
 *       - tool events (not spans) with aggregated statistics
 * 
 * Requires: HONEYCOMB_API_KEY environment variable
 */

import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { Resource } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions"
import { trace, context, SpanStatusCode, type Span, type Context, SpanContext, TraceFlags } from "@opentelemetry/api"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node"
import type { Plugin } from "@opencode-ai/plugin"

// Configuration
const HONEYCOMB_API_KEY = process.env.HONEYCOMB_API_KEY
const HONEYCOMB_DATASET = process.env.HONEYCOMB_DATASET || "opencode-agents"
const SERVICE_NAME = "opencode-agents"
const PLUGIN_VERSION = "8.4.1"  // Fix orphaned phase spans on early return paths

// TTL Configuration (in milliseconds)
const SESSION_TTL_MS = 30 * 60 * 1000      // 30 minutes - sessions can be long-running
const TOOL_TTL_MS = 5 * 60 * 1000          // 5 minutes - tools should complete quickly
const PENDING_CONTEXT_TTL_MS = 10 * 60 * 1000  // 10 minutes - subagent should start soon
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000  // Run cleanup every 5 minutes

// Phase mapping: agent type → workflow phase name
const AGENT_PHASE_MAP: Record<string, string> = {
  planner: "planning",
  builder: "implementation",
  reviewer: "review",
  debugger: "diagnosis",
  "beads-manager": "coordination",
  general: "work",
  explore: "exploration",
}

// Tool error tracking
interface ToolError {
  tool: string
  message: string
  timestamp: number
  callId: string
  sequenceNumber: number
}

// Tool execution tracking (for duration calculation)
interface ToolExecution {
  tool: string
  callId: string
  startTime: number
  sequenceNumber: number
  sessionID: string
  argsPreview: string
}

// Tool aggregation data
interface ToolAggregate {
  counts: Record<string, number>      // { read: 5, glob: 2 }
  errors: ToolError[]                 // All errors preserved for debugging
  totalDurationMs: number
  executions: number                  // Total tool executions
}

// Session tracking with phase-based structure
interface SessionData {
  span: Span
  ctx: Context
  startTime: number
  phase?: string                      // Phase name (planning, implementation, etc.)
  agentType?: string                  // Agent type (planner, builder, etc.)
  agentMode?: string                  // From message.mode
  modelId?: string
  beadsTaskId?: string                // Extracted from prompt/title
  lastKnownAgentName?: string
  lastKnownModelId?: string
  toolAggregate: ToolAggregate        // Aggregated tool statistics
  messageCount: number
  cumulativeInputTokens: number
  cumulativeOutputTokens: number
}

// Phase span tracking (wraps agent sessions)
interface PhaseData {
  span: Span
  ctx: Context
  startTime: number
  phase: string
  agentType: string
}

// Pending subagent context (from task tool to session creation)
interface SubagentContext {
  subagentType: string
  parentSessionId: string
  taskDescription: string
  parentCtx: Context
  parentSpanContext: SpanContext  // Explicit span context for trace linking
  createdAt: number  // For TTL cleanup
}

// State tracking Maps
const sessionSpans = new Map<string, SessionData>()
const phaseSpans = new Map<string, PhaseData>()  // keyed by session ID
const toolExecutions = new Map<string, ToolExecution>()  // keyed by call ID
const pendingSubagentContext = new Map<string, SubagentContext>()

// Cleanup interval reference (for shutdown)
let cleanupInterval: ReturnType<typeof setInterval> | null = null

/**
 * TTL Cleanup function - removes stale entries from all tracking Maps
 * This prevents memory leaks when sessions/tools don't complete cleanly
 */
function performTTLCleanup(): void {
  const now = Date.now()
  
  // Clean up stale session spans
  for (const [sessionId, sessionData] of sessionSpans.entries()) {
    if (now - sessionData.startTime > SESSION_TTL_MS) {
      // End the span with a timeout status before removing
      sessionData.span.setAttributes({
        "session.cleanup_reason": "ttl_expired",
        "session.age_ms": now - sessionData.startTime,
      })
      sessionData.span.addEvent("cleanup.ttl_expired", {
        "cleanup.type": "session",
        "cleanup.age_ms": now - sessionData.startTime,
        "cleanup.ttl_ms": SESSION_TTL_MS,
      })
      sessionData.span.setStatus({ code: SpanStatusCode.ERROR, message: "Session TTL expired" })
      sessionData.span.end()
      sessionSpans.delete(sessionId)
    }
  }
  
  // Clean up stale phase spans
  for (const [sessionId, phaseData] of phaseSpans.entries()) {
    if (now - phaseData.startTime > SESSION_TTL_MS) {
      phaseData.span.setAttributes({
        "phase.cleanup_reason": "ttl_expired",
        "phase.age_ms": now - phaseData.startTime,
      })
      phaseData.span.addEvent("cleanup.ttl_expired", {
        "cleanup.type": "phase",
        "cleanup.age_ms": now - phaseData.startTime,
        "cleanup.ttl_ms": SESSION_TTL_MS,
      })
      phaseData.span.setStatus({ code: SpanStatusCode.ERROR, message: "Phase TTL expired" })
      phaseData.span.end()
      phaseSpans.delete(sessionId)
    }
  }
  
  // Clean up stale tool executions
  for (const [callId, execution] of toolExecutions.entries()) {
    if (now - execution.startTime > TOOL_TTL_MS) {
      // Try to add event to session span if it exists
      const sessionData = sessionSpans.get(execution.sessionID)
      if (sessionData) {
        sessionData.span.addEvent("cleanup.tool_ttl_expired", {
          "cleanup.type": "tool_execution",
          "tool.name": execution.tool,
          "tool.call_id": callId,
          "cleanup.age_ms": now - execution.startTime,
          "cleanup.ttl_ms": TOOL_TTL_MS,
        })
      }
      toolExecutions.delete(callId)
    }
  }
  
  // Clean up stale pending subagent contexts
  for (const [sessionId, pending] of pendingSubagentContext.entries()) {
    if (now - pending.createdAt > PENDING_CONTEXT_TTL_MS) {
      // Try to add event to parent session span if it exists
      const parentSession = sessionSpans.get(pending.parentSessionId)
      if (parentSession) {
        parentSession.span.addEvent("cleanup.pending_context_ttl_expired", {
          "cleanup.type": "pending_subagent_context",
          "cleanup.subagent_type": pending.subagentType,
          "cleanup.age_ms": now - pending.createdAt,
          "cleanup.ttl_ms": PENDING_CONTEXT_TTL_MS,
        })
      }
      pendingSubagentContext.delete(sessionId)
    }
  }
}

/**
 * Helper to clean up phase span for a session
 * This ensures phase spans are always ended, even if the session span is missing
 * Returns tool statistics for use by the caller, or defaults if no phase data
 */
interface PhaseCleanupResult {
  toolsSummary: string
  totalToolCount: number
  errorCount: number
}

function cleanupPhaseSpan(
  sessionID: string,
  success: boolean,
  errorMessage?: string,
  toolStats?: { counts: Record<string, number>; errors: ToolError[] }
): PhaseCleanupResult {
  const phaseData = phaseSpans.get(sessionID)
  
  // Default stats if not provided
  const counts = toolStats?.counts || {}
  const errors = toolStats?.errors || []
  const toolsSummary = createToolsSummary(counts)
  const totalToolCount = Object.values(counts).reduce((a, b) => a + b, 0)
  
  if (phaseData) {
    phaseData.span.setAttributes({
      "phase.duration_ms": Date.now() - phaseData.startTime,
      "phase.success": success,
      "tools.summary": toolsSummary || "none",
      "tools.total_count": totalToolCount,
      "tools.error_count": errors.length,
    })
    
    if (success) {
      phaseData.span.setStatus({ code: SpanStatusCode.OK })
    } else {
      phaseData.span.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage || "Session ended with error",
      })
    }
    
    phaseData.span.end()
    phaseSpans.delete(sessionID)
  }
  
  return { toolsSummary, totalToolCount, errorCount: errors.length }
}

/**
 * Helper to handle orphaned phase spans when session span is missing
 * This can happen due to race conditions or abnormal session termination
 */
function cleanupOrphanedPhaseSpan(sessionID: string, reason: string): void {
  const phaseData = phaseSpans.get(sessionID)
  
  if (phaseData) {
    phaseData.span.setAttributes({
      "phase.duration_ms": Date.now() - phaseData.startTime,
      "phase.success": false,
      "phase.cleanup_reason": "orphaned",
      "phase.orphan_reason": reason,
    })
    phaseData.span.addEvent("cleanup.orphaned_phase_span", {
      "cleanup.type": "orphaned_phase",
      "cleanup.reason": reason,
      "cleanup.session_id": sessionID,
    })
    phaseData.span.setStatus({
      code: SpanStatusCode.ERROR,
      message: `Orphaned phase span: ${reason}`,
    })
    phaseData.span.end()
    phaseSpans.delete(sessionID)
  }
}

// Get tracer instance
const tracer = trace.getTracer(SERVICE_NAME, PLUGIN_VERSION)

// Initialize OpenTelemetry SDK with Honeycomb exporter
let sdk: NodeSDK | null = null

if (HONEYCOMB_API_KEY) {
  const exporter = new OTLPTraceExporter({
    url: "https://api.honeycomb.io/v1/traces",
    headers: {
      "x-honeycomb-team": HONEYCOMB_API_KEY,
      "x-honeycomb-dataset": HONEYCOMB_DATASET,
    },
  })

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: "1.0.0",
    }),
    spanProcessor: new BatchSpanProcessor(exporter),
  })

  sdk.start()
  
  // Start TTL cleanup interval
  cleanupInterval = setInterval(performTTLCleanup, CLEANUP_INTERVAL_MS)

  // Graceful shutdown
  const shutdown = () => {
    // Stop cleanup interval
    if (cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
    }
    // Perform one final cleanup before shutdown
    performTTLCleanup()
    sdk?.shutdown().catch(console.error)
  }
  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)
}

// Capture git context at startup
let gitBranch = "unknown"
let gitCommit = "unknown"

try {
  const { execSync } = require("child_process")
  gitBranch = execSync("git branch --show-current", { encoding: "utf-8" }).trim()
  gitCommit = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim()
} catch {
  // Not a git repo or git not available
}

/**
 * Extract Beads task ID from text using regex
 * Matches patterns like bd-a1b2, bd-xyz123, etc.
 */
function extractBeadsTaskId(text: string | undefined): string | undefined {
  if (!text) return undefined
  const match = text.match(/\bbd-[a-z0-9]+\b/i)
  return match ? match[0].toLowerCase() : undefined
}

/**
 * Extract subagent type from session title
 * Matches patterns like "@planner subagent", "planner subagent", etc.
 */
function extractSubagentTypeFromTitle(title: string | undefined): string | undefined {
  if (!title) return undefined
  const match = title.match(/@?(\w+)\s+subagent/i)
  return match ? match[1].toLowerCase() : undefined
}

/**
 * Get phase name for an agent type
 */
function getPhaseForAgent(agentType: string): string {
  return AGENT_PHASE_MAP[agentType] || "work"
}

/**
 * Create tool summary string from counts
 * e.g., "read:5,edit:3,bash:2"
 */
function createToolsSummary(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])  // Sort by count descending
    .map(([tool, count]) => `${tool}:${count}`)
    .join(",")
}

/**
 * Initialize empty tool aggregate
 */
function createToolAggregate(): ToolAggregate {
  return {
    counts: {},
    errors: [],
    totalDurationMs: 0,
    executions: 0,
  }
}

export const HoneycombTracingPlugin: Plugin = async ({ project }) => {
  // Early exit if no API key
  if (!HONEYCOMB_API_KEY) {
    return {}
  }

  return {
    event: async ({ event }) => {
      // Handle session created - start root span or phase+agent spans for sub-agents
      if (event.type === "session.created") {
        const session = event.properties.info
        
        let parentSpan: Span | undefined
        let parentSpanContext: SpanContext | undefined
        let subagentType: string | undefined
        let taskDescription: string | undefined
        let foundParentSessionId: string | undefined
        
        // Debug: Capture Map state at lookup time
        const debugInfo = {
          sessionSpansSize: sessionSpans.size,
          sessionSpansKeys: Array.from(sessionSpans.keys()).join(","),
          pendingContextSize: pendingSubagentContext.size,
          pendingContextKeys: Array.from(pendingSubagentContext.keys()).join(","),
          strategy1_hasParentId: false,
          strategy1_foundSessionSpan: false,
          strategy1_foundPendingContext: false,
          strategy2_extractedFromTitle: false,
          strategy2_foundViaIteration: false,
          sessionParentId: session.parentID || "",
          sessionTitle: session.title || "",
        }
        
        // Strategy 1: Use parentID if OpenCode provides it
        if (session.parentID) {
          debugInfo.strategy1_hasParentId = true
          foundParentSessionId = session.parentID
          
          // Check parent session for span - this is the key for trace linking
          const parentSessionData = sessionSpans.get(session.parentID)
          if (parentSessionData) {
            debugInfo.strategy1_foundSessionSpan = true
            parentSpan = parentSessionData.span
            parentSpanContext = parentSpan.spanContext()
          }
          
          // Check for pending subagent context from task tool (has richer context)
          const pending = pendingSubagentContext.get(session.parentID)
          if (pending) {
            debugInfo.strategy1_foundPendingContext = true
            subagentType = pending.subagentType
            taskDescription = pending.taskDescription
            // Use explicit span context if available (more reliable)
            if (pending.parentSpanContext) {
              parentSpanContext = pending.parentSpanContext
            }
            pendingSubagentContext.delete(session.parentID)
          }
        }
        
        // Strategy 2: Extract subagent type from session title (fallback)
        // OpenCode includes "@planner subagent" etc. in session titles
        if (!subagentType) {
          const titleType = extractSubagentTypeFromTitle(session.title)
          if (titleType) {
            debugInfo.strategy2_extractedFromTitle = true
            subagentType = titleType
            // Try to find main session to use as parent
            for (const [sessionId, sessionData] of sessionSpans.entries()) {
              if (!sessionData.agentType) {  // Skip other subagents, find main session
                debugInfo.strategy2_foundViaIteration = true
                parentSpan = sessionData.span
                parentSpanContext = parentSpan.spanContext()
                foundParentSessionId = sessionId
                break
              }
            }
          }
        }
        
        const isSubAgent = !!subagentType
        
        // Extract Beads task ID from session title or task description
        const beadsTaskId = extractBeadsTaskId(session.title) || 
                           extractBeadsTaskId(taskDescription)
        
        const now = Date.now()
        
        if (isSubAgent && subagentType) {
          // Create phase span first, then agent span as child
          const phase = getPhaseForAgent(subagentType)
          
          // CRITICAL: Create a parent context from the parent span context
          // This ensures the trace ID is inherited correctly
          let spanParentCtx: Context
          if (parentSpanContext && parentSpanContext.traceId) {
            // Create a context with a remote span context - this links the traces
            const remoteCtx = trace.setSpanContext(context.active(), parentSpanContext)
            spanParentCtx = remoteCtx
          } else {
            spanParentCtx = context.active()
          }
          
          // Phase span - child of parent session
          const phaseSpan = tracer.startSpan(
            `phase:${phase}`,
            {
              attributes: {
                "phase.name": phase,
                "phase.agent_type": subagentType,
                "session.id": session.id,
                "session.is_subagent": true,
                "session.parent_id": foundParentSessionId || session.parentID || "",
                "git.branch": gitBranch,
                "git.commit": gitCommit,
                "plugin.version": PLUGIN_VERSION,
                // Debug attributes - Map state at lookup time
                "debug.session_spans_size": debugInfo.sessionSpansSize,
                "debug.session_spans_keys": debugInfo.sessionSpansKeys || "empty",
                "debug.pending_context_size": debugInfo.pendingContextSize,
                "debug.pending_context_keys": debugInfo.pendingContextKeys || "empty",
                // Debug attributes - Strategy results
                "debug.strategy1_has_parent_id": debugInfo.strategy1_hasParentId,
                "debug.strategy1_found_session_span": debugInfo.strategy1_foundSessionSpan,
                "debug.strategy1_found_pending_context": debugInfo.strategy1_foundPendingContext,
                "debug.strategy2_extracted_from_title": debugInfo.strategy2_extractedFromTitle,
                "debug.strategy2_found_via_iteration": debugInfo.strategy2_foundViaIteration,
                // Debug attributes - Input values
                "debug.session_parent_id_input": debugInfo.sessionParentId,
                "debug.session_title_input": debugInfo.sessionTitle.slice(0, 100),
                // Debug attributes - Final state
                "debug.had_parent_span": !!parentSpan,
                "debug.had_parent_span_context": !!parentSpanContext,
                "debug.parent_trace_id": parentSpanContext?.traceId || "none",
                "debug.found_parent_session_id": foundParentSessionId || "",
                ...(beadsTaskId ? { "beads.task_id": beadsTaskId } : {}),
              },
            },
            spanParentCtx  // This should inherit the trace ID from parent
          )
          
          // Create context with phase span for child spans
          const phaseCtx = trace.setSpan(spanParentCtx, phaseSpan)
          
          phaseSpans.set(session.id, {
            span: phaseSpan,
            ctx: phaseCtx,
            startTime: now,
            phase,
            agentType: subagentType,
          })
          
          // Agent span (child of phase)
          const agentSpan = tracer.startSpan(
            `agent:${subagentType}`,
            {
              attributes: {
                "agent.type": subagentType,
                "session.id": session.id,
                "session.is_subagent": true,
                "session.parent_id": foundParentSessionId || session.parentID || "",
                "session.title": session.title,
                "session.task_description": taskDescription || "",
                "project.id": session.projectID,
                "project.directory": session.directory,
                ...(beadsTaskId ? { "beads.task_id": beadsTaskId } : {}),
              },
            },
            phaseCtx  // Agent is child of phase
          )
          
          // Create context with agent span for tool events
          const agentCtx = trace.setSpan(phaseCtx, agentSpan)
          
          sessionSpans.set(session.id, {
            span: agentSpan,
            ctx: agentCtx,
            startTime: now,
            phase,
            agentType: subagentType,
            beadsTaskId,
            toolAggregate: createToolAggregate(),
            messageCount: 0,
            cumulativeInputTokens: 0,
            cumulativeOutputTokens: 0,
          })
        } else {
          // Main session - create root session span
          const span = tracer.startSpan(
            "session:main",
            {
              attributes: {
                "session.id": session.id,
                "session.title": session.title,
                "session.is_subagent": false,
                "project.id": session.projectID,
                "project.directory": session.directory,
                "git.branch": gitBranch,
                "git.commit": gitCommit,
                "plugin.version": PLUGIN_VERSION,
                ...(beadsTaskId ? { "beads.task_id": beadsTaskId } : {}),
              },
            }
            // No parent context - this is a root span
          )
          
          // IMPORTANT: Create a new context with this span as the active span
          // This context will be used by child spans to inherit the trace ID
          const ctx = trace.setSpan(context.active(), span)
          
          sessionSpans.set(session.id, {
            span,
            ctx,
            startTime: now,
            beadsTaskId,
            toolAggregate: createToolAggregate(),
            messageCount: 0,
            cumulativeInputTokens: 0,
            cumulativeOutputTokens: 0,
          })
        }
      }

      // Handle session idle - end spans with aggregated tool statistics
      if (event.type === "session.idle") {
        const sessionID = event.properties.sessionID
        const sessionData = sessionSpans.get(sessionID)
        
        if (sessionData) {
          const duration = Date.now() - sessionData.startTime
          const { counts, errors, totalDurationMs, executions } = sessionData.toolAggregate
          
          // End phase span FIRST (it wraps the agent span)
          cleanupPhaseSpan(sessionID, true, undefined, { counts, errors })
          
          // Add aggregated tool statistics
          const toolsSummary = createToolsSummary(counts)
          const totalToolCount = Object.values(counts).reduce((a, b) => a + b, 0)
          
          sessionData.span.setAttributes({
            "session.duration_ms": duration,
            "session.success": true,
            "session.message_count": sessionData.messageCount,
            "session.cumulative_input_tokens": sessionData.cumulativeInputTokens,
            "session.cumulative_output_tokens": sessionData.cumulativeOutputTokens,
            // Tool aggregates
            "tools.summary": toolsSummary || "none",
            "tools.total_count": totalToolCount,
            "tools.unique_types": Object.keys(counts).length,
            "tools.error_count": errors.length,
            "tools.total_duration_ms": totalDurationMs,
            "tools.executions": executions,
          })
          
          // Preserve all error details as JSON (cap at 50 to avoid size limits)
          if (errors.length > 0) {
            sessionData.span.setAttribute(
              "tools.errors_detail",
              JSON.stringify(errors.slice(0, 50))
            )
          }
          
          sessionData.span.setStatus({ code: SpanStatusCode.OK })
          sessionData.span.end()
          sessionSpans.delete(sessionID)
        } else {
          // Session span missing but phase span might exist - clean it up
          cleanupOrphanedPhaseSpan(sessionID, "session_span_missing_on_idle")
        }
      }

      // Handle session error - end spans with error status
      if (event.type === "session.error") {
        const sessionID = event.properties.sessionID
        
        // Don't early return - we need to clean up phase spans even if sessionID is missing
        if (!sessionID) {
          // Can't clean up anything without a session ID
          return
        }
        
        const sessionData = sessionSpans.get(sessionID)
        const error = event.properties.error
        const errorName = error?.name || "UnknownError"
        const errorData = error?.data as { message?: string } | undefined
        const errorMessage = errorData?.message || "Unknown error"
        
        if (sessionData) {
          const duration = Date.now() - sessionData.startTime
          const { counts, errors, totalDurationMs, executions } = sessionData.toolAggregate
          
          // End phase span FIRST (it wraps the agent span)
          cleanupPhaseSpan(sessionID, false, errorMessage, { counts, errors })
          
          const toolsSummary = createToolsSummary(counts)
          const totalToolCount = Object.values(counts).reduce((a, b) => a + b, 0)
          
          sessionData.span.setAttributes({
            "session.duration_ms": duration,
            "session.success": false,
            "session.message_count": sessionData.messageCount,
            "session.cumulative_input_tokens": sessionData.cumulativeInputTokens,
            "session.cumulative_output_tokens": sessionData.cumulativeOutputTokens,
            "tools.summary": toolsSummary || "none",
            "tools.total_count": totalToolCount,
            "tools.unique_types": Object.keys(counts).length,
            "tools.error_count": errors.length,
            "tools.total_duration_ms": totalDurationMs,
            "tools.executions": executions,
          })
          
          if (errors.length > 0) {
            sessionData.span.setAttribute(
              "tools.errors_detail",
              JSON.stringify(errors.slice(0, 50))
            )
          }
          
          sessionData.span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          })
          
          if (error) {
            sessionData.span.setAttribute("error.name", errorName)
            sessionData.span.setAttribute("error.message", errorMessage)
          }
          
          sessionData.span.end()
          sessionSpans.delete(sessionID)
        } else {
          // Session span missing but phase span might exist - clean it up
          cleanupOrphanedPhaseSpan(sessionID, `session_span_missing_on_error: ${errorMessage}`)
        }
      }

      // Handle message part updates - track tool errors via state transitions
      if (event.type === "message.part.updated") {
        const part = event.properties.part as any
        
        if (part.type !== "tool") return
        
        const execution = toolExecutions.get(part.callID)
        if (!execution) return
        
        const state = part.state
        const sessionData = sessionSpans.get(execution.sessionID)
        
        // Handle error state
        if (state.status === "error" && sessionData) {
          const errorMessage = state.error || "Unknown error"
          
          // Add to error aggregate
          sessionData.toolAggregate.errors.push({
            tool: execution.tool,
            message: errorMessage,
            timestamp: Date.now(),
            callId: part.callID,
            sequenceNumber: execution.sequenceNumber,
          })
          
          // Add error event to session span
          sessionData.span.addEvent("tool.error", {
            "tool.name": execution.tool,
            "tool.call_id": part.callID,
            "tool.sequence_number": execution.sequenceNumber,
            "tool.error_message": errorMessage,
          })
          
          // Calculate duration and add to aggregate
          const duration = Date.now() - execution.startTime
          sessionData.toolAggregate.totalDurationMs += duration
          
          // Clean up execution tracking
          toolExecutions.delete(part.callID)
        }
      }

      // Handle message updates - track tokens and agent mode
      if (event.type === "message.updated") {
        const message = event.properties.info
        if (message.role !== "assistant") return
        
        const sessionData = sessionSpans.get(message.sessionID)
        if (sessionData) {
          sessionData.messageCount++
          
          if (message.mode) {
            sessionData.span.setAttribute("agent.mode", message.mode)
            sessionData.agentMode = message.mode
            sessionData.lastKnownAgentName = message.mode
          }
          
          if (message.modelID) {
            sessionData.span.setAttribute("model.id", message.modelID)
            sessionData.modelId = message.modelID
            sessionData.lastKnownModelId = message.modelID
          }
          
          if (message.providerID) {
            sessionData.span.setAttribute("provider.id", message.providerID)
          }
          
          if ("tokens" in message && message.tokens) {
            sessionData.span.setAttribute("tokens.input", message.tokens.input)
            sessionData.span.setAttribute("tokens.output", message.tokens.output)
            sessionData.span.setAttribute("tokens.reasoning", message.tokens.reasoning)
            sessionData.span.setAttribute("tokens.cache.read", message.tokens.cache.read)
            sessionData.span.setAttribute("tokens.cache.write", message.tokens.cache.write)
            
            sessionData.cumulativeInputTokens += message.tokens.input || 0
            sessionData.cumulativeOutputTokens += message.tokens.output || 0
          }
        }
      }
    },

    // Tool execution hooks - capture as events, not spans
    "tool.execute.before": async (input, output) => {
      const sessionData = sessionSpans.get(input.sessionID)
      if (!sessionData) return
      
      const sequenceNumber = ++sessionData.toolAggregate.executions
      
      // Increment tool count
      sessionData.toolAggregate.counts[input.tool] = 
        (sessionData.toolAggregate.counts[input.tool] || 0) + 1
      
      // Create args preview
      let argsPreview: string
      if (input.tool === "task" && output.args) {
        argsPreview = `${output.args.subagent_type}: ${output.args.description}`
      } else if (output.args?.description) {
        argsPreview = output.args.description
      } else {
        argsPreview = JSON.stringify(output.args).slice(0, 200)
      }
      
      // Add tool start event to session span
      sessionData.span.addEvent(`tool.${input.tool}.start`, {
        "tool.name": input.tool,
        "tool.call_id": input.callID,
        "tool.sequence_number": sequenceNumber,
        "tool.args_preview": argsPreview,
        // Task-specific attributes
        ...(input.tool === "task" && output.args ? {
          "task.subagent_type": output.args.subagent_type,
          "task.description": output.args.description,
        } : {}),
      })
      
      // Track execution for duration calculation
      toolExecutions.set(input.callID, {
        tool: input.tool,
        callId: input.callID,
        startTime: Date.now(),
        sequenceNumber,
        sessionID: input.sessionID,
        argsPreview,
      })
      
      // If this is a task tool, store context for child session
      if (input.tool === "task" && output.args?.subagent_type && sessionData) {
        const spanContext = sessionData.span.spanContext()
        pendingSubagentContext.set(input.sessionID, {
          subagentType: output.args.subagent_type,
          parentSessionId: input.sessionID,
          taskDescription: output.args.description || "",
          parentCtx: sessionData.ctx,
          parentSpanContext: spanContext,  // Store explicit span context
          createdAt: Date.now(),  // For TTL cleanup
        })
        
        // Add debug event to track pending context creation
        sessionData.span.addEvent("debug.pending_context_stored", {
          "debug.parent_session_id": input.sessionID,
          "debug.subagent_type": output.args.subagent_type,
          "debug.parent_trace_id": spanContext.traceId,
          "debug.parent_span_id": spanContext.spanId,
          "debug.pending_context_size_after": pendingSubagentContext.size,
          "debug.session_spans_size": sessionSpans.size,
        })
      }
    },

    "tool.execute.after": async (input, output) => {
      const execution = toolExecutions.get(input.callID)
      if (!execution) return
      
      const sessionData = sessionSpans.get(execution.sessionID)
      if (!sessionData) {
        toolExecutions.delete(input.callID)
        return
      }
      
      const duration = Date.now() - execution.startTime
      sessionData.toolAggregate.totalDurationMs += duration
      
      // Add tool completion event
      sessionData.span.addEvent(`tool.${input.tool}.end`, {
        "tool.name": input.tool,
        "tool.call_id": input.callID,
        "tool.sequence_number": execution.sequenceNumber,
        "tool.duration_ms": duration,
        "tool.title": output.title,
        "tool.output_length": output.output?.length || 0,
        "tool.success": true,
      })
      
      toolExecutions.delete(input.callID)
    },
  }
}
