@echo off
rem Disable RAM Pulse auto-start on Windows boot
powershell -NoProfile -Command "$startup = [Environment]::GetFolderPath('Startup'); $shortcutPath = Join-Path $startup 'RAM Pulse Widget.lnk'; if (Test-Path $shortcutPath) { Remove-Item $shortcutPath -Force; Write-Host 'RAM Pulse auto-start has been disabled.'; } else { Write-Host 'RAM Pulse was not configured to start automatically.'; }"
pause
