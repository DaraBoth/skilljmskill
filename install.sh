#!/usr/bin/env sh
# SkillJM Skill installer for Mac and Linux.
#
#   curl -fsSL https://daraboth.github.io/skilljmskill/install.sh | sh
#       asks you: which skills (shows the list with a recommendation) and where (you or this project)
#
#   curl -fsSL https://daraboth.github.io/skilljmskill/install.sh | sh -s -- [options] [skill ...]
#       --list         show every skill with a short description, install nothing
#       --all          every skill
#       --recommended  the recommended skills for the current folder
#       --user         install for you, in every project:  ~/.claude/skills  (default)
#       --project      install for this project only:      ./.claude/skills
#       --yes          do not ask anything (use with the options above)
#
# A skill folder that already exists is moved to skills/.skilljmskill-backup/<time>/ first,
# so running it again updates the skills and never loses your own edits.
set -eu

REPO="DaraBoth/skilljmskill"
BRANCH="main"
STARTER="debugging ai-usage prompt-templates cmd devops system-design learning"

MODE="" SCOPE="" YES=0 LIST=0 NAMES=""
for a in "$@"; do
  case "$a" in
    --list) LIST=1 ;;
    --all) MODE=all ;;
    --recommended) MODE=rec ;;
    --user) SCOPE=user ;;
    --project) SCOPE=project ;;
    --yes|-y) YES=1 ;;
    -*) echo "Unknown option $a"; exit 1 ;;
    *) NAMES="$NAMES $a" ;;
  esac
done

# Questions are read from the keyboard even when this script itself arrives through a pipe.
ASK=0
if [ "$YES" = 0 ] && [ -z "$NAMES" ] && [ -z "$MODE" ] && [ "$LIST" = 0 ] && (exec </dev/tty) 2>/dev/null; then ASK=1; fi
ask() { printf '%s' "$1" >/dev/tty; read -r REPLY </dev/tty || REPLY=""; }

command -v curl >/dev/null 2>&1 || { echo "curl is needed"; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "tar is needed"; exit 1; }
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM
echo "Downloading $REPO ..."
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" | tar -xz -C "$TMP"
SRC=$(find "$TMP" -mindepth 2 -maxdepth 2 -type d -name skills | head -n 1)
[ -n "$SRC" ] || { echo "Download looks wrong: no skills folder"; exit 1; }
ALL=$(for d in "$SRC"/*/; do basename "$d"; done)

desc() {  # first sentence of the description in SKILL.md, at most 80 characters
  awk '/^description:/{sub(/^description:[ ]*/,""); gsub(/"/,""); print; exit}' "$SRC/$1/SKILL.md" |
    sed 's/\([.!?]\) .*/\1/' | cut -c1-80
}

# Recommend from what is in the current folder, plus a starter set everyone can use.
recommend() {
  R="$STARTER"
  if [ -f package.json ]; then
    R="$R javascript frontend-design ui-design-principles"
    grep -q '"three"' package.json 2>/dev/null && R="$R 3d-web-experience threejs-fundamentals threejs-performance"
    grep -q '"@react-three/fiber"' package.json 2>/dev/null && R="$R threejs-react-three-fiber"
  fi
  if [ -f pom.xml ] || [ -f build.gradle ] || [ -f build.gradle.kts ]; then R="$R java"; fi
  if [ -d .git ]; then R="$R project-system-map code-explainer-page"; fi
  for n in $R; do [ -d "$SRC/$n" ] && echo "$n"; done | awk '!seen[$0]++'
}
REC=$(recommend)
is_rec() { echo "$REC" | grep -qx "$1"; }

show_list() {
  i=0
  for n in $ALL; do
    i=$((i + 1))
    if is_rec "$n"; then mark="*"; else mark=" "; fi
    printf '%3d %s %-26s %s\n' "$i" "$mark" "$n" "$(desc "$n")"
  done
  echo ""
  echo "  * = recommended for you, from what is in $(pwd)"
}

if [ "$LIST" = 1 ]; then show_list; exit 0; fi

# Which skills
if [ -n "$NAMES" ]; then WANT="$NAMES"
elif [ "$MODE" = all ]; then WANT="$ALL"
elif [ "$MODE" = rec ]; then WANT="$REC"
elif [ "$ASK" = 1 ]; then
  echo ""
  show_list
  echo ""
  echo "Which skills?  Enter = recommended (*)   a = all   or numbers, for example: 1 4 7"
  echo "ជ្រើស skill:  Enter = ដែលណែនាំ (*)   a = ទាំងអស់   ឬលេខ ដូចជា 1 4 7"
  ask "> "
  case "$REPLY" in
    "") WANT="$REC" ;;
    a|A|all) WANT="$ALL" ;;
    *) WANT=""
       for k in $(echo "$REPLY" | tr ',' ' '); do
         case "$k" in *[!0-9]*) n="" ;; *) n=$(echo "$ALL" | sed -n "${k}p") ;; esac
         if [ -n "$n" ]; then WANT="$WANT $n"; else echo "  skip  $k (not a number in the list)"; fi
       done ;;
  esac
else WANT="$REC"
fi
[ -n "$(echo "$WANT" | tr -d ' \n')" ] || { echo "Nothing picked, nothing installed."; exit 0; }

# Where
if [ -z "$SCOPE" ] && [ "$ASK" = 1 ]; then
  echo ""
  echo "Install where?  ដំឡើងទៅណា?"
  echo "  1  For me, in every project   ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills   (Enter)"
  echo "  2  Only this project          $(pwd)/.claude/skills"
  ask "> "
  if [ "$REPLY" = 2 ]; then SCOPE=project; else SCOPE=user; fi
fi
if [ "$SCOPE" = project ]; then DEST="$(pwd)/.claude/skills"; else DEST="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"; fi

mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)
N=0
for name in $WANT; do
  if [ ! -d "$SRC/$name" ]; then echo "  skip  $name (no such skill, run with --list)"; continue; fi
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
if [ -d "$DEST/.skilljmskill-backup/$STAMP" ]; then echo "Older copies were moved to $DEST/.skilljmskill-backup/$STAMP"; fi
if [ "$SCOPE" = project ]; then echo "Commit .claude/skills to share them with your team."; fi
echo "Restart Claude Code, then type / to see them."
echo "បិទ Claude Code ហើយបើកវាឡើងវិញ រួចវាយ / ដើម្បីមើល skill ។"
