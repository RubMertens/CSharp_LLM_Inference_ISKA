#!/usr/bin/env bash
set -euo pipefail

# Deploy the presentation to GitHub Pages (gh-pages branch).
# Build output is expected in ./dist (produced by `npm run build`).
# All asset paths are relative, so the site works under /REPO/ project pages.

# --- Config (override via environment) ---
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-gh-pages}"

# --- Preflight checks ---
if ! command -v git >/dev/null 2>&1; then
  echo "Error: git not found. Install: https://git-scm.com" >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx not found. Install Node.js: https://nodejs.org" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node not found. Install Node.js: https://nodejs.org" >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repo." >&2
  exit 1
fi

# --- Detect GitHub remote ---
if ! REMOTE_URL="$(git remote get-url "$REMOTE" 2>/dev/null)" || [ -z "$REMOTE_URL" ]; then
  echo "Error: no remote '$REMOTE' configured." >&2
  echo "Add one: git remote add origin git@github.com:USER/REPO.git" >&2
  exit 1
fi

# --- Derive USER/REPO from remote (git@ or https forms) ---
# git@github.com:USER/REPO.git  ->  USER/REPO
# https://github.com/USER/REPO.git -> USER/REPO
SLUG="$REMOTE_URL"
SLUG="${SLUG#git@github.com:}"
SLUG="${SLUG#https://github.com/}"
SLUG="${SLUG#http://github.com/}"
SLUG="${SLUG%.git}"
SLUG="${SLUG%/}"

GH_USER="${SLUG%%/*}"
GH_REPO="${SLUG##*/}"

if [ -z "$GH_USER" ] || [ -z "$GH_REPO" ] || [ "$GH_USER" = "$SLUG" ]; then
  echo "Error: can't parse USER/REPO from remote '$REMOTE_URL'." >&2
  echo "Expected git@github.com:USER/REPO.git or https://github.com/USER/REPO.git" >&2
  exit 1
fi

PAGES_URL="https://${GH_USER}.github.io/${GH_REPO}/"

# --- Build ---
echo "Building..."
npm run build

# --- .nojekyll (keep js/ folder from being stripped by Jekyll) ---
touch dist/.nojekyll

# --- Deploy ---
echo "Deploying ./dist to branch '$BRANCH'..."
npx -y gh-pages -d dist -b "$BRANCH" --dotfiles

# --- Final URL ---
echo "Deployed: ${PAGES_URL}"
echo "One-time: enable Pages -> Deploy from branch '$BRANCH' /(root) in repo settings."
