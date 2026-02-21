import * as fs from "fs"
import * as path from "path"
import { createHash } from "crypto"
import { Task } from "../task/Task"
import type { ToolUse } from "../../shared/tools"
import { SelectActiveIntentTool } from "../tools/SelectActiveIntentTool"

/**
 * Represents a file that the agent has read and is tracking for concurrency
 */
interface TrackedFile {
	absolutePath: string
	contentHash: string
	timestamp: number
	intentId?: string
}

/**
 * Parallel Orchestration Service
 * 
 * Implements concurrency control for parallel AI agents:
 * - Tracks files read by the agent
 * - Detects stale files (modified by parallel agents/humans)
 * - Prevents overwriting with stale content
 */
export class ParallelOrchestrationService {
	// Map of taskId -> tracked files
	private static trackedFiles: Map<string, Map<string, TrackedFile>> = new Map()

	/**
	 * Track a file that the agent has read
	 * Called when the agent reads a file, to later detect if it was modified
	 */
	static trackFileRead(taskId: string, absolutePath: string, content: string, intentId?: string): void {
		const contentHash = this.computeHash(content)
		
		if (!this.trackedFiles.has(taskId)) {
			this.trackedFiles.set(taskId, new Map())
		}
		
		const taskFiles = this.trackedFiles.get(taskId)!
		taskFiles.set(absolutePath, {
			absolutePath,
			contentHash,
			timestamp: Date.now(),
			intentId,
		})
		
		console.log(`[ParallelOrchestration] Tracking file: ${absolutePath} with hash: ${contentHash.substring(0, 8)}...`)
	}

	/**
	 * Check if a file has been modified since it was last read
	 * Returns true if the file is stale (modified)
	 */
	static async isFileStale(taskId: string, absolutePath: string): Promise<boolean> {
		const taskFiles = this.trackedFiles.get(taskId)
		if (!taskFiles) {
			return false // No files tracked for this task
		}
		
		const trackedFile = taskFiles.get(absolutePath)
		if (!trackedFile) {
			return false // File wasn't tracked (may have been read before tracking started)
		}
		
		try {
			// Read current file content
			const currentContent = await fs.readFile(absolutePath, "utf-8")
			const currentHash = this.computeHash(currentContent)
			
			// Compare hashes
			const isStale = currentHash !== trackedFile.contentHash
			
			if (isStale) {
				console.log(`[ParallelOrchestration] File STALE: ${absolutePath}`)
				console.log(`  Original hash: ${trackedFile.contentHash.substring(0, 8)}...`)
				console.log(`  Current hash:  ${currentHash.substring(0, 8)}...`)
			}
			
			return isStale
		} catch (error) {
			// File may have been deleted - treat as stale
			console.log(`[ParallelOrchestration] Error checking file staleness: ${absolutePath}`, error)
			return true
		}
	}

	/**
	 * Get the original content hash for a tracked file
	 * Used to help the agent understand what changed
	 */
	static getOriginalHash(taskId: string, absolutePath: string): string | null {
		const taskFiles = this.trackedFiles.get(taskId)
		if (!taskFiles) {
			return null
		}
		
		const trackedFile = taskFiles.get(absolutePath)
		return trackedFile?.contentHash ?? null
	}

	/**
	 * Clear tracking for a specific task
	 * Called when a task completes
	 */
	static clearTaskTracking(taskId: string): void {
		this.trackedFiles.delete(taskId)
		console.log(`[ParallelOrchestration] Cleared tracking for task: ${taskId}`)
	}

	/**
	 * Remove a specific file from tracking
	 */
	static untrackFile(taskId: string, absolutePath: string): void {
		const taskFiles = this.trackedFiles.get(taskId)
		if (taskFiles) {
			taskFiles.delete(absolutePath)
		}
	}

	/**
	 * Pre-Hook check for write operations
	 * Validates that the file hasn't been modified by another agent/human
	 */
	static async checkWritePreConditions(task: Task, toolBlock: ToolUse): Promise<{
		shouldProceed: boolean
		errorMessage?: string
	}> {
		// Only check for write operations
		const writeTools = ["write_to_file", "apply_diff", "edit", "search_and_replace", "search_replace", "edit_file", "apply_patch"]
		
		if (!writeTools.includes(toolBlock.name)) {
			return { shouldProceed: true }
		}

		// Get the active intent
		const activeIntent = SelectActiveIntentTool.getActiveIntent()
		
		// Extract file path from tool parameters
		let filePath: string | undefined
		switch (toolBlock.name) {
			case "write_to_file":
			case "apply_diff":
				filePath = toolBlock.params.path
				break
			case "edit":
			case "search_and_replace":
			case "search_replace":
			case "edit_file":
				filePath = toolBlock.params.file_path
				break
			case "apply_patch":
				// Can't easily determine file path for apply_patch
				return { shouldProceed: true }
		}

		if (!filePath) {
			return { shouldProceed: true }
		}

		const absolutePath = path.resolve(task.cwd, filePath)
		
		// Check if file exists
		try {
			await fs.access(absolutePath)
		} catch {
			// File doesn't exist - not stale
			return { shouldProceed: true }
		}

		// Check if file is stale
		const isStale = await this.isFileStale(task.taskId, absolutePath)
		
		if (isStale) {
			const originalHash = this.getOriginalHash(task.taskId, absolutePath)
			const errorMessage = `Stale File Error: The file "${filePath}" has been modified since you read it. ` +
				`A parallel agent or human may have made changes. ` +
				`Please re-read the file to get the latest content before making changes.`
			
			console.log(`[ParallelOrchestration] Blocked write to stale file: ${filePath}`)
			
			return {
				shouldProceed: false,
				errorMessage,
			}
		}

		return { shouldProceed: true }
	}

	/**
	 * Compute SHA-256 hash of content
	 * Used for spatial independence - hash remains valid even if lines move
	 */
	private static computeHash(content: string): string {
		return createHash("sha256").update(content).digest("hex")
	}
}

/**
 * Get workspace lock status for parallel orchestration
 * Returns information about files that are being worked on
 */
export function getWorkspaceOrchestrationStatus(cwd: string): {
	activeFiles: string[]
	totalTracked: number
} {
	const activeFiles: string[] = []
	let totalTracked = 0
	
	for (const [taskId, files] of ParallelOrchestrationService.trackedFiles.entries()) {
		totalTracked += files.size
		for (const [filePath, trackedFile] of files.entries()) {
			// Only include files in the workspace
			if (filePath.startsWith(cwd)) {
				activeFiles.push(filePath)
			}
		}
	}
	
	return {
		activeFiles: [...new Set(activeFiles)],
		totalTracked,
	}
}
