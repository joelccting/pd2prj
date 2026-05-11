@echo off
chcp 65001 > nul
echo 🚀 正在啟動 CCU Campus Navigation 後端伺服器...

:: 開啟一個新的終端機視窗，並執行 Python 後端
start cmd /k "python -m uvicorn main:app --reload"

echo ⏳ 等待後端伺服器暖機 (2秒)...
timeout /t 2 /nobreak > nul

echo 🌐 正在開啟前端網頁...
:: 直接使用系統預設瀏覽器打開你的 Live Server 網址
start http://127.0.0.1:5500/pd2prj/

echo ✅ 全部啟動完畢！