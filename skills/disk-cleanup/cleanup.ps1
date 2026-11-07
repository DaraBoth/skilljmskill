<#
.SYNOPSIS
  Scan and reclaim regenerable cache space on the Windows system drive.
.DESCRIPTION
  Scan mode (default) only measures. Clean mode deletes, and even then does
  nothing unless -Execute is passed. Targets are an explicit allowlist; there
  are no wildcards that could reach user data.
.EXAMPLE
  .\cleanup.ps1                                  # scan, report sizes
  .\cleanup.ps1 -Mode Clean                      # dry run, shows what would go
  .\cleanup.ps1 -Mode Clean -Execute             # actually delete safe targets
  .\cleanup.ps1 -Mode Clean -Execute -Only npm-cache,pip-cache
#>
param(
    [ValidateSet('Scan','Clean')] [string]$Mode = 'Scan',
    [switch]$Execute,
    [string[]]$Only,
    [string[]]$Skip,
    [switch]$IncludeAsk
)

$ErrorActionPreference = 'SilentlyContinue'

# Folders that must never be touched. Matched by name against Temp/.cache children.
$Protected = @('claude', 'chrome-devtools-mcp')

function Get-FolderSize {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return 0 }
    $sum = (Get-ChildItem $Path -Recurse -Force -File -ErrorAction SilentlyContinue |
            Measure-Object -Property Length -Sum).Sum
    if ($null -eq $sum) { return 0 }
    return $sum
}

# risk: safe = regenerable, no questions. ask = needs a human decision first.
$Targets = @(
    @{ Id='npm-cache';    Path="$env:LOCALAPPDATA\npm-cache";                    Risk='safe'; Note='npm refetches on next install' }
    @{ Id='pip-cache';    Path="$env:LOCALAPPDATA\pip\Cache";                    Risk='safe'; Note='pip refetches on next install' }
    @{ Id='winupdate';    Path="C:\Windows\SoftwareDistribution\Download";       Risk='safe'; Note='Windows Update re-downloads; some files may be locked without admin' }
    @{ Id='windows-temp'; Path="C:\Windows\Temp";                               Risk='safe'; Note='system temp; locked files are skipped' }
    @{ Id='user-temp';    Path="$env:TEMP";                                     Risk='safe'; Note="user temp; PROTECTED subfolders preserved: $($Protected -join ', ')" }
    @{ Id='puppeteer';    Path="$env:USERPROFILE\.cache\puppeteer";              Risk='safe'; Note='re-downloads Chromium on next browser-automation run' }
    @{ Id='nvidia-extract'; Path="C:\NVIDIA";                                   Risk='safe'; Note='driver installer extraction leftovers' }
    @{ Id='nvidia-extract2'; Path="C:\NVIDIA Corporation";                      Risk='safe'; Note='driver installer extraction leftovers (alternate path)' }
    @{ Id='nvidia-ota';   Path="C:\ProgramData\NVIDIA Corporation\NVIDIA App\UpdateFramework\ota-artifacts"; Risk='safe'; Note='NVIDIA App driver download cache - grows multi-GB per update, regrows on next check' }
    @{ Id='recycle-bin';  Path="__RECYCLEBIN__";                                Risk='safe'; Note='permanently empties the Recycle Bin' }
    @{ Id='windows-old';  Path="C:\Windows.old";                                Risk='ask';  Note='previous Windows install; removal is irreversible' }
)

# Any unrecognised .cache child becomes an 'ask' target rather than being deleted silently.
$known = @('puppeteer') + $Protected
foreach ($d in Get-ChildItem "$env:USERPROFILE\.cache" -Directory -Force -ErrorAction SilentlyContinue) {
    if ($known -notcontains $d.Name) {
        $Targets += @{ Id = ".cache\$($d.Name)"; Path = $d.FullName; Risk = 'ask'; Note = 'unrecognised cache - confirm what owns it before deleting' }
    }
}

if ($Only) { $Targets = $Targets | Where-Object { $Only -contains $_.Id } }
if ($Skip) { $Targets = $Targets | Where-Object { $Skip -notcontains $_.Id } }

$freeBefore = (Get-PSDrive C).Free

Write-Output ""
Write-Output "  MODE: $Mode$(if ($Mode -eq 'Clean' -and -not $Execute) { '  (DRY RUN - pass -Execute to delete)' })"
Write-Output "  C: free before: $([math]::Round($freeBefore/1GB,2)) GB"
Write-Output ""
Write-Output ("  {0,-22} {1,10}  {2,-5} {3}" -f 'TARGET','SIZE','RISK','NOTE')
Write-Output ("  " + ("-" * 100))

$totalSafe = 0; $totalAsk = 0

foreach ($t in $Targets) {
    if ($t.Path -eq '__RECYCLEBIN__') {
        $size = (Get-ChildItem 'C:\$Recycle.Bin' -Recurse -Force -File -ErrorAction SilentlyContinue |
                 Measure-Object -Property Length -Sum).Sum
        if ($null -eq $size) { $size = 0 }
    } else {
        if (-not (Test-Path $t.Path)) { continue }
        $size = Get-FolderSize $t.Path
        # user-temp is measured minus its protected children
        if ($t.Id -eq 'user-temp') {
            foreach ($p in $Protected) {
                $size = $size - (Get-FolderSize (Join-Path $t.Path $p))
            }
        }
    }

    if ($size -le 0) { continue }
    if ($t.Risk -eq 'safe') { $totalSafe += $size } else { $totalAsk += $size }

    Write-Output ("  {0,-22} {1,7:N2} GB  {2,-5} {3}" -f $t.Id, ($size/1GB), $t.Risk, $t.Note)

    if ($Mode -ne 'Clean') { continue }
    if ($t.Risk -eq 'ask' -and -not $IncludeAsk) { continue }
    if (-not $Execute) { continue }

    if ($t.Path -eq '__RECYCLEBIN__') {
        Clear-RecycleBin -DriveLetter C -Force -ErrorAction SilentlyContinue
    }
    elseif ($t.Id -eq 'user-temp' -or $t.Id -eq 'windows-temp') {
        # delete children individually so protected folders survive
        foreach ($child in Get-ChildItem $t.Path -Force -ErrorAction SilentlyContinue) {
            if ($Protected -contains $child.Name) { continue }
            Remove-Item $child.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    else {
        Remove-Item $t.Path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Output ("  " + ("-" * 100))
Write-Output ("  {0,-22} {1,7:N2} GB  reclaimable without asking" -f 'TOTAL (safe)', ($totalSafe/1GB))
if ($totalAsk -gt 0) {
    Write-Output ("  {0,-22} {1,7:N2} GB  needs a decision (use -IncludeAsk once confirmed)" -f 'TOTAL (ask)', ($totalAsk/1GB))
}

if ($Mode -eq 'Clean' -and $Execute) {
    Start-Sleep -Seconds 2
    $freeAfter = (Get-PSDrive C).Free
    Write-Output ""
    Write-Output "  C: free after:  $([math]::Round($freeAfter/1GB,2)) GB"
    Write-Output "  reclaimed:      $([math]::Round(($freeAfter-$freeBefore)/1GB,2)) GB"
}
Write-Output ""
