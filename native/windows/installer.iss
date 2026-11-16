#define MyAppName "EX-YU Radio"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Aleksandar Aleksovski"

[Setup]
AppId={{B15C4EF8-91B6-486D-815A-6F12CCDB7B39}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\EX-YU Radio
DefaultGroupName=EX-YU Radio
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
OutputDir=..\..\build\release
OutputBaseFilename=EX-YU-Radio-Setup
SetupIconFile=EX-YU-Radio.ico
UninstallDisplayIcon={app}\EX-YU-Radio.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "..\..\build\windows\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "EX-YU-Radio.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\EX-YU Radio"; Filename: "{app}\EXYURadio.exe"
Name: "{autodesktop}\EX-YU Radio"; Filename: "{app}\EXYURadio.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Dodaj EX-YU Radio na radnu površinu"; Flags: unchecked

[Run]
Filename: "{app}\EXYURadio.exe"; Description: "Pokreni EX-YU Radio"; Flags: nowait postinstall skipifsilent
