!macro DownloadWhisperFile FILE_NAME
  DetailPrint "Downloading faster-whisper ${FILE_NAME}..."
  nsExec::ExecToLog '"$SYSDIR\curl.exe" -fL --retry 10 --retry-all-errors --retry-delay 2 --progress-bar -C - -o "$R2\${FILE_NAME}" "https://huggingface.co/Systran/faster-whisper-small/resolve/main/${FILE_NAME}"'
  Pop $R0
  StrCmp $R0 "0" +2
  StrCpy $R1 "1"
!macroend

!macro customInstall
  StrCpy $R1 "0"
  StrCpy $R2 "$INSTDIR\resources\app\.cache\faster-whisper-small"
  CreateDirectory "$R2"

  IfFileExists "$R2\model.bin" 0 aeWhisperDownload
  FileOpen $R0 "$R2\model.bin" r
  IfErrors aeWhisperDownload
  FileSeek $R0 0 END $R3
  FileClose $R0
  IntCmp $R3 400000000 aeWhisperDone aeWhisperDownload aeWhisperDone

aeWhisperDownload:
  DetailPrint "Downloading the speech recognition model (about 450 MB)..."
  !insertmacro DownloadWhisperFile "config.json"
  !insertmacro DownloadWhisperFile "tokenizer.json"
  !insertmacro DownloadWhisperFile "vocabulary.txt"
  !insertmacro DownloadWhisperFile "model.bin"
  StrCmp $R1 "0" aeWhisperDone
  MessageBox MB_OK|MB_ICONEXCLAMATION "The speech recognition model could not be downloaded. Connect to the internet and rerun the installer. The app can install, but speech recognition will not work until this model is present."

aeWhisperDone:
!macroend
