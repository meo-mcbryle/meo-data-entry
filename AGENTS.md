<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know
This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Refactor Rules
- NO EXPLANATIONS: Do not explain your logic unless asked.
- OUTPUT: ONLY use `git diff` format for all file changes. Never output full files.
- MODULARITY: Extract components into `src/components` and hooks into `src/hooks`.
- VERIFICATION: Always run `npm test` or a dry-run build after each modification.
- CONCISENESS: Output ONLY the code changes. Do not re-state the file context.
- CHUNKED WORK: Max 300 lines per interaction. If a refactor is larger, stop and ask.
- PLAN FIRST: For any refactor, output a 1-sentence [PLAN] first. Wait for my "Proceed" before generating the [CODE] diff.
- NO CHATTER: If the instruction is clear, provide the diff immediately without conversational fillers ("Here is the code...", "I have updated...").