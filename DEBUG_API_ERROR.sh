#!/bin/bash
# Diagnostic script to debug the 500 error on /api/quiz-question

echo "🔍 Diagnosing iNaturaQuizz Backend Issues..."
echo ""

# Kill any existing processes
echo "1️⃣  Stopping existing processes..."
killall node npm 2>/dev/null
sleep 2

# Check environment variables
echo ""
echo "2️⃣  Checking environment variables..."
if [ -f "server/.env" ]; then
  echo "✅ server/.env exists"
  echo "   Keys present:"
  grep -E "^[A-Z_]+=" server/.env | cut -d= -f1 | sort
else
  echo "❌ server/.env NOT FOUND"
  echo "   Creating from .env.example..."
  if [ -f "server/.env.example" ]; then
    cp server/.env.example server/.env
    echo "   Created server/.env from .env.example"
  fi
fi

echo ""
echo "3️⃣  Starting server with verbose logging..."
echo "   Server will be on http://localhost:3001"
echo "   Client will be on http://localhost:5173"
echo ""
echo "------- SERVER OUTPUT -------"

# Start server and capture output
cd /Users/ryelandt/Documents/Inaturamouche

# Start both servers
echo "Starting backend (port 3001)..."
npm run dev > /tmp/server-debug.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

echo "Waiting 5 seconds for server to start..."
sleep 5

echo ""
echo "------- TESTING API ENDPOINT -------"
echo ""
echo "Making test request to /api/quiz-question..."
curl -s -w "\nStatus: %{http_code}\n" \
  "http://localhost:3001/api/quiz-question?locale=fr&media_type=images&game_mode=easy&pack_id=belgium_birds" \
  | head -100

echo ""
echo ""
echo "------- SERVER LOGS (LAST 50 LINES) -------"
sleep 2
tail -50 /tmp/server-debug.log

echo ""
echo "------- INSTRUCTIONS -------"
echo ""
echo "The complete server log is saved in: /tmp/server-debug.log"
echo ""
echo "Common issues:"
echo "  1. Missing INAT API environment variables"
echo "  2. Network error connecting to api.inaturalist.org"
echo "  3. Port 3001 already in use"
echo "  4. Invalid pack_id or configuration"
echo ""
echo "Server is still running in background (PID: $SERVER_PID)"
echo "Kill it with: kill $SERVER_PID"
echo ""
echo "Full command:"
echo "  npm run dev                  # Terminal 1: Backend on :3001"
echo "  npm --prefix client run dev  # Terminal 2: Frontend on :5173"
