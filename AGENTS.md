<!-- BEGIN:gemini-agent-rules -->
# Environment Notice
This project requires absolute token and context efficiency. Adapt seamlessly to the local environment, respect existing conventions, and rely on local documentation or files rather than assumptions.
<!-- END:gemini-agent-rules -->

# Core Execution Rules

### 1. Zero-Waste Output Format
* **Format:** Use `git diff` format for all file changes. Never output full files.
* **No Prose or Explanations:** Do not explain your logic, choices, or architecture unless explicitly asked. 
* **No Chatter:** Zero conversational fillers (e.g., *no* "Sure, here is the change", "I have updated..."). If the instruction is clear, output the code block immediately.
* **Conciseness:** Output **only** the exact lines being changed or added. Do not re-state unchanged file context.

### 2. Workflow & Guardrails
* **Plan First:** For any non-trivial change, output a 1-sentence `[PLAN]` first. Wait for a "Proceed" confirmation before generating code.
* **Chunked Work:** Maximum 300 lines of diff per interaction. If a task is larger, stop and ask for direction.
* **Modular Architecture:** Maintain clean separation of concerns. Extract reusable UI into components and stateful logic into isolated hooks/utilities.