; Inno Setup script. Build with installer\build-installer.cmd (it stages the files first).
#ifndef AppVersion
  #define AppVersion "0.0"
#endif

[Setup]
AppId={{6F1D3C52-7B0A-4E8E-9C21-5A3D0B7E4A19}
AppName=Serpent
AppVersion={#AppVersion}
AppPublisher=Serpent
DefaultDirName={autopf}\Serpent
DefaultGroupName=Serpent
UninstallDisplayIcon={app}\SerpentGame.exe
OutputDir=..\dist
OutputBaseFilename=SerpentGame-Setup
SetupIconFile=..\launcher\res\SerpentGame.ico
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
WizardStyle=modern
DisableProgramGroupPage=yes

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked

[Files]
Source: "..\dist\stage\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\Serpent"; Filename: "{app}\SerpentGame.exe"
Name: "{autodesktop}\Serpent"; Filename: "{app}\SerpentGame.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\SerpentGame.exe"; Description: "Play Serpent now"; Flags: nowait postinstall skipifsilent
