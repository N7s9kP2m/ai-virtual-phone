@echo off
title Push to N7s9kP2m/ai-virtual-phone
echo ======================================================
echo   正在向您的 GitHub 仓库推送代码...
echo   目标: N7s9kP2m/ai-virtual-phone
echo ======================================================
cd /d d:\float\ai-virtual-phone

echo 正在尝试推送 (使用代理 127.0.0.1:7897)...
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin main

if %errorlevel% neq 0 (
    echo.
    echo 代理推送未成功，正在尝试直连推送...
    git push origin main
)

if %errorlevel% equ 0 (
    echo.
    echo ======================================================
    echo  [成功] 代码已成功推送到您的 GitHub (N7s9kP2m)！
    echo  Netlify 现已自动触发云端构建与部署（预计耗时 1~2 分钟）。
    echo  构建完成后，在手机上刷新小手机页面即可体验流式剧情！
    echo ======================================================
) else (
    echo.
    echo [提示] 如果失败，请检查浏览器是否已通过 N7s9kP2m 账号登录。
)

echo.
pause
