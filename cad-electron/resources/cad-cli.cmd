@echo off
setlocal

set "APP_NAME=CADViewer"
if not "%CAD_APP_NAME%"=="" set "APP_NAME=%CAD_APP_NAME%"

if "%CAD_CLI_INVOKE%"=="" set "CAD_CLI_INVOKE=%~nx0"

if not "%CAD_APP_PATH%"=="" (
  set "APP_PATH=%CAD_APP_PATH%"
) else (
  for %%I in ("%~dp0..") do set "APP_PATH=%%~fI"
)

set "APP_EXE=%APP_PATH%\%APP_NAME%.exe"
set "CLI_JS=%APP_PATH%\resources\cad-tools\dist\cli.js"

if not exist "%APP_EXE%" (
  echo cad-cli: app executable not found at "%APP_EXE%" >&2
  exit /b 1
)

if not exist "%CLI_JS%" (
  echo cad-cli: cli.js not found at "%CLI_JS%" >&2
  exit /b 1
)

set ELECTRON_RUN_AS_NODE=1
"%APP_EXE%" "%CLI_JS%" %*
set EXIT_CODE=%ERRORLEVEL%
endlocal
exit /b %EXIT_CODE%
