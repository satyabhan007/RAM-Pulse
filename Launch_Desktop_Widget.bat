@echo off
title RAM PULSE Desktop Widget Launcher
cd /d "%~dp0"
echo ========================================================
echo        RAM PULSE - Live Desktop Memory Widget
echo ========================================================
echo Starting background telemetry engine & Edge App Mode...
node server.js
