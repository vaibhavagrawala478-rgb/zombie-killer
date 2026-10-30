@echo off
rem Double-click to play: starts the local server and opens the game in your browser.
cd /d "%~dp0"
start "" http://localhost:5173
node serve.mjs 5173
