#!/usr/bin/env bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

VENV_DIR="/tmp/adk-deploy"
if [ ! -f "$VENV_DIR/bin/activate" ]; then
  rm -rf "$VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
pip install -q "google-cloud-aiplatform>=1.126.1" 2>/dev/null || pip install "google-cloud-aiplatform>=1.126.1"
# Upgrade if already installed but too old
pip install --upgrade -q "google-cloud-aiplatform>=1.126.1" 2>/dev/null
python3 "$PROJECT_DIR/apps/adk-agent/deploy_agent_engine.py" "$@"
