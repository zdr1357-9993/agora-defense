#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_ROOT="${AGORA_ENV_ROOT:-$(dirname "$ROOT")/agora-defense-envs}"

mkdir -p "$ENV_ROOT"

for branch in develop stage; do
  target="$ENV_ROOT/$branch"
  current_branch="$(git -C "$ROOT" branch --show-current)"

  if [[ "$current_branch" == "$branch" ]]; then
    echo "Using current checkout as $branch environment: $ROOT"
    continue
  fi

  if [[ -e "$target" ]]; then
    if git -C "$target" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
      && [[ "$(git -C "$target" branch --show-current)" == "$branch" ]]; then
      echo "$branch worktree already exists: $target"
      continue
    fi
    echo "Refusing to overwrite existing path: $target" >&2
    exit 1
  fi

  if git -C "$ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$ROOT" worktree add "$target" "$branch"
  else
    git -C "$ROOT" worktree add --track -b "$branch" "$target" "origin/$branch"
  fi
  echo "Created $branch worktree: $target"
done

echo "Install dependencies in each worktree with: (cd '$ENV_ROOT/develop' && npm ci) and (cd '$ENV_ROOT/stage' && npm ci)"
