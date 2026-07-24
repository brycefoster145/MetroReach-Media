#!/bin/bash
cd /home/team/shared/site
echo "=== GIT STATUS ===" > /tmp/git-result.txt
git status --short >> /tmp/git-result.txt 2>&1
echo "=== GIT ADD ===" >> /tmp/git-result.txt
git add -A >> /tmp/git-result.txt 2>&1
echo "=== GIT COMMIT ===" >> /tmp/git-result.txt
git commit -m "Security fixes: C5(PII-URL) C3(paywall) C4(email-auth) H2(SSRF) H4(XSS-email)" >> /tmp/git-result.txt 2>&1
echo "=== GIT PUSH ===" >> /tmp/git-result.txt
git push origin main >> /tmp/git-result.txt 2>&1
echo "=== DONE ===" >> /tmp/git-result.txt
