cd /downloads/cb2-game; (python3 -m http.server 8765 >/tmp/srv.log 2>&1 &); sleep 1
for v in "$@"; do timeout 60 google-chrome --headless=new --no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --enable-logging=stderr --v=0 --virtual-time-budget=60000 --window-size=1266,585 --screenshot=/tmp/m$v.png --dump-dom "http://localhost:8765/index.html?stage=${STG:--1}&visit=$v" 2>&1 | grep -io "uncaught[^\"]*\|<title>[^<]*" | cut -c1-500 | head -3; done
pkill -f "http.server 8765"
