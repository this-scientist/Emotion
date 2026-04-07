#!/bin/bash
echo "启动 Emotion 应用..."
echo "环境变量:"
echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
echo "VITE_SUPABASE_ANON_KEY=$(echo $VITE_SUPABASE_ANON_KEY | head -c 20)..."
docker-compose up -d
echo "应用已启动，访问 http://localhost:3000"
