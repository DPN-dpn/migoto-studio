; NSIS custom installer & uninstaller hooks for Migoto Studio

!macro NSIS_HOOK_POSTUNINSTALL
  ; If the user checked the "Delete app data" checkbox on the uninstaller screen,
  ; also clean up the custom MigotoStudio data directory (%APPDATA%\MigotoStudio).
  ${If} $DeleteAppDataCheckboxState = 1
    SetShellVarContext current
    RmDir /r "$APPDATA\MigotoStudio"
  ${EndIf}

  ; If uninstallation was invoked from the installer's maintenance screen (not an update),
  ; close the hidden installer window so it doesn't pop back up to reinstall.
  ${If} $UpdateMode <> 1
    FindWindow $0 "#32770" "Migoto Studio 설치"
    ${If} $0 != 0
      SendMessage $0 16 0 0 ; WM_CLOSE = 0x0010
    ${EndIf}
    FindWindow $0 "#32770" "Migoto Studio Setup"
    ${If} $0 != 0
      SendMessage $0 16 0 0 ; WM_CLOSE = 0x0010
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  ; Safety guard: If the maintenance page choice was "Uninstall" ($ReinstallPageCheck = 2),
  ; immediately quit the installer without installing any files.
  ${If} $ReinstallPageCheck = 2
    Quit
  ${EndIf}
!macroend
