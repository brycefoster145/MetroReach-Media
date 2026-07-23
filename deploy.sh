#!/usr/bin/env bash
# MetroReach Media — Production Deploy Script
# Always deploys to metro-reach-media/metro-reach-media (never marina-os1).
# Must be run from /home/team/shared/site.
set -euo pipefail
cd "$(dirname "$0")"

PROJECT="metro-reach-media"

# Ensure .vercel/project.json points to the right project
mkdir -p .vercel
cat > .vercel/project.json << 'VCEOF'
{"projectId":"prj_SWWtX72Ml8ujmApJNvuoBhEJ14TM","orgId":"team_ay5jkmOa4BoSnmw2dAdqEgX1","projectName":"metro-reach-media"}
VCEOF

echo "Building..."
bun install --silent
bun run build

echo "Deploying to $PROJECT..."
bunx vercel deploy --prebuilt --yes --prod --cwd . 2>&1

echo ""
echo "Verifying deploy..."
sleep 2

check() {
  local url="$1" label="$2"
  local code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$code" = "200" ]; then
    echo "  ✅ $label — $url"
  else
    echo "  ❌ $label — HTTP $code — $url"
  fi
}

check "https://www.metroreachagency.com/" "Homepage"
check "https://www.metroreachagency.com/services/organic-content" "Services"
check "https://www.metroreachagency.com/images/og-image.webp" "OG Image"

echo "Done."
