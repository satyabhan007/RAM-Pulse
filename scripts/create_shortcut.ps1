$wsh = New-Object -ComObject WScript.Shell
$desktop = $wsh.SpecialFolders('Desktop')
$shortcutPath = Join-Path $desktop "RAM Pulse Widget.lnk"

$lnk = $wsh.CreateShortcut($shortcutPath)
$lnk.TargetPath = "d:\DesktopMemoryWidget\Launch_Desktop_Widget.bat"
$lnk.WorkingDirectory = "d:\DesktopMemoryWidget"
$lnk.IconLocation = "C:\Windows\System32\shell32.dll, 238" # Performance monitor icon
$lnk.Save()

Write-Host "Created Desktop Shortcut at: $shortcutPath"
