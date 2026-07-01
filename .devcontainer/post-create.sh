#!/usr/bin/env bash
# Post-create setup for the fieldset devcontainer / Codespace.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing dependencies"
pnpm install

# ---------------------------------------------------------------------------
# .dev.vars: build from Codespaces secrets when available, otherwise start
# from the example so `pnpm dev` boots (auth will need real keys).
# ---------------------------------------------------------------------------
if [ ! -f .dev.vars ]; then
  if [ -n "${CLERK_SECRET_KEY:-}" ]; then
    echo "==> Writing .dev.vars from Codespaces secrets"
    cat > .dev.vars <<EOF
CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY:-}
CLERK_WEBHOOK_SECRET=${CLERK_WEBHOOK_SECRET:-whsec_placeholder}
POLAR_ACCESS_TOKEN=${POLAR_ACCESS_TOKEN:-}
POLAR_WEBHOOK_SECRET=${POLAR_WEBHOOK_SECRET:-polar_whs_placeholder}
POLAR_PRO_PRODUCT_ID=${POLAR_PRO_PRODUCT_ID:-}
POLAR_BIZ_PRODUCT_ID=${POLAR_BIZ_PRODUCT_ID:-}
POLAR_SERVER=${POLAR_SERVER:-sandbox}
RESEND_API_KEY=${RESEND_API_KEY:-}
SVIX_API_KEY=${SVIX_API_KEY:-}
R2_PUBLIC_BASE_URL=${R2_PUBLIC_BASE_URL:-}
APP_URL=http://localhost:5173
EOF
  else
    echo "==> No Codespaces secrets found; copying .dev.vars.example"
    echo "    Fill in real keys before signing in (see AGENTS.md → Secrets)."
    cp .dev.vars.example .dev.vars
  fi
fi

# Client-side Clerk config (Vite reads .env.local). The publishable key is the
# same one the server uses, so fall back to CLERK_PUBLISHABLE_KEY.
CLERK_PK="${VITE_CLERK_PUBLISHABLE_KEY:-${CLERK_PUBLISHABLE_KEY:-}}"
if [ ! -f .env.local ] && [ -n "$CLERK_PK" ]; then
  echo "==> Writing .env.local"
  cat > .env.local <<EOF
VITE_CLERK_PUBLISHABLE_KEY=${CLERK_PK}
VITE_CLERK_SIGN_IN_URL=/sign-in
VITE_CLERK_SIGN_UP_URL=/sign-up
VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/app
VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/app
EOF
fi

echo "==> Applying D1 migrations to the local database"
pnpm db:migrate:local


echo "==> Done. Useful commands:"
echo "    pnpm dev                 start the app on :5173"
echo "    pnpm test / typecheck    verify"
echo "    pnpm db:studio           Drizzle Studio on the local D1"
echo "    polar listen http://localhost:5173/api/integrations/polar"
echo "    set CLOUDFLARE_API_TOKEN to deploy (wrangler login does not work in Codespaces;"
echo "                             see README → Deploying from a Codespace)"
echo "    sudo npx -y playwright install --with-deps chromium"
echo "                             one-time browser setup before playwright-cli"
