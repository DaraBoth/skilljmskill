#!/usr/bin/env bash
# Start a successor agent session in a new Orca terminal tab and hand it a handoff file.
#
# Usage:
#   launch-successor.sh --file <handoff.md> [--title <tab title>] [--cli claude|codex]
#                       [--flags "<extra cli flags>"] [--worktree <selector>]
#                       [--prompt <text>] [--launch "<full launch command>"] [--no-wait]
#
# Defaults: --cli claude, --worktree active, --title "Handoff <date>".
# --flags is appended to the cli, e.g. --flags "--agent api --model sonnet".
# --launch replaces the whole launch command (testing, or an unusual setup).
# The claude launch inherits CLAUDE_CONFIG_DIR from this shell, so the successor
# signs in with the same profile as the session that ran this script.
set -euo pipefail

# Git Bash rewrites arguments that start with "/" (a prompt such as "/loop ...")
# into Windows paths unless conversion is off.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

FILE="" TITLE="" CLI="claude" FLAGS="" WORKTREE="active" PROMPT="" LAUNCH="" WAIT=1
while [ $# -gt 0 ]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --cli) CLI="$2"; shift 2 ;;
    --flags) FLAGS="$2"; shift 2 ;;
    --worktree) WORKTREE="$2"; shift 2 ;;
    --prompt) PROMPT="$2"; shift 2 ;;
    --launch) LAUNCH="$2"; shift 2 ;;
    --no-wait) WAIT=0; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -n "$FILE" ] || { echo "--file is required" >&2; exit 2; }
FILE="${FILE//\\//}"
[ -f "$FILE" ] || { echo "handoff file not found: $FILE" >&2; exit 2; }
[ -n "$TITLE" ] || TITLE="Handoff $(date +%Y-%m-%d)"

# Resolve the Orca executable the same way the orca-cli skill does.
if [ -n "${ORCA_CLI_COMMAND:-}" ]; then ORCA="$ORCA_CLI_COMMAND"
elif [ -n "${ORCA_DEV_REPO_ROOT:-}" ]; then ORCA="orca-dev"
elif [ "$(uname -s)" = "Linux" ]; then ORCA="orca-ide"
else ORCA="orca"; fi
command -v "$ORCA" >/dev/null 2>&1 || { echo "Orca CLI '$ORCA' not found; start the successor by hand (see SKILL.md, No Orca)." >&2; exit 3; }

# python3 on Windows can be the Store stub, so probe it before trusting it.
if command -v python3 >/dev/null 2>&1 && python3 -c '' >/dev/null 2>&1; then PY=python3; else PY=python; fi
jget() {
  "$PY" -I -c 'import sys,json
d=json.load(sys.stdin)
for k in sys.argv[1].split("."):
    d=d[int(k)] if isinstance(d,list) else (d or {}).get(k)
print("" if d is None else (json.dumps(d) if isinstance(d,(dict,list)) else d))' "$1"
}
tail_lines() {
  "$ORCA" terminal read --terminal "$1" --json | "$PY" -I -c 'import sys,json
t=json.load(sys.stdin)["result"]["terminal"].get("tail") or []
print("\n".join(t[-int(sys.argv[1]):]))' "$2"
}

# Absolute, forward-slash path so any shell or agent can open it.
FILE_DIR="$(cd "$(dirname "$FILE")" && { pwd -W 2>/dev/null || pwd; })"
ABS_FILE="$FILE_DIR/$(basename "$FILE")"

if [ -z "$PROMPT" ]; then
  PROMPT="You are taking over from a previous session. Read the handoff file $ABS_FILE in full, then your memory index if you have one. Then tell the user in one or two lines that you have taken over and follow the file's 'First thing to do' section."
fi

SHELL_ARG=()
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) SHELL_ARG=(--shell git-bash) ;;
esac

if [ -z "$LAUNCH" ]; then
  case "$CLI" in
    claude)
      LAUNCH="claude"
      [ -n "${CLAUDE_CONFIG_DIR:-}" ] && LAUNCH="CLAUDE_CONFIG_DIR='${CLAUDE_CONFIG_DIR}' claude"
      ;;
    codex) LAUNCH="codex" ;;
    *) LAUNCH="$CLI" ;;
  esac
  [ -n "$FLAGS" ] && LAUNCH="$LAUNCH $FLAGS"
fi

echo "launch: $LAUNCH"
OUT="$("$ORCA" terminal create --worktree "$WORKTREE" --title "$TITLE" "${SHELL_ARG[@]}" --command "$LAUNCH" --json)"
HANDLE="$(printf '%s' "$OUT" | jget result.terminal.handle)"
[ -n "$HANDLE" ] || { echo "terminal create failed:"; echo "$OUT"; exit 4; }
echo "tab: $TITLE  handle: $HANDLE"

"$ORCA" terminal wait --terminal "$HANDLE" --for tui-idle --timeout-ms 120000 --json >/dev/null || true
SCREEN="$(tail_lines "$HANDLE" 40)"
if printf '%s' "$SCREEN" | grep -qiE 'not logged in|select login method|do you trust|trust this folder|command not found'; then
  echo "successor is not ready; prompt NOT sent. Screen:"; printf '%s\n' "$SCREEN"
  echo "fix it in tab '$TITLE', then: $ORCA terminal send --terminal $HANDLE --text \"<prompt>\" --enter"
  exit 5
fi

RECEIPT="$("$ORCA" terminal send --terminal "$HANDLE" --text "$PROMPT" --enter --wait-submit 30 --json)"
if printf '%s' "$RECEIPT" | grep -q 'turn_started'; then echo "prompt delivered: turn started"
elif printf '%s' "$RECEIPT" | grep -q '"accepted": *true'; then
  # A tab made by `terminal create` is a plain shell to Orca, so it cannot observe the
  # agent's turn. The successor screen printed below is the proof; never resend.
  echo "prompt accepted (turn start not observable in this tab; check the screen below, do not resend)"
else echo "send receipt unclear (do not resend blindly):"; echo "$RECEIPT"; exit 6; fi

if [ "$WAIT" = 1 ]; then
  "$ORCA" terminal wait --terminal "$HANDLE" --for tui-idle --timeout-ms 600000 --json >/dev/null || true
  echo "---- successor screen (last 25 lines) ----"
  tail_lines "$HANDLE" 25
fi
echo "handle: $HANDLE"
