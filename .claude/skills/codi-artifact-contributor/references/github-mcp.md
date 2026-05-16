# GitHub MCP Contribution Workflow

Reference for contributing via the GitHub MCP server. Read when the main
flow reaches Step 3 Option D and the GitHub MCP server is configured.

## MCP server setup

Add to your agent's MCP config:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<token>"
      }
    }
  }
}
```

The token needs `repo` and `read:org` scopes. Create at
https://github.com/settings/tokens.

## Contribution steps

1. **Check authentication** — `mcp__github__get_me`
2. **Create fork or repo** — `mcp__github__create_repository` (or use an
   existing fork)
3. **Create a branch** — `mcp__github__create_branch`
4. **Push files** — `mcp__github__push_files` with the artifact's template
   and index entries
5. **Open the PR** — `mcp__github__create_pull_request` with base `develop`

## When to prefer MCP over CLI

- The agent already has the MCP server configured and authenticated
- The contribution touches many files in one shot (push_files handles the
  batch atomically)
- The user wants to stay inside the chat without dropping to a shell
