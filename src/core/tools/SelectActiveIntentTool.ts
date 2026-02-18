import * as fs from "fs"
import * as path from "path"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import * as yaml from "js-yaml"

interface SelectActiveIntentParams {
	intent_id: string
}

interface IntentConfig {
	id: string
	name: string
	description: string
	context: string[]
}

interface ActiveIntentsConfig {
	intents: IntentConfig[]
}

// Store the active intent in a module-level variable
let currentActiveIntent: IntentConfig | null = null

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError } = callbacks

		try {
			const intentId = params.intent_id

			if (!intentId) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				task.didToolFailInCurrentTurn = true
				pushToolResult(formatResponse.toolError("The intent_id parameter is required"))
				return
			}

			// Load active_intents.yaml
			const intentConfig = await this.loadActiveIntentsConfig(task)

			if (!intentConfig) {
				pushToolResult(formatResponse.toolError("Could not load active_intents.yaml configuration"))
				return
			}

			// Find the requested intent
			const intent = intentConfig.intents.find((i) => i.id === intentId)

			if (!intent) {
				const availableIntents = intentConfig.intents.map((i) => i.id).join(", ")
				pushToolResult(
					formatResponse.toolError(`Intent "${intentId}" not found. Available intents: ${availableIntents}`),
				)
				return
			}

			// Set the active intent
			currentActiveIntent = intent

			// Build response message
			const responseMessage = `Active intent set to: "${intent.name}"\n\n${intent.description}\n\nContext applied:\n${intent.context.map((c) => `- ${c}`).join("\n")}`

			pushToolResult(formatResponse.toolResult(responseMessage))
		} catch (error) {
			await handleError("selecting active intent", error as Error)
		}
	}

	private async loadActiveIntentsConfig(task: Task): Promise<ActiveIntentsConfig | null> {
		// Try multiple locations for active_intents.yaml
		const possiblePaths = [
			// Project root
			path.join(task.cwd, "active_intents.yaml"),
			// Config directory
			path.join(task.cwd, ".roo", "active_intents.yaml"),
			// Home directory
			path.join(process.env.HOME || "", ".roo", "active_intents.yaml"),
			// VSCode config directory
			path.join(
				process.env.APPDATA || "",
				"Code",
				"User",
				"globalStorage",
				"rooveterinary.roo-code",
				"active_intents.yaml",
			),
		]

		for (const configPath of possiblePaths) {
			try {
				if (fs.existsSync(configPath)) {
					const fileContent = fs.readFileSync(configPath, "utf-8")
					return yaml.load(fileContent) as ActiveIntentsConfig
				}
			} catch (error) {
				console.error(`Error loading active_intents.yaml from ${configPath}:`, error)
			}
		}

		return null
	}

	/**
	 * Get the current active intent
	 */
	static getActiveIntent(): IntentConfig | null {
		return currentActiveIntent
	}

	/**
	 * Clear the current active intent
	 */
	static clearActiveIntent(): void {
		currentActiveIntent = null
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
