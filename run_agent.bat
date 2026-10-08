@echo off
title Sara Windows Companion
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3.10 or newer is required. Install Python from python.org, then reopen this file.
  pause
  exit /b 1
)
python -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)"
if errorlevel 1 (
  echo Python 3.10 or newer is required. Update Python, then reopen this file.
  pause
  exit /b 1
)
python "%~dp0windows-agent\agent.py"
if errorlevel 1 pause
