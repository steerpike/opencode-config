/**
 * Custom Tools Plugin for OpenCode
 * 
 * Registers custom tools defined in .opencode/tools/
 * 
 * To add a new tool:
 * 1. Create a tool file in .opencode/tools/ using the tool() helper
 * 2. Import and add it to the `tool` object below
 */

import type { Plugin } from "@opencode-ai/plugin"
import testError from "../tools/test-error"

export const ToolsPlugin: Plugin = async ({ project }) => {
  console.log("[tools-plugin] Registering custom tools")
  
  return {
    tool: {
      "test-error": testError,
    },
  }
}
