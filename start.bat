@echo off
:: 設定終端機顯示 UTF-8 中文，避免亂碼
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 切換到 bat 所在的資料夾，確保路徑正確
cd /d "%~dp0"

echo ===================================================
echo     🚀 智慧校園微觀導航系統 - 一鍵啟動環境
echo ===================================================
echo.

:: 1. 檢測 Python 環境
echo [1/4] 檢測 Python 環境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ [錯誤] 找不到 Python！
    echo 👉 請先前往 https://www.python.org/ 安裝 Python。
    echo 👉 記得在安裝時勾選「Add Python to PATH」！
    echo.
    pause
    exit /b
)
echo ✅ Python 環境正常。

:: 2. 檢測 C++ 編譯器並編譯
echo.
echo [2/4] 檢測 C++ 編譯器 [g++] 並準備編譯...
g++ --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ [錯誤] 找不到 C++ 編譯器！
    echo 👉 請確認你已經安裝了 MinGW [GCC] 並且加入了環境變數。
    echo.
    pause
    exit /b
)

:: 執行編譯 (-O3 代表最高效能優化)
echo ⏳ 正在編譯 C++ 演算法引擎...
g++ main.cpp -o dijkstra.exe -O3
if %errorlevel% neq 0 (
    echo ❌ [錯誤] C++ 編譯失敗！請檢查 main.cpp 是否有語法錯誤。
    echo.
    pause
    exit /b
)
echo ✅ C++ 編譯成功 [dijkstra.exe 已產出]。

:: 3. 安裝後端必要套件
echo.
echo [3/4] 檢查並安裝 Python 後端套件...
pip install -r requirements.txt
echo ✅ 套件準備就緒。

:: 4. 啟動伺服器
echo.
echo [4/4] 準備啟動伺服器...

echo 啟動後端 API (Port 8000)...
start "Backend Server" cmd /k "python -m uvicorn main:app --host 0.0.0.0 --port 8000"

echo 啟動前端網頁 (Port 5500)...
start "Frontend Server" cmd /k "python -m http.server 5500"

echo.
echo ===================================================
echo   🎉 系統已成功啟動！
echo   🌐 兩秒後將自動開啟瀏覽器...
echo   [你可以隨時查看彈出的兩個終端機視窗來監控系統狀態]
echo ===================================================

:: 等待 2 秒確保伺服器啟動，然後自動開啟瀏覽器
timeout /t 2 >nul
start http://localhost:5500

exit