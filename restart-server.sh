#!/bin/bash

echo "🔄 Restarting Node.js server..."

# Kill existing node process
pkill -f "node.*app.js"

echo "⏳ Waiting for process to stop..."
sleep 2

# Start the server again
echo "🚀 Starting server..."
nohup node app.js > server.log 2>&1 &

echo "✅ Server restarted! Check server.log for output"
echo "📝 Process ID: $!"

