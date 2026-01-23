/**
 * Honeycomb Distributed Tracing Plugin for OpenCode
 * 
 * Sends OpenTelemetry traces to Honeycomb for visibility into
 * agent workflows, tool executions, and session lifecycle.
 * 
 * Requires: HONEYCOMB_API_KEY environment variable
 */

import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { Resource } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions"
import { trace, context, SpanStatusCode, type Span, type Context } from "@opentelemetry/api"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node"
import type { Plugin } from "@opencode-ai/plugin"

// Configuration
const HONEYCOMB_API_KEY = process.env.HONEYCOMB_API_KEY
const HONEYCOMB_DATASET = process.env.HONEYCOMB_DATASET || "opencode-agents"
const SERVICE_NAME = "opencode-agents"

// Validate API key is present
if (!HONEYCOMB_API_KEY) {
  console.warn("[honeycomb-tracing] HONEYCOMB_API_KEY not set - tracing disabled")
}

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
  console.log(`[honeycomb-tracing] Initialized - sending traces to dataset: ${HONEYCOMB_DATASET}`)

  // Graceful shutdown
  const shutdown = () => sdk?.shutdown().catch(console.error)
  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)
}

// Span tracking maps (include agentMode and modelId for propagating to tool spans)
const sessionSpans = new Map<string, { span: Span; ctx: Context; agentMode?: string; modelId?: string }>()
const toolSpans = new Map<string, { span: Span; startTime: number }>()

// Get tracer instance
const tracer = trace.getTracer(SERVICE_NAME, "1.0.0")

// Capture git context at startup (for enriching spans)
let gitBranch = "unknown"
let gitCommit = "unknown"

try {
  const { execSync } = require("child_process")
  gitBranch = execSync("git branch --show-current", { encoding: "utf-8" }).trim()
  gitCommit = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim()
} catch {
  // Not a git repo or git not available
}

export const HoneycombTracingPlugin: Plugin = async ({ project }) => {
  console.log("[honeycomb-tracing] Plugin loaded - v3 with sub-agent trace propagation")
  
  // Early exit if no API key
  if (!HONEYCOMB_API_KEY) {
    return {}
  }

  return {
    event: async ({ event }) => {

      // Handle session created - start root span (or child span for sub-agents)
      if (event.type === "session.created") {
        const session = event.properties.info
        
        // Try to extract agent mode from session if available
        const agentMode = (session as any).mode || (session as any).agentMode || undefined
        
        // Check if this is a sub-agent session with a parent
        const parentSessionData = session.parentID ? sessionSpans.get(session.parentID) : null
        const parentCtx = parentSessionData?.ctx || context.active()
        const isSubAgent = !!parentSessionData
        
        const span = tracer.startSpan(
          isSubAgent ? `subagent:${session.id.slice(0, 8)}` : `session:${session.id.slice(0, 8)}`,
          {
            attributes: {
              "session.id": session.id,
              "session.title": session.title,
              "session.parent_id": session.parentID || "none",
              "session.is_subagent": isSubAgent,
              "project.id": session.projectID,
              "project.directory": session.directory,
              "git.branch": gitBranch,
              "git.commit": gitCommit,
              ...(agentMode ? { "agent.mode": agentMode } : {}),
            },
          },
          parentCtx  // Use parent session's context if available
        )
        
        const ctx = trace.setSpan(context.active(), span)
        sessionSpans.set(session.id, { span, ctx, agentMode })
        

      }

      // Handle session idle - end root span (success)
      if (event.type === "session.idle") {
        const sessionID = event.properties.sessionID
        const sessionData = sessionSpans.get(sessionID)
        
        if (sessionData) {
          sessionData.span.setStatus({ code: SpanStatusCode.OK })
          sessionData.span.end()
          sessionSpans.delete(sessionID)
          

        }
      }

      // Handle session error - end root span (error)
      if (event.type === "session.error") {
        const sessionID = event.properties.sessionID
        if (!sessionID) return
        
        const sessionData = sessionSpans.get(sessionID)
        
        if (sessionData) {
          const error = event.properties.error
          sessionData.span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error?.data?.message || "Unknown error",
          })
          
          if (error) {
            sessionData.span.setAttribute("error.name", error.name)
            sessionData.span.setAttribute("error.message", error.data?.message || "Unknown")
          }
          
          sessionData.span.end()
          sessionSpans.delete(sessionID)
          

        }
      }

      // Handle message updates - add token/cost info to session span
      if (event.type === "message.updated") {
        const message = event.properties.info
        if (message.role !== "assistant") return
        
        const sessionData = sessionSpans.get(message.sessionID)
        if (sessionData) {
          // Capture agent mode immediately (don't wait for tokens)
          if (message.mode) {
            sessionData.span.setAttribute("agent.mode", message.mode)
            sessionData.agentMode = message.mode  // Track for tool spans
          }
          if (message.modelID) {
            sessionData.span.setAttribute("model.id", message.modelID)
            sessionData.modelId = message.modelID  // Track for tool spans
          }
          if (message.providerID) {
            sessionData.span.setAttribute("provider.id", message.providerID)
          }
          
          // Add token/cost info when available
          if ("tokens" in message && message.tokens) {
            sessionData.span.setAttribute("tokens.input", message.tokens.input)
            sessionData.span.setAttribute("tokens.output", message.tokens.output)
            sessionData.span.setAttribute("tokens.reasoning", message.tokens.reasoning)
            sessionData.span.setAttribute("tokens.cache.read", message.tokens.cache.read)
            sessionData.span.setAttribute("tokens.cache.write", message.tokens.cache.write)
            sessionData.span.setAttribute("cost.usd", message.cost)
          }
        }
      }
    },

    "tool.execute.before": async (input, output) => {

      
      const sessionData = sessionSpans.get(input.sessionID)
      
      // Create tool span as child of session span
      const parentCtx = sessionData?.ctx || context.active()
      const agentMode = sessionData?.agentMode || "unknown"
      
      // Smart args preview - extract description for task tool, otherwise truncate
      let argsPreview: string
      if (input.tool === "task" && output.args) {
        argsPreview = `${output.args.subagent_type}: ${output.args.description}`
      } else if (output.args?.description) {
        argsPreview = output.args.description
      } else {
        argsPreview = JSON.stringify(output.args).slice(0, 200)
      }
      
      // For task tool, include the subagent type in the span name for clarity
      const spanName = input.tool === "task" && output.args?.subagent_type
        ? `${agentMode}:tool:task[${output.args.subagent_type}]`
        : `${agentMode}:tool:${input.tool}`
      
      const span = tracer.startSpan(
        spanName,
        {
          attributes: {
            "tool.name": input.tool,
            "tool.call_id": input.callID,
            "session.id": input.sessionID,
            "agent.name": agentMode,
            "agent.model": sessionData?.modelId || "unknown",
            "git.branch": gitBranch,
            "git.commit": gitCommit,
            "tool.args_preview": argsPreview,
            // Task-specific attributes
            ...(input.tool === "task" && output.args ? {
              "task.subagent_type": output.args.subagent_type,
              "task.description": output.args.description,
            } : {}),
          },
        },
        parentCtx
      )
      
      toolSpans.set(input.callID, { span, startTime: Date.now() })
    },

    "tool.execute.after": async (input, output) => {
      const toolData = toolSpans.get(input.callID)
      
      if (toolData) {
        const duration = Date.now() - toolData.startTime
        
        toolData.span.setAttribute("tool.title", output.title)
        toolData.span.setAttribute("tool.duration_ms", duration)
        toolData.span.setAttribute("tool.output_length", output.output?.length || 0)
        
        // Add metadata if present (skip large fields like 'preview' which contains file contents)
        if (output.metadata) {
          const skipFields = new Set(["preview", "content", "output", "result"])
          for (const [key, value] of Object.entries(output.metadata)) {
            if (skipFields.has(key)) continue
            if (typeof value === "string") {
              // Truncate long strings
              toolData.span.setAttribute(`tool.metadata.${key}`, value.slice(0, 200))
            } else if (typeof value === "number" || typeof value === "boolean") {
              toolData.span.setAttribute(`tool.metadata.${key}`, value)
            }
          }
        }
        
        toolData.span.setStatus({ code: SpanStatusCode.OK })
        toolData.span.end()
        toolSpans.delete(input.callID)
      }
    },
  }
}
