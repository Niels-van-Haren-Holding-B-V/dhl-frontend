#!/bin/sh
# Renders the runtime config the SPA loads before boot (see src/config.ts).
set -eu
cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  apiBaseUrl: "${API_BASE_URL:-https://dhl-api.vanharen-it.nl}",
  authUrl: "${AUTH_URL:-https://dhl-auth.vanharen-it.nl}",
  authRealm: "${AUTH_REALM:-courier}",
  authClientId: "${AUTH_CLIENT_ID:-dhl-frontend}",
};
EOF
