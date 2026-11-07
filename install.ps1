# SkillJM Skill installer for Windows PowerShell.
#
#   irm https://daraboth.github.io/skilljmskill/install.ps1 | iex
#
# This only downloads the pack to a temporary folder and opens the chooser. You pick the skills,
# your AI tool and where; nothing is installed until you confirm. Options pass through, see --help
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Repo = 'DaraBoth/skilljmskill'

$Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("skilljmskill-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $Tmp | Out-Null
try {
  $Zip = Join-Path $Tmp 'pack.zip'
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -UseBasicParsing "https://codeload.github.com/$Repo/zip/refs/heads/main" -OutFile $Zip
  Expand-Archive -Path $Zip -DestinationPath $Tmp -Force
  $Pkg = Get-ChildItem -Path $Tmp -Directory | Select-Object -First 1 -ExpandProperty FullName

  if (Get-Command node -ErrorAction SilentlyContinue) {
    & node (Join-Path $Pkg 'bin\skilljmskill.mjs') @args
    return
  }
  Write-Host 'The chooser needs Node.js 18 or newer (https://nodejs.org). Nothing was installed.'
  Write-Host 'Skills in this pack:'
  Get-ChildItem (Join-Path $Pkg 'skills') -Directory | ForEach-Object { Write-Host "  $($_.Name)" }
  Write-Host ''
  Write-Host "To add one by hand, copy its folder from https://github.com/$Repo/tree/main/skills into your"
  Write-Host "AI tool's skills folder, for example $HOME\.claude\skills (Claude Code) or $HOME\.agents\skills (Codex)."
}
finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
