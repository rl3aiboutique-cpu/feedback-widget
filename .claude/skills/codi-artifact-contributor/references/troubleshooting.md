# Troubleshooting

Read when the contribution hits one of the symptoms below.

## GitHub CLI not authenticated

```bash
gh auth login
gh auth status  # Verify
```

Pick `GitHub.com → HTTPS → Login with browser` during the prompts.

## Cannot push to remote

The CLI creates (or reuses) a repo on your GitHub account to push the
branch. Verify:

- `gh auth status` reports you are logged in
- Your account can create public repositories
- The remote name is correct (default is `user` when using the manual
  flow above)

## PR has merge conflicts

```bash
cd /tmp/codi-contrib
git fetch origin develop
git rebase origin/develop
# Resolve conflicts, then:
git push user contrib/my-branch --force-with-lease
```

Never use `--force` on a shared branch — `--force-with-lease` is safer
because it aborts if someone else pushed in the meantime.

## ZIP import fails

Ensure the ZIP was created by `codi contribute`. It must contain a
`preset.yaml` manifest at the root or one level deep. Hand-zipped
directories will not install.

## "repository not found" on PR create

Usually means you targeted a repo you cannot fork (private org, no
access). Pass `--repo <owner>/<name>` explicitly, or fork via the
GitHub UI first and re-run.

## Artifact does not appear after `codi generate`

`codi generate` reads from `.codi/`, not from `src/templates/`. See the
clean + reinstall flow in `references/manual-pr.md` or in the
`codi-dev-operations` skill.
