#!/bin/bash

# Check if the current directory is a git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "Error: Not inside a Git repository."
  exit 1
fi

# Check for any uncommitted changes (tracked or untracked)
if [ -z "$(git status --porcelain)" ]; then
  echo "No changes detected. Working tree is clean."
  exit 0
fi

# Allow an optional commit message via the first argument.
# If no argument is provided, default to a timestamp.
COMMIT_MSG="${1:-Auto-commit: $(date +'%Y-%m-%d %H:%M:%S')}"

echo "Changes detected. Staging files..."
git add -A

echo "Committing changes..."
git commit -m "$COMMIT_MSG"

echo "Pushing to remote..."
# Push to the default remote and current branch
git push

# Verify if the push was successful
if [ $? -eq 0 ]; then
  echo "✅ Successfully committed and pushed changes."
else
  echo "❌ Error: Push failed. Check your remote configuration or network."
  exit 1
fi
