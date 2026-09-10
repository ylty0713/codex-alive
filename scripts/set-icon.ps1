param([Parameter(Mandatory=$true)][string]$Executable,[Parameter(Mandatory=$true)][string]$Icon)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class IconResource {
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern IntPtr BeginUpdateResource(string name, bool delete);
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool UpdateResource(IntPtr h, IntPtr type, IntPtr name, ushort lang, byte[] data, uint size);
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool EndUpdateResource(IntPtr h, bool discard);
}
'@
$rinBytes=[IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Icon))
$rinCount=[BitConverter]::ToUInt16($rinBytes,4)
$rinGroup=New-Object byte[] (6+14*$rinCount)
[Array]::Copy($rinBytes,0,$rinGroup,0,6)
$rinHandle=[IconResource]::BeginUpdateResource((Resolve-Path -LiteralPath $Executable),$false)
if ($rinHandle -eq [IntPtr]::Zero) { throw 'Cannot open executable resources.' }
try {
 for ($rinIndex=0;$rinIndex -lt $rinCount;$rinIndex++) {
  $rinEntry=6+16*$rinIndex
  $rinSize=[BitConverter]::ToUInt32($rinBytes,$rinEntry+8)
  $rinOffset=[BitConverter]::ToUInt32($rinBytes,$rinEntry+12)
  $rinImage=New-Object byte[] $rinSize
  [Array]::Copy($rinBytes,$rinOffset,$rinImage,0,$rinSize)
  if (-not [IconResource]::UpdateResource($rinHandle,[IntPtr]3,[IntPtr]($rinIndex+1),1033,$rinImage,$rinSize)) { throw 'Cannot write icon resource.' }
  [Array]::Copy($rinBytes,$rinEntry,$rinGroup,(6+14*$rinIndex),12)
  [Array]::Copy([BitConverter]::GetBytes([uint16]($rinIndex+1)),0,$rinGroup,(18+14*$rinIndex),2)
 }
 # Electron's application icon group is ID 1, language en-US.
 if (-not [IconResource]::UpdateResource($rinHandle,[IntPtr]14,[IntPtr]1,1033,$rinGroup,$rinGroup.Length)) { throw 'Cannot write icon group.' }
 if (-not [IconResource]::EndUpdateResource($rinHandle,$false)) { throw 'Cannot commit executable icon.' }
 $rinHandle=[IntPtr]::Zero
} finally { if ($rinHandle -ne [IntPtr]::Zero) { [IconResource]::EndUpdateResource($rinHandle,$true) | Out-Null } }
