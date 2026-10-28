@echo off
title phone-ref
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Double-click phone-ref.exe instead, or install Node from https://nodejs.org
  pause
  exit /b 1
)
node "%~dp0phone-ref.mjs" %*
if errorlevel 1 pause
