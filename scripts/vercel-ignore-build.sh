#!/usr/bin/env bash
# Vercel Ignored Build Step (vercel.json "ignoreCommand").
# Vercel semantika: exit 1 = build notiek, exit 0 = build tiek izlaists.
#
# Kārtība (19.11.2026, Vercel izmaksas):
#   - būvē TIKAI zars "main" (production) un zari "pakete/*" (paketes preview);
#   - visi citi zari (aģentu feat/fix/chore/docs, backup/* u.c.) - izlaists.
#   PR pārbaudi (vitest + next build) dara GitHub Actions (.github/workflows/ci.yml).
#   - main: ja mainīti tikai docs/ vai *.md faili - arī izlaists (taupība).

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

REF="${VERCEL_GIT_COMMIT_REF:-}"

# Bez git zara (piem. manuāls CLI deploy) - būvē, lai neko nebloķētu.
if [ -z "$REF" ]; then
  echo "nav VERCEL_GIT_COMMIT_REF (ne-git deploy) - build notiek"
  exit 1
fi

case "$REF" in
  main)
    if only_docs_changed; then
      echo "main: mainīti tikai docs/*.md - build izlaists (taupība)"
      exit 0
    fi
    echo "main: build notiek"
    exit 1
    ;;
  pakete/*)
    echo "paketes zars '$REF': preview build notiek"
    exit 1
    ;;
  *)
    echo "zars '$REF': build izlaists (būvē tikai main un pakete/*)"
    exit 0
    ;;
esac
