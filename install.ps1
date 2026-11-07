# SkillJM Skill installer for Windows PowerShell.
#
#   irm https://daraboth.github.io/skilljmskill/install.ps1 | iex
#       asks you: which skills (shows the list with a recommendation) and where (you or this project)
#
#   & ([scriptblock]::Create((irm https://daraboth.github.io/skilljmskill/install.ps1))) [options] [skill ...]
#       -List          show every skill with a short description, install nothing
#       -All           every skill
#       -Recommended   the recommended skills for the current folder
#       -User          install for you, in every project:  ~\.claude\skills  (default)
#       -Project       install for this project only:      .\.claude\skills
#       -Yes           do not ask anything (use with the options above)
#
# A skill folder that already exists is moved to skills\.skilljmskill-backup\<time>\ first,
# so running it again updates the skills and never loses your own edits.
param(
  [switch]$List, [switch]$All, [switch]$Recommended, [switch]$User, [switch]$Project, [switch]$Yes,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Skills
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Repo = 'DaraBoth/skilljmskill'
$Branch = 'main'
$Starter = @('debugging', 'ai-usage', 'prompt-templates', 'cmd', 'devops', 'system-design', 'learning')
$Here = (Get-Location).Path
$Ask = -not ($Yes -or $List -or $All -or $Recommended -or ($Skills -and $Skills.Count)) -and -not [Console]::IsInputRedirected

$Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("skilljmskill-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $Tmp | Out-Null
try {
  Write-Host "Downloading $Repo ..."
  $Zip = Join-Path $Tmp 'pack.zip'
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -UseBasicParsing "https://codeload.github.com/$Repo/zip/refs/heads/$Branch" -OutFile $Zip
  Expand-Archive -Path $Zip -DestinationPath $Tmp -Force
  $Src = Get-ChildItem -Path $Tmp -Directory | ForEach-Object { Join-Path $_.FullName 'skills' } | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $Src) { throw 'Download looks wrong: no skills folder' }
  $AllNames = @(Get-ChildItem -Path $Src -Directory | Sort-Object Name | Select-Object -ExpandProperty Name)

  function Get-Desc($Name) {
    $line = Get-Content -Encoding UTF8 (Join-Path $Src "$Name\SKILL.md") | Where-Object { $_ -match '^description:' } | Select-Object -First 1
    $d = ($line -replace '^description:\s*', '') -replace '"', ''
    $d = ($d -split '(?<=[.!?])\s')[0]
    if ($d.Length -gt 80) { $d = $d.Substring(0, 80) }
    $d
  }

  # Recommend from what is in the current folder, plus a starter set everyone can use.
  $Rec = [System.Collections.Generic.List[string]]::new()
  $Starter | ForEach-Object { $Rec.Add($_) }
  $pkg = Join-Path $Here 'package.json'
  if (Test-Path $pkg) {
    'javascript', 'frontend-design', 'ui-design-principles' | ForEach-Object { $Rec.Add($_) }
    $p = Get-Content -Raw $pkg
    if ($p -match '"three"') { '3d-web-experience', 'threejs-fundamentals', 'threejs-performance' | ForEach-Object { $Rec.Add($_) } }
    if ($p -match '"@react-three/fiber"') { $Rec.Add('threejs-react-three-fiber') }
  }
  if ((Test-Path (Join-Path $Here 'pom.xml')) -or (Test-Path (Join-Path $Here 'build.gradle')) -or (Test-Path (Join-Path $Here 'build.gradle.kts'))) { $Rec.Add('java') }
  if (Test-Path (Join-Path $Here '.git')) { 'project-system-map', 'code-explainer-page' | ForEach-Object { $Rec.Add($_) } }
  $Rec = @($Rec | Select-Object -Unique | Where-Object { $AllNames -contains $_ })

  function Show-List {
    for ($i = 0; $i -lt $AllNames.Count; $i++) {
      $n = $AllNames[$i]
      $mark = if ($Rec -contains $n) { '*' } else { ' ' }
      $line = '{0,3} {1} {2,-26} {3}' -f ($i + 1), $mark, $n, (Get-Desc $n)
      if ($mark -eq '*') { Write-Host $line -ForegroundColor Cyan } else { Write-Host $line }
    }
    Write-Host ''
    Write-Host "  * = recommended for you, from what is in $Here"
  }

  if ($List) { Show-List; return }

  # Which skills
  if ($Skills -and $Skills.Count) { $Want = $Skills }
  elseif ($All) { $Want = $AllNames }
  elseif ($Recommended -or -not $Ask) { $Want = $Rec }
  else {
    Write-Host ''
    Show-List
    Write-Host ''
    Write-Host 'Which skills?  Enter = recommended (*)   a = all   or numbers, for example: 1 4 7'
    $r = (Read-Host '>').Trim()
    if ($r -eq '') { $Want = $Rec }
    elseif ($r -in 'a', 'A', 'all') { $Want = $AllNames }
    else {
      $Want = @()
      foreach ($k in ($r -split '[\s,]+')) {
        $num = 0
        if ([int]::TryParse($k, [ref]$num) -and $num -ge 1 -and $num -le $AllNames.Count) { $Want += $AllNames[$num - 1] }
        elseif ($k) { Write-Host "  skip  $k (not a number in the list)" }
      }
    }
  }
  if (-not $Want -or $Want.Count -eq 0) { Write-Host 'Nothing picked, nothing installed.'; return }

  # Where
  $UserDir = Join-Path $(if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }) 'skills'
  $ProjectDir = Join-Path $Here '.claude\skills'
  if (-not $User -and -not $Project -and $Ask) {
    Write-Host ''
    Write-Host 'Install where?'
    Write-Host "  1  For me, in every project   $UserDir   (Enter)"
    Write-Host "  2  Only this project          $ProjectDir"
    $Project = ((Read-Host '>').Trim() -eq '2')
  }
  $Dest = if ($Project) { $ProjectDir } else { $UserDir }

  New-Item -ItemType Directory -Force $Dest | Out-Null
  $Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $Backup = Join-Path $Dest ".skilljmskill-backup\$Stamp"
  $N = 0
  foreach ($Name in $Want) {
    $From = Join-Path $Src $Name
    if (-not (Test-Path $From -PathType Container)) { Write-Host "  skip  $Name (no such skill, run with -List)"; continue }
    $To = Join-Path $Dest $Name
    if (Test-Path $To) {
      New-Item -ItemType Directory -Force $Backup | Out-Null
      Move-Item -Path $To -Destination (Join-Path $Backup $Name)
    }
    Copy-Item -Recurse -Path $From -Destination $To
    Write-Host "  ok    $Name"
    $N++
  }
  Write-Host ''
  Write-Host "Installed $N skill(s) into $Dest"
  if (Test-Path $Backup) { Write-Host "Older copies were moved to $Backup" }
  if ($Project) { Write-Host 'Commit .claude\skills to share them with your team.' }
  Write-Host 'Restart Claude Code, then type / to see them.'
}
finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
