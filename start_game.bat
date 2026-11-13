@echo off
rem Starts a small local web server for Game for Peace and opens it in your browser.
rem Needs Python. Close this window to stop the game server.
cd /d "%~dp0"
start "" "http://localhost:8765/index.html"
python -m http.server 8765
