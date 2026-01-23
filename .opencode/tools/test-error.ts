/**
 * Test Error Tool
 * 
 * Generates controlled errors for testing telemetry and error handling.
 * Use this to validate that error tracking is working correctly in Honeycomb.
 * 
 * Error types:
 * - throw: Throws a JavaScript error (tests ToolStateError capture)
 * - delayed-throw: Waits before throwing (tests async error handling)
 * - return-error: Returns an error-like string (tests output-based detection)
 */

import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Generate a test error for telemetry validation. WARNING: This tool intentionally fails. Use 'throw' to test error tracking, 'delayed-throw' for async errors, or 'return-error' for error-like output.",
  args: {
    errorType: tool.schema
      .enum(["throw", "delayed-throw", "return-error"])
      .describe("Type of error to generate: 'throw' (immediate exception), 'delayed-throw' (async exception after delay), 'return-error' (returns error string)"),
    message: tool.schema
      .string()
      .optional()
      .describe("Custom error message (default: 'Test error for telemetry validation')"),
    delayMs: tool.schema
      .number()
      .optional()
      .describe("Delay in milliseconds before throwing (only for delayed-throw, default: 1000)"),
  },
  async execute(args) {
    const message = args.message || "Test error for telemetry validation"
    const delay = args.delayMs || 1000

    switch (args.errorType) {
      case "throw":
        throw new Error(message)
      
      case "delayed-throw":
        await new Promise(resolve => setTimeout(resolve, delay))
        throw new Error(message)
      
      case "return-error":
        return `Error: ${message}`
      
      default:
        return `Unknown error type: ${args.errorType}`
    }
  },
})
