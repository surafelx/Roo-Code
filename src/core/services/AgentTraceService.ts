import * as fs from "fs"
import * as path from "path"
import { createHash } from "crypto"
import { SelectActiveIntentTool } from "../tools/SelectActiveIntentTool"

/**
 * Mutation classification for semantic tracking
 */
export type MutationClass = 
	| "AST_REFACTOR"  // Syntax change, same intent (e.g., renaming variables)
	| "INTENT_EVOLUTION"  // New feature or behavior change
	| "DOC_UPDATE"  // Documentation only
	| "CONFIG_CHANGE"  // Configuration change

/**
 * Agent Trace Entry Schema
 * Based on the TRP specification for Intent-AST correlation
 */
export interface AgentTraceEntry {
	id: string
	timestamp: string
	vcs: {
		revision_id?: string
	}
	files: {
		relative_path: string
		conversations: {
			url?: string
			contributor: {
				entity_type: "AI" | "Human"
				model_identifier?: string
			}
			ranges: {
				start_line: number
				end_line: number
				content_hash: string
			}[]
			related: {
				type: "specification" | "intent" | "requirement"
				value: string
			}[]
		}[]
	}[]
}

/**
 * Agent Trace Service
 * 
 * Implements the AI-Native Git Layer for semantic tracking:
 * - Links Business Intent -> Code AST -> Agent Action
 * - Uses content hashing for spatial independence
 * - Appends to agent_trace.jsonl for ledger
 */
export class AgentTraceService {
	private static traceFileName = "agent_trace.jsonl"
	private static orchestrationDir = ".orchestration"

	/**
	 * Get the trace file path
	 */
	private static getTraceFilePath(cwd: string): string {
		return path.join(cwd, this.orchestrationDir, this.traceFileName)
	}

	/**
	 * Ensure the .orchestration directory exists
	 */
	private static async ensureOrchestrationDir(cwd: string): Promise<void> {
		const dirPath = path.join(cwd, this.orchestrationDir)
		try {
			await fs.promises.mkdir(dirPath, { recursive: true })
		} catch (error) {
			// Ignore if already exists
		}
	}

	/**
	 * Compute SHA-256 hash for spatial independence
	 * Hash remains valid even if lines move
	 */
	private static computeContentHash(content: string): string {
		return createHash("sha256").update(content).digest("hex")
	}

	/**
	 * Generate a UUID-like ID
	 */
	private static generateId(): string {
		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
			const r = (Math.random() * 16) | 0
			const v = c === "x" ? r : (r & 0x3) | 0x8
			return v.toString(16)
		})
	}

	/**
	 * Log a file mutation to the trace
	 */
	static async logFileMutation(
		cwd: string,
		filePath: string,
		content: string,
		startLine: number = 1,
		endLine: number = -1,
		mutationClass: MutationClass = "INTENT_EVOLUTION",
	): Promise<void> {
		await this.ensureOrchestrationDir(cwd)

		const tracePath = this.getTraceFilePath(cwd)
		const activeIntent = SelectActiveIntentTool.getActiveIntent()
		
		// Calculate content hash for spatial independence
		const contentHash = this.computeContentHash(content)
		
		// Determine line count if not provided
		const lineCount = endLine > 0 ? endLine - startLine + 1 : content.split("\n").length

		// Build the trace entry
		const entry: AgentTraceEntry = {
			id: this.generateId(),
			timestamp: new Date().toISOString(),
			vcs: {}, // Would be populated with git SHA in full implementation
			files: [
				{
					relative_path: filePath,
					conversations: [
						{
							contributor: {
								entity_type: "AI",
								model_identifier: "roo-code",
							},
							ranges: [
								{
									start_line: startLine,
									end_line: endLine > 0 ? endLine : lineCount,
									content_hash: contentHash,
								},
							],
							related: activeIntent
								? [
										{
											type: "intent",
											value: activeIntent.id,
										},
								  ]
								: [],
						},
					],
				},
			],
		}

		// Append to JSONL file
		const line = JSON.stringify(entry) + "\n"
		await fs.promises.appendFile(tracePath, line, "utf-8")

		console.log(`[AgentTrace] Logged ${mutationClass} for ${filePath} with hash ${contentHash.substring(0, 8)}...`)
	}

	/**
	 * Read trace entries for a specific file
	 */
	static async getTraceForFile(cwd: string, filePath: string): Promise<AgentTraceEntry[]> {
		const tracePath = this.getTraceFilePath(cwd)
		
		try {
			const content = await fs.promises.readFile(tracePath, "utf-8")
			const lines = content.split("\n").filter(line => line.trim())
			
			const entries: AgentTraceEntry[] = []
			for (const line of lines) {
				try {
					const entry = JSON.parse(line) as AgentTraceEntry
					if (entry.files.some(f => f.relative_path === filePath)) {
						entries.push(entry)
					}
				} catch {
					// Skip invalid lines
				}
			}
			
			return entries
		} catch {
			return []
		}
	}

	/**
	 * Read trace entries for a specific intent
	 */
	static async getTraceForIntent(cwd: string, intentId: string): Promise<AgentTraceEntry[]> {
		const tracePath = this.getTraceFilePath(cwd)
		
		try {
			const content = await fs.promises.readFile(tracePath, "utf-8")
			const lines = content.split("\n").filter(line => line.trim())
			
			const entries: AgentTraceEntry[] = []
			for (const line of lines) {
				try {
					const entry = JSON.parse(line) as AgentTraceEntry
					for (const file of entry.files) {
						for (const conversation of file.conversations) {
							if (conversation.related.some(r => r.value === intentId)) {
								entries.push(entry)
								break
							}
						}
					}
				} catch {
					// Skip invalid lines
				}
			}
			
			return entries
		} catch {
			return []
		}
	}

	/**
	 * Verify content hash matches (for trust verification)
	 */
	static verifyContentHash(content: string, expectedHash: string): boolean {
		const actualHash = this.computeContentHash(content)
		return actualHash === expectedHash
	}
}

/**
 * Helper to classify mutation type
 * This is a simplified classification - in production, AST analysis would be used
 */
export function classifyMutation(
	oldContent: string,
	newContent: string,
	intentChanged: boolean,
): MutationClass {
	if (intentChanged) {
		return "INTENT_EVOLUTION"
	}
	
	// Simple heuristic: if the structural elements changed significantly, it's evolution
	// Otherwise it's a refactor
	const oldLines = oldContent.split("\n").length
	const newLines = newContent.split("\n").length
	const lineDiff = Math.abs(oldLines - newLines)
	
	// More than 20% line difference suggests evolution
	if (lineDiff / Math.max(oldLines, newLines) > 0.2) {
		return "INTENT_EVOLUTION"
	}
	
	return "AST_REFACTOR"
}
