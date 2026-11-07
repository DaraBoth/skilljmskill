# SkillJM Skill installer for Windows PowerShell.
#
#   irm https://daraboth.github.io/skilljmskill/install.ps1 | iex                      every skill
#   & ([scriptblock]::Create((irm https://daraboth.github.io/skilljmskill/install.ps1))) debugging devops
#   & ([scriptblock]::Create((irm https://daraboth.github.io/skilljmskill/install.ps1))) -List
#
# Installs into $env:CLAUDE_CONFIG_DIR\skills if that is set, otherwise $HOME\.claude\skills.
# A skill folder that already exists is moved to skills\.skilljmskill-backup\<time>\ first,
# so running it again updates the pack and never loses your own edits.
param(
  [switch]$List,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Skills
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Repo = 'DaraBoth/skilljmskill'
$Branch = 'main'
$Base = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$Dest = Join-Path $Base 'skills'

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

  $All = Get-ChildItem -Path $Src -Directory | Select-Object -ExpandProperty Name
  if ($List) {
    Write-Host 'Available skills:'
    $All | ForEach-Object { Write-Host "  $_" }
    return
  }
  $Want = if ($Skills -and $Skills.Count -gt 0) { $Skills } else { $All }

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
  Write-Host 'Restart Claude Code, then type / to see them.'
}
finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
