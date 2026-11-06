@echo off
setlocal
title Qatar University Academic Simulator
cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
  echo Python was not found. Install Python 3.12 or newer and add it to PATH.
  goto :error
)

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js and npm were not found. Install Node.js before starting the app.
  goto :error
)

python -c "import fastapi, uvicorn, pydantic, numpy, networkx, httpx" >nul 2>&1
if errorlevel 1 (
  echo Backend packages are missing.
  echo Run: python -m pip install -r backend\requirements.txt
  goto :error
)

if not exist "frontend\node_modules" (
  echo Frontend packages are missing.
  echo Run: cd frontend ^&^& npm install
  goto :error
)

echo Building the latest frontend...
pushd frontend
call npm run build
if errorlevel 1 (
  popd
  echo Frontend build failed. Review the error above.
  goto :error
)
popd

echo.
echo Starting Qatar University Academic Simulator...
echo Open http://localhost:8001 after startup completes.
echo Press Ctrl+C to stop the app.
echo.
cd /d "%~dp0backend"
python -m uvicorn main:app --host 127.0.0.1 --port 8001
goto :end

:error
echo.
pause
exit /b 1

:end
endlocal
