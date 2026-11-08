#!/usr/bin/env bash
# computer-control for macOS: one command per call, JSON out. Uses only built-in tools (osascript, pmset, networksetup,
# screencapture, pbcopy). The first time, macOS asks to allow the terminal under Privacy & Security → Accessibility
# (for clicks and keys) and Screen Recording (for screenshots).
#   bash computer.sh <action> [name=value ...]
#   bash computer.sh volume_set level=30
#   bash computer.sh help
# Actions that are hard to undo (shutdown, restart, sign_out, quit_app, stop_program, empty_trash) need confirm=yes,
# which an AI adds only after the person said yes.
set -u
action="${1:-help}"; shift || true
ARGS=("$@")
# Value of name=value from the arguments (macOS ships bash 3.2, which has no associative arrays).
arg() { local pair; for pair in "${ARGS[@]:-}"; do case "$pair" in "$1="*) printf '%s' "${pair#*=}"; return;; esac; done; printf '%s' "${2:-}"; }

json() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1" 2>/dev/null || printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"; }
# Answers go to fd 3 (the real output) so a failure inside $(...) or a >/dev/null still reaches the caller, and a failure
# anywhere stops the whole script, not just the subshell it happened in.
exec 3>&1; MAIN=$$; trap 'exit 1' TERM
ok() { printf '{"ok":true,"action":"%s","result":%s}\n' "$action" "$1" >&3; exit 0; }
fail() { printf '{"ok":false,"action":"%s","error":%s}\n' "$action" "$(json "$1")" >&3; kill -s TERM "$MAIN" 2>/dev/null; exit 1; }
need() { local v; v="$(arg "$1")"; [ -n "$v" ] || fail "$action needs $1=..."; printf '%s' "$v"; }
num() { local v; v="$(arg "$1" "$2")"; v="${v%%.*}"; [[ "$v" =~ ^-?[0-9]+$ ]] || v="$2"; (( v < $3 )) && v=$3; (( v > $4 )) && v=$4; printf '%s' "$v"; }
yes() { [[ "$(arg "$1")" =~ ^(true|on|yes|1)$ ]]; }
confirm() { [[ "$(arg confirm)" =~ ^(yes|true|1)$ ]] || fail "$action is hard to undo. Ask the person first; after they say yes, run it again with confirm=yes."; }
osa() { local out; out="$(osascript -e "$1" 2>&1)" || fail "macOS refused: $(printf "%s" "$out" | tail -1)"; printf "%s" "$out"; }
# AppleScript string literal
as() { local s="${1//\\/\\\\}"; s="${s//\"/\\\"}"; printf '"%s"' "$s"; }
volume() { local s; s="$(osascript -e 'get volume settings')"; printf '{"level":%s,"muted":%s}' "$(sed -E 's/.*output volume:([0-9]+).*/\1/' <<<"$s")" "$(grep -q 'output muted:true' <<<"$s" && echo true || echo false)"; }
mouse() { # x y "type,button;type,button" clicks
  osascript -l JavaScript -e "ObjC.import('CoreGraphics'); const pt = \$.CGPointMake($1, $2);
    for (const pair of '$3'.split(';')) { const [t, b] = pair.split(',').map(Number); const e = \$.CGEventCreateMouseEvent(null, t, pt, b); \$.CGEventSetIntegerValueField(e, 1, ${4:-1}); \$.CGEventPost(0, e); delay(0.03); }" >/dev/null || fail 'Allow the terminal in System Settings → Privacy & Security → Accessibility.'
}
app_path() { # best match for an app name in the usual folders
  local want; want="$(tr 'A-Z' 'a-z' <<<"$1")"
  local list; list="$(ls -d /Applications/*.app /System/Applications/*.app /System/Applications/Utilities/*.app "$HOME"/Applications/*.app 2>/dev/null)"
  local hit; hit="$(grep -i "/$want\.app$" <<<"$list" | head -1)"
  [ -n "$hit" ] || hit="$(grep -i "/$want[^/]*\.app$" <<<"$list" | head -1)"
  [ -n "$hit" ] || hit="$(grep -i "/[^/]*$want[^/]*\.app$" <<<"$list" | head -1)"
  printf '%s' "$hit"
}
settings_pane() {
  case "$1" in
    display) echo com.apple.Displays-Settings.extension;; sound) echo com.apple.Sound-Settings.extension;; bluetooth) echo com.apple.BluetoothSettings;;
    wifi) echo com.apple.wifi-settings-extension;; network) echo com.apple.Network-Settings.extension;; battery|power) echo com.apple.Battery-Settings.extension;;
    wallpaper) echo com.apple.Wallpaper-Settings.extension;; appearance) echo com.apple.Appearance-Settings.extension;; notifications) echo com.apple.Notifications-Settings.extension;;
    focus) echo com.apple.Focus-Settings.extension;; camera) echo 'com.apple.preference.security?Privacy_Camera';; microphone) echo 'com.apple.preference.security?Privacy_Microphone';;
    location) echo 'com.apple.preference.security?Privacy_LocationServices';; privacy) echo com.apple.settings.PrivacySecurity.extension;; updates) echo com.apple.Software-Update-Settings.extension;;
    storage|apps) echo com.apple.settings.Storage;; about) echo com.apple.SystemProfiler.AboutExtension;; accounts) echo com.apple.Users-Groups-Settings.extension;;
    date_time) echo com.apple.Date-Time-Settings.extension;; language) echo com.apple.Localization-Settings.extension;; keyboard) echo com.apple.Keyboard-Settings.extension;;
    mouse) echo com.apple.Trackpad-Settings.extension;; printers) echo com.apple.Print-Scan-Settings.extension;; accessibility) echo com.apple.Accessibility-Settings.extension;;
    startup_apps) echo com.apple.LoginItems-Settings.extension;; *) echo '';;
  esac
}
key_code() { case "$1" in enter|return) echo 36;; tab) echo 48;; space) echo 49;; backspace) echo 51;; delete|del) echo 117;; escape|esc) echo 53;; left) echo 123;; right) echo 124;; down) echo 125;; up) echo 126;;
  home) echo 115;; end) echo 119;; pageup) echo 116;; pagedown) echo 121;; f1) echo 122;; f2) echo 120;; f3) echo 99;; f4) echo 118;; f5) echo 96;; f6) echo 97;; f7) echo 98;; f8) echo 100;; f9) echo 101;; f10) echo 109;; f11) echo 103;; f12) echo 111;; *) echo '';; esac; }
press() { # ctrl+shift+t style
  local mods=() main=""
  IFS='+' read -ra keys <<<"$(tr 'A-Z' 'a-z' <<<"${1// /}")"
  for k in "${keys[@]}"; do case "$k" in ctrl|control) mods+=("control down");; shift) mods+=("shift down");; alt|option) mods+=("option down");; cmd|command|meta|win) mods+=("command down");; *) main="$k";; esac; done
  [ -n "$main" ] || fail 'Name one main key, for example cmd+c or enter.'
  local using=""; [ ${#mods[@]} -gt 0 ] && using=" using {$(IFS=,; echo "${mods[*]}" | sed 's/,/, /g')}"
  local code; code="$(key_code "$main")"
  if [ -n "$code" ]; then osa "tell application \"System Events\" to key code $code$using" >/dev/null
  elif [ ${#main} -eq 1 ]; then osa "tell application \"System Events\" to keystroke $(as "$main")$using" >/dev/null
  else fail "Unknown key '$main'."; fi
}
front() { # bring an app to the front when window= is given; print the front app
  if [ -n "$(arg window)" ]; then local a; a="$(app_path "$(arg window)")"; [ -n "$a" ] || fail "No app called $(arg window)."; osa "tell application $(as "$(basename "$a" .app)") to activate" >/dev/null; sleep 0.3; fi
  osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'
}

case "$action" in
  help) ok "$(json 'open_app name | quit_app name confirm=yes | list_apps | list_windows | focus_window name | show_desktop | open_url url | web_search query | open_folder path | open_settings [page] | volume_status | volume_set level | volume_up [step] | volume_down [step] | mute | unmute | mic_mute | mic_unmute | media key=play_pause|next|previous | speak text | brightness level | dark_mode on | screen_off | screenshot [path] | screen_items [window] | click_item name [window] | click x y [button] [count] | move_mouse x y | scroll direction [amount] | drag from_x from_y to_x to_y | type_text text [window] | press_keys keys [window] | clipboard_read | clipboard_write text | wifi on | bluetooth on (needs blueutil) | camera/microphone_access (opens privacy settings) | battery | power_mode mode | lock | sleep | schedule_wake hours minutes (admin) | sleep_and_wake hours minutes (admin) | shutdown confirm=yes | restart confirm=yes | sign_out confirm=yes | system_info | top_processes [limit] | stop_program name confirm=yes | notify message [title] | empty_trash confirm=yes')";;

  open_app) a="$(app_path "$(need name)")"; [ -n "$a" ] || fail "No app called $(arg name) is installed."; open -a "$a" || fail "Could not open $a"; ok "{\"opened\":$(json "$(basename "$a" .app)")}";;
  quit_app) confirm; a="$(app_path "$(need name)")"; [ -n "$a" ] || fail "No app called $(arg name)."; osa "tell application $(as "$(basename "$a" .app)") to quit" >/dev/null; ok "{\"closed\":$(json "$(basename "$a" .app)")}";;
  list_apps) ok "$(json "$(ls -d /Applications/*.app /System/Applications/*.app "$HOME"/Applications/*.app 2>/dev/null | xargs -I{} basename {} .app | paste -sd ',' -)")";;
  list_windows) ok "$(json "$(osa 'tell application "System Events" to get name of every process whose background only is false')")";;
  focus_window) ARGS+=("window=$(need name)"); ok "{\"focused\":$(json "$(front)")}";;
  show_desktop) osa 'tell application "System Events" to set visible of every process whose visible is true and frontmost is false to false' >/dev/null; ok '{"done":true}';;
  open_url) u="$(need url)"; [[ "$u" =~ ^[a-zA-Z][a-zA-Z0-9+.-]*: ]] || u="https://$u"; [[ "$u" =~ ^https?:// ]] || fail 'Only web addresses (http or https) open this way.'; open "$u"; ok "{\"opened\":$(json "$u")}";;
  web_search) q="$(need query)"; open "https://www.google.com/search?q=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$q")"; ok "{\"searched\":$(json "$q")}";;
  open_folder) f="$(need path)"; case "$(tr 'A-Z' 'a-z' <<<"$f")" in home) f="$HOME";; desktop) f="$HOME/Desktop";; documents) f="$HOME/Documents";; downloads) f="$HOME/Downloads";; pictures) f="$HOME/Pictures";; music) f="$HOME/Music";; videos|movies) f="$HOME/Movies";; esac
    f="${f/#\~/$HOME}"; [ -e "$f" ] || fail "$f does not exist."; open "$f"; ok "{\"opened\":$(json "$f")}";;
  open_settings) pane="$(settings_pane "$(arg page home)")"; if [ -n "$pane" ]; then open "x-apple.systempreferences:$pane"; else open -b com.apple.systempreferences; fi; ok "{\"opened\":$(json "$(arg page home)")}";;

  volume_status) ok "$(volume)";;
  volume_set) osa "set volume output volume $(num level 50 0 100) without output muted" >/dev/null; ok "$(volume)";;
  volume_up|volume_down) now="$(osascript -e 'output volume of (get volume settings)')"; step="$(num step 10 1 100)"; [ "$action" = volume_up ] && n=$((now + step)) || n=$((now - step)); ((n<0)) && n=0; ((n>100)) && n=100
    osa "set volume output volume $n" >/dev/null; ok "$(volume)";;
  mute) osa 'set volume with output muted' >/dev/null; ok "$(volume)";;
  unmute) osa 'set volume without output muted' >/dev/null; ok "$(volume)";;
  mic_mute) osa 'set volume input volume 0' >/dev/null; ok '{"microphone":"muted (input volume 0)"}';;
  mic_unmute) osa 'set volume input volume 75' >/dev/null; ok '{"microphone":"on (input volume 75)"}';;
  media) case "$(need key)" in play_pause) v=playpause;; next) v='next track';; previous) v='previous track';; stop) v=pause;; *) fail 'key must be play_pause, next, previous or stop.';; esac
    player=Music; pgrep -x Spotify >/dev/null && player=Spotify; osa "tell application \"$player\" to $v" >/dev/null; ok "{\"player\":\"$player\"}";;
  speak) say "$(need text)"; ok '{"spoke":true}';;

  brightness) steps=$(( ($(num level 50 0 100) * 16 + 50) / 100 )); osa "tell application \"System Events\"
repeat 16 times
key code 145
end repeat
repeat $steps times
key code 144
end repeat
end tell" >/dev/null; ok "{\"level\":$((steps * 100 / 16))}";;
  dark_mode) yes on && d=true || d=false; osa "tell application \"System Events\" to tell appearance preferences to set dark mode to $d" >/dev/null; ok "{\"dark\":$d}";;
  screen_off) pmset displaysleepnow; ok '{"screenOff":true}';;
  screenshot) f="$(arg path "${TMPDIR:-/tmp}/screen-$(date +%Y%m%d-%H%M%S).png")"; screencapture -x "$f" || fail 'Allow Screen Recording for the terminal in Privacy & Security.'
    sips -Z "$(num max_width 1568 200 8000)" "$f" >/dev/null 2>&1
    pw="$(sips -g pixelWidth "$f" | awk '/pixelWidth/{print $2}')"; sw="$(osascript -l JavaScript -e 'ObjC.import("AppKit"); $.NSScreen.mainScreen.frame.size.width')"
    ok "{\"path\":$(json "$f"),\"width\":$pw,\"scale\":$(python3 -c "print(round($pw/$sw,4))" 2>/dev/null || echo 1),\"note\":\"screen point = picture pixel / scale\"}";;

  screen_items) app="$(front)"; ok "{\"app\":$(json "$app"),\"items\":$(json "$(osascript -e "tell application \"System Events\" to tell process $(as "$app") to get {name, role description, position, size} of every UI element of entire contents of front window" 2>&1 | head -c 20000)")}";;
  click_item) app="$(front)"; name="$(need name)"
    r="$(osascript -e "tell application \"System Events\" to tell process $(as "$app")
      repeat with e in (entire contents of front window)
        try
          if (name of e as text) contains $(as "$name") then
            click e
            return name of e as text
          end if
        end try
      end repeat
      return \"\"
    end tell" 2>&1)"; [ -n "$r" ] || fail "Nothing called '$name' in $app."; ok "{\"pressed\":$(json "$r"),\"app\":$(json "$app")}";;
  click) b="$(arg button left)"; case "$b" in right) ev='3,1;4,1';; middle) ev='25,2;26,2';; *) ev='1,0;2,0';; esac; c="$(num count 1 1 3)"
    for i in $(seq 1 "$c"); do mouse "$(num x 0 -100000 100000)" "$(num y 0 -100000 100000)" "$ev" "$i"; done; ok "{\"clicked\":[$(arg x 0),$(arg y 0)]}";;
  move_mouse) mouse "$(num x 0 -100000 100000)" "$(num y 0 -100000 100000)" '5,0'; ok '{"moved":true}';;
  scroll) d="$(need direction)"; case "$d" in up) k=pageup;; down) k=pagedown;; left) k=left;; right) k=right;; *) fail 'direction must be up, down, left or right.';; esac
    for i in $(seq 1 $(( ($(num amount 5 1 50) + 4) / 5 ))); do press "$k"; done; ok "{\"scrolled\":\"$d\"}";;
  drag) mouse "$(num from_x 0 -100000 100000)" "$(num from_y 0 -100000 100000)" '1,0'; mouse "$(num to_x 0 -100000 100000)" "$(num to_y 0 -100000 100000)" '6,0;2,0'; ok '{"dragged":true}';;
  # System Events cannot type Khmer or Korean, so text goes through the clipboard and a paste.
  type_text) t="$(need text)"; into="$(front)"; printf '%s' "$t" | pbcopy; osa 'tell application "System Events" to keystroke "v" using {command down}' >/dev/null; ok "{\"typed\":${#t},\"into\":$(json "$into")}";;
  press_keys) k="$(need keys)"; into="$(front)"; press "$k"; ok "{\"pressed\":$(json "$k"),\"into\":$(json "$into")}";;
  clipboard_read) ok "{\"text\":$(json "$(pbpaste)")}";;
  clipboard_write) printf '%s' "$(need text)" | pbcopy; ok '{"copied":true}';;

  wifi) dev="$(networksetup -listallhardwareports | awk '/Wi-Fi|AirPort/{getline; print $2; exit}')"; yes on && s=on || s=off; networksetup -setairportpower "${dev:-en0}" "$s" || fail 'macOS refused.'; ok "{\"wifi\":\"$s\"}";;
  bluetooth) yes on && s=1 || s=0; if command -v blueutil >/dev/null; then blueutil --power "$s"; ok "{\"bluetooth\":$s}"; else open "x-apple.systempreferences:com.apple.BluetoothSettings"; ok '{"opened":"Bluetooth settings","note":"brew install blueutil to switch Bluetooth directly"}'; fi;;
  camera) open 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera'; ok '{"opened":"Camera privacy settings","note":"macOS has no camera switch; choose apps here."}';;
  microphone_access) open 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'; ok '{"opened":"Microphone privacy settings"}';;

  battery) b="$(pmset -g batt)"; ok "{\"percent\":$(grep -Eo '[0-9]+%' <<<"$b" | head -1 | tr -d %),\"pluggedIn\":$(grep -q 'AC Power' <<<"$b" && echo true || echo false),\"detail\":$(json "$(tail -1 <<<"$b")")}";;
  power_mode) m="$(need mode)"; [ "$m" = efficiency ] && v=1 || v=0; osa "do shell script \"pmset -a lowpowermode $v\" with administrator privileges" >/dev/null; ok "{\"lowPowerMode\":$v}";;
  lock) printf '{"ok":true,"action":"lock","result":{"locking":true}}\n'; sleep 0.8; osascript -e 'tell application "System Events" to keystroke "q" using {control down, command down}'; exit 0;;
  sleep) printf '{"ok":true,"action":"sleep","result":{"sleeping":true}}\n'; sleep 0.8; pmset sleepnow >/dev/null; exit 0;;
  schedule_wake|sleep_and_wake) mins=$(( $(num hours 0 0 72) * 60 + $(num minutes 0 0 59) )); ((mins >= 1)) || fail 'Give hours= and/or minutes= for when to wake up.'
    at="$(date -v+"${mins}"M '+%m/%d/%y %H:%M:%S')"; osa "do shell script \"pmset schedule wake '$at'\" with administrator privileges" >/dev/null
    if [ "$action" = sleep_and_wake ]; then printf '{"ok":true,"action":"%s","result":{"wakeAt":"%s"}}\n' "$action" "$at"; sleep 0.8; pmset sleepnow >/dev/null; exit 0; fi; ok "{\"wakeAt\":\"$at\"}";;
  shutdown) confirm; printf '{"ok":true,"action":"shutdown","result":{"shuttingDown":true}}\n'; sleep 0.8; osascript -e 'tell application "System Events" to shut down'; exit 0;;
  restart) confirm; printf '{"ok":true,"action":"restart","result":{"restarting":true}}\n'; sleep 0.8; osascript -e 'tell application "System Events" to restart'; exit 0;;
  sign_out) confirm; printf '{"ok":true,"action":"sign_out","result":{"signingOut":true}}\n'; sleep 0.8; osascript -e 'tell application "System Events" to log out'; exit 0;;
  hibernate|cancel_shutdown) fail "$action is Windows only; macOS hibernates on its own and shuts down at once.";;

  system_info) ok "{\"cpu\":$(json "$(top -l 1 -n 0 | grep 'CPU usage')"),\"memory\":$(json "$(top -l 1 -n 0 | grep PhysMem)"),\"disk\":$(json "$(df -h / | tail -1)"),\"uptime\":$(json "$(uptime)"),\"macos\":$(json "$(sw_vers -productVersion)")}";;
  top_processes) ok "$(json "$(ps -Ao pid=,rss=,%cpu=,comm= -m | head -n "$(num limit 10 1 40)")")";;
  stop_program) confirm; n="$(need name)"; case "$(tr 'A-Z' 'a-z' <<<"$n")" in kernel_task|launchd|windowserver|loginwindow|finder|dock|systemuiserver) fail "$n keeps macOS running, so it is not stopped.";; esac; killall "$n" || fail "No program called $n."; ok "{\"stopped\":$(json "$n")}";;
  notify) osa "display notification $(as "$(need message)") with title $(as "$(arg title Computer)")" >/dev/null; ok '{"shown":true}';;
  empty_trash) confirm; osa 'tell application "Finder" to empty trash' >/dev/null; ok '{"emptied":true}';;
  *) fail "Unknown action '$action'. Run: computer.sh help";;
esac
