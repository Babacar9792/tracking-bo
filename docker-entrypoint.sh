#!/bin/sh
set -e

ENV_FILE="/usr/share/nginx/html/assets/env.js"
TEMPLATE="/usr/share/nginx/html/assets/env.template.js"

# Generate env.js from template using actual environment variables
# Falls back to defaults if vars are not set
export API_BASE_URL="${API_BASE_URL:-http://localhost:8083/api}"
export WS_URL="${WS_URL:-ws://localhost:8083/ws}"

envsubst < "$TEMPLATE" > "$ENV_FILE"

echo "env.js generated:"
cat "$ENV_FILE"

exec nginx -g "daemon off;"
