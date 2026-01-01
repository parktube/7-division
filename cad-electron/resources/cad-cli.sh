#!/usr/bin/env bash
set -euo pipefail

APP_NAME="CADViewer"

if [ -n "${CAD_APP_NAME:-}" ]; then
  APP_NAME="${CAD_APP_NAME}"
fi

if [ -z "${CAD_CLI_INVOKE:-}" ]; then
  CAD_CLI_INVOKE="$(basename "$0")"
  export CAD_CLI_INVOKE
fi

if [ -n "${CAD_APP_PATH:-}" ]; then
  APP_PATH="${CAD_APP_PATH}"
else
  # Resolve symlinks and get the real path to the script
  SCRIPT_PATH="$(realpath "$0")"
  SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
  # The app path is two levels up from the script's directory (e.g., /path/to/CADViewer.app)
  APP_PATH="$(cd "${SCRIPT_DIR}/../.." && pwd)"
fi

APP_EXEC="${APP_PATH}/Contents/MacOS/${APP_NAME}"
CLI_JS="${APP_PATH}/Contents/Resources/cad-tools/dist/cli.js"

if [ ! -x "${APP_EXEC}" ]; then
  echo "cad-cli: app executable not found at ${APP_EXEC}" >&2
  exit 1
fi

if [ ! -f "${CLI_JS}" ]; then
  echo "cad-cli: cli.js not found at ${CLI_JS}" >&2
  exit 1
fi

exec env ELECTRON_RUN_AS_NODE=1 "${APP_EXEC}" "${CLI_JS}" "$@"
