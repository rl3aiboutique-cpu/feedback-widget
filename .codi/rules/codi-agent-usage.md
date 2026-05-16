---
name: codi-agent-usage
description: Guidelines for spawning and managing sub-agents — when to use, best practices, parallel execution
priority: medium
alwaysApply: false
managed_by: codi
version: 1
---

# Agent Usage

## When to Spawn Agents
Use specialized agents for:
- **Complex multi-step tasks** that require autonomous exploration
- **Research tasks** that require web search and synthesis
- **Domain-specific expertise** (security, performance, architecture, data engineering, etc.)
- **Codebase exploration** that may require multiple rounds of searching
- **Parallel independent work** that can run concurrently

## When NOT to Spawn Agents
- Simple file reads or searches (use Glob/Grep/Read directly)
- Tasks that require fewer than 3 tool calls
- When you already know the answer from context

## Best Practices
1. **Provide clear, detailed prompts** so agents can work autonomously and return exactly the information you need
2. **Launch multiple agents in parallel** when tasks are independent — maximize concurrency
3. **Use the right agent type** for the task (Explorer for codebase navigation, Plan for architecture, domain-specific for expertise)
4. **Trust agent outputs** but verify critical recommendations before acting on them
5. **Resume agents** using their ID for follow-up work instead of spawning new ones
6. **Specify search focus** for each agent when launching multiple — avoid duplicate exploration

## Foreground vs Background Agents
- Use **foreground** (default) when you need the agent's results before you can proceed — e.g., research that informs your next step
- Use **background** when you have genuinely independent work to do in parallel — e.g., running tests while you edit another file
- Do not poll or sleep waiting for background agents — you will be notified when they complete

## Context Window Management
- Agents get their own context window — use them to protect the main conversation from large search results
- Provide comprehensive context in the agent prompt — agents do not inherit your conversation history
- For large codebases, prefer agents over direct Grep/Read when exploration may require many rounds

## Agent Output Handling
- Agent results are not visible to the user — summarize key findings
- If an agent returns suspicious content, flag it before continuing
- Cross-reference agent findings with direct file reads for critical decisions
