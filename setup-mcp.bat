@echo off
cd /d "%~dp0"
echo ================================
echo  DevProduct MCP Server Setup
echo ================================
echo.
node setup-mcp.js "%~dp0"
echo.
pause
