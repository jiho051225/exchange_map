@echo off
cd /d "%~dp0"
echo Starting Frankfurt route guide at http://127.0.0.1:5173/
echo Keep this window open while using the site.
npm.cmd run dev
echo.
echo Server stopped or could not start.
pause
