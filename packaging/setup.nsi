; 🧰 Windows maintenance wrapper. MSI owns registration, shortcuts and repair.
Unicode true
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"
!ifndef MSI_FILE
  !error "Define MSI_FILE with the tested MSI path"
!endif
!ifndef OUT_FILE
  !define OUT_FILE "OWGuide-1.0.0-x64-setup.exe"
!endif
Name "OWGuide"
Caption "OWGuide Setup"
OutFile "${OUT_FILE}"
RequestExecutionLevel admin
Icon "..\src-tauri\icons\icon.ico"
Var Dialog
Var InstallOption
Var RepairOption
Var RemoveOption
Var DeleteData
Var Operation
Var DeletePersonal
Var Result
Page custom MaintenancePage MaintenanceLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Function MaintenancePage
  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 25u "Choose an action. Repair restores installed files and keeps your personal data."
  Pop $0
  ${NSD_CreateRadioButton} 0 35u 100% 15u "Install OWGuide"
  Pop $InstallOption
  ${NSD_Check} $InstallOption
  ${NSD_CreateRadioButton} 0 60u 100% 15u "Repair OWGuide (must already be installed)"
  Pop $RepairOption
  ${NSD_CreateRadioButton} 0 85u 100% 15u "Uninstall OWGuide"
  Pop $RemoveOption
  ${NSD_CreateCheckbox} 0 115u 100% 25u "Also delete this Windows user's notes and settings after uninstall"
  Pop $DeleteData
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Apply"
  nsDialogs::Show
FunctionEnd
Function MaintenanceLeave
  StrCpy $Operation "install"
  ${NSD_GetState} $RepairOption $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $Operation "repair"
  ${EndIf}
  ${NSD_GetState} $RemoveOption $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $Operation "uninstall"
  ${EndIf}
  ${NSD_GetState} $DeleteData $DeletePersonal
FunctionEnd
Section
  InitPluginsDir
  SetOutPath $PLUGINSDIR
  File /oname=OWGuide.msi "${MSI_FILE}"
  ${If} $Operation == "repair"
    ExecWait '"$SYSDIR\msiexec.exe" /fa "$PLUGINSDIR\OWGuide.msi" /passive /norestart' $Result
  ${ElseIf} $Operation == "uninstall"
    ExecWait '"$SYSDIR\msiexec.exe" /x "$PLUGINSDIR\OWGuide.msi" /passive /norestart' $Result
  ${Else}
    ExecWait '"$SYSDIR\msiexec.exe" /i "$PLUGINSDIR\OWGuide.msi" /passive /norestart' $Result
  ${EndIf}
  ${If} $Result != 0
  ${AndIf} $Result != 3010
    MessageBox MB_OK|MB_ICONSTOP "Windows Installer returned $Result. Your personal data has not been deleted."
    SetErrorLevel $Result
    Abort
  ${EndIf}
  ${If} $Operation == "uninstall"
  ${AndIf} $DeletePersonal == ${BST_CHECKED}
    ; Current user only. Portable folders are deliberately untouched.
    ClearErrors
    RMDir /r "$LOCALAPPDATA\com.owguide.desktop"
    ; Remove legacy app-owned geometry only when deletion was explicitly selected.
    RMDir /r "$APPDATA\com.owguide.desktop"
    IfFileExists "$APPDATA\com.owguide.desktop\." delete_failed
    IfFileExists "$LOCALAPPDATA\com.owguide.desktop\." delete_failed delete_done
    delete_failed:
      MessageBox MB_OK|MB_ICONSTOP "OWGuide was uninstalled, but personal data could not be deleted. Close its windows and check folder permissions before trying again."
      SetErrorLevel 1
      Abort
    delete_done:
  ${EndIf}
  SetErrorLevel $Result
SectionEnd
