@echo off
chcp 65001 >nul
title AI Virtual Phone 本地运行服务
echo ======================================================
echo    AI Virtual Phone 本地高速运行服务
echo ======================================================
echo.
echo 电脑本地访问地址: http://localhost:3001
echo 手机访问地址(需与电脑连接同一WiFi): http://192.168.31.188:3001
echo.
echo 提示：
echo 1. 保持此窗口开启即可正常使用；
echo 2. 手机浏览器打开后可直接选择「添加到主屏幕」即可当全屏 App 用。
echo ======================================================
echo.
node scripts/local-next-server.mjs --prod --host 0.0.0.0 --port 3001
pause
