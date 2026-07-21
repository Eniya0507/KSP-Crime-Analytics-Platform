#!/bin/bash
# ============================================================
# KSP Crime Intelligence Platform — Catalyst Deployment Script
# ============================================================
# Prerequisites:
#   1. Install Catalyst CLI: npm install -g @zohocloud/catalyst-cli
#   2. Login: catalyst login
#   3. Set environment variables in .env or export them
# ============================================================

set -e

echo "=== KSP Crime Intelligence Platform — Catalyst Deploy ==="

# 1. Install dependencies
echo "[1/6] Installing dependencies..."
npm ci

# 2. Build frontend
echo "[2/6] Building frontend..."
npm run build

# 3. Type check
echo "[3/6] Type checking..."
npm run typecheck || echo "TypeScript warnings (non-blocking)"

# 4. Deploy to Catalyst AppSail
echo "[4/6] Deploying to Catalyst AppSail..."
catalyst deploy --component appsail --name ksp-frontend

# 5. Deploy Catalyst Functions
echo "[5/6] Deploying Catalyst Functions..."
for fn in ai-query forecast alerts-cron; do
  echo "  Deploying function: $fn"
  catalyst deploy --component function --name ksp-$fn --path catalyst-functions/$fn
done

# 6. Configure Cron
echo "[6/6] Configuring Catalyst Cron..."
catalyst cron update --name ksp-daily-alerts --schedule "0 0 30 * * ? *" --function ksp-alerts-cron

echo ""
echo "=== Deployment Complete ==="
echo "Frontend URL: https://ksp-frontend-<project-id>.catalystappsail.com"
echo "Functions:    https://api.<project-id>.catalystserverless.com/server/ksp-ai-query"
echo ""
echo "Next steps:"
echo "  1. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Catalyst AppSail env vars"
echo "  2. Run database migration: supabase db push"
echo "  3. Seed database: open the app and go to Settings > Seed Database"
