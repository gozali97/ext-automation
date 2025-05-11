@echo off
echo Memulai server backend Ext-Automation...
echo.

REM Cek apakah Node.js terinstal
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo Node.js tidak ditemukan. Silakan instal Node.js terlebih dahulu.
  echo Download: https://nodejs.org/
  pause
  exit /b 1
)

REM Cek apakah npm terinstal
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo npm tidak ditemukan. Silakan instal Node.js terlebih dahulu.
  echo Download: https://nodejs.org/
  pause
  exit /b 1
)

REM Cek apakah node_modules ada, jika tidak ada maka install dependencies
if not exist node_modules (
  echo Menginstal dependencies...
  call npm install
  if %ERRORLEVEL% neq 0 (
    echo Gagal menginstal dependencies.
    pause
    exit /b 1
  )
)

REM Jalankan server
echo Menjalankan server di http://localhost:3000
echo Tekan Ctrl+C untuk menghentikan server
echo.
node server.js

pause
