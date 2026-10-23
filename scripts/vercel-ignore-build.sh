#!/usr/bin/env bash
# Vercel Ignored Build Step (vercel.json "ignoreCommand").
# exit 0 = build tiek izlaists, exit 1 = build notiek.
# Mērķis: netērēt Build CPU minūtes uz aģentu/rezerves zaru preview buildiem.
# Production (main) builds VIENMĒR notiek.

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "production: build notiek"
  exit 1
fi

REF="${VERCEL_GIT_COMMIT_REF:-}"
case "$REF" in
  cursor/*|claude/*|agent/*|grok/*|codex/*|backup/*|docs/*)
    echo "preview zaram '$REF' build izlaists (taupība)"
    exit 0
    ;;
esac

echo "preview zaram '$REF' build notiek"
exit 1
