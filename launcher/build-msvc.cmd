@echo off
rem =====================================================================
rem  Builds SnakeGame.exe with Visual Studio's compiler, from a plain
rem  command prompt, with nothing to download: it uses the open WebView2
rem  loader in third_party\ (like mingw\build.sh) instead of the NuGet
rem  package the .sln restores. The .exe lands in the game folder.
rem
rem    launcher\build-msvc.cmd
rem =====================================================================
setlocal
cd /d "%~dp0"
where cl >nul 2>nul && goto :ready
set VCVARS=
for /d %%v in ("%ProgramFiles%\Microsoft Visual Studio\*") do for /d %%e in ("%%~v\*") do if exist "%%~e\VC\Auxiliary\Build\vcvars64.bat" set "VCVARS=%%~e\VC\Auxiliary\Build\vcvars64.bat"
if not defined VCVARS (echo Visual Studio with C++ isn't installed. & exit /b 1)
call "%VCVARS%" >nul || exit /b 1
:ready
if not exist build\msvc mkdir build\msvc
set L=third_party\OpenWebView2Loader
rc /nologo /Isrc /fo build\msvc\app.res mingw\app.rc || exit /b 1
cl /nologo /std:c++20 /EHsc /O2 /MT /DUNICODE /D_UNICODE /W3 /I%L%\Include /Isrc ^
   src\main.cpp %L%\Source\WebView2Loader.cpp build\msvc\app.res ^
   /Fobuild\msvc\ /Fe..\SnakeGame.exe ^
   /link /SUBSYSTEM:WINDOWS ole32.lib shell32.lib shlwapi.lib user32.lib gdi32.lib version.lib advapi32.lib uuid.lib oleaut32.lib || exit /b 1
echo Built SnakeGame.exe
