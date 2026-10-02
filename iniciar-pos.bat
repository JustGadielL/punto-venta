@echo off
echo Iniciando Sistema POS para Restaurante...
echo.

cd /d "%~dp0"

echo [1/2] Iniciando Servidor Backend (API)...
start "POS Backend" cmd /c "cd backend && npm run dev"

echo [2/2] Iniciando Interfaz Frontend (Vite)...
start "POS Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo Los servidores se estan ejecutando en ventanas separadas.
echo - Backend API corriendo en puerto 4000
echo - Frontend App corriendo en puerto 5173
echo.
echo Puedes cerrar esta ventana.
pause
