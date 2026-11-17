#!/usr/bin/env bash
# Vercel Ignored Build Step (vercel.json "ignoreCommand").
# exit 0 = build tiek izlaists, exit 1 = build notiek.
# Mērķis: netērēt Build CPU minūtes uz aģentu/rezerves zaru preview buildiem
# un uz production commitiem, kas maina tikai dokumentus.

# Atgriež 0, ja VISI mainītie faili ir docs/ vai *.md; citādi 1 (arī kļūdas gadījumā).
only_docs_changed() {
  local prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
  [ -n "$prev" ] || { echo "nav VERCEL_GIT_PREVIOUS_SHA"; return 1; }
  if ! git cat-file -e "${prev}^{commit}" 2>/dev/null; then
    git fetch -q --depth=200 origin "$prev" 2>/dev/null || true
  fi
  git cat-file -e "${prev}^{commit}" 2>/dev/null || { echo "iepriekšējais commits nav pieejams"; return 1; }
  local files
  files="$(git diff --name-only "$prev" HEAD 2>/dev/null)" || return 1
  [ -n "$files" ] || return 1
  while IFS= read -r f; do
    case "$f" in
      docs/*|*.md) ;;
      *) echo "koda fails mainīts: $f"; return 1 ;;
    esac
  done <<< "$files"
  return 0
}

if [ "${VERCEL_ENV:-}" = "production" ]; then
  if only_docs_changed; then
    echo "production: mainīti tikai docs/*.md - build izlaists (taupība)"
    exit 0
  fi
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
