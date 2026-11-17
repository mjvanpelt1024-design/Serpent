#!/usr/bin/env bash
# Builds SerpentGame.exe without Visual Studio, using llvm-mingw (https://github.com/mstorsjo/llvm-mingw)
# on Linux or in MSYS2. This is how the SerpentGame.exe that ships with the game was made.
# It uses OpenWebView2Loader (third_party/, ISC license) in place of Microsoft's WebView2 loader.
#
#   PATH=/path/to/llvm-mingw/bin:$PATH ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
L=../third_party/OpenWebView2Loader
mkdir -p obj shim
# Windows headers are case-insensitive; Linux isn't
for h in Windows.h:windows.h ShObjIdl.h:shobjidl.h EventToken.h:eventtoken.h; do
  printf '#include <%s>\n' "${h#*:}" > "shim/${h%%:*}"
done
CXX=x86_64-w64-mingw32-clang++
$CXX -std=c++17 -O2 -c $L/Source/WebView2Loader.cpp -Ishim -o obj/loader.o
$CXX -std=c++17 -O2 -municode -c ../src/main.cpp -Ishim -I$L/Include -I../src -I. -o obj/main.o
x86_64-w64-mingw32-windres -I../src app.rc -O coff -o obj/app.res.o
$CXX -municode -mwindows -static -O2 -s obj/main.o obj/loader.o obj/app.res.o -o ../../SerpentGame.exe \
  -lole32 -lshell32 -lshlwapi -luser32 -lgdi32 -lversion -ladvapi32 -luuid
echo "Built ../../SerpentGame.exe"
