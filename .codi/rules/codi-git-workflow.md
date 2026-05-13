---
name: codi-git-workflow
description: Git workflow and commit conventions
priority: medium
alwaysApply: true
managed_by: codi
version: 1
---

# Git Workflow

## Commit Messages
- Use conventional commits format: type(scope): description — enables automated changelogs and semantic versioning

BAD: `"fixed stuff"` or `"WIP"`
GOOD: `feat(auth): add OAuth2 login with Google provider`

- Types: feat, fix, docs, refactor, test, chore, perf, ci
- Write in imperative mood: "add feature" not "added feature"
- First line under 72 characters, details in body

## Commit Practices
- Make atomic commits: one logical change per commit — simplifies reverts and code review

BAD: One commit with a new feature, a bug fix, and a refactor
GOOD: Three separate commits, each reviewable independently

- Every commit should leave the codebase in a working state — broken commits block bisect and teammates
- Review your diff before committing
- Do not commit generated files, build artifacts, or secrets
- Do not add AI attribution or co-author signatures to commits

## Trunk-Based Development
- Prefer trunk-based development for teams practicing CI/CD — merge to main at least daily
- Keep feature branches short-lived (1-3 days maximum) — long-lived branches accumulate merge conflicts and delay integration feedback
- Use feature flags to merge incomplete work safely — code can be in main without being active in production

## Branch Strategy
- Branch from main for all work
- Use descriptive branch names: feature/, fix/, chore/
- Delete branches after merging

## Pull Request Discipline
- Keep PRs under 200 lines of changed code — large PRs get superficial reviews and hide bugs
- One concern per PR — do not bundle a feature, a refactor, and a bug fix in the same PR
- Require green CI and at least one approval before merge — use merge queues to serialize merges and prevent broken main

## Safety
- Never force push to main or shared branches — rewrites shared history and causes data loss
- Always pull before pushing to avoid unnecessary merge conflicts
- Resolve merge conflicts carefully — understand both sides
- Tag releases with semantic versions (vMAJOR.MINOR.PATCH)

## Automation
- Use semantic-release to automate version bumps and changelog generation from conventional commits — removes human error from the release process
- Enforce commit message format with commitlint in a pre-commit or commit-msg hook — reject malformed messages before they enter history
- Sign commits in CI pipelines for supply chain integrity — verify that releases were produced by trusted automation

## Release Management
- Never publish without a fresh build — stale dist artifacts cause silent regressions
- Use npm lifecycle hooks (preversion, prepublishOnly) to enforce lint, test, and build automatically
- Run tests before every version bump — a broken release is worse than a delayed one
- Verify the built output matches the source before publishing: grep for key changes in dist/
- One atomic command for releases: `npm version patch` triggers lint, test, commit, and tag in sequence — then `npm publish` rebuilds via prepublishOnly
- Configure `.npmrc` with `message=chore(release): bump version to %s` so npm version commits follow conventional format automatically
- Guard `prepublishOnly` with a branch check — abort publish if not on main. Never publish from feature or develop branches
