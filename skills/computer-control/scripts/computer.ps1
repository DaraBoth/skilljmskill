<#
  computer-control for Windows: one command per call, JSON out. Needs only Windows PowerShell 5.1 (built into Windows 10/11).
    powershell -NoProfile -ExecutionPolicy Bypass -File computer.ps1 <action> [name=value ...]
    computer.ps1 volume_set level=30
    computer.ps1 click_item name="Bluetooth & devices" window=Settings
    computer.ps1 help
  Actions that are hard to undo (shutdown, restart, sign_out, hibernate, quit_app, stop_program, empty_trash) refuse to run
  unless confirm=yes is passed, which an AI must only add after the person said yes.
#>
param([Parameter(Position = 0)][string]$Action = 'help', [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $utf8

# name=value pairs; a value can contain '=' and spaces when quoted by the caller.
$p = @{}
foreach ($pair in @($Rest)) { if ($pair -match '^([A-Za-z_]+)=(.*)$') { $p[$Matches[1].ToLower()] = $Matches[2] } }
function Need($name) { if (-not $p.ContainsKey($name) -or "$($p[$name])" -eq '') { throw "$Action needs $name=..." }; $p[$name] }
function Num($name, $default, $low, $high) { $v = if ($p.ContainsKey($name) -and "$($p[$name])" -ne '') { [double]$p[$name] } else { $default }; [int][math]::Min($high, [math]::Max($low, [math]::Round($v))) }
function Yes($name) { "$($p[$name])" -match '^(true|on|yes|1)$' }
function Out($value) { [Console]::Out.WriteLine((@{ ok = $true; action = $Action; result = $value } | ConvertTo-Json -Compress -Depth 6)) }
$confirmed = "$($p['confirm'])" -match '^(yes|true|1)$'
function NeedConfirm { if (-not $confirmed) { throw "$Action is hard to undo. Ask the person first; after they say yes, run it again with confirm=yes." } }

# Native helpers (Core Audio volume, SendInput mouse/keyboard), compiled once into %LOCALAPPDATA% and reused.
$helperVersion = 5
$helperDll = Join-Path $env:LOCALAPPDATA "computer-control\helpers-v$helperVersion.dll"
$helperSource = @'
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Threading;
namespace ComputerControl {
  [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioEndpointVolume { int f(); int g(); int h(); int i(); int SetMasterVolumeLevelScalar(float level, Guid context); int j(); int GetMasterVolumeLevelScalar(out float level); int k(); int l(); int m(); int n(); int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, Guid context); int GetMute(out bool mute); }
  [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice { int Activate(ref Guid id, int context, int parameters, out IAudioEndpointVolume volume); }
  [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice device); }
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator { }
  public static class Audio {   // flow 0 = speakers, 1 = microphone
    static IAudioEndpointVolume Endpoint(int flow) { var e = new MMDeviceEnumerator() as IMMDeviceEnumerator; IMMDevice d; Marshal.ThrowExceptionForHR(e.GetDefaultAudioEndpoint(flow, 1, out d)); IAudioEndpointVolume v; var id = typeof(IAudioEndpointVolume).GUID; Marshal.ThrowExceptionForHR(d.Activate(ref id, 23, 0, out v)); return v; }
    public static float GetVolume(int flow) { float l; Marshal.ThrowExceptionForHR(Endpoint(flow).GetMasterVolumeLevelScalar(out l)); return l; }
    public static void SetVolume(int flow, float l) { Marshal.ThrowExceptionForHR(Endpoint(flow).SetMasterVolumeLevelScalar(l, Guid.Empty)); }
    public static bool GetMute(int flow) { bool m; Marshal.ThrowExceptionForHR(Endpoint(flow).GetMute(out m)); return m; }
    public static void SetMute(int flow, bool m) { Marshal.ThrowExceptionForHR(Endpoint(flow).SetMute(m, Guid.Empty)); }
  }
  public static class Input {
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx, dy; public uint data, flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort vk, scan; public uint flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mouse; [FieldOffset(0)] public KEYBDINPUT key; }
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION u; }
    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr w);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr w, int c);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr w);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr w, uint m, IntPtr a, IntPtr b);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr w, IntPtr pid);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr w);
    static void Send(INPUT[] i) { if (SendInput((uint)i.Length, i, Marshal.SizeOf(typeof(INPUT))) != i.Length) throw new Exception("Windows blocked the input (a window running as administrator ignores input from normal apps)."); }
    static INPUT M(uint f, int d) { var i = new INPUT { type = 0 }; i.u.mouse.flags = f; i.u.mouse.data = unchecked((uint)d); return i; }
    static INPUT K(ushort vk, ushort scan, uint f) { var i = new INPUT { type = 1 }; i.u.key.vk = vk; i.u.key.scan = scan; i.u.key.flags = f; return i; }
    static bool Ext(ushort vk) { return (vk >= 0x21 && vk <= 0x2E) || vk == 0x5B || (vk >= 0xA6 && vk <= 0xB7); }
    public static void Click(int x, int y, string button, int count) { SetCursorPos(x, y); Thread.Sleep(30); uint d = 0x2, u = 0x4; if (button == "right") { d = 0x8; u = 0x10; } else if (button == "middle") { d = 0x20; u = 0x40; } for (int n = 0; n < count; n++) { Send(new[] { M(d, 0), M(u, 0) }); Thread.Sleep(70); } }
    public static void Scroll(int notches, bool horizontal) { Send(new[] { M(horizontal ? 0x1000u : 0x0800u, notches * 120) }); }
    public static void Drag(int x1, int y1, int x2, int y2) { SetCursorPos(x1, y1); Send(new[] { M(0x2, 0) }); for (int s = 1; s <= 20; s++) { SetCursorPos(x1 + (x2 - x1) * s / 20, y1 + (y2 - y1) * s / 20); Thread.Sleep(12); } Send(new[] { M(0x4, 0) }); }
    // Unicode key events type any language (Khmer, Korean, ...) whatever keyboard layout is active.
    public static void Type(string text) { var l = new List<INPUT>(); foreach (char c in text) { if (c == '\r') continue; if (c == '\n') { l.Add(K(0x0D, 0, 0)); l.Add(K(0x0D, 0, 2)); continue; } l.Add(K(0, c, 0x4)); l.Add(K(0, c, 0x6)); } if (l.Count > 0) Send(l.ToArray()); }
    public static void Chord(ushort[] keys) { var l = new List<INPUT>(); foreach (var k in keys) l.Add(K(k, 0, Ext(k) ? 1u : 0u)); for (int n = keys.Length - 1; n >= 0; n--) l.Add(K(keys[n], 0, (Ext(keys[n]) ? 1u : 0u) | 2u)); Send(l.ToArray()); }
    public static void MonitorOff() { PostMessage((IntPtr)0xFFFF, 0x0112, (IntPtr)0xF170, (IntPtr)2); }
    // Joins the front window's input queue for a moment so Windows allows the switch; no key is pressed (Alt would open menus).
    public static bool Focus(IntPtr w) { if (IsIconic(w)) ShowWindow(w, 9); uint front = GetWindowThreadProcessId(GetForegroundWindow(), IntPtr.Zero), me = GetCurrentThreadId(); bool joined = front != me && AttachThreadInput(me, front, true); try { BringWindowToTop(w); SetForegroundWindow(w); } finally { if (joined) AttachThreadInput(me, front, false); } Thread.Sleep(150); if (GetForegroundWindow() == w) return true; Chord(new ushort[] { 0x87 }); SetForegroundWindow(w); Thread.Sleep(150); return GetForegroundWindow() == w; }
    public static string ForegroundTitle() { var b = new System.Text.StringBuilder(512); GetWindowText(GetForegroundWindow(), b, 512); return b.ToString(); }
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr w, System.Text.StringBuilder b, int max);
  }
}
'@
if (-not ('ComputerControl.Input' -as [type])) {
  if (Test-Path $helperDll) { Add-Type -Path $helperDll }
  else {
    New-Item -ItemType Directory -Force -Path (Split-Path $helperDll) | Out-Null
    try { Add-Type -TypeDefinition $helperSource -OutputAssembly $helperDll; Add-Type -Path $helperDll } catch { Add-Type -TypeDefinition $helperSource }
  }
}
[void][ComputerControl.Input]::SetProcessDPIAware()   # physical pixels: a screenshot position is a click position

function Normalize([string]$s) { ($s.ToLower() -replace '[^\p{L}\p{N}]+', ' ').Trim() }
# Best fuzzy match of a spoken name: exact, starts with, contains, then every word present.
function BestMatch([string]$wanted, $items, [scriptblock]$label) {
  $target = Normalize $wanted; $best = $null; $bestScore = 0
  foreach ($item in $items) {
    $name = Normalize (& $label $item); if (-not $name) { continue }
    $score = if ($name -eq $target) { 100 } elseif ($name.StartsWith($target)) { 80 - $name.Length / 100 } elseif ($name.Contains($target)) { 60 - $name.Length / 100 } elseif (@($target.Split(' ') | Where-Object { -not $name.Contains($_) }).Count -eq 0) { 45 } else { 0 }
    if ($score -gt $bestScore) { $best = $item; $bestScore = $score }
  }
  $best
}
function OpenWindows { Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | ForEach-Object { [pscustomobject]@{ app = $_.ProcessName; title = $_.MainWindowTitle; processId = $_.Id; handle = [int64]$_.MainWindowHandle } } }
# One open window by app name or part of its title. When several match equally, it refuses to guess and lists them.
function FindWindow([string]$name) {
  $target = Normalize $name; $windows = @(OpenWindows)
  $scored = foreach ($w in $windows) { $label = Normalize "$($w.title) $($w.app)"; $title = Normalize $w.title
    $score = if ($title -eq $target) { 100 } elseif ($title.Contains($target)) { 70 } elseif ((Normalize $w.app) -eq $target) { 60 } elseif ($label.Contains($target)) { 50 } else { 0 }
    if ($score) { [pscustomobject]@{ window = $w; score = $score } } }
  $scored = @($scored | Sort-Object score -Descending)
  if (-not $scored.Count) { throw "No open window matches '$name'. Run list_windows." }
  $top = @($scored | Where-Object { $_.score -eq $scored[0].score })
  # Store apps such as Settings show one window twice (the frame and the app inside); the frame holds the buttons.
  if (@($top | ForEach-Object { $_.window.title } | Select-Object -Unique).Count -eq 1) { return (@($top | Where-Object { $_.window.app -eq 'ApplicationFrameHost' }) + $top)[0].window }
  if ($top.Count -gt 1) { throw "Several windows match '$name': $(($top | ForEach-Object { $_.window.title }) -join ' | '). Use more of the exact title." }
  $scored[0].window
}
# Brings the named window to the front and checks it really is in front, so keys and text never land somewhere else.
function FrontWindow([string]$name) {
  if (-not $name) { return [ComputerControl.Input]::ForegroundTitle() }
  $w = FindWindow $name
  if (-not [ComputerControl.Input]::Focus([IntPtr]$w.handle)) { Start-Sleep -Milliseconds 300; if ([ComputerControl.Input]::ForegroundTitle() -ne $w.title) { throw "Could not bring '$($w.title)' to the front, so nothing was sent to it." } }
  $w.title
}
function Sound($flow, $level, $mute) {
  if ($null -ne $level) { [ComputerControl.Audio]::SetVolume($flow, [float]($level / 100)) }
  if ($null -ne $mute) { [ComputerControl.Audio]::SetMute($flow, [bool]$mute) }
  @{ level = [int][math]::Round([ComputerControl.Audio]::GetVolume($flow) * 100); muted = [ComputerControl.Audio]::GetMute($flow) }
}
$winKeys = @{ enter = 0x0D; return = 0x0D; tab = 0x09; escape = 0x1B; esc = 0x1B; backspace = 0x08; delete = 0x2E; del = 0x2E; space = 0x20; up = 0x26; down = 0x28; left = 0x25; right = 0x27
  home = 0x24; end = 0x23; pageup = 0x21; pagedown = 0x22; insert = 0x2D; ctrl = 0x11; control = 0x11; shift = 0x10; alt = 0x12; win = 0x5B; windows = 0x5B; cmd = 0x5B; meta = 0x5B
  printscreen = 0x2C; capslock = 0x14; volumemute = 0xAD; volumedown = 0xAE; volumeup = 0xAF; next = 0xB0; previous = 0xB1; stop = 0xB2; playpause = 0xB3
  comma = 0xBC; period = 0xBE; minus = 0xBD; equal = 0xBB; plus = 0xBB; slash = 0xBF; semicolon = 0xBA; quote = 0xDE; backslash = 0xDC; backquote = 0xC0 }
function KeyCodes([string]$text) {
  $keys = @($text.ToLower() -replace '\s', '' -split '\+' | Where-Object { $_ })
  if ($keys.Count -lt 1 -or $keys.Count -gt 5) { throw 'Name one to five keys, for example ctrl+c or enter.' }
  [uint16[]]($keys | ForEach-Object {
    if ($winKeys.ContainsKey($_)) { $winKeys[$_] } elseif ($_ -match '^f([1-9]|1[0-2])$') { 0x6F + [int]$Matches[1] } elseif ($_ -match '^[a-z0-9]$') { [int][char]$_.ToUpper() } else { throw "Unknown key '$_'." }
  })
}
$settingsPages = @{ home = 'ms-settings:'; display = 'ms-settings:display'; sound = 'ms-settings:sound'; bluetooth = 'ms-settings:bluetooth'; wifi = 'ms-settings:network-wifi'; network = 'ms-settings:network'
  vpn = 'ms-settings:network-vpn'; battery = 'ms-settings:batterysaver'; power = 'ms-settings:powersleep'; wallpaper = 'ms-settings:personalization-background'; appearance = 'ms-settings:colors'
  night_light = 'ms-settings:nightlight'; notifications = 'ms-settings:notifications'; focus = 'ms-settings:quiethours'; camera = 'ms-settings:privacy-webcam'; microphone = 'ms-settings:privacy-microphone'
  location = 'ms-settings:privacy-location'; privacy = 'ms-settings:privacy'; updates = 'ms-settings:windowsupdate'; apps = 'ms-settings:appsfeatures'; default_apps = 'ms-settings:defaultapps'
  startup_apps = 'ms-settings:startupapps'; storage = 'ms-settings:storagesense'; about = 'ms-settings:about'; accounts = 'ms-settings:yourinfo'; sign_in = 'ms-settings:signinoptions'
  date_time = 'ms-settings:dateandtime'; language = 'ms-settings:regionlanguage'; keyboard = 'ms-settings:keyboard'; mouse = 'ms-settings:mousetouchpad'; printers = 'ms-settings:printers'
  accessibility = 'ms-settings:easeofaccess'; taskbar = 'ms-settings:taskbar' }
$protected = 'system','idle','csrss','wininit','winlogon','services','lsass','smss','svchost','dwm','fontdrvhost','registry','memcompression','explorer','powershell','pwsh'
function UrlOf([string]$text) { $t = $text.Trim(); if ($t -notmatch '^[a-z][a-z0-9+.-]*:') { $t = "https://$t" }; if ($t -notmatch '^https?://') { throw 'Only web addresses (http or https) open this way.' }; ([Uri]$t).AbsoluteUri }
function FolderOf([string]$text) {
  $known = @{ home = ''; desktop = 'Desktop'; documents = 'Documents'; downloads = 'Downloads'; pictures = 'Pictures'; music = 'Music'; videos = 'Videos' }
  $key = Normalize $text
  if ($known.ContainsKey($key)) { return (Join-Path $env:USERPROFILE $known[$key]) }
  $full = $text -replace '^~', $env:USERPROFILE
  if (-not (Test-Path -LiteralPath $full)) { throw "$full does not exist." }; $full
}
function Await-WinRt($operation, [Type]$type) {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($operation)); [void]$task.Wait(-1); $task.Result
}
function Radio([string]$kind) {
  [void][Windows.Devices.Radios.Radio, Windows.System.Devices, ContentType = WindowsRuntime]
  [void](Await-WinRt ([Windows.Devices.Radios.Radio]::RequestAccessAsync()) ([Windows.Devices.Radios.RadioAccessStatus]))
  $radios = Await-WinRt ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])
  $radio = $radios | Where-Object { [string]$_.Kind -eq $kind } | Select-Object -First 1
  if (-not $radio) { throw "This computer has no $kind radio." }
  if ($p.ContainsKey('on')) { $status = Await-WinRt ($radio.SetStateAsync($(if (Yes 'on') { 'On' } else { 'Off' }))) ([Windows.Devices.Radios.RadioAccessStatus]); if ([string]$status -ne 'Allowed') { throw "Windows did not allow it: $status" } }
  @{ kind = $kind; state = [string]$radio.State }
}
function Consent([string]$device) {
  $key = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\$device"
  if (-not (Test-Path $key)) { New-Item $key -Force | Out-Null }
  if ($p.ContainsKey('on')) { Set-ItemProperty $key Value $(if (Yes 'on') { 'Allow' } else { 'Deny' }) }
  @{ access = (Get-ItemProperty $key).Value }
}
# Buttons, links, tabs, fields... in a window (the front one unless window= names part of its title), via UI Automation.
function ScreenItems([int]$limit = 150) {
  Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
  $UIA = [System.Windows.Automation.AutomationElement]; $Scope = [System.Windows.Automation.TreeScope]; $all = [System.Windows.Automation.Condition]::TrueCondition
  $window = $null
  if ($p['window']) { $window = $UIA::FromHandle([IntPtr](FindWindow $p['window']).handle) }
  if (-not $window) { $window = $UIA::FromHandle([ComputerControl.Input]::GetForegroundWindow()) }
  if (-not $window) { throw 'No window is open to look at.' }
  $kinds = 'Button','Hyperlink','MenuItem','ListItem','TabItem','CheckBox','RadioButton','Edit','ComboBox','TreeItem','SplitButton','Slider','DataItem'
  $conditions = [System.Windows.Automation.Condition[]]($kinds | ForEach-Object { New-Object System.Windows.Automation.PropertyCondition ($UIA::ControlTypeProperty), ([System.Windows.Automation.ControlType]::$_) })
  $found = $window.FindAll($Scope::Descendants, (New-Object System.Windows.Automation.OrCondition (,$conditions)))
  $list = New-Object System.Collections.ArrayList
  foreach ($e in $found) {
    if ($list.Count -ge $limit) { break }
    $c = $e.Current; if ($c.IsOffscreen -or -not $c.Name) { continue }
    $r = $c.BoundingRectangle; if ($r.Width -le 0 -or $r.Height -le 0) { continue }
    [void]$list.Add([pscustomobject]@{ name = $c.Name; type = ($c.ControlType.ProgrammaticName -replace 'ControlType\.', ''); x = [int]($r.X + $r.Width / 2); y = [int]($r.Y + $r.Height / 2); enabled = $c.IsEnabled; element = $e })
  }
  @{ window = $window.Current.Name; items = $list }
}
function Press($e) {
  $c = $e.Current; $how = ''
  if ($c.ControlType.ProgrammaticName -eq 'ControlType.Edit') { $e.SetFocus(); $how = 'focus' }
  foreach ($pattern in 'InvokePattern', 'SelectionItemPattern', 'TogglePattern', 'ExpandCollapsePattern') {
    if ($how) { break }
    try { $object = $e.GetCurrentPattern(("System.Windows.Automation.$pattern" -as [type])::Pattern)
      switch ($pattern) { 'InvokePattern' { $object.Invoke() } 'SelectionItemPattern' { $object.Select() } 'TogglePattern' { $object.Toggle() } 'ExpandCollapsePattern' { $object.Expand() } }
      $how = $pattern -replace 'Pattern', '' } catch {}
  }
  if (-not $how) { $r = $c.BoundingRectangle; [ComputerControl.Input]::Click([int]($r.X + $r.Width / 2), [int]($r.Y + $r.Height / 2), 'left', 1); $how = 'click' }
  @{ pressed = $c.Name; how = $how.ToLower() }
}
function Later([scriptblock]$then, $answer) { Out $answer; [Console]::Out.Flush(); Start-Sleep -Milliseconds 800; & $then; exit 0 }

try {
  switch ($Action.ToLower()) {
    'help' { Out @{ actions = 'open_app name | quit_app name [force] confirm=yes | list_apps | list_windows | focus_window name | show_desktop | open_url url | web_search query | open_folder path | open_settings [page] | volume_status | volume_set level | volume_up [step] | volume_down [step] | mute | unmute | mic_mute | mic_unmute | media key=play_pause|next|previous|stop | speak text | brightness level | dark_mode on | screen_off | screenshot [path] [max_width] | screen_items [window] | click_item name [window] | click x y [button] [count] | move_mouse x y | scroll direction [amount] | drag from_x from_y to_x to_y | type_text text | press_keys keys | clipboard_read | clipboard_write text | camera on | microphone_access on | wifi on | bluetooth on | battery | power_mode mode=efficiency|balanced|performance | lock | sleep | schedule_wake [hours] [minutes] | sleep_and_wake [hours] [minutes] | hibernate confirm=yes | shutdown [minutes] confirm=yes | restart [minutes] confirm=yes | cancel_shutdown | sign_out confirm=yes | system_info | top_processes [limit] | stop_program name confirm=yes | notify message [title] | empty_trash confirm=yes'; settings_pages = ($settingsPages.Keys | Sort-Object) -join ' ' } }

    # Apps, windows, web, folders, Settings
    'open_app' {
      $name = Need 'name'
      $app = BestMatch $name @(Get-StartApps) { param($x) $x.Name }
      if ($app) { Start-Process explorer.exe ('shell:AppsFolder\' + $app.AppID); Out @{ opened = $app.Name } } else { Start-Process $name; Out @{ opened = $name } }
    }
    'quit_app' { NeedConfirm; $open = BestMatch (Need 'name') @(OpenWindows) { param($x) "$($x.app) $($x.title)" }; if (-not $open) { throw "$($p['name']) is not open." }
      if (Yes 'force') { Stop-Process -Id $open.processId -Force } else { [void](Get-Process -Id $open.processId).CloseMainWindow() }; Out @{ closed = $open.app } }
    'list_apps' { Out @(Get-StartApps | ForEach-Object { $_.Name }) }
    'list_windows' { Out @(OpenWindows | Select-Object app, title) }
    'focus_window' { Out @{ focused = (FrontWindow (Need 'name')) } }
    'show_desktop' { (New-Object -ComObject Shell.Application).MinimizeAll(); Out @{ done = $true } }
    'open_url' { $url = UrlOf (Need 'url'); Start-Process $url; Out @{ opened = $url } }
    'web_search' { $q = Need 'query'; Start-Process ('https://www.google.com/search?q=' + [Uri]::EscapeDataString($q)); Out @{ searched = $q } }
    'open_folder' { $target = FolderOf (Need 'path'); Start-Process $target; Out @{ opened = $target } }
    'open_settings' { $page = if ($p['page']) { $p['page'].ToLower() } else { 'home' }; if (-not $settingsPages.ContainsKey($page)) { throw "page must be one of: $(($settingsPages.Keys | Sort-Object) -join ', ')" }; Start-Process $settingsPages[$page]; Out @{ opened = $page } }

    # Sound and media
    'volume_status' { Out (Sound 0 $null $null) }
    'volume_set' { $level = Num 'level' 50 0 100; Out (Sound 0 $level ($level -eq 0)) }
    'volume_up' { $now = Sound 0 $null $null; Out (Sound 0 ([math]::Min(100, $now.level + (Num 'step' 10 1 100))) $false) }
    'volume_down' { $now = Sound 0 $null $null; Out (Sound 0 ([math]::Max(0, $now.level - (Num 'step' 10 1 100))) $null) }
    'mute' { Out (Sound 0 $null $true) }
    'unmute' { Out (Sound 0 $null $false) }
    'mic_mute' { Out (Sound 1 $null $true) }
    'mic_unmute' { Out (Sound 1 $null $false) }
    'media' { $code = @{ play_pause = 0xB3; next = 0xB0; previous = 0xB1; stop = 0xB2 }[(Need 'key')]; if (-not $code) { throw 'key must be play_pause, next, previous or stop.' }; [ComputerControl.Input]::Chord([uint16[]]@($code)); Out @{ pressed = $p['key'] } }
    'speak' { Add-Type -AssemblyName System.Speech; $voice = New-Object System.Speech.Synthesis.SpeechSynthesizer; $voice.Speak([string](Need 'text')); Out @{ spoke = $true } }

    # Screen
    'brightness' { $level = Num 'level' 50 0 100
      try { Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{ Timeout = [uint32]1; Brightness = [byte]$level } | Out-Null }
      catch { throw "Brightness works only on a laptop's built-in screen ($($_.Exception.Message))." }
      Out @{ level = [int](Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | Select-Object -First 1).CurrentBrightness } }
    'dark_mode' { $key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'; $light = [int](-not (Yes 'on')); Set-ItemProperty $key AppsUseLightTheme $light; Set-ItemProperty $key SystemUsesLightTheme $light; Out @{ dark = (Yes 'on') } }
    'screen_off' { Later { [ComputerControl.Input]::MonitorOff() } @{ screenOff = $true } }
    'screenshot' {
      Add-Type -AssemblyName System.Drawing, System.Windows.Forms
      $path = if ($p['path']) { $p['path'] } else { Join-Path $env:TEMP ('screen-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.png') }
      $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
      $full = New-Object System.Drawing.Bitmap $b.Width, $b.Height; $g = [System.Drawing.Graphics]::FromImage($full); $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $full.Size); $g.Dispose()
      $scale = [math]::Min(1, (Num 'max_width' 1568 200 8000) / $b.Width); $w = [int]($b.Width * $scale); $h = [int]($b.Height * $scale)
      $small = New-Object System.Drawing.Bitmap $full, $w, $h
      $format = if ($path -match '\.jpe?g$') { [System.Drawing.Imaging.ImageFormat]::Jpeg } else { [System.Drawing.Imaging.ImageFormat]::Png }
      $small.Save($path, $format); $small.Dispose(); $full.Dispose()
      # To click something seen in the picture: screen x = left + picture x / scale (same for y).
      Out @{ path = $path; width = $w; height = $h; left = $b.Left; top = $b.Top; scale = [math]::Round($scale, 4) } }

    # What is on screen, mouse and keyboard
    'screen_items' { $found = ScreenItems (Num 'limit' 150 1 500); Out @{ window = $found.window; items = @($found.items | Select-Object name, type, x, y, enabled) } }
    'click_item' {
      $found = ScreenItems 500; $name = Need 'name'
      $item = BestMatch $name @($found.items | Where-Object { $_.enabled }) { param($x) $x.name }
      if (-not $item) { throw "Nothing called '$name' in '$($found.window)'. Run screen_items to see what is there." }
      Out ((Press $item.element) + @{ window = $found.window }) }
    'click' { [ComputerControl.Input]::Click((Num 'x' 0 -100000 100000), (Num 'y' 0 -100000 100000), $(if ($p['button']) { $p['button'] } else { 'left' }), (Num 'count' 1 1 3)); Out @{ clicked = @($p['x'], $p['y']) } }
    'move_mouse' { [void][ComputerControl.Input]::SetCursorPos((Num 'x' 0 -100000 100000), (Num 'y' 0 -100000 100000)); Out @{ moved = @($p['x'], $p['y']) } }
    'scroll' { $direction = Need 'direction'; $amount = Num 'amount' 5 1 50; [ComputerControl.Input]::Scroll($(if ($direction -in 'down', 'left') { -$amount } else { $amount }), ($direction -in 'left', 'right')); Out @{ scrolled = $direction } }
    'drag' { [ComputerControl.Input]::Drag((Num 'from_x' 0 -100000 100000), (Num 'from_y' 0 -100000 100000), (Num 'to_x' 0 -100000 100000), (Num 'to_y' 0 -100000 100000)); Out @{ dragged = $true } }
    # window= brings that window to the front first and checks it; without it the keys go to whatever is in front.
    'type_text' { $text = [string](Need 'text'); $into = FrontWindow $p['window']; [ComputerControl.Input]::Type($text); Out @{ typed = $text.Length; into = $into } }
    'press_keys' { $keys = Need 'keys'; $codes = KeyCodes $keys; $into = FrontWindow $p['window']; [ComputerControl.Input]::Chord($codes); Out @{ pressed = $keys; into = $into } }
    'clipboard_read' { Out @{ text = [string](Get-Clipboard -Raw) } }
    'clipboard_write' { Set-Clipboard -Value ([string](Need 'text')); Out @{ copied = $true } }

    # Devices and privacy
    'camera' { Out (Consent 'webcam') }
    'microphone_access' { Out (Consent 'microphone') }
    'wifi' { Out (Radio 'WiFi') }
    'bluetooth' { Out (Radio 'Bluetooth') }

    # Battery and power
    'battery' { Add-Type -AssemblyName System.Windows.Forms; $s = [System.Windows.Forms.SystemInformation]::PowerStatus
      Out @{ hasBattery = ([string]$s.BatteryChargeStatus -notmatch 'NoSystemBattery'); percent = [int]($s.BatteryLifePercent * 100); pluggedIn = ([string]$s.PowerLineStatus -eq 'Online'); minutesLeft = $(if ($s.BatteryLifeRemaining -gt 0) { [int]($s.BatteryLifeRemaining / 60) } else { $null }) } }
    'power_mode' {
      $guid = @{ efficiency = '961cc777-2547-4f9d-8174-7d86181b8a7a'; balanced = '00000000-0000-0000-0000-000000000000'; performance = 'ded574b5-45a0-4f42-8737-46345c09c238' }[(Need 'mode')]
      if (-not $guid) { throw 'mode must be efficiency, balanced or performance.' }
      if (-not ('ComputerControl.Power' -as [type])) { Add-Type -Namespace ComputerControl -Name Power -MemberDefinition '[DllImport("powrprof.dll")] public static extern uint PowerSetActiveOverlayScheme(Guid scheme);' }
      $code = [ComputerControl.Power]::PowerSetActiveOverlayScheme([Guid]$guid); if ($code -ne 0) { throw "Windows refused the power mode ($code)." }; Out @{ mode = $p['mode'] } }
    'lock' { Later { rundll32.exe user32.dll,LockWorkStation } @{ locking = $true } }
    'sleep' { Add-Type -AssemblyName System.Windows.Forms; Later { [void][System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false) } @{ sleeping = $true } }
    { $_ -in 'schedule_wake', 'sleep_and_wake' } {
      $minutes = (Num 'hours' 0 0 72) * 60 + (Num 'minutes' 0 0 59); if ($minutes -lt 1) { throw 'Give hours= and/or minutes= for when to wake up.' }
      $at = (Get-Date).AddMinutes($minutes)
      $settings = New-ScheduledTaskSettingsSet -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
      Register-ScheduledTask -TaskName 'computer-control wake' -Action (New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c exit') -Trigger (New-ScheduledTaskTrigger -Once -At $at) -Settings $settings -Force | Out-Null
      foreach ($kind in '/setacvalueindex', '/setdcvalueindex') { powercfg $kind SCHEME_CURRENT SUB_SLEEP RTCWAKE 1 2>$null | Out-Null }; powercfg /setactive SCHEME_CURRENT 2>$null | Out-Null
      $answer = @{ wakeAt = $at.ToString('yyyy-MM-dd HH:mm'); note = 'Waking needs wake timers, which most laptops support when plugged in.' }
      if ($Action -eq 'sleep_and_wake') { Add-Type -AssemblyName System.Windows.Forms; Later { [void][System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false) } $answer } else { Out $answer } }
    'hibernate' { NeedConfirm; Add-Type -AssemblyName System.Windows.Forms; Later { [void][System.Windows.Forms.Application]::SetSuspendState('Hibernate', $false, $false) } @{ hibernating = $true } }
    'shutdown' { NeedConfirm; $s = (Num 'minutes' 1 0 600) * 60; shutdown.exe /s /t $s /c 'Shutting down (computer-control). Run cancel_shutdown to stop it.'; Out @{ shutdownInSeconds = $s } }
    'restart' { NeedConfirm; $s = (Num 'minutes' 1 0 600) * 60; shutdown.exe /r /t $s /c 'Restarting (computer-control). Run cancel_shutdown to stop it.'; Out @{ restartInSeconds = $s } }
    'cancel_shutdown' { shutdown.exe /a 2>$null; Out @{ cancelled = ($LASTEXITCODE -eq 0) } }
    'sign_out' { NeedConfirm; Later { shutdown.exe /l } @{ signingOut = $true } }

    # System
    'system_info' {
      $os = Get-CimInstance Win32_OperatingSystem; $cpu = (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average
      Out @{ cpuPercent = [int]$cpu; memoryFreeMB = [int]($os.FreePhysicalMemory / 1024); memoryTotalMB = [int]($os.TotalVisibleMemorySize / 1024); upHours = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1)
        disks = @(Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | ForEach-Object { @{ drive = $_.Name; freeGB = [math]::Round($_.Free / 1GB, 1); usedGB = [math]::Round($_.Used / 1GB, 1) } }); windows = $os.Caption } }
    'top_processes' { Out @(Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First (Num 'limit' 10 1 40) | ForEach-Object { @{ name = $_.ProcessName; processId = $_.Id; memoryMB = [int]($_.WorkingSet64 / 1MB); cpuSeconds = [int]$_.CPU } }) }
    'stop_program' { NeedConfirm; $name = (Need 'name') -replace '\.exe$', ''; if ($protected -contains $name.ToLower()) { throw "$name keeps Windows running, so it is not stopped." }
      $found = @(Get-Process -Name $name -ErrorAction Stop); $found | Stop-Process -Force; Out @{ stopped = $found.Count } }
    'notify' {
      [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
      [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
      $xml = New-Object Windows.Data.Xml.Dom.XmlDocument; $xml.LoadXml('<toast><visual><binding template="ToastGeneric"><text></text><text></text></binding></visual></toast>')
      $texts = $xml.GetElementsByTagName('text'); [void]$texts.Item(0).AppendChild($xml.CreateTextNode($(if ($p['title']) { $p['title'] } else { 'Computer' }))); [void]$texts.Item(1).AppendChild($xml.CreateTextNode([string](Need 'message')))
      [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($xml)); Out @{ shown = $true } }
    'empty_trash' { NeedConfirm; Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Out @{ emptied = $true } }
    default { throw "Unknown action '$Action'. Run: computer.ps1 help" }
  }
} catch {
  [Console]::Out.WriteLine((@{ ok = $false; action = $Action; error = $_.Exception.Message } | ConvertTo-Json -Compress))
  exit 1
}

