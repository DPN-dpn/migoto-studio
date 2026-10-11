; NSIS custom installer & uninstaller hooks for Migoto Studio

!macro NSIS_HOOK_POSTUNINSTALL
  ; If the user checked the "Delete app data" checkbox on the uninstaller screen,
  ; also clean up the custom MigotoStudio data directory (%APPDATA%\MigotoStudio).
  ${If} $DeleteAppDataCheckboxState = 1
    SetShellVarContext current
    RmDir /r "$APPDATA\MigotoStudio"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Tell Windows shell to refresh icon and association cache immediately
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
