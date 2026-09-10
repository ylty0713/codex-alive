param([switch]$Once)
$ErrorActionPreference = 'Stop'
$rinRoot = Split-Path $PSScriptRoot -Parent
$rinStop = Join-Path $env:LOCALAPPDATA 'CodexAlive\stop-startup'
$rinMutex = [Threading.Mutex]::new($false, 'Local\CodexAliveStartup')
if (-not $rinMutex.WaitOne(0)) { $rinMutex.Dispose(); exit }
function Test-CodexDesktop {
  # The desktop app is packaged as ChatGPT.exe; the codex.exe CLI is not a desktop launch.
  foreach ($rinProcess in @(Get-Process -Name ChatGPT,Codex -ErrorAction SilentlyContinue)) {
    try {
      if ($rinProcess.Path -match '(?i)\\WindowsApps\\OpenAI\.Codex_[^\\]+\\app\\(ChatGPT|Codex)\.exe$') { return $true }
    } catch {}
  }
  return $false
}
function Start-Companion {
  $rinBuild = Get-ChildItem -LiteralPath (Join-Path $rinRoot 'dist') -Directory -Filter 'Companion-v*' |
    Where-Object { $_.Name -match '^Companion-v\d+\.\d+\.\d+$' } |
    Sort-Object { [version]($_.Name -replace '^Companion-v','') } -Descending | Select-Object -First 1
  if (-not $rinBuild) { throw 'Build the app before enabling Codex startup.' }
  $rinExe = Join-Path $rinBuild.FullName 'Rin.exe'
  if (-not (Test-Path -LiteralPath $rinExe)) { throw 'Rin.exe is missing.' }
  Start-Process -FilePath $rinExe -ArgumentList '--wallpaper','--codex-startup' -WindowStyle Hidden
}
try {
  $rinWasRunning = $false
  do {
    if (Test-Path -LiteralPath $rinStop) { break }
    $rinRunning = Test-CodexDesktop
    if ($rinRunning -and -not $rinWasRunning) { Start-Companion }
    $rinWasRunning = $rinRunning
    if ($Once) { break }
    Start-Sleep -Seconds 3
  } while ($true)
} finally { $rinMutex.ReleaseMutex(); $rinMutex.Dispose() }
