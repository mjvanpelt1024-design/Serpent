@echo off
rem =====================================================================
rem  Builds dist\SerpentGame-Setup.exe
rem    1. copies only the files the game needs into dist\stage
rem    2. turns off the developer keys (F12, F5) in the staged launcher.ini
rem    3. runs Inno Setup (winget install JRSoftware.InnoSetup)
rem  Rebuild the launcher first if you changed it: launcher\build-msvc.cmd
rem =====================================================================
setlocal
cd /d "%~dp0\.."
set ISCC=
for %%p in ("%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" "%ProgramFiles%\Inno Setup 6\ISCC.exe") do if exist %%p set "ISCC=%%~p"
if not defined ISCC (echo Inno Setup isn't installed: winget install JRSoftware.InnoSetup & exit /b 1)
if not exist SerpentGame.exe (echo SerpentGame.exe is missing: run launcher\build-msvc.cmd & exit /b 1)

if exist dist\stage rmdir /s /q dist\stage
mkdir dist\stage
for %%d in (assets content mods src styles textures world-launcher) do xcopy /e /i /q /y %%d dist\stage\%%d >nul || exit /b 1
for %%f in (SerpentGame.exe index.html launcher.ini version.txt README.md) do copy /y %%f dist\stage\ >nul || exit /b 1

powershell -NoProfile -Command "$p='dist\stage\launcher.ini'; (Get-Content $p) -replace '^devTools\s*=\s*true','devTools   = false' -replace '^reloadKey\s*=\s*true','reloadKey  = false' | Set-Content $p"

set VER=
for /f "tokens=2 delims=:_" %%a in ('findstr /b "v:" version.txt') do set VER=%%a
for /f "tokens=3 delims=:" %%a in ('findstr /b "v:" version.txt') do set BUILD=%%a
"%ISCC%" /Qp /DAppVersion=%BUILD% installer\SerpentGame.iss || exit /b 1
echo.
echo Built dist\SerpentGame-Setup.exe
