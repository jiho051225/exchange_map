@echo off
cd /d "%~dp0"
echo Starting Frankfurt route guide at http://127.0.0.1:8765/
echo Keep this window open while using the site.
python -m http.server 8765 --bind 127.0.0.1 --directory src
echo.
echo Server stopped or could not start.
pause
