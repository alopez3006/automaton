# Snipara context and memory

This fork uses the hosted project endpoint `https://api.snipara.com/mcp/automaton`.
The owner explicitly approved this project endpoint instead of the global Snipara project.

Build with `pnpm build`, then start with `npm run start:snipara -- --run`.
The first launch still needs Automaton's interactive setup (identity, providers,
genesis instruction). Starting the agent can consume inference and Conway credits.

The launcher reads `RLM_API_KEY` or `SNIPARA_API_KEY` from the environment, or the
same variables from `~/.codex/snipara.env`. It passes the key in the child process
environment; no key is written to Automaton configuration or this repository.
Use `SNIPARA_SECRET_FILE` to select a separate local secret file. A project-bound
EDITOR credential is preferable to a personal key with access to other projects.

At startup the runtime initializes hosted MCP and discovers the schemas for
`snipara_stats`, `snipara_context_query`, `snipara_recall` and
`snipara_remember_if_novel`. These become real tools available to the model.
The system prompt instructs it to recall project memory and retrieve sources at
the beginning of work and to persist only durable, validated knowledge. Tool
availability and prompt instructions do not prove the model follows them in every
turn. No full autonomous agent run is needed to verify the adapter.

Keep the fork current with `git fetch upstream` and review changes before merging
`upstream/main`. The remotes are `origin=alopez3006/automaton` and
`upstream=Conway-Research/automaton`.
