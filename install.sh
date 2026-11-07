#!/usr/bin/env sh
# SkillJM Skill installer for Mac and Linux.
#
#   curl -fsSL https://daraboth.github.io/skilljmskill/install.sh | sh
#
# This only downloads the pack to a temporary folder and opens the chooser. You pick the skills,
# your AI tool and where; nothing is installed until you confirm. Options pass through, see --help
# Options are passed through:  ... | sh -s -- --list
set -eu

REPO="DaraBoth/skilljmskill"
command -v curl >/dev/null 2>&1 || { echo "curl is needed"; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "tar is needed"; exit 1; }
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/main" | tar -xz -C "$TMP"
PKG=$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -n 1)

if command -v node >/dev/null 2>&1; then
  if (exec </dev/tty) 2>/dev/null; then node "$PKG/bin/skilljmskill.mjs" "$@" </dev/tty
  else node "$PKG/bin/skilljmskill.mjs" "$@"; fi
  exit $?
fi

echo "The chooser needs Node.js 18 or newer (https://nodejs.org). Nothing was installed."
echo "Skills in this pack:"
for d in "$PKG"/skills/*/; do echo "  $(basename "$d")"; done
echo ""
echo "To add one by hand, copy its folder from https://github.com/$REPO/tree/main/skills into your"
echo "AI tool's skills folder, for example ~/.claude/skills (Claude Code) or ~/.agents/skills (Codex)."
