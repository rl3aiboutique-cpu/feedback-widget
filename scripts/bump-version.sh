#!/usr/bin/env bash
# Bump version in lockstep across the package.json, pyproject.toml,
# the version.ts of the frontend, and the __init__.py of the backend.
#
# Usage:
#   scripts/bump-version.sh patch   # 0.1.0 -> 0.1.1
#   scripts/bump-version.sh minor   # 0.1.X -> 0.2.0
#   scripts/bump-version.sh major   # X.Y.Z -> (X+1).0.0
#   scripts/bump-version.sh 1.2.3   # set to an explicit version
#
# Does NOT push or tag — the operator runs `git push origin main &&
# git push origin vX.Y.Z` after reviewing the CHANGELOG.md update.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

CURRENT="$(awk -F'"' '/^version = /{print $2; exit}' pyproject.toml)"
if [[ -z "$CURRENT" ]]; then
  echo "ERR: could not parse current version from pyproject.toml" >&2
  exit 1
fi

case "${1:-}" in
  patch) NEXT="$(echo "$CURRENT" | awk -F. '{printf "%d.%d.%d", $1, $2, $3+1}')" ;;
  minor) NEXT="$(echo "$CURRENT" | awk -F. '{printf "%d.%d.0", $1, $2+1}')" ;;
  major) NEXT="$(echo "$CURRENT" | awk -F. '{printf "%d.0.0", $1+1}')" ;;
  [0-9]*.[0-9]*.[0-9]*) NEXT="$1" ;;
  *) echo "Usage: $0 {patch|minor|major|X.Y.Z}" >&2; exit 1 ;;
esac

echo "Bumping $CURRENT -> $NEXT"

FILES=(
  "pyproject.toml"
  "package.json"
  "packages/feedback-backend/pyproject.toml"
  "packages/feedback-backend/src/feedback_widget/__init__.py"
  "packages/feedback-frontend/package.json"
  "packages/feedback-frontend/src/version.ts"
)

for f in "${FILES[@]}"; do
  if [[ -f "$f" ]]; then
    sed -i \
      -e "s/^version = \"$CURRENT\"/version = \"$NEXT\"/" \
      -e "s/\"version\": \"$CURRENT\"/\"version\": \"$NEXT\"/" \
      -e "s/__version__ = \"$CURRENT\"/__version__ = \"$NEXT\"/" \
      -e "s/VERSION = \"$CURRENT\"/VERSION = \"$NEXT\"/" \
      "$f"
    echo "  updated $f"
  fi
done

TODAY="$(date -u +%Y-%m-%d)"
if grep -q "^## \[Unreleased\]" CHANGELOG.md; then
  sed -i "/^## \[Unreleased\]/a\\
\\
## [$NEXT] - $TODAY\\
\\
### Added\\
\\
- _(fill in)_\\
" CHANGELOG.md
  echo "  added CHANGELOG.md section for $NEXT (please fill it in)"
fi

git add "${FILES[@]}" CHANGELOG.md
echo ""
echo "Staged. When happy:"
echo "  git commit -m 'release: v$NEXT'"
echo "  git tag -a v$NEXT -m 'v$NEXT'"
echo "  git push origin main && git push origin v$NEXT"
