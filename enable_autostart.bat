@echo off
rem Enable RAM Pulse auto-start on Windows boot
powershell -NoProfile -Command "$startup = [Environment]::GetFolderPath('Startup'); $target = 'D:\DesktopMemoryWidget\node_modules\electron\dist\electron.exe'; $args = 'D:\DesktopMemoryWidget'; $icon = 'D:\DesktopMemoryWidget\assets\icon.ico'; $shortcutPath = Join-Path $startup 'RAM Pulse Widget.lnk'; $ws = New-Object -ComObject WScript.Shell; $shortcut = $ws.CreateShortcut($shortcutPath); $shortcut.TargetPath = $target; $shortcut.Arguments = $args; $shortcut.WorkingDirectory = 'D:\DesktopMemoryWidget'; $shortcut.IconLocation = $icon + ',0'; $shortcut.Description = 'RAM Pulse - Live Desktop Memory Widget & Optimizer'; $shortcut.Save(); Write-Host 'RAM Pulse is now configured to start automatically with Windows!';"
pause
