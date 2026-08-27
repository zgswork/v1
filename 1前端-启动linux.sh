#!/usr/bin/env bash
# 纯前端静态预览（Pyodide 模式）—— 无需后端依赖，自动找空闲端口并打开浏览器
cd "$(dirname "$0")"

PORT=8080
while lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

echo "纯前端静态预览（Pyodide 模式） http://localhost:$PORT/"

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1

if command -v open >/dev/null 2>&1; then
  open "http://localhost:$PORT/" >/dev/null 2>&1
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:$PORT/" >/dev/null 2>&1
else
  echo "请手动打开 http://localhost:$PORT/"
fi

echo "按 Enter 停止预览..."
read
kill "$SERVER_PID" 2>/dev/null
echo "服务器已停止。"
