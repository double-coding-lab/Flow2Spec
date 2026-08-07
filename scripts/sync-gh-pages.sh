#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'EOF'
Flow2Spec website deployment is managed by GitHub Actions.

Merge website or docs changes into main to trigger:
  .github/workflows/deploy-pages.yml

For a local production build, run:
  npm --prefix website ci
  npm --prefix website run build

This legacy script no longer writes or pushes the gh-pages branch.
EOF

exit 1
