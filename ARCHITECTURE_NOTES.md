# Roo-Code Extension Architecture Notes

## Overview

This document describes the architecture of the Roo-Code (formerly Cline) VSCode extension and identifies key areas for modification.

## Key Components

### 1. Tool Execution

**Location:** `forked-repo/Roo-Code/src/core/assistant-message/presentAssistantMessage.ts`

Tools are executed in the `presentAssistantMessage()` function. This is the main entry point for tool execution:

- **Lines 298-918**: Main tool execution switch statement
- **Lines 678-918**: Individual tool handlers via `switch (block.name)`

#### Tool Handlers

| Tool                        | Handler Function                   | File                                        |
| --------------------------- | ---------------------------------- | ------------------------------------------- |
| `execute_command`           | `executeCommandTool.handle()`      | `src/core/tools/ExecuteCommandTool.ts`      |
| `write_to_file`             | `writeToFileTool.handle()`         | `src/core/tools/WriteToFileTool.ts`         |
| `read_file`                 | `readFileTool.handle()`            | `src/core/tools/ReadFileTool.ts`            |
| `search_files`              | `searchFilesTool.handle()`         | `src/core/tools/SearchFilesTool.ts`         |
| `list_files`                | `listFilesTool.handle()`           | `src/core/tools/ListFilesTool.ts`           |
| `edit`/`search_and_replace` | `editTool.handle()`                | `src/core/tools/EditTool.ts`                |
| `search_replace`            | `searchReplaceTool.handle()`       | `src/core/tools/SearchReplaceTool.ts`       |
| `edit_file`                 | `editFileTool.handle()`            | `src/core/tools/EditFileTool.ts`            |
| `apply_diff`                | `applyDiffToolClass.handle()`      | `src/core/tools/ApplyDiffTool.ts`           |
| `apply_patch`               | `applyPatchTool.handle()`          | `src/core/tools/ApplyPatchTool.ts`          |
| `use_mcp_tool`              | `useMcpToolTool.handle()`          | `src/core/tools/UseMcpToolTool.ts`          |
| `ask_followup_question`     | `askFollowupQuestionTool.handle()` | `src/core/tools/AskFollowupQuestionTool.ts` |
| `switch_mode`               | `switchModeTool.handle()`          | `src/core/tools/SwitchModeTool.ts`          |
| `attempt_completion`        | `attemptCompletionTool.handle()`   | `src/core/tools/AttemptCompletionTool.ts`   |
| `new_task`                  | `newTaskTool.handle()`             | `src/core/tools/NewTaskTool.ts`             |
| `update_todo_list`          | `updateTodoListTool.handle()`      | `src/core/tools/UpdateTodoListTool.ts`      |
| `run_slash_command`         | `runSlashCommandTool.handle()`     | `src/core/tools/RunSlashCommandTool.ts`     |
| `skill`                     | `skillTool.handle()`               | `src/core/tools/SkillTool.ts`               |
| `generate_image`            | `generateImageTool.handle()`       | `src/core/tools/GenerateImageTool.ts`       |
| `codebase_search`           | `codebaseSearchTool.handle()`      | `src/core/tools/CodebaseSearchTool.ts`      |
| `read_command_output`       | `readCommandOutputTool.handle()`   | `src/core/tools/ReadCommandOutputTool.ts`   |

### 2. System Prompt Construction

**Location:** `forked-repo/Roo-Code/src/core/prompts/system.ts`

The system prompt is built in the `SYSTEM_PROMPT()` function:

- **Lines 41-110**: `generatePrompt()` - Core prompt generation
- **Lines 112-158**: `SYSTEM_PROMPT()` - Main exported function

#### Prompt Sections

Located in `src/core/prompts/sections/`:

| Section             | File                     | Description                     |
| ------------------- | ------------------------ | ------------------------------- |
| Rules               | `rules.ts`               | General rules for the assistant |
| System Info         | `system-info.ts`         | System information (cwd, etc.)  |
| Objective           | `objective.ts`           | Main objective                  |
| Tool Use            | `tool-use.ts`            | Tool usage instructions         |
| Tool Use Guidelines | `tool-use-guidelines.ts` | Guidelines for tool usage       |
| Capabilities        | `capabilities.ts`        | Assistant capabilities          |
| Modes               | `modes.ts`               | Mode definitions                |
| Custom Instructions | `custom-instructions.ts` | User custom instructions        |
| Markdown Formatting | `markdown-formatting.ts` | Markdown formatting rules       |
| Skills              | `skills.ts`              | Available skills                |

### 3. Tool Definitions

**Location:** `forked-repo/Roo-Code/src/shared/tools.ts`

- **Lines 26-85**: `toolParamNames` - All tool parameter names
- **Lines 91-119**: `NativeToolArgs` - Native argument types for each tool
- **Lines 267-292**: `TOOL_DISPLAY_NAMES` - Human-readable tool names
- **Lines 295-313**: `TOOL_GROUPS` - Tool groupings
- **Lines 316-324**: `ALWAYS_AVAILABLE_TOOLS` - Tools available in all modes
- **Lines 336-339**: `TOOL_ALIASES` - Tool name aliases

### 4. Base Tool Class

**Location:** `forked-repo/Roo-Code/src/core/tools/BaseTool.ts`

All tools extend `BaseTool<T>` which provides:

- `handle()` - Main execution handler
- `handlePartial()` - Partial (streaming) handler

## Hook Injection Points

### Pre-Execution Hook

Located in `presentAssistantMessage.ts` around **lines 573-677**, before the tool execution switch statement. This is where you can intercept tool calls before they execute.

Key validation steps:

1. **Lines 573-624**: Tool validation
2. **Lines 626-676**: Tool repetition detection

### Post-Execution Hook

Located in `presentAssistantMessage.ts` around **lines 678-918**, after each tool's `handle()` call returns. This is where you can capture tool results.

### System Prompt Injection

Located in `src/core/prompts/system.ts` around **lines 85-109**, in the `generatePrompt()` function. You can inject context into:

- Line 97: After `getRulesSection()`
- Line 101: After `getObjectiveSection()`

## Implementation Notes

### Adding a New Tool

1. **Define tool type** in `src/shared/tools.ts`:

    - Add to `NativeToolArgs` type (lines 91-119)
    - Add to `TOOL_DISPLAY_NAMES` (lines 267-292)
    - Add to `TOOL_GROUPS` if needed (lines 295-313)

2. **Create tool class** in `src/core/tools/`:

    - Extend `BaseTool<T>`
    - Implement `handle()` method

3. **Register tool handler** in `src/core/assistant-message/presentAssistantMessage.ts`:
    - Import the tool
    - Add case in switch statement (lines 678-918)

### Adding Pre/Post Hooks

1. **Pre-execution hooks**: Add logic before line 678 in `presentAssistantMessage.ts`
2. **Post-execution hooks**: Add logic after each tool's `handle()` call

### Injecting Context into LLM Prompt

Modify `src/core/prompts/system.ts`:

- Add parameters to `generatePrompt()` function
- Inject context into the prompt string around lines 85-109

## File Structure

```
forked-repo/Roo-Code/src/
├── core/
│   ├── assistant-message/
│   │   └── presentAssistantMessage.ts    # Tool execution entry point
│   ├── prompts/
│   │   ├── system.ts                     # System prompt construction
│   │   └── sections/                     # Prompt sections
│   ├── tools/                           # Tool implementations
│   │   ├── BaseTool.ts                  # Base tool class
│   │   ├── ExecuteCommandTool.ts        # Command execution
│   │   ├── WriteToFileTool.ts           # File writing
│   │   └── ...                          # Other tools
│   └── task/
│       └── Task.ts                      # Main task logic
├── shared/
│   └── tools.ts                         # Tool definitions
└── services/                            # External services
```

## Active Intent System

To implement the active intent system:

1. **Create `active_intents.yaml`** in project root or config directory
2. **Add `select_active_intent` tool** to intercept intent selection
3. **Implement Pre-Hook** in `presentAssistantMessage.ts` to intercept all tool calls
4. **Load intent context** and inject into system prompt in `system.ts`
