import { SelectActiveIntentTool } from "../tools/SelectActiveIntentTool"
import { Task } from "../task/Task"
import type { ToolUse } from "../../shared/tools"
import { ParallelOrchestrationService } from "./ParallelOrchestrationService"
import * as fs from "fs"
import * as path from "path"

/**
 * Pre-Hook service that intercepts tool execution
 * and applies active intent context
 */
export class IntentPreHook {
	/**
	 * Execute Pre-Hook logic before a tool is executed
	 *
	 * @param cline - The Task instance
	 * @param toolBlock - The tool use block
	 * @returns Whether to proceed with tool execution
	 */
	static async executePreHook(cline: Task, toolBlock: ToolUse): Promise<boolean> {
		// Get the active intent
		const activeIntent = SelectActiveIntentTool.getActiveIntent()

		// PARALLEL ORCHESTRATION: Check for stale files before write operations
		// This prevents parallel agents from overwriting each other's changes
		const staleCheck = await ParallelOrchestrationService.checkWritePreConditions(cline, toolBlock)
		if (!staleCheck.shouldProceed) {
			console.log(`[IntentPreHook] Blocked ${toolBlock.name} due to stale file`)
			return false
		}

		// TRACK READ FILES: Track file reads for later staleness detection
		if (toolBlock.name === "read_file") {
			await this.trackReadFile(cline, toolBlock)
		}

		if (!activeIntent) {
			// No active intent, allow execution
			return true
		}

		// Log the pre-hook execution for debugging
		console.log(`[IntentPreHook] Executing ${toolBlock.name} with active intent: ${activeIntent.name}`)

		// Here you can add logic to:
		// 1. Modify tool parameters based on intent
		// 2. Block certain tools based on intent
		// 3. Add additional context to the task

		// Example: Add intent context to task for later use
		;(cline as any).activeIntentContext = activeIntent.context

		// Example: Block certain tools based on intent
		// if (activeIntent.id === 'security_review' && this.isWriteTool(toolBlock.name)) {
		//     console.log(`[IntentPreHook] Blocking ${toolBlock.name} for security review intent`)
		//     return false
		// }

		return true
	}

	/**
	 * Track a file that was read for staleness detection
	 * This enables parallel orchestration to detect when files have been modified
	 */
	private static async trackReadFile(cline: Task, toolBlock: ToolUse): Promise<void> {
		const filePath = toolBlock.params.path
		if (!filePath) return

		const absolutePath = path.resolve(cline.cwd, filePath)
		
		try {
			// Only track if file exists
			await fs.promises.access(absolutePath)
			
			const content = await fs.promises.readFile(absolutePath, "utf-8")
			const activeIntent = SelectActiveIntentTool.getActiveIntent()
			
			ParallelOrchestrationService.trackFileRead(
				cline.taskId,
				absolutePath,
				content,
				activeIntent?.id
			)
		} catch {
			// File doesn't exist or can't be read - skip tracking
		}
	}

	/**
	 * Execute Post-Hook logic after a tool is executed
	 *
	 * @param cline - The Task instance
	 * @param toolBlock - The tool use block
	 * @param result - The tool result
	 */
	static async executePostHook(cline: Task, toolBlock: ToolUse, result: any): Promise<void> {
		// Get the active intent
		const activeIntent = SelectActiveIntentTool.getActiveIntent()

		if (!activeIntent) {
			return
		}

		// Log the post-hook execution for debugging
		console.log(`[IntentPostHook] Completed ${toolBlock.name} with intent: ${activeIntent.name}`)

		// Here you can add logic to:
		// 1. Process tool results based on intent
		// 2. Track intent-specific metrics
		// 3. Trigger follow-up actions
	}

	/**
	 * Check if a tool is a write tool
	 */
	private static isWriteTool(toolName: string): boolean {
		const writeTools = [
			"write_to_file",
			"apply_diff",
			"edit",
			"search_and_replace",
			"search_replace",
			"edit_file",
			"apply_patch",
			"execute_command",
		]
		return writeTools.includes(toolName)
	}
}

/**
 * Get the active intent context for injection into prompts
 */
export function getActiveIntentContext(): string[] {
	const activeIntent = SelectActiveIntentTool.getActiveIntent()
	return activeIntent?.context ?? []
}
