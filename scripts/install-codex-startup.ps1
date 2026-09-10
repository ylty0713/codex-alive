param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'
$rinRoot = Split-Path $PSScriptRoot -Parent
$rinData = Join-Path $env:LOCALAPPDATA 'CodexAlive'
$rinLink = Join-Path ([Environment]::GetFolderPath('Startup')) 'Codex Alive.lnk'
$rinStop = Join-Path $rinData 'stop-startup'
New-Item -ItemType Directory -Path $rinData -Force | Out-Null
if ($Uninstall) {
  Set-Content -LiteralPath $rinStop -Value 'stop'
  if (Test-Path -LiteralPath $rinLink) { Remove-Item -LiteralPath $rinLink }
  Write-Output 'Codex companion startup disabled.'
  exit
}
if (Test-Path -LiteralPath $rinStop) { Remove-Item -LiteralPath $rinStop }
$rinVbs = Join-Path $rinData 'start.vbs'
$rinScript = Join-Path $PSScriptRoot 'codex-startup.ps1'
$rinCommand = 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $rinScript + '"'
Set-Content -LiteralPath $rinVbs -Encoding Unicode -Value ('CreateObject("WScript.Shell").Run "' + $rinCommand.Replace('"','""') + '", 0, False')
$rinShell = New-Object -ComObject WScript.Shell
$rinShortcut = $rinShell.CreateShortcut($rinLink)
$rinShortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$rinShortcut.Arguments = '"' + $rinVbs + '"'
$rinShortcut.IconLocation = (Join-Path $rinRoot 'desktop\branding\app.ico') + ',0'
$rinShortcut.Description = 'Launch Codex Alive when Codex desktop opens'
$rinShortcut.Save()
Start-Process -FilePath $rinShortcut.TargetPath -ArgumentList ('"' + $rinVbs + '"') -WindowStyle Hidden
Write-Output 'Codex companion startup enabled (current user).'
