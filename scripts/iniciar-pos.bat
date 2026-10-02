@echo off
chcp 65001 >nul
title SISTEMA POS RESTAURANTE - SERVIDOR LOCAL
color 0A

echo =================================================================
echo        🍽️ SISTEMA POS PARA RESTAURANTE EN RED LOCAL
echo =================================================================
echo.
echo [1/3] Verificando dependencias de Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no está instalado en este equipo.
    echo Por favor instala Node.js desde https://nodejs.org
    pause
    exit /b
)

echo [2/3] Iniciando Servidor Backend (API + WebSockets + Base de Datos SQLite)...
cd /d "%~dp0\..\backend"
start "POS Backend Server" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo [3/3] Iniciando Frontend POS (Accesible para Tablets en LAN)...
cd /d "%~dp0\..\frontend"
start "POS Frontend Server" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo =================================================================
echo    ✅ ¡SISTEMA POS INICIADO CON ÉXITO!
echo.
echo    💻 Pantalla de Caja en esta Laptop:  http://localhost:5173
echo    📱 Para conectar Tablets de meseros:
echo       Escanea el código QR en la pestaña "Config & QR" del POS.
echo =================================================================
echo.

start http://localhost:5173

exit
