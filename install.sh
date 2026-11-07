#!/usr/bin/env sh
# SkillJM Skill installer for Mac and Linux.
#
#   curl -fsSL https://daraboth.github.io/skilljmskill/install.sh | sh                 every skill
#   curl -fsSL https://daraboth.github.io/skilljmskill/install.sh | sh -s -- debugging devops
#   curl -fsSL https://daraboth.github.io/skilljmskill/install.sh | sh -s -- --list
#
# Installs into $CLAUDE_CONFIG_DIR/skills if that is set, otherwise ~/.claude/skills.
# A skill folder that already exists is moved to skills/.skilljmskill-backup/<time>/ first,
# so running it again updates the pack and never loses your own edits.
set -eu

REPO="DaraBoth/skilljmskill"
BRANCH="main"
DEST="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"

command -v curl >/dev/null 2>&1 || { echo "curl is needed"; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "tar is needed"; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM

echo "Downloading $REPO ..."
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" | tar -xz -C "$TMP"
SRC=$(find "$TMP" -mindepth 2 -maxdepth 2 -type d -name skills | head -n 1)
[ -n "$SRC" ] || { echo "Download looks wrong: no skills folder"; exit 1; }

if [ "${1:-}" = "--list" ]; then
  echo "Available skills:"
  for d in "$SRC"/*/; do echo "  $(basename "$d")"; done
  exit 0
fi

if [ "$#" -gt 0 ]; then
  WANT="$*"
else
  WANT=$(for d in "$SRC"/*/; do basename "$d"; done)
fi

mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)
N=0
for name in $WANT; do
  if [ ! -d "$SRC/$name" ]; then
    echo "  skip  $name (no such skill, run with --list)"
    continue
  fi
  if [ -e "$DEST/$name" ]; then
    mkdir -p "$DEST/.skilljmskill-backup/$STAMP"
    mv "$DEST/$name" "$DEST/.skilljmskill-backup/$STAMP/$name"
  fi
  cp -R "$SRC/$name" "$DEST/$name"
  echo "  ok    $name"
  N=$((N + 1))
done

echo ""
echo "Installed $N skill(s) into $DEST"
[ -d "$DEST/.skilljmskill-backup/$STAMP" ] && echo "Older copies were moved to $DEST/.skilljmskill-backup/$STAMP"
echo "Restart Claude Code, then type / to see them."
echo "បិទ Claude Code ហើយបើកវាឡើងវិញ រួចវាយ / ដើម្បីមើល skill ។"
