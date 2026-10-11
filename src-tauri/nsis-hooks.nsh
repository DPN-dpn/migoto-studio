; NSIS custom installer & uninstaller hooks for Migoto Studio

!macro NSIS_HOOK_PREUNINSTALL
  ; Check if the AppData folder (%APPDATA%\MigotoStudio) exists
  IfFileExists "$APPDATA\MigotoStudio\*.*" 0 skip_appdata_cleanup
    StrCmp $LANGUAGE "1042" is_korean is_english

    is_korean:
      MessageBox MB_YESNO|MB_ICONQUESTION \
        "Migoto Studio의 사용자 설정 및 백업 데이터($APPDATA\MigotoStudio)도 함께 삭제하시겠습니까?$\r$\n$\r$\n- [예]: 모든 설정과 자동 백업 파일을 완전히 삭제합니다.$\r$\n- [아니오]: 이전 설정을 보존하여 다음 설치 시 그대로 유지합니다." \
        IDNO skip_appdata_cleanup
      RMDir /r "$APPDATA\MigotoStudio"
      Goto skip_appdata_cleanup

    is_english:
      MessageBox MB_YESNO|MB_ICONQUESTION \
        "Do you want to delete Migoto Studio settings and backup data ($APPDATA\MigotoStudio) as well?$\r$\n$\r$\n- [Yes]: Completely delete all settings and safety backup files.$\r$\n- [No]: Keep settings and backups for future use." \
        IDNO skip_appdata_cleanup
      RMDir /r "$APPDATA\MigotoStudio"

    skip_appdata_cleanup:
!macroend
