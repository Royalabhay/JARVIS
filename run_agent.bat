@echo off
title Sara Windows Companion
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3 is required. Install Python from python.org, then reopen this file.
  pause
  exit /b 1
)
python "%~dp0windows-agent\agent.py"
if errorlevel 1 pause
