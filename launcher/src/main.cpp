// =====================================================================
//  SnakeGame launcher
//
//  A small Windows program that opens its windows with WebView2 (the Edge
//  engine built into Windows 10 and 11). Run with no arguments it shows the
//  saves window (list, New, Play); with "--world <id>" it opens the game on
//  that save. It:
//    - serves the game folder at https://game.snakegame.example/ so the
//      game can read its content files straight from disk
//    - serves the mods folder at https://mods.snakegame.example/
//    - keeps saves (.world files, docs\WORLDS.md) and browser data in %APPDATA%\SnakeGame
//    - handles full screen (F11, Alt+Enter, or the game's own toggle),
//      reload (F5) and developer tools (F12), per launcher.ini
//    - remembers the window's size and position
//
//  Build: open launcher\SnakeGame.sln in Visual Studio 2022 and build
//  Release | x64. SnakeGame.exe lands in the game folder, next to
//  index.html. See docs\LAUNCHER.md.
// =====================================================================

#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0A00   // Windows 10 and up
#endif
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <wrl/client.h>

#include <algorithm>
#include <cwchar>
#include <utility>
#include <cwctype>
#include <cwchar>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <string>

#include "WebView2.h"
#include "resource.h"
#ifdef __MINGW32__
#include "webview2_uuids.h"   // interface ids for __uuidof (see launcher/mingw)
#endif

using Microsoft::WRL::ComPtr;
namespace fs = std::filesystem;

// ---------------------------------------------------------------------
//  Callback<Handler>(lambda): wraps a lambda as a WebView2 event handler.
//  (A tiny COM object whose Invoke calls the lambda. Written out here so
//  the launcher builds with Visual Studio or with MinGW/clang alike.)
// ---------------------------------------------------------------------
template <typename Interface, typename Function, typename Method>
class CallbackObject;

template <typename Interface, typename Function, typename Class, typename... Args>
class CallbackObject<Interface, Function, HRESULT (STDMETHODCALLTYPE Class::*)(Args...)> final : public Interface {
public:
    explicit CallbackObject(Function function) : m_function(std::move(function)) {}
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** object) override {
        if (!object) return E_POINTER;
        // WebView2 asks for the handler's own interface (and IUnknown) before calling it
        if (IsEqualIID(riid, IID_IUnknown) || IsEqualIID(riid, __uuidof(Interface))) {
            *object = static_cast<Interface*>(this);
            AddRef();
            return S_OK;
        }
        *object = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return static_cast<ULONG>(InterlockedIncrement(&m_references)); }
    ULONG STDMETHODCALLTYPE Release() override {
        LONG left = InterlockedDecrement(&m_references);
        if (left == 0) delete this;
        return static_cast<ULONG>(left);
    }
    HRESULT STDMETHODCALLTYPE Invoke(Args... args) override { return m_function(args...); }

private:
    Function m_function;
    LONG m_references = 1;
};

template <typename Interface, typename Function>
static ComPtr<Interface> Callback(Function function) {
    ComPtr<Interface> handler;
    handler.Attach(new CallbackObject<Interface, Function, decltype(&Interface::Invoke)>(std::move(function)));
    return handler;
}

// ---------------------------------------------------------------------
//  Names that must never change once players have saves: WebView2 keeps
//  each site's saved data under its address, so a new host name would
//  start everyone from scratch.
// ---------------------------------------------------------------------
static const wchar_t* kGameHost = L"game.snakegame.example";
static const wchar_t* kModsHost = L"mods.snakegame.example";
static const wchar_t* kGameUrl = L"https://game.snakegame.example/index.html";
static const wchar_t* kLauncherUrl = L"https://game.snakegame.example/world-launcher/index.html";
static const wchar_t* kAppFolder = L"SnakeGame";
static const wchar_t* kWorldsFolder = L"worlds";      // %APPDATA%\SnakeGame\worlds\<id>.world
static const wchar_t* kWindowClass = L"SnakeGameLauncherWindow";
static const wchar_t* kLauncherTitle = L"Snake Saves";
static const int kLauncherWidth = 640;                // the saves window, at 96 DPI
static const int kLauncherHeight = 440;
static const COLORREF kBackground = RGB(10, 28, 22);  // matches the game's loading screen
static const UINT_PTR kQuitTimer = 1;                 // gives the game a moment to write its save on close

// ---------------------------------------------------------------------
//  Settings from launcher.ini (next to SnakeGame.exe)
// ---------------------------------------------------------------------
struct Settings {
    std::wstring title = L"Snake";
    bool devTools = true;
    bool reloadKey = true;
    bool startFullscreen = true;
    int width = 1280;
    int height = 800;
    std::wstring modsFolder = L"documents";  // "documents" or "game"
};

// The launcher has two windows, chosen by the command line:
//   SnakeGame.exe              the saves window (Launcher): list, New, Play
//   SnakeGame.exe --world <id> the game, on one save (Game). Play starts it.
enum class Mode { Launcher, Game };

static HWND g_window = nullptr;
static Settings g_settings;
static Mode g_mode = Mode::Launcher;
static std::wstring g_worldId;          // the save this game is on (Game mode)
static std::wstring g_documentScript;   // what every page sees first: the launcher's settings and, in Game mode, the save
static fs::path g_gameDir, g_dataDir, g_modsDir;
static ComPtr<ICoreWebView2Environment> g_environment;
static ComPtr<ICoreWebView2Controller> g_controller;
static ComPtr<ICoreWebView2> g_webview;
static bool g_fullscreen = false;
static bool g_flushing = false;         // Game mode: asked the game to write its save before closing
static bool g_quitting = false;
static WINDOWPLACEMENT g_placementBeforeFullscreen = { sizeof(WINDOWPLACEMENT) };

// ---------------------------------------------------------------------
//  Small helpers
// ---------------------------------------------------------------------
static fs::path ExeFolder() {
    wchar_t buffer[MAX_PATH * 4];
    DWORD length = GetModuleFileNameW(nullptr, buffer, static_cast<DWORD>(std::size(buffer)));
    return fs::path(std::wstring(buffer, length)).parent_path();
}

static fs::path KnownFolder(REFKNOWNFOLDERID id) {
    PWSTR raw = nullptr;
    fs::path result;
    if (SUCCEEDED(SHGetKnownFolderPath(id, KF_FLAG_CREATE, nullptr, &raw))) result = raw;
    CoTaskMemFree(raw);
    return result;
}

static std::wstring IniString(const fs::path& file, const wchar_t* section, const wchar_t* key, const std::wstring& fallback) {
    wchar_t buffer[512];
    GetPrivateProfileStringW(section, key, fallback.c_str(), buffer, static_cast<DWORD>(std::size(buffer)), file.c_str());
    std::wstring value = buffer;
    // allow "value   ; a note" in the file
    size_t note = value.find_first_of(L";#");
    if (note != std::wstring::npos) value = value.substr(0, note);
    while (!value.empty() && iswspace(value.back())) value.pop_back();
    while (!value.empty() && iswspace(value.front())) value.erase(value.begin());
    return value.empty() ? fallback : value;
}

static bool IniBool(const fs::path& file, const wchar_t* section, const wchar_t* key, bool fallback) {
    std::wstring v = IniString(file, section, key, fallback ? L"true" : L"false");
    return v == L"true" || v == L"1" || v == L"yes" || v == L"on";
}

static int IniInt(const fs::path& file, const wchar_t* section, const wchar_t* key, int fallback) {
    std::wstring v = IniString(file, section, key, std::to_wstring(fallback));
    try { return std::stoi(v); } catch (...) { return fallback; }
}

static void LoadSettings() {
    fs::path ini = g_gameDir / L"launcher.ini";
    g_settings.title = IniString(ini, L"window", L"title", g_settings.title);
    g_settings.width = IniInt(ini, L"window", L"width", g_settings.width);
    g_settings.height = IniInt(ini, L"window", L"height", g_settings.height);
    g_settings.startFullscreen = IniBool(ini, L"window", L"fullscreen", g_settings.startFullscreen);
    g_settings.devTools = IniBool(ini, L"developer", L"devTools", g_settings.devTools);
    g_settings.reloadKey = IniBool(ini, L"developer", L"reloadKey", g_settings.reloadKey);
    g_settings.modsFolder = IniString(ini, L"mods", L"folder", g_settings.modsFolder);
}

// Only web links leave the game. Anything else (file:, ms-settings:, search-ms: ...) would
// ask Windows to open a program, so it's dropped.
static void OpenInBrowser(const std::wstring& url) {
    if (_wcsnicmp(url.c_str(), L"https://", 8) != 0 && _wcsnicmp(url.c_str(), L"http://", 7) != 0) return;
    ShellExecuteW(nullptr, L"open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

static std::wstring Hex(HRESULT value) {
    wchar_t buffer[16];
    swprintf_s(buffer, L"0x%08X", static_cast<unsigned int>(value));
    return buffer;
}

static void Fail(const std::wstring& message) {
    MessageBoxW(g_window, message.c_str(), L"Snake", MB_OK | MB_ICONERROR);
}

// ---------------------------------------------------------------------
//  The mods folder: Documents\SnakeGame\mods by default. On first run it
//  is created with a copy of the game's own mods folder (the example mod
//  and an empty _enabled.dat).
// ---------------------------------------------------------------------
static void PrepareModsFolder() {
    if (g_settings.modsFolder == L"game") {
        g_modsDir = g_gameDir / L"mods";
        return;
    }
    fs::path documents = KnownFolder(FOLDERID_Documents);
    if (documents.empty()) { g_modsDir = g_gameDir / L"mods"; return; }
    g_modsDir = documents / kAppFolder / L"mods";
    std::error_code error;
    if (!fs::exists(g_modsDir, error)) {
        fs::create_directories(g_modsDir, error);
        fs::path starter = g_gameDir / L"mods";
        if (fs::exists(starter, error)) {
            fs::copy(starter, g_modsDir, fs::copy_options::recursive | fs::copy_options::skip_existing, error);
        }
    }
}

// ---------------------------------------------------------------------
//  Window size and position, kept in %APPDATA%\SnakeGame\window.ini
// ---------------------------------------------------------------------
static fs::path WindowStateFile() { return g_dataDir / L"window.ini"; }

static void SaveWindowState() {
    WINDOWPLACEMENT placement = { sizeof(WINDOWPLACEMENT) };
    if (g_fullscreen) placement = g_placementBeforeFullscreen;
    else GetWindowPlacement(g_window, &placement);
    const RECT& r = placement.rcNormalPosition;
    fs::path file = WindowStateFile();
    WritePrivateProfileStringW(L"window", L"left", std::to_wstring(r.left).c_str(), file.c_str());
    WritePrivateProfileStringW(L"window", L"top", std::to_wstring(r.top).c_str(), file.c_str());
    WritePrivateProfileStringW(L"window", L"right", std::to_wstring(r.right).c_str(), file.c_str());
    WritePrivateProfileStringW(L"window", L"bottom", std::to_wstring(r.bottom).c_str(), file.c_str());
    WritePrivateProfileStringW(L"window", L"maximized", placement.showCmd == SW_SHOWMAXIMIZED ? L"1" : L"0", file.c_str());
    WritePrivateProfileStringW(L"window", L"fullscreen", g_fullscreen ? L"1" : L"0", file.c_str());
}

static bool RestoreWindowState(int& showCommand) {
    fs::path file = WindowStateFile();
    if (!fs::exists(file)) return false;
    RECT r;   // (read as text: a window on a monitor to the left has negative coordinates)
    r.left = IniInt(file, L"window", L"left", 0);
    r.top = IniInt(file, L"window", L"top", 0);
    r.right = IniInt(file, L"window", L"right", 0);
    r.bottom = IniInt(file, L"window", L"bottom", 0);
    if (r.right - r.left < 320 || r.bottom - r.top < 240) return false;
    // only if that spot is still on a screen
    if (!MonitorFromRect(&r, MONITOR_DEFAULTTONULL)) return false;
    WINDOWPLACEMENT placement = { sizeof(WINDOWPLACEMENT) };
    placement.rcNormalPosition = r;
    placement.showCmd = IniInt(file, L"window", L"maximized", 0) ? SW_SHOWMAXIMIZED : SW_SHOWNORMAL;
    SetWindowPlacement(g_window, &placement);
    showCommand = placement.showCmd;
    return true;
}

// ---------------------------------------------------------------------
//  Full screen: a borderless window covering the whole monitor
// ---------------------------------------------------------------------
static void SetFullscreen(bool on) {
    if (on == g_fullscreen) return;
    DWORD style = GetWindowLongW(g_window, GWL_STYLE);
    if (on) {
        MONITORINFO monitor = { sizeof(MONITORINFO) };
        if (GetWindowPlacement(g_window, &g_placementBeforeFullscreen) &&
            GetMonitorInfoW(MonitorFromWindow(g_window, MONITOR_DEFAULTTOPRIMARY), &monitor)) {
            SetWindowLongW(g_window, GWL_STYLE, style & ~WS_OVERLAPPEDWINDOW);
            const RECT& m = monitor.rcMonitor;
            SetWindowPos(g_window, HWND_TOP, m.left, m.top, m.right - m.left, m.bottom - m.top,
                         SWP_NOOWNERZORDER | SWP_FRAMECHANGED);
        }
    } else {
        SetWindowLongW(g_window, GWL_STYLE, style | WS_OVERLAPPEDWINDOW);
        SetWindowPlacement(g_window, &g_placementBeforeFullscreen);
        SetWindowPos(g_window, nullptr, 0, 0, 0, 0,
                     SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_FRAMECHANGED);
    }
    g_fullscreen = on;
}

static void ResizeWebView() {
    if (!g_controller) return;
    RECT bounds;
    GetClientRect(g_window, &bounds);
    g_controller->put_Bounds(bounds);
}

// ---------------------------------------------------------------------
//  Worlds: one save per .world file in %APPDATA%\SnakeGame\worlds.
//  The file is JSON (docs\WORLDS.md). The launcher only moves its text:
//  the game and the saves window build and read it.
// ---------------------------------------------------------------------
static fs::path WorldsFolder() { return g_dataDir / kWorldsFolder; }
static fs::path WorldFile(const std::wstring& id) { return WorldsFolder() / (id + L".world"); }

// Save keys are the letters, digits, '-' and '_' only: they become file names
static bool ValidWorldId(const std::wstring& id) {
    if (id.empty() || id.size() > 40) return false;
    for (wchar_t ch : id) {
        bool ok = (ch >= L'a' && ch <= L'z') || (ch >= L'A' && ch <= L'Z') || (ch >= L'0' && ch <= L'9') || ch == L'-' || ch == L'_';
        if (!ok) return false;
    }
    return true;
}

static std::string ToUtf8(const std::wstring& text) {
    if (text.empty()) return {};
    int length = WideCharToMultiByte(CP_UTF8, 0, text.data(), static_cast<int>(text.size()), nullptr, 0, nullptr, nullptr);
    std::string result(length, '\0');
    WideCharToMultiByte(CP_UTF8, 0, text.data(), static_cast<int>(text.size()), &result[0], length, nullptr, nullptr);
    return result;
}

static std::wstring FromUtf8(const std::string& bytes) {
    if (bytes.empty()) return {};
    int length = MultiByteToWideChar(CP_UTF8, 0, bytes.data(), static_cast<int>(bytes.size()), nullptr, 0);
    std::wstring result(length, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, bytes.data(), static_cast<int>(bytes.size()), &result[0], length);
    return result;
}

// A JavaScript string literal holding the text, so it can be passed to JSON.parse
static std::wstring JsStringLiteral(const std::wstring& text) {
    std::wstring out = L"\"";
    for (wchar_t ch : text) {
        switch (ch) {
        case L'\\': out += L"\\\\"; break;
        case L'"': out += L"\\\""; break;
        case L'\n': out += L"\\n"; break;
        case L'\r': out += L"\\r"; break;
        case L'\t': out += L"\\t"; break;
        default:
            if (ch < 0x20 || ch == 0x2028 || ch == 0x2029) {
                wchar_t escaped[8];
                swprintf_s(escaped, L"\\u%04x", static_cast<unsigned int>(ch));
                out += escaped;
            } else {
                out += ch;
            }
        }
    }
    return out + L"\"";
}

// Writes a save's file. The new text goes to a temporary file first, so a crash
// never leaves a half-written save.
static void WriteWorld(const std::wstring& id, const std::wstring& text) {
    std::string bytes = ToUtf8(text);
    fs::path file = WorldFile(id);
    fs::path temp = file;
    temp += L".tmp";
    std::error_code error;
    fs::create_directories(WorldsFolder(), error);
    HANDLE handle = CreateFileW(temp.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (handle == INVALID_HANDLE_VALUE) return;
    DWORD written = 0;
    BOOL ok = WriteFile(handle, bytes.data(), static_cast<DWORD>(bytes.size()), &written, nullptr);
    FlushFileBuffers(handle);
    CloseHandle(handle);
    if (ok && written == bytes.size()) MoveFileExW(temp.c_str(), file.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH);
    else DeleteFileW(temp.c_str());
}

// Page -> launcher: "world:write:<id>:<json>". A game only writes its own save.
static void HandleWorldWrite(const std::wstring& rest) {
    size_t colon = rest.find(L':');
    if (colon == std::wstring::npos) return;
    std::wstring id = rest.substr(0, colon);
    if (!ValidWorldId(id)) return;
    if (g_mode == Mode::Game && id != g_worldId) return;
    std::wstring body = rest.substr(colon + 1);
    if (body.empty() || body[0] != L'{') return;
    WriteWorld(id, body);
}

// Page -> launcher: "worlds:list". Sends each readable file back as "world|<id>|<json>", then "end|".
static void HandleWorldList() {
    if (!g_webview) return;
    std::error_code error;
    fs::path folder = WorldsFolder();
    for (fs::directory_iterator it(folder, error), end; !error && it != end; it.increment(error)) {
        const fs::path& path = it->path();
        if (path.extension().wstring() != L".world") continue;
        std::wstring id = path.stem().wstring();
        if (!ValidWorldId(id)) continue;
        std::ifstream in(path, std::ios::binary);
        std::string bytes((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
        std::wstring message = L"world|" + id + L"|" + FromUtf8(bytes);
        g_webview->PostWebMessageAsString(message.c_str());
    }
    g_webview->PostWebMessageAsString(L"end|");
}

// Page -> launcher: "world:play:<id>". Starts the game on that save, in a window of its own.
static void HandleWorldPlay(const std::wstring& id) {
    if (!ValidWorldId(id) || !fs::exists(WorldFile(id))) return;
    wchar_t buffer[MAX_PATH * 4];
    DWORD length = GetModuleFileNameW(nullptr, buffer, static_cast<DWORD>(std::size(buffer)));
    std::wstring exe(buffer, length);
    std::wstring command = L"\"" + exe + L"\" --world " + id;
    STARTUPINFOW info = { sizeof(STARTUPINFOW) };
    PROCESS_INFORMATION process = {};
    if (CreateProcessW(exe.c_str(), command.data(), nullptr, nullptr, FALSE, 0, nullptr, g_gameDir.c_str(), &info, &process)) {
        CloseHandle(process.hThread);
        CloseHandle(process.hProcess);
    } else {
        Fail(L"The game couldn't be started (error " + Hex(HRESULT_FROM_WIN32(GetLastError())) + L").");
    }
}

// Page -> launcher: "world:delete:<id>". Only the saves window may delete, and never a save that
// is open in a game window (its mutex exists). The file goes to the Recycle Bin, so a save deleted
// by mistake can still be restored from there. Answers "deleted|<id>|ok", "|open" or "|failed".
static void HandleWorldDelete(const std::wstring& id) {
    if (g_mode != Mode::Launcher || !g_webview || !ValidWorldId(id)) return;
    std::wstring answer = L"failed";
    fs::path file = WorldFile(id);
    HANDLE open = OpenMutexW(SYNCHRONIZE, FALSE, (L"SnakeGame.World." + id).c_str());
    if (open) {
        CloseHandle(open);
        answer = L"open";
    } else if (fs::exists(file)) {
        // SHFileOperation wants a list ending in two nulls
        std::wstring from = file.wstring();
        from.push_back(L'\0');
        from.push_back(L'\0');
        SHFILEOPSTRUCTW op = {};
        op.hwnd = g_window;
        op.wFunc = FO_DELETE;
        op.pFrom = from.c_str();
        op.fFlags = FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT;
        if (SHFileOperationW(&op) == 0 && !op.fAnyOperationsAborted && !fs::exists(file)) answer = L"ok";
    } else {
        answer = L"ok";   // already gone
    }
    std::wstring message = L"deleted|" + id + L"|" + answer;
    g_webview->PostWebMessageAsString(message.c_str());
}

// Closing the game window: the game writes its save first (see world-save.js), then the
// window goes. The two-second timer goes anyway, so a game that can't answer never blocks it.
static void FinishQuit() {
    if (g_quitting || !g_window) return;
    g_quitting = true;
    KillTimer(g_window, kQuitTimer);
    if (g_mode == Mode::Game) SaveWindowState();
    DestroyWindow(g_window);
}

// ---------------------------------------------------------------------
//  Messages from the pages (window.chrome.webview.postMessage)
//    "quit"                       close the window
//    "fullscreen:on"  "fullscreen:off"  "fullscreen:toggle"
//    "worlds:list"                 the saves window asks for the saves
//    "world:write:<id>:<json>"     a save is written to its file
//    "world:play:<id>"             the saves window starts the game on a save
//    "world:delete:<id>"           the saves window deletes a save (to the Recycle Bin)
//    "world:flushed"               the game has written its save (see FinishQuit)
// ---------------------------------------------------------------------
static void OnGameMessage(const std::wstring& message) {
    if (message == L"quit") PostMessageW(g_window, WM_CLOSE, 0, 0);
    else if (message == L"fullscreen:on") SetFullscreen(true);
    else if (message == L"fullscreen:off") SetFullscreen(false);
    else if (message == L"fullscreen:toggle") SetFullscreen(!g_fullscreen);
    else if (message == L"worlds:list") HandleWorldList();
    else if (message == L"world:flushed") { if (g_flushing) PostMessageW(g_window, WM_CLOSE, 0, 0); }
    else if (message.rfind(L"world:write:", 0) == 0) HandleWorldWrite(message.substr(12));
    else if (message.rfind(L"world:play:", 0) == 0) HandleWorldPlay(message.substr(11));
    else if (message.rfind(L"world:delete:", 0) == 0) HandleWorldDelete(message.substr(13));
}

static bool IsGameUrl(const std::wstring& url) {
    std::wstring prefix = std::wstring(L"https://") + kGameHost + L"/";
    return url.rfind(prefix, 0) == 0 || url == L"about:blank";
}

// The script every page sees before anything else runs. In Game mode it also hands the game its
// save (window.SNAKE_WORLD): the .world file's text, parsed by the page itself.
static std::wstring DocumentScript(const std::wstring& worldText) {
    std::wstring version = L"1.0.0";
    std::wstring mode = g_mode == Mode::Game ? L"game" : L"launcher";
    std::wstring script = L"window.SNAKE_LAUNCHER = Object.freeze({ launcher: '" + version + L"', mode: '" + mode +
           L"', worldId: '" + g_worldId + L"', modsUrl: 'https://" + std::wstring(kModsHost) +
           L"/', dataFolder: '%APPDATA%\\\\SnakeGame' });";
    if (g_mode == Mode::Game) {
        script += L"try { window.SNAKE_WORLD = JSON.parse(" + JsStringLiteral(worldText) + L"); }"
                  L" catch (e) { window.SNAKE_WORLD_ERROR = String(e); }";
    }
    return script;
}

// ---------------------------------------------------------------------
//  The local file server: https://game.snakegame.example/<path> is the file
//  <game folder>\<path>, and https://mods.snakegame.example/<path> is the
//  file in the mods folder. Nothing outside those two folders is served.
// ---------------------------------------------------------------------
static std::wstring MimeFor(const fs::path& file) {
    std::wstring ext = file.extension().wstring();
    for (auto& ch : ext) ch = static_cast<wchar_t>(towlower(ch));
    if (ext == L".html" || ext == L".htm") return L"text/html; charset=utf-8";
    if (ext == L".js") return L"text/javascript; charset=utf-8";
    if (ext == L".css") return L"text/css; charset=utf-8";
    if (ext == L".json") return L"application/json; charset=utf-8";
    if (ext == L".png") return L"image/png";
    if (ext == L".svg") return L"image/svg+xml";
    if (ext == L".ico") return L"image/x-icon";
    if (ext == L".woff") return L"font/woff";
    if (ext == L".woff2") return L"font/woff2";
    if (ext == L".ttf") return L"font/ttf";
    if (ext == L".ogg") return L"audio/ogg";
    if (ext == L".wav") return L"audio/wav";
    if (ext == L".mp3") return L"audio/mpeg";
    // content files (.txt .dat .upg .skin .theme ...) are all plain text
    return L"text/plain; charset=utf-8";
}

static std::wstring UrlDecode(const std::wstring& text) {
    std::string bytes;
    for (size_t i = 0; i < text.size(); ++i) {
        wchar_t ch = text[i];
        if (ch == L'%' && i + 2 < text.size() && iswxdigit(text[i + 1]) && iswxdigit(text[i + 2])) {
            bytes.push_back(static_cast<char>(std::stoi(std::wstring(text, i + 1, 2), nullptr, 16)));
            i += 2;
        } else if (ch < 0x80) {
            bytes.push_back(static_cast<char>(ch));
        } else {
            // already-decoded wide character: keep it as UTF-8
            char utf8[8];
            int n = WideCharToMultiByte(CP_UTF8, 0, &text[i], 1, utf8, sizeof(utf8), nullptr, nullptr);
            bytes.append(utf8, n > 0 ? n : 0);
        }
    }
    int length = MultiByteToWideChar(CP_UTF8, 0, bytes.data(), static_cast<int>(bytes.size()), nullptr, 0);
    std::wstring result(length, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, bytes.data(), static_cast<int>(bytes.size()), &result[0], length);
    return result;
}

static ComPtr<ICoreWebView2WebResourceResponse> ServeFile(const std::wstring& url) {
    ComPtr<ICoreWebView2WebResourceResponse> response;
    if (!g_environment) return response;
    const std::wstring gamePrefix = std::wstring(L"https://") + kGameHost + L"/";
    const std::wstring modsPrefix = std::wstring(L"https://") + kModsHost + L"/";
    fs::path root;
    std::wstring rest;
    if (url.rfind(gamePrefix, 0) == 0) { root = g_gameDir; rest = url.substr(gamePrefix.size()); }
    else if (url.rfind(modsPrefix, 0) == 0) { root = g_modsDir; rest = url.substr(modsPrefix.size()); }
    else return response;

    size_t cut = rest.find_first_of(L"?#");
    if (cut != std::wstring::npos) rest = rest.substr(0, cut);
    rest = UrlDecode(rest);
    if (rest.empty()) rest = L"index.html";

    const std::wstring headers = L"Access-Control-Allow-Origin: *\r\nCache-Control: no-store";
    fs::path file = (root / fs::path(rest)).lexically_normal();
    // never step outside the folder (no "..")
    // Compare against the folder *with* its trailing separator, so a neighbouring folder whose
    // name merely starts the same way (SnakeGame-old, mods-backup) is never treated as inside
    std::wstring rootText = root.lexically_normal().wstring(), fileText = file.wstring();
    if (!rootText.empty() && rootText.back() != L'\\' && rootText.back() != L'/') rootText += L'\\';
    bool inside = fileText.size() > rootText.size() && _wcsnicmp(fileText.c_str(), rootText.c_str(), rootText.size()) == 0;
    std::error_code error;
    if (inside && fs::is_regular_file(file, error)) {
        ComPtr<IStream> stream;
        if (SUCCEEDED(SHCreateStreamOnFileEx(file.c_str(), STGM_READ | STGM_SHARE_DENY_NONE, FILE_ATTRIBUTE_NORMAL, FALSE, nullptr, &stream))) {
            std::wstring all = L"Content-Type: " + MimeFor(file) + L"\r\n" + headers;
            g_environment->CreateWebResourceResponse(stream.Get(), 200, L"OK", all.c_str(), &response);
            return response;
        }
    }
    std::wstring all = L"Content-Type: text/plain\r\n" + headers;
    g_environment->CreateWebResourceResponse(nullptr, 404, L"Not Found", all.c_str(), &response);
    return response;
}

// ---------------------------------------------------------------------
//  Setting up WebView2
// ---------------------------------------------------------------------
static HRESULT OnControllerCreated(HRESULT result, ICoreWebView2Controller* controller) {
    if (FAILED(result) || !controller) {
        Fail(L"The game view couldn't be created (error " + Hex(result) + L").");
        PostMessageW(g_window, WM_CLOSE, 0, 0);
        return S_OK;
    }
    g_controller = controller;
    g_controller->get_CoreWebView2(&g_webview);

#ifdef __ICoreWebView2Controller2_INTERFACE_DEFINED__
    // No white flash while the page loads (needs a WebView2 SDK newer than 1.0.774)
    ComPtr<ICoreWebView2Controller2> controller2;
    if (SUCCEEDED(g_controller.As(&controller2))) {
        COREWEBVIEW2_COLOR color = { 255, GetRValue(kBackground), GetGValue(kBackground), GetBValue(kBackground) };
        controller2->put_DefaultBackgroundColor(color);
    }
#endif

    ComPtr<ICoreWebView2Settings> settings;
    g_webview->get_Settings(&settings);
    settings->put_AreDevToolsEnabled(g_settings.devTools);
    settings->put_AreDefaultContextMenusEnabled(g_settings.devTools);
    settings->put_IsStatusBarEnabled(FALSE);
    settings->put_IsZoomControlEnabled(FALSE);
    settings->put_IsBuiltInErrorPageEnabled(TRUE);
    EventRegistrationToken token;

    // The game folder and the mods folder, served as two local web addresses
    g_webview->AddWebResourceRequestedFilter((std::wstring(L"https://") + kGameHost + L"/*").c_str(), COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL);
    g_webview->AddWebResourceRequestedFilter((std::wstring(L"https://") + kModsHost + L"/*").c_str(), COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL);
    g_webview->add_WebResourceRequested(
        Callback<ICoreWebView2WebResourceRequestedEventHandler>(
            [](ICoreWebView2*, ICoreWebView2WebResourceRequestedEventArgs* args) -> HRESULT {
                ComPtr<ICoreWebView2WebResourceRequest> request;
                args->get_Request(&request);
                LPWSTR uri = nullptr;
                if (!request || FAILED(request->get_Uri(&uri)) || !uri) return S_OK;
                std::wstring url = uri;
                CoTaskMemFree(uri);
                ComPtr<ICoreWebView2WebResourceResponse> response = ServeFile(url);
                if (response) args->put_Response(response.Get());
                return S_OK;
            }).Get(),
        &token);


    // Messages from the game
    g_webview->add_WebMessageReceived(
        Callback<ICoreWebView2WebMessageReceivedEventHandler>(
            [](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
                LPWSTR message = nullptr;
                if (SUCCEEDED(args->TryGetWebMessageAsString(&message)) && message) {
                    OnGameMessage(message);
                    CoTaskMemFree(message);
                }
                return S_OK;
            }).Get(),
        &token);

    // The game's own full screen button (the Fullscreen API) fills the monitor
    g_webview->add_ContainsFullScreenElementChanged(
        Callback<ICoreWebView2ContainsFullScreenElementChangedEventHandler>(
            [](ICoreWebView2* sender, IUnknown*) -> HRESULT {
                BOOL inside = FALSE;
                sender->get_ContainsFullScreenElement(&inside);
                SetFullscreen(inside != FALSE);
                return S_OK;
            }).Get(),
        &token);

    // window.close() from the game's Quit button
    g_webview->add_WindowCloseRequested(
        Callback<ICoreWebView2WindowCloseRequestedEventHandler>(
            [](ICoreWebView2*, IUnknown*) -> HRESULT {
                PostMessageW(g_window, WM_CLOSE, 0, 0);
                return S_OK;
            }).Get(),
        &token);

    // Links to anywhere else open in the player's browser
    g_webview->add_NavigationStarting(
        Callback<ICoreWebView2NavigationStartingEventHandler>(
            [](ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT {
                LPWSTR uri = nullptr;
                if (SUCCEEDED(args->get_Uri(&uri)) && uri) {
                    std::wstring url = uri;
                    CoTaskMemFree(uri);
                    if (!IsGameUrl(url)) {
                        args->put_Cancel(TRUE);
                        OpenInBrowser(url);
                    }
                }
                return S_OK;
            }).Get(),
        &token);
    g_webview->add_NewWindowRequested(
        Callback<ICoreWebView2NewWindowRequestedEventHandler>(
            [](ICoreWebView2*, ICoreWebView2NewWindowRequestedEventArgs* args) -> HRESULT {
                LPWSTR uri = nullptr;
                if (SUCCEEDED(args->get_Uri(&uri)) && uri) {
                    OpenInBrowser(uri);
                    CoTaskMemFree(uri);
                }
                args->put_Handled(TRUE);
                return S_OK;
            }).Get(),
        &token);

    // If the page's process crashes, start it again; if WebView2 itself goes, say so
    g_webview->add_ProcessFailed(
        Callback<ICoreWebView2ProcessFailedEventHandler>(
            [](ICoreWebView2* sender, ICoreWebView2ProcessFailedEventArgs* args) -> HRESULT {
                COREWEBVIEW2_PROCESS_FAILED_KIND kind;
                args->get_ProcessFailedKind(&kind);
                if (kind == COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED) {
                    Fail(L"The game's view stopped unexpectedly. Your progress up to the last save is safe. Please start the game again.");
                    PostMessageW(g_window, WM_CLOSE, 0, 0);
                } else if (kind == COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED ||
                           kind == COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE) {
                    sender->Reload();
                }
                return S_OK;
            }).Get(),
        &token);

    // Launcher keys: F11 / Alt+Enter full screen, F5 reload, F12 developer tools
    g_controller->add_AcceleratorKeyPressed(
        Callback<ICoreWebView2AcceleratorKeyPressedEventHandler>(
            [](ICoreWebView2Controller*, ICoreWebView2AcceleratorKeyPressedEventArgs* args) -> HRESULT {
                COREWEBVIEW2_KEY_EVENT_KIND kind;
                args->get_KeyEventKind(&kind);
                if (kind != COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN && kind != COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN) return S_OK;
                UINT key = 0;
                args->get_VirtualKey(&key);
                bool alt = (GetKeyState(VK_MENU) & 0x8000) != 0;
                if (key == VK_F11 || (alt && key == VK_RETURN)) {
                    SetFullscreen(!g_fullscreen);
                    args->put_Handled(TRUE);
                } else if (key == VK_F5 && g_settings.reloadKey) {
                    // Forget cached scripts and styles first, so every edited file is read fresh
                    g_webview->CallDevToolsProtocolMethod(
                        L"Network.clearBrowserCache", L"{}",
                        Callback<ICoreWebView2CallDevToolsProtocolMethodCompletedHandler>(
                            [](HRESULT, LPCWSTR) -> HRESULT {
                                if (g_webview) g_webview->Reload();
                                return S_OK;
                            }).Get());
                    args->put_Handled(TRUE);
                } else if (key == VK_F12 && g_settings.devTools) {
                    g_webview->OpenDevToolsWindow();
                    args->put_Handled(TRUE);
                }
                return S_OK;
            }).Get(),
        &token);

    ResizeWebView();
    g_controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);

    // Tell the page where it's running, then open it: the saves window, or the game on its save
    g_webview->AddScriptToExecuteOnDocumentCreated(
        g_documentScript.c_str(),
        Callback<ICoreWebView2AddScriptToExecuteOnDocumentCreatedCompletedHandler>(
            [](HRESULT, LPCWSTR) -> HRESULT {
                g_webview->Navigate(g_mode == Mode::Game ? kGameUrl : kLauncherUrl);
                return S_OK;
            }).Get());
    return S_OK;
}

static HRESULT OnEnvironmentCreated(HRESULT result, ICoreWebView2Environment* environment) {
    if (FAILED(result) || !environment) {
        if (result == HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND)) {
            int choice = MessageBoxW(g_window,
                L"Snake needs the Microsoft Edge WebView2 Runtime, which comes with Windows 11 and most Windows 10 PCs.\n\n"
                L"It isn't installed on this PC. Open the download page now?",
                L"Snake", MB_YESNO | MB_ICONINFORMATION);
            if (choice == IDYES) OpenInBrowser(L"https://go.microsoft.com/fwlink/p/?LinkId=2124703");
        } else {
            Fail(L"WebView2 couldn't start (error " + Hex(result) + L").");
        }
        PostMessageW(g_window, WM_CLOSE, 0, 0);
        return S_OK;
    }
    g_environment = environment;
    return environment->CreateCoreWebView2Controller(
        g_window, Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                      [](HRESULT r, ICoreWebView2Controller* c) -> HRESULT { return OnControllerCreated(r, c); }).Get());
}

// ---------------------------------------------------------------------
//  The window
// ---------------------------------------------------------------------
static LRESULT CALLBACK WindowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) {
    switch (message) {
    case WM_SIZE:
        ResizeWebView();
        return 0;
    case WM_MOVE:
    case WM_MOVING:
        if (g_controller) g_controller->NotifyParentWindowPositionChanged();
        return 0;
    case WM_DPICHANGED: {
        const RECT* suggested = reinterpret_cast<const RECT*>(lParam);
        SetWindowPos(hwnd, nullptr, suggested->left, suggested->top, suggested->right - suggested->left,
                     suggested->bottom - suggested->top, SWP_NOZORDER | SWP_NOACTIVATE);
        return 0;
    }
    case WM_GETMINMAXINFO: {
        MINMAXINFO* info = reinterpret_cast<MINMAXINFO*>(lParam);
        info->ptMinTrackSize = { 480, 400 };
        return 0;
    }
    case WM_ACTIVATE:
        if (LOWORD(wParam) != WA_INACTIVE && g_controller) g_controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
        return 0;
    case WM_CLOSE:
        // A game first writes its save; the page answers with "world:flushed" (see OnGameMessage)
        if (g_mode == Mode::Game && g_webview && !g_flushing && !g_quitting) {
            g_flushing = true;
            SetTimer(hwnd, kQuitTimer, 2000, nullptr);
            g_webview->ExecuteScript(
                L"if (window.__worldFlush) window.__worldFlush(); else window.chrome.webview.postMessage('world:flushed');",
                Callback<ICoreWebView2ExecuteScriptCompletedHandler>(
                    [](HRESULT, LPCWSTR) -> HRESULT { return S_OK; }).Get());
            return 0;
        }
        FinishQuit();
        return 0;
    case WM_TIMER:
        if (wParam == kQuitTimer) FinishQuit();
        return 0;
    case WM_DESTROY:
        if (g_controller) g_controller->Close();
        g_webview = nullptr;
        g_controller = nullptr;
        g_environment = nullptr;
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(hwnd, message, wParam, lParam);
}

int APIENTRY wWinMain(_In_ HINSTANCE instance, _In_opt_ HINSTANCE, _In_ LPWSTR, _In_ int showCommand) {
    // --world <id>: the game, on that save. No argument: the saves window.
    int argc = 0;
    LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    for (int i = 1; argv && i + 1 < argc; ++i) {
        if (wcscmp(argv[i], L"--world") == 0) { g_mode = Mode::Game; g_worldId = argv[i + 1]; }
    }
    if (argv) LocalFree(argv);
    if (g_mode == Mode::Game && !ValidWorldId(g_worldId)) {
        MessageBoxW(nullptr, L"That save can't be opened: its name isn't valid.", L"Snake", MB_OK | MB_ICONERROR);
        return 1;
    }

    // One copy of the saves window at a time (a second launch brings it forward), and one
    // game window per save (two windows writing one save would overwrite each other)
    std::wstring mutexName = (g_mode == Mode::Game) ? (L"SnakeGame.World." + g_worldId)
                                                    : std::wstring(L"SnakeGame.Launcher.SingleInstance");
    HANDLE single = CreateMutexW(nullptr, TRUE, mutexName.c_str());
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        if (g_mode == Mode::Launcher) {
            HWND existing = FindWindowW(kWindowClass, kLauncherTitle);
            if (existing) {
                ShowWindow(existing, IsIconic(existing) ? SW_RESTORE : SW_SHOW);
                SetForegroundWindow(existing);
            }
        } else {
            MessageBoxW(nullptr, L"This save is already open in another game window.", L"Snake", MB_OK | MB_ICONINFORMATION);
        }
        return 0;
    }

    // The game folder is the one holding index.html: normally the .exe's own folder.
    // (A Debug build runs from launcher\build\Debug, so look a few folders up too.)
    g_gameDir = ExeFolder();
    fs::path probe = g_gameDir;
    for (int up = 0; up < 4; ++up) {
        if (fs::exists(probe / L"index.html") && fs::exists(probe / L"content")) { g_gameDir = probe; break; }
        if (probe.parent_path() == probe) break;
        probe = probe.parent_path();
    }
    if (!fs::exists(g_gameDir / L"index.html")) {
        MessageBoxW(nullptr, (L"SnakeGame.exe has to sit in the game folder, next to index.html.\n\nIt is in:\n" + g_gameDir.wstring()).c_str(),
                    L"Snake", MB_OK | MB_ICONERROR);
        return 1;
    }
    LoadSettings();

    fs::path appData = KnownFolder(FOLDERID_RoamingAppData);
    g_dataDir = (appData.empty() ? g_gameDir / L"userdata" : appData / kAppFolder);
    std::error_code error;
    fs::create_directories(g_dataDir, error);
    PrepareModsFolder();
    fs::create_directories(WorldsFolder(), error);

    // The game's save, read here and handed to the game as its first script (see DocumentScript)
    std::wstring worldText;
    if (g_mode == Mode::Game) {
        std::ifstream in(WorldFile(g_worldId), std::ios::binary);
        if (!in) {
            MessageBoxW(nullptr, L"That save can't be found. It may have been moved or deleted.\n\nOpen Snake Saves to choose another.",
                        L"Snake", MB_OK | MB_ICONERROR);
            return 1;
        }
        std::string bytes((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
        worldText = FromUtf8(bytes);
    }
    g_documentScript = DocumentScript(worldText);

    HRESULT com = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    if (FAILED(com)) { Fail(L"Windows couldn't start the game's view (COM)."); return 1; }

    WNDCLASSEXW windowClass = { sizeof(WNDCLASSEXW) };
    windowClass.style = CS_HREDRAW | CS_VREDRAW;
    windowClass.lpfnWndProc = WindowProc;
    windowClass.hInstance = instance;
    windowClass.hIcon = LoadIconW(instance, MAKEINTRESOURCEW(IDI_APPICON));
    windowClass.hIconSm = static_cast<HICON>(LoadImageW(instance, MAKEINTRESOURCEW(IDI_APPICON), IMAGE_ICON,
                                                         GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), 0));
    windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    windowClass.hbrBackground = CreateSolidBrush(kBackground);
    windowClass.lpszClassName = kWindowClass;
    RegisterClassExW(&windowClass);

    // Centered at the size in launcher.ini (the game) or the saves window's size, scaled for the screen's DPI
    UINT dpi = GetDpiForSystem();
    bool game = g_mode == Mode::Game;
    int width = MulDiv(game ? g_settings.width : kLauncherWidth, dpi, 96);
    int height = MulDiv(game ? g_settings.height : kLauncherHeight, dpi, 96);
    RECT work;
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &work, 0);
    width = std::min(width, static_cast<int>(work.right - work.left));
    height = std::min(height, static_cast<int>(work.bottom - work.top));
    int x = work.left + ((work.right - work.left) - width) / 2;
    int y = work.top + ((work.bottom - work.top) - height) / 2;

    g_window = CreateWindowExW(0, kWindowClass, game ? g_settings.title.c_str() : kLauncherTitle, WS_OVERLAPPEDWINDOW,
                               x, y, width, height, nullptr, nullptr, instance, nullptr);
    if (!g_window) { Fail(L"The window couldn't be created."); return 1; }

    // The game remembers its window's place and full screen; the saves window opens centered
    int show = showCommand;
    if (game) RestoreWindowState(show);
    ShowWindow(g_window, show);
    UpdateWindow(g_window);
    if (game && (g_settings.startFullscreen || IniInt(WindowStateFile(), L"window", L"fullscreen", 0))) SetFullscreen(true);

    fs::path browserData = g_dataDir / L"WebView2";
    HRESULT created = CreateCoreWebView2EnvironmentWithOptions(
        nullptr, browserData.c_str(), nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [](HRESULT r, ICoreWebView2Environment* e) -> HRESULT { return OnEnvironmentCreated(r, e); }).Get());
    if (FAILED(created)) OnEnvironmentCreated(created, nullptr);

    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
    CoUninitialize();
    if (single) { ReleaseMutex(single); CloseHandle(single); }
    return static_cast<int>(msg.wParam);
}
