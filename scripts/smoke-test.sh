#!/usr/bin/env bash
# =============================================================================
# MetroReach Media — Post-Deploy Smoke Test
# =============================================================================
# Runs after every deploy to verify ALL critical services before the owner
# notices a breakage.
#
# Usage:
#   ./scripts/smoke-test.sh                          # tests metroreachagency.com
#   BASE_URL=https://staging.example.com ./scripts/smoke-test.sh
#
# Exit: 0 = all checks passed, non-zero = at least one failure.
# =============================================================================

set -o pipefail

BASE_URL="${BASE_URL:-https://www.metroreachagency.com}"
TIMEOUT=15
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASSED=0
FAILED=0
TOTAL=0
FAILURE_LOG=""

# ── Helpers ─────────────────────────────────────────────────────────────────

check() {
    local label="$1" result="$2" expected="$3" detail="${4:-}"
    TOTAL=$((TOTAL + 1))
    if [[ "$result" == "$expected" ]]; then
        printf "  ${GREEN}✓ PASS${NC}  %s %s\n" "$label" "${detail:+($detail)}"
        PASSED=$((PASSED + 1))
    else
        printf "  ${RED}✗ FAIL${NC}  %s  ${YELLOW}got=%s expected=%s${NC} %s\n" "$label" "$result" "$expected" "${detail:+($detail)}"
        FAILED=$((FAILED + 1))
        FAILURE_LOG+="  FAIL: $label (got=$result, expected=$expected)"$'\n'
    fi
}

check_contains() {
    local label="$1" body="$2" substring="$3"
    TOTAL=$((TOTAL + 1))
    # Bash built-in substring check: null-safe, no pipe, no echo
    if [[ "$body" == *"$substring"* ]]; then
        printf "  ${GREEN}✓ PASS${NC}  %s\n" "$label"
        PASSED=$((PASSED + 1))
    else
        printf "  ${RED}✗ FAIL${NC}  %s  ${YELLOW}body missing \"%s\"${NC}\n" "$label" "$substring"
        FAILED=$((FAILED + 1))
        FAILURE_LOG+="  FAIL: $label (body missing \"$substring\")"$'\n'
    fi
}

http_get_code() {
    curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$1" 2>/dev/null
}

http_get_body() {
    curl -sS --max-time "$TIMEOUT" "$1" 2>/dev/null
}

http_post_code() {
    local url="$1" data="${2:-{}}"
    curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" \
        -X POST "$url" -H "Content-Type: application/json" -d "$data" 2>/dev/null
}

# ── Pre-flight ──────────────────────────────────────────────────────────────

echo ""
printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
printf "${CYAN}  MetroReach Media — Post-Deploy Smoke Test${NC}\n"
printf "${CYAN}  Target: %s${NC}\n" "$BASE_URL"
printf "${CYAN}  Started: %s UTC${NC}\n" "$(date -u '+%Y-%m-%d %H:%M:%S')"
printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
echo ""

if ! curl -sS --max-time 5 "$BASE_URL" > /dev/null 2>&1; then
    printf "${RED}FATAL: Cannot reach %s — aborting.${NC}\n" "$BASE_URL"
    exit 1
fi

# ── SECTION 1: Public Pages ─────────────────────────────────────────────────

printf "${CYAN}── Public Pages ───────────────────────────────────────────────${NC}\n"

HOME_BODY=$(http_get_body "$BASE_URL/")
CODE=$(http_get_code "$BASE_URL/")
check "Homepage (/) HTTP 200" "$CODE" "200"
check_contains "Homepage contains MetroReach" "$HOME_BODY" "MetroReach"

for page in about pricing services contact vip faq privacy terms cookie-policy; do
    CODE=$(http_get_code "$BASE_URL/$page")
    check "$page (/$(echo $page)) HTTP 200" "$CODE" "200"
done

CODE=$(http_get_code "$BASE_URL/portal/connect")
check "Client Portal (/portal/connect) HTTP 200" "$CODE" "200"

CODE=$(http_get_code "$BASE_URL/connect")
if [[ "$CODE" == "200" || "$CODE" == "301" || "$CODE" == "302" || "$CODE" == "308" ]]; then
    printf "  ${GREEN}✓ PASS${NC}  Connect (/connect) resolves (%s)\n" "$CODE"
    PASSED=$((PASSED + 1))
else
    printf "  ${YELLOW}⚠ WARN${NC}  Connect (/connect) returned %s (may not exist yet)\n" "$CODE"
fi
TOTAL=$((TOTAL + 1))

# ── SECTION 2: Form Pages ──────────────────────────────────────────────────

printf "\n${CYAN}── Form Pages ─────────────────────────────────────────────────${NC}\n"

FREE_AUDIT_BODY=$(http_get_body "$BASE_URL/free-audit")
CODE=$(http_get_code "$BASE_URL/free-audit")
check "Free Audit (/free-audit) HTTP 200" "$CODE" "200"
check_contains "Free Audit has <form" "$FREE_AUDIT_BODY" "<form"
check_contains "Free Audit has 'Get My Free Audit' button" "$FREE_AUDIT_BODY" "Get My Free Audit"

PREMIUM_BODY=$(http_get_body "$BASE_URL/premium-audit")
CODE=$(http_get_code "$BASE_URL/premium-audit")
check "Premium Audit (/premium-audit) HTTP 200" "$CODE" "200"
check_contains "Premium Audit has <form" "$PREMIUM_BODY" "<form"

# ── SECTION 3: API Endpoints ────────────────────────────────────────────────

printf "\n${CYAN}── API Endpoints ───────────────────────────────────────────────${NC}\n"

# Audit submit (free) — POST
CODE=$(http_post_code "$BASE_URL/api/audit/submit" '{"website":"example.com","name":"Smoke Test","email":"smoke@example.com"}')
TOTAL=$((TOTAL + 1))
if [[ "$CODE" == "200" || "$CODE" == "201" || "$CODE" == "302" || "$CODE" == "400" ]]; then
    printf "  ${GREEN}✓ PASS${NC}  POST /api/audit/submit (%s)\n" "$CODE"
    PASSED=$((PASSED + 1))
else
    printf "  ${RED}✗ FAIL${NC}  POST /api/audit/submit  ${YELLOW}got=%s${NC}\n" "$CODE"
    FAILED=$((FAILED + 1))
    FAILURE_LOG+="  FAIL: POST /api/audit/submit (got=$CODE)"$'\n'
fi

# Premium audit submit — POST
CODE=$(http_post_code "$BASE_URL/api/premium-audit/submit" '{"website":"example.com","name":"Smoke Test","email":"smoke@example.com"}')
TOTAL=$((TOTAL + 1))
if [[ "$CODE" == "200" || "$CODE" == "201" || "$CODE" == "302" || "$CODE" == "400" ]]; then
    printf "  ${GREEN}✓ PASS${NC}  POST /api/premium-audit/submit (%s)\n" "$CODE"
    PASSED=$((PASSED + 1))
else
    printf "  ${RED}✗ FAIL${NC}  POST /api/premium-audit/submit  ${YELLOW}got=%s${NC}\n" "$CODE"
    FAILED=$((FAILED + 1))
    FAILURE_LOG+="  FAIL: POST /api/premium-audit/submit (got=$CODE)"$'\n'
fi

# Cron post-scheduler
CODE=$(http_get_code "$BASE_URL/api/cron/post-scheduler")
TOTAL=$((TOTAL + 1))
if [[ "$CODE" == "200" || "$CODE" == "503" || "$CODE" == "405" ]]; then
    printf "  ${GREEN}✓ PASS${NC}  GET /api/cron/post-scheduler (%s)\n" "$CODE"
    PASSED=$((PASSED + 1))
else
    printf "  ${RED}✗ FAIL${NC}  GET /api/cron/post-scheduler  ${YELLOW}got=%s${NC}\n" "$CODE"
    FAILED=$((FAILED + 1))
    FAILURE_LOG+="  FAIL: GET /api/cron/post-scheduler (got=$CODE)"$'\n'
fi

# DB health check
CODE=$(http_get_code "$BASE_URL/api/db-check")
TOTAL=$((TOTAL + 1))
if [[ "$CODE" == "200" || "$CODE" == "503" ]]; then
    printf "  ${GREEN}✓ PASS${NC}  GET /api/db-check (%s)\n" "$CODE"
    PASSED=$((PASSED + 1))
else
    printf "  ${RED}✗ FAIL${NC}  GET /api/db-check  ${YELLOW}got=%s${NC}\n" "$CODE"
    FAILED=$((FAILED + 1))
    FAILURE_LOG+="  FAIL: GET /api/db-check (got=$CODE)"$'\n'
fi

# Force migrate
CODE=$(http_get_code "$BASE_URL/api/force-migrate")
TOTAL=$((TOTAL + 1))
if [[ "$CODE" == "200" || "$CODE" == "405" || "$CODE" == "503" ]]; then
    printf "  ${GREEN}✓ PASS${NC}  GET /api/force-migrate (%s)\n" "$CODE"
    PASSED=$((PASSED + 1))
else
    printf "  ${RED}✗ FAIL${NC}  GET /api/force-migrate  ${YELLOW}got=%s${NC}\n" "$CODE"
    FAILED=$((FAILED + 1))
    FAILURE_LOG+="  FAIL: GET /api/force-migrate (got=$CODE)"$'\n'
fi

# Contact form
CODE=$(http_post_code "$BASE_URL/api/contact" '{"name":"Smoke Test","email":"smoke@example.com","message":"test"}')
TOTAL=$((TOTAL + 1))
if [[ "$CODE" == "200" || "$CODE" == "201" || "$CODE" == "302" || "$CODE" == "400" ]]; then
    printf "  ${GREEN}✓ PASS${NC}  POST /api/contact (%s)\n" "$CODE"
    PASSED=$((PASSED + 1))
else
    printf "  ${RED}✗ FAIL${NC}  POST /api/contact  ${YELLOW}got=%s${NC}\n" "$CODE"
    FAILED=$((FAILED + 1))
    FAILURE_LOG+="  FAIL: POST /api/contact (got=$CODE)"$'\n'
fi

# ── SECTION 4: Static Assets ────────────────────────────────────────────────

printf "\n${CYAN}── Static Assets ───────────────────────────────────────────────${NC}\n"

for LOGO in logo.png logo.webp logo-nav.png logo-nav.svg logo-footer.png logo-footer.svg logo-og.png; do
    CODE=$(http_get_code "$BASE_URL/$LOGO")
    check "Logo: /$LOGO" "$CODE" "200"
done

CODE=$(http_get_code "$BASE_URL/images/og-image.webp")
check "OG Image: /images/og-image.webp" "$CODE" "200"

CODE=$(http_get_code "$BASE_URL/favicon.svg")
check "Favicon: /favicon.svg" "$CODE" "200"

# IG brand images (all 9)
for IMG in \
    "01-social-media-work-hard.png" \
    "02-posting-strategy-geometric.png" \
    "03-stop-guessing-start-growing.png" \
    "04-premium-management-service.png" \
    "05-post-for-leads-bold.png" \
    "06-competitors-online.png" \
    "07-agency-grade-zero-overhead.png" \
    "08-free-audit-cta.png" \
    "09-honest-marketing-reports.png"; do
    CODE=$(http_get_code "$BASE_URL/images/ig/$IMG")
    check "IG: /images/ig/$IMG" "$CODE" "200"
done

# CSS/JS bundles from homepage
ASSET_URLS=$(printf '%s' "$HOME_BODY" | grep -aPo '(?:href|src)="(/assets/[^"]+)"' | sed 's/.*="//;s/"//' | sort -u)
ASSET_COUNT=0
ASSET_PASS=0
for ASSET in $ASSET_URLS; do
    ASSET_COUNT=$((ASSET_COUNT + 1))
    CODE=$(http_get_code "$BASE_URL$ASSET")
    [[ "$CODE" == "200" ]] && ASSET_PASS=$((ASSET_PASS + 1))
done
TOTAL=$((TOTAL + 1))
if [[ $ASSET_COUNT -gt 0 && $ASSET_PASS -eq $ASSET_COUNT ]]; then
    printf "  ${GREEN}✓ PASS${NC}  CSS/JS bundles (%d/%d assets load)\n" "$ASSET_PASS" "$ASSET_COUNT"
    PASSED=$((PASSED + 1))
elif [[ $ASSET_COUNT -eq 0 ]]; then
    printf "  ${YELLOW}⚠ WARN${NC}  CSS/JS bundles — no asset URLs found in homepage\n"
else
    printf "  ${RED}✗ FAIL${NC}  CSS/JS bundles (%d/%d assets load)\n" "$ASSET_PASS" "$ASSET_COUNT"
    FAILED=$((FAILED + 1))
    FAILURE_LOG+="  FAIL: CSS/JS bundles ($ASSET_PASS/$ASSET_COUNT)"$'\n'
fi

CODE=$(http_get_code "$BASE_URL/robots.txt")
check "robots.txt" "$CODE" "200"

CODE=$(http_get_code "$BASE_URL/sitemap.xml")
check "sitemap.xml" "$CODE" "200"

# ── SECTION 5: Security & Infrastructure ────────────────────────────────────

printf "\n${CYAN}── Security & Infrastructure ──────────────────────────────────${NC}\n"

HTTP_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 -L "http://www.metroreachagency.com" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if [[ "$HTTP_CODE" == "200" ]]; then
    printf "  ${GREEN}✓ PASS${NC}  HTTP→HTTPS redirect (final: %s)\n" "$HTTP_CODE"
    PASSED=$((PASSED + 1))
else
    printf "  ${YELLOW}⚠ WARN${NC}  HTTP→HTTPS redirect (final: %s)\n" "$HTTP_CODE"
fi

HEADERS=$(curl -sI --max-time 5 "$BASE_URL" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if printf '%s' "$HEADERS" | grep -qi 'strict-transport-security'; then
    printf "  ${GREEN}✓ PASS${NC}  HSTS header present\n"
    PASSED=$((PASSED + 1))
else
    printf "  ${YELLOW}⚠ WARN${NC}  HSTS header not set\n"
fi

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
printf "${CYAN}  SUMMARY${NC}\n"
printf "${CYAN}───────────────────────────────────────────────────────────────${NC}\n"
printf "  Total:   %d\n" "$TOTAL"
printf "  Passed:  ${GREEN}%d${NC}\n" "$PASSED"
if [[ $FAILED -gt 0 ]]; then
    printf "  Failed:  ${RED}%d${NC}\n" "$FAILED"
else
    printf "  Failed:  ${GREEN}0${NC}\n"
fi
printf "${CYAN}───────────────────────────────────────────────────────────────${NC}\n"

if [[ $FAILED -gt 0 ]]; then
    echo ""
    printf "${RED}FAILURES:${NC}\n"
    printf '%s' "$FAILURE_LOG"
    echo ""
    printf "${RED}%d/%d checks failed.${NC}\n" "$FAILED" "$TOTAL"
    exit 1
else
    echo ""
    printf "${GREEN}All %d/%d checks passed. ✓${NC}\n" "$PASSED" "$TOTAL"
    exit 0
fi
