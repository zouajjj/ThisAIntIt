#!/usr/bin/env bash
# Run this ON the VM, from inside the cloned repo, to (re)deploy the stack.
# First run: see the setup steps in the PR/chat this script shipped with —
# this script assumes Docker is installed, the repo is cloned, and a .env
# with GROQ_API_KEY already exists in the repo root.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building images and starting the stack"
docker compose up -d --build

echo "==> Pruning dangling images from the old build"
docker image prune -f

echo "==> Status"
docker compose ps
