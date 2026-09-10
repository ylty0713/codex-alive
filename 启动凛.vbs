Set rinFS = CreateObject("Scripting.FileSystemObject")
Set rinShell = CreateObject("WScript.Shell")
rinRoot = rinFS.GetParentFolderName(WScript.ScriptFullName)
rinExe = rinRoot & "\dist\Companion-v0.4.4\Rin.exe"
If rinFS.FileExists(rinExe) Then
  rinShell.Run Chr(34) & rinExe & Chr(34) & " --wallpaper", 1, False
Else
  MsgBox "Please build the application first: node scripts/package.mjs", 48, "Rin Desktop"
End If
