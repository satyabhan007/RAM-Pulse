@echo off
rem Create a desktop shortcut for RAM Pulse Electron Widget
powershell -NoProfile -Command "$desktop = [Environment]::GetFolderPath('Desktop'); $target = 'D:\\DesktopMemoryWidget\\Launch_Electron_Widget.bat'; $shortcutPath = Join-Path $desktop 'RAM Pulse Widget.lnk'; $ws = New-Object -ComObject WScript.Shell; $shortcut = $ws.CreateShortcut($shortcutPath); $shortcut.TargetPath = $target; $shortcut.WorkingDirectory = 'D:\\DesktopMemoryWidget'; $shortcut.WindowStyle = 1; $shortcut.IconLocation = $target + ',0'; $shortcut.Save(); Write-Host 'Shortcut created on Desktop';"
