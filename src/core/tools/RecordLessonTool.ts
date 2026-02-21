import * as fs from "fs"
import * as path from "path"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface RecordLessonParams {
	lesson: string
	category?: "failure" | "success" | "architecture" | "workflow" | "general"
	file_path?: string
}

/**
 * Record Lesson Tool
 * 
 * Allows the agent to record lessons learned during development.
 * Appends to CLAUDE.md (or custom file) for persistent knowledge sharing
 * across parallel agent sessions.
 * 
 * This implements the "Hive Mind" pattern where multiple agents
 * share knowledge through a common knowledge base.
 */
export class RecordLessonTool extends BaseTool<"record_lesson"> {
	readonly name = "record_lesson" as const

	async execute(params: RecordLessonParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError } = callbacks

		try {
			const { lesson, category = "general", file_path } = params

			if (!lesson) {
				task.consecutiveMistakeCount++
				task.recordToolError("record_lesson")
				pushToolResult(formatResponse.toolError("The lesson parameter is required"))
				return
			}

			// Determine the file to write to
			const targetFile = file_path 
				? path.resolve(task.cwd, file_path)
				: path.join(task.cwd, "CLAUDE.md")

			// Format the lesson entry
			const timestamp = new Date().toISOString()
			const taskId = task.taskId || "unknown"
			
			const lessonEntry = this.formatLessonEntry(timestamp, taskId, category, lesson)

			// Check if file exists and append or create
			let existingContent = ""
			try {
				if (fs.existsSync(targetFile)) {
					existingContent = fs.readFileSync(targetFile, "utf-8")
				}
			} catch (error) {
				console.warn(`[RecordLesson] Could not read existing file: ${error}`)
			}

			// Append the new lesson
			const updatedContent = this.appendLesson(existingContent, lessonEntry)

			// Write back to file
			await fs.writeFile(targetFile, updatedContent, "utf-8")

			const successMessage = `Lesson recorded successfully in ${path.basename(targetFile)}.\n` +
				`Category: ${category}\n` +
				`Timestamp: ${timestamp}`

			pushToolResult(formatResponse.toolResult(successMessage))
			
			console.log(`[RecordLesson] Recorded lesson to ${targetFile}`)
		} catch (error) {
			await handleError("recording lesson", error as Error)
		}
	}

	/**
	 * Format a lesson entry with metadata
	 */
	private formatLessonEntry(timestamp: string, taskId: string, category: string, lesson: string): string {
		const categoryEmoji = this.getCategoryEmoji(category)
		
		return `
## ${categoryEmoji} ${this.capitalizeFirst(category)} - ${timestamp}

**Task:** ${taskId}

${lesson}

---
`
	}

	/**
	 * Get emoji for category
	 */
	private getCategoryEmoji(category: string): string {
		const emojis: Record<string, string> = {
			failure: "❌",
			success: "✅",
			architecture: "🏗️",
			workflow: "🔄",
			general: "📝",
		}
		return emojis[category] || "📝"
	}

	/**
	 * Capitalize first letter
	 */
	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1)
	}

	/**
	 * Append lesson to existing content
	 * Creates a Lessons Learned section if it doesn't exist
	 */
	private appendLesson(existingContent: string, newLesson: string): string {
		const lessonsSectionMarker = "## Lessons Learned"
		
		if (!existingContent) {
			// New file - create with lessons section
			return `# Project Knowledge Base

${lessonsSectionMarker}
${newLesson}
`
		}

		// Check if Lessons Learned section exists
		if (existingContent.includes(lessonsSectionMarker)) {
			// Find the section and append after it
			const lines = existingContent.split("\n")
			const sectionIndex = lines.findIndex(line => line.startsWith(lessonsSectionMarker))
			
			if (sectionIndex !== -1) {
				// Find where the next ## section starts (if any)
				let insertIndex = sectionIndex + 1
				while (insertIndex < lines.length) {
					if (lines[insertIndex].startsWith("## ") && !lines[insertIndex].startsWith("### ")) {
						break
					}
					insertIndex++
				}
				
				// Insert the new lesson
				lines.splice(insertIndex, 0, newLesson)
				return lines.join("\n")
			}
		}

		// No Lessons Learned section - add it before any other concluding sections
		// or at the end
		return `${existingContent.trim()}

${lessonsSectionMarker}
${newLesson}
`
	}
}

export const recordLessonTool = new RecordLessonTool()
